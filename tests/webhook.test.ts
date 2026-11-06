import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  bindFakeGateway,
  resetTestCaseState,
} from './helpers/integration';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { processRazorpayWebhook } from '@/lib/recovery/process-webhook';
import { prisma } from '@/lib/db';
import { setPredictTransactionForTests } from '@/lib/recovery/python-client';
import { smartRetryMlFixture } from './helpers/ml-fixtures';

function signBody(body: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('razorpay webhook', () => {
  beforeEach(async () => {
    await resetTestCaseState();
    setPredictTransactionForTests(async () => smartRetryMlFixture());
  });

  it('creates one case for payment.failed', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'tests/fixtures/razorpay-payment-failed.json'),
        'utf8'
      )
    );
    fixture.created_at = Math.floor(Date.now() / 1000);
    fixture.payload.payment.entity.order_id = order.order_id;

    const raw = JSON.stringify(fixture);
    const result = await processRazorpayWebhook(raw, fixture);
    expect(result.duplicate).toBe(false);
    expect(result.caseId).toBeTruthy();

    const caseCount = await prisma.recoveryCase.count();
    expect(caseCount).toBe(1);
  });

  it('returns duplicate on identical webhook delivery', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), 'tests/fixtures/razorpay-payment-failed.json'),
        'utf8'
      )
    );
    fixture.created_at = Math.floor(Date.now() / 1000);
    fixture.payload.payment.entity.order_id = order.order_id;

    const raw = JSON.stringify(fixture);
    await processRazorpayWebhook(raw, fixture);
    const second = await processRazorpayWebhook(raw, fixture);
    expect(second.duplicate).toBe(true);

    const caseCount = await prisma.recoveryCase.count();
    expect(caseCount).toBe(1);
  });

  it('recovers case on payment.captured after failure', async () => {
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

    const gateway = bindFakeGateway();
    const payId = 'pay_test_captured_001';
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

    const recoveryCase = await prisma.recoveryCase.findFirst({
      where: { amountPaise: 49900 },
    });
    expect(recoveryCase?.status).toBe('recovered');
    expect(recoveryCase?.verifiedRecoveredPaise).toBe(49900);
  });
});

describe('webhook signature route guard', () => {
  it('rejects bad signatures at the gateway layer', () => {
    const gateway = bindFakeGateway();
    const body = '{"id":"evt_x","event":"payment.failed"}';
    expect(
      gateway.verifyWebhookSignature({
        rawBody: body,
        signature: 'deadbeef',
      })
    ).toBe(false);
  });
});
