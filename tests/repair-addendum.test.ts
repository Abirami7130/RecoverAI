import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  bindFakeGateway,
  resetTestCaseState,
} from './helpers/integration';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import { processRazorpayWebhook } from '@/lib/recovery/process-webhook';
import { runDueAttempts } from '@/lib/recovery/worker';
import { prisma } from '@/lib/db';
import { setPredictTransactionForTests } from '@/lib/recovery/python-client';
import { smartRetryMlFixture } from './helpers/ml-fixtures';
import {
  nextFakePaymentId,
  seedFakePayment,
} from '@/lib/payments/fake-razorpay-gateway';
import { setRazorpayGatewayForTests } from '@/lib/payments/razorpay-gateway';
import { createFakeRazorpayGateway } from '@/lib/payments/fake-razorpay-gateway';
import { POST as verifyPost } from '@/app/api/payment/verify/route';
import { POST as webhookPost } from '@/app/api/webhooks/razorpay/route';

function checkoutSignature(orderId: string, paymentId: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET ?? 'test_secret';
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

describe('Phase 2 repair addendum', () => {
  beforeEach(async () => {
    await resetTestCaseState();
    setPredictTransactionForTests(async () => smartRetryMlFixture());
  });

  it('T1: concurrent failure ingestion creates one case', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const results = await Promise.all([
      ingestFailure({
        razorpayOrderId: order.order_id,
        amountInr: 499,
        source: 'browser',
      }),
      ingestFailure({
        razorpayOrderId: order.order_id,
        amountInr: 499,
        source: 'webhook',
        rawEventId: 'evt_concurrent_a',
      }),
      ingestFailure({
        razorpayOrderId: order.order_id,
        amountInr: 499,
        source: 'webhook',
        rawEventId: 'evt_concurrent_b',
      }),
    ]);

    const caseCount = await prisma.recoveryCase.count();
    expect(caseCount).toBe(1);
    const caseIds = new Set(results.map((r) => r.caseId).filter(Boolean));
    expect(caseIds.size).toBe(1);
    expect(results.some((r) => r.duplicate)).toBe(true);
  });

  it('T2: recovery payment failure does not open a new case', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const ingest = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });
    const caseId = ingest.caseId!;

    await runDueAttempts(new Date(Date.now() + 60_000));
    const attempt = await prisma.recoveryAttempt.findFirst({ where: { caseId } });
    expect(attempt?.razorpayOrderId).toBeTruthy();

    const recoveryOrderId = attempt!.razorpayOrderId!;
    const beforeCount = await prisma.recoveryCase.count();

    const failed = await ingestFailure({
      razorpayOrderId: recoveryOrderId,
      amountInr: 499,
      source: 'webhook',
      rawEventId: 'evt_recovery_failed',
    });

    expect(await prisma.recoveryCase.count()).toBe(beforeCount);
    expect(failed.caseId).toBe(caseId);
    expect(failed.duplicate).toBe(false);

    const updatedAttempt = await prisma.recoveryAttempt.findUnique({
      where: { id: attempt!.id },
    });
    expect(updatedAttempt?.status).toBe('failed');
    expect(updatedAttempt?.blockReason).toBe('RECOVERY_PAYMENT_FAILED');
  });

  it('T3: concurrent create-order with same idempotency key', async () => {
    const gateway = bindFakeGateway();
    const [a, b] = await Promise.all([
      createDemoOrder({ amountInr: 499, idempotencyKey: 'repair-idem-1' }),
      createDemoOrder({ amountInr: 499, idempotencyKey: 'repair-idem-1' }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.order_id).toBe(b.order_id);
    expect(gateway.state.createOrderCalls).toBe(1);
    expect(await prisma.payment.count()).toBe(1);
  });

  it('T4: gateway createOrder failure rolls back payment row', async () => {
    const gateway = createFakeRazorpayGateway(process.env.RAZORPAY_WEBHOOK_SECRET);
    const originalCreate = gateway.createOrder.bind(gateway);
    gateway.createOrder = async () => {
      throw new Error('GatewayDown');
    };
    setRazorpayGatewayForTests(gateway);

    await expect(createDemoOrder({ amountInr: 499 })).rejects.toThrow('GatewayDown');
    expect(await prisma.payment.count()).toBe(0);

    gateway.createOrder = originalCreate;
  });

  it('T5: verify route recovers case when recovery payment is captured', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });

    await runDueAttempts(new Date(Date.now() + 60_000));
    const attempt = await prisma.recoveryAttempt.findFirst();
    const recoveryPayment = await prisma.payment.findFirst({
      where: { razorpayOrderId: attempt!.razorpayOrderId! },
    });

    const gateway = bindFakeGateway();
    const payId = nextFakePaymentId(gateway);
    seedFakePayment(gateway, {
      id: payId,
      order_id: recoveryPayment!.razorpayOrderId,
      status: 'captured',
      amount: 49900,
      currency: 'INR',
    });

    await prisma.payment.update({
      where: { id: recoveryPayment!.id },
      data: { razorpayPaymentId: payId },
    });

    const sig = checkoutSignature(recoveryPayment!.razorpayOrderId, payId);
    const req = new NextRequest('http://localhost/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: recoveryPayment!.razorpayOrderId,
        razorpay_payment_id: payId,
        razorpay_signature: sig,
      }),
    });
    const res = await verifyPost(req);
    expect(res.status).toBe(200);

    const recoveryCase = await prisma.recoveryCase.findFirst();
    expect(recoveryCase?.status).toBe('recovered');
    expect(recoveryCase?.verifiedRecoveredPaise).toBe(49900);
  });

  it('T6: verify route captures payment without opening a case', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const gateway = bindFakeGateway();
    const payId = nextFakePaymentId(gateway);
    seedFakePayment(gateway, {
      id: payId,
      order_id: order.order_id,
      status: 'captured',
      amount: 49900,
      currency: 'INR',
    });

    await prisma.payment.update({
      where: { razorpayOrderId: order.order_id },
      data: { razorpayPaymentId: payId },
    });

    const sig = checkoutSignature(order.order_id, payId);
    const req = new NextRequest('http://localhost/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: order.order_id,
        razorpay_payment_id: payId,
        razorpay_signature: sig,
      }),
    });
    const res = await verifyPost(req);
    expect(res.status).toBe(200);
    expect(await prisma.recoveryCase.count()).toBe(0);

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: order.order_id },
    });
    expect(payment?.status).toBe('captured');
  });

  it('T7: webhook route rejects invalid signature without side effects', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const fixture = {
      id: 'evt_bad_sig',
      event: 'payment.failed',
      created_at: Math.floor(Date.now() / 1000),
      payload: {
        payment: {
          entity: {
            order_id: order.order_id,
            amount: 49900,
            id: 'pay_x',
          },
        },
      },
    };
    const raw = JSON.stringify(fixture);
    const req = new NextRequest('http://localhost/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Razorpay-Signature': 'deadbeef',
      },
      body: raw,
    });
    const res = await webhookPost(req);
    expect(res.status).toBe(400);
    expect(await prisma.recoveryCase.count()).toBe(0);
    expect(await prisma.webhookEvent.count()).toBe(0);
  });

  it('T8: captured webhook skips pending attempts', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const failedFixture = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'tests/fixtures/razorpay-payment-failed.json'),
        'utf8'
      )
    );
    failedFixture.created_at = Math.floor(Date.now() / 1000);
    failedFixture.payload.payment.entity.order_id = order.order_id;
    await processRazorpayWebhook(JSON.stringify(failedFixture), failedFixture);

    const pending = await prisma.recoveryAttempt.findFirst({
      where: { status: 'pending' },
    });
    expect(pending).toBeTruthy();

    const gateway = bindFakeGateway();
    const payId = nextFakePaymentId(gateway);
    gateway.state.payments.set(payId, {
      id: payId,
      order_id: order.order_id,
      status: 'captured',
      amount: 49900,
      currency: 'INR',
    });

    const capturedFixture = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'tests/fixtures/razorpay-payment-captured.json'),
        'utf8'
      )
    );
    capturedFixture.created_at = Math.floor(Date.now() / 1000);
    capturedFixture.payload.payment.entity.order_id = order.order_id;
    capturedFixture.payload.payment.entity.id = payId;

    await processRazorpayWebhook(JSON.stringify(capturedFixture), capturedFixture);

    const attempt = await prisma.recoveryAttempt.findUnique({
      where: { id: pending!.id },
    });
    expect(attempt?.status).toBe('skipped');
    expect(attempt?.blockReason).toBe('ALREADY_CAPTURED');
  });

  it('T9: concurrent worker ticks double-claim one attempt', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });

    const gateway = bindFakeGateway();
    const now = new Date(Date.now() + 60_000);
    const [a, b] = await Promise.all([runDueAttempts(now), runDueAttempts(now)]);
    expect(a.claimed + b.claimed).toBeGreaterThanOrEqual(1);
    expect(gateway.state.createOrderCalls).toBe(1);
  });

  it('T10: blocks fourth execution when maxAttempts is 3', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const ingest = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });
    const decision = await prisma.recoveryDecisionRecord.findFirst({
      where: { caseId: ingest.caseId! },
    });

    await prisma.recoveryAttempt.updateMany({
      where: { caseId: ingest.caseId! },
      data: { status: 'failed', finishedAt: new Date() },
    });

    for (let i = 0; i < 3; i++) {
      await prisma.recoveryAttempt.create({
        data: {
          caseId: ingest.caseId!,
          decisionId: decision!.id,
          idempotencyKey: `repair:cap:${i}`,
          status: 'failed',
          scheduledFor: new Date(),
          finishedAt: new Date(),
        },
      });
    }

    await prisma.recoveryAttempt.create({
      data: {
        caseId: ingest.caseId!,
        decisionId: decision!.id,
        idempotencyKey: 'repair:cap:fourth',
        status: 'pending',
        scheduledFor: new Date(Date.now() - 1000),
      },
    });

    const result = await runDueAttempts(new Date());
    expect(result.blocked).toBe(1);
  });

  it('T11: awaiting_payment timeout marks attempt failed', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });

    await runDueAttempts(new Date(Date.now() + 60_000));
    const attempt = await prisma.recoveryAttempt.findFirst();
    const stale = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await prisma.recoveryAttempt.update({
      where: { id: attempt!.id },
      data: { status: 'awaiting_payment', updatedAt: stale },
    });

    await runDueAttempts(new Date());
    const updated = await prisma.recoveryAttempt.findUnique({
      where: { id: attempt!.id },
    });
    expect(updated?.status).toBe('failed');
    expect(updated?.blockReason).toBe('AWAITING_TIMEOUT');
  });
});
