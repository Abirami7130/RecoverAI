import { describe, it, expect, beforeEach } from 'vitest';
import {
  bindFakeGateway,
  resetTestCaseState,
} from './helpers/integration';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { prisma } from '@/lib/db';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import {
  setPredictTransactionForTests,
  MlUnreachableError,
} from '@/lib/recovery/python-client';

describe('create order persistence', () => {
  beforeEach(async () => {
    await resetTestCaseState();
    setPredictTransactionForTests(async () => {
      throw new MlUnreachableError('down');
    });
  });

  it('persists a created payment in paise', async () => {
    const result = await createDemoOrder({ amountInr: 499 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = await prisma.payment.findUnique({
      where: { id: result.payment_record_id },
    });
    expect(row?.status).toBe('created');
    expect(row?.amountPaise).toBe(49900);
  });

  it('returns the same order for idempotent key and amount', async () => {
    const gateway = bindFakeGateway();
    const first = await createDemoOrder({
      amountInr: 499,
      idempotencyKey: 'idem-1',
    });
    const second = await createDemoOrder({
      amountInr: 499,
      idempotencyKey: 'idem-1',
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.order_id).toBe(second.order_id);
    expect(gateway.state.createOrderCalls).toBe(1);
  });

  it('returns conflict for same idempotency key and different amount', async () => {
    await createDemoOrder({ amountInr: 499, idempotencyKey: 'idem-2' });
    const second = await createDemoOrder({
      amountInr: 599,
      idempotencyKey: 'idem-2',
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.status).toBe(409);
  });

  it('stores MONITOR fail-safe case when ML is down', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const ingest = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });

    expect(ingest.caseId).toBeTruthy();
    expect(ingest.mlFailSafe).toBe(true);

    const decision = await prisma.recoveryDecisionRecord.findFirst({
      where: { caseId: ingest.caseId! },
    });
    expect(decision?.action).toBe('MONITOR');
    expect(JSON.parse(decision?.ruleIdsJson ?? '[]')).toContain(
      'ML_UNAVAILABLE_FAIL_SAFE'
    );

    const attempts = await prisma.recoveryAttempt.count({
      where: { caseId: ingest.caseId! },
    });
    expect(attempts).toBe(0);
  });
});
