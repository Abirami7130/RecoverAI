import { describe, it, expect, beforeEach } from 'vitest';
import {
  bindFakeGateway,
  resetTestCaseState,
} from './helpers/integration';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import { runDueAttempts } from '@/lib/recovery/worker';
import { prisma } from '@/lib/db';
import { setPredictTransactionForTests } from '@/lib/recovery/python-client';
import { smartRetryMlFixture } from './helpers/ml-fixtures';
import {
  nextFakePaymentId,
  seedFakePayment,
} from '@/lib/payments/fake-razorpay-gateway';

describe('recovery worker', () => {
  beforeEach(async () => {
    await resetTestCaseState();
    setPredictTransactionForTests(async () => smartRetryMlFixture());
  });

  it('does not claim attempts before scheduledFor', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });

    const future = new Date(Date.now() - 60_000);
    const result = await runDueAttempts(future);
    expect(result.claimed).toBe(0);

    const attempt = await prisma.recoveryAttempt.findFirst();
    expect(attempt?.status).toBe('pending');
  });

  it('creates a recovery order when due', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });

    const result = await runDueAttempts(new Date(Date.now() + 60_000));
    expect(result.claimed).toBe(1);
    expect(result.awaitingPayment).toBe(1);

    const attempt = await prisma.recoveryAttempt.findFirst();
    expect(attempt?.status).toBe('awaiting_payment');
    expect(attempt?.razorpayOrderId).toMatch(/^order_fake_/);

    const recoveryCase = await prisma.recoveryCase.findFirst();
    expect(recoveryCase?.status).toBe('awaiting_payment');
    expect(recoveryCase?.verifiedRecoveredPaise).toBe(0);
  });

  it('skips attempt when origin payment already captured', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });

    const gateway = bindFakeGateway();
    const payId = nextFakePaymentId(gateway);
    seedFakePayment(gateway, {
      id: payId,
      order_id: order.order_id,
      status: 'captured',
      amount: 49900,
      currency: 'INR',
    });

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: order.order_id },
    });
    await prisma.payment.update({
      where: { id: payment!.id },
      data: { razorpayPaymentId: payId, status: 'captured', capturedAt: new Date() },
    });

    const result = await runDueAttempts(new Date(Date.now() + 60_000));
    expect(result.skipped).toBeGreaterThan(0);
    expect(gateway.state.createOrderCalls).toBe(0);
  });
});
