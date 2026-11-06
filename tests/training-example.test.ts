import { describe, it, expect, beforeEach } from 'vitest';
import {
  bindFakeGateway,
  resetTestCaseState,
} from './helpers/integration';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import { runDueAttempts } from '@/lib/recovery/worker';
import { markCaptured } from '@/lib/recovery/mark-captured';
import { handleRecoveryPaymentFailure } from '@/lib/recovery/handle-recovery-payment-failure';
import { prisma } from '@/lib/db';
import { setPredictTransactionForTests } from '@/lib/recovery/python-client';
import { smartRetryMlFixture } from './helpers/ml-fixtures';
import {
  nextFakePaymentId,
  seedFakePayment,
} from '@/lib/payments/fake-razorpay-gateway';

describe('TrainingExample (Phase 5)', () => {
  beforeEach(async () => {
    await resetTestCaseState();
    setPredictTransactionForTests(async () => smartRetryMlFixture());
  });

  it('does not insert a row after ingest simulation alone', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });

    const count = await prisma.trainingExample.count();
    expect(count).toBe(0);
  });

  it('does not insert a row when recovery payment fails via webhook only', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });

    await runDueAttempts(new Date(Date.now() + 120_000));

    const attempt = await prisma.recoveryAttempt.findFirst();
    const recoveryPayment = await prisma.payment.findFirst({
      where: { recoveryCaseId: { not: null }, parentPaymentId: { not: null } },
    });
    expect(attempt?.razorpayOrderId).toBeTruthy();
    expect(recoveryPayment).toBeTruthy();

    await handleRecoveryPaymentFailure(
      {
        razorpayOrderId: attempt!.razorpayOrderId!,
        amountInr: 499,
        source: 'webhook',
        errorReason: 'payment_failed',
      },
      {
        id: recoveryPayment!.id,
        merchantId: recoveryPayment!.merchantId,
        recoveryCaseId: recoveryPayment!.recoveryCaseId,
        status: recoveryPayment!.status,
      }
    );

    const count = await prisma.trainingExample.count();
    expect(count).toBe(0);
  });

  it('inserts one row when a recovery payment is captured after fetch', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });

    await runDueAttempts(new Date(Date.now() + 120_000));

    const attempt = await prisma.recoveryAttempt.findFirst();
    const recoveryPayment = await prisma.payment.findFirst({
      where: { recoveryCaseId: { not: null }, parentPaymentId: { not: null } },
    });

    const gateway = bindFakeGateway();
    const payId = nextFakePaymentId(gateway);
    seedFakePayment(gateway, {
      id: payId,
      order_id: attempt!.razorpayOrderId!,
      status: 'captured',
      amount: 49900,
      currency: 'INR',
    });

    await prisma.payment.update({
      where: { id: recoveryPayment!.id },
      data: { razorpayPaymentId: payId },
    });

    const result = await markCaptured(recoveryPayment!.id);
    expect(result.updated).toBe(true);

    const examples = await prisma.trainingExample.findMany();
    expect(examples).toHaveLength(1);
    expect(examples[0]?.verifiedSuccess).toBe(true);
    expect(examples[0]?.attemptId).toBe(attempt!.id);

    const refreshedAttempt = await prisma.recoveryAttempt.findUnique({
      where: { id: attempt!.id },
    });
    expect(refreshedAttempt?.status).toBe('succeeded');
  });
});
