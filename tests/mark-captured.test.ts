import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  bindFakeGateway,
  resetTestCaseState,
} from './helpers/integration';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { prisma } from '@/lib/db';
import {
  nextFakePaymentId,
  seedFakePayment,
} from '@/lib/payments/fake-razorpay-gateway';
import { markCaptured } from '@/lib/recovery/mark-captured';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import { setPredictTransactionForTests } from '@/lib/recovery/python-client';
import { smartRetryMlFixture } from './helpers/ml-fixtures';

describe('markCaptured', () => {
  beforeEach(async () => {
    await resetTestCaseState();
    setPredictTransactionForTests(async () => smartRetryMlFixture());
  });

  it('recovers a case when origin payment is captured with matching amount', async () => {
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
      data: { razorpayPaymentId: payId },
    });

    const result = await markCaptured(payment!.id);
    expect(result.updated).toBe(true);

    const recoveryCase = await prisma.recoveryCase.findFirst({
      where: { originPaymentId: payment!.id },
    });
    expect(recoveryCase?.status).toBe('recovered');
    expect(recoveryCase?.verifiedRecoveredPaise).toBe(49900);
  });

  it('does not capture when remote amount mismatches', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const gateway = bindFakeGateway();
    const payId = nextFakePaymentId(gateway);
    seedFakePayment(gateway, {
      id: payId,
      order_id: order.order_id,
      status: 'captured',
      amount: 100,
      currency: 'INR',
    });

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: order.order_id },
    });
    await prisma.payment.update({
      where: { id: payment!.id },
      data: { razorpayPaymentId: payId },
    });

    const result = await markCaptured(payment!.id);
    expect(result.updated).toBe(false);
    expect(result.reason).toBe('AMOUNT_MISMATCH');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'AMOUNT_MISMATCH' },
    });
    expect(audit).toBeTruthy();
  });
});
