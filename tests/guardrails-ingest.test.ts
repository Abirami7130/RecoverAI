import { describe, it, expect, beforeEach } from 'vitest';
import { resetTestCaseState } from './helpers/integration';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { prisma } from '@/lib/db';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import { setPredictTransactionForTests } from '@/lib/recovery/python-client';
import { customerCancelledMlFixture } from './helpers/ml-fixtures';

describe('guardrails ingest', () => {
  beforeEach(async () => {
    await resetTestCaseState();
    setPredictTransactionForTests(async (input) => {
      if (input.context?.normalized_reason === 'CUSTOMER_CANCELLED') {
        return customerCancelledMlFixture();
      }
      throw new Error('unexpected predict call');
    });
  });

  it('stores NO_RECOVERY with zero attempts for cancelled payments', async () => {
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const ingest = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
      errorReason: 'payment_cancelled',
      errorDescription: 'Payment cancelled by user',
    });

    expect(ingest.caseId).toBeTruthy();
    expect(ingest.guardrailResult).toBe('blocked');
    expect(ingest.ruleIds).toContain('REASON_DISABLED');

    const decision = await prisma.recoveryDecisionRecord.findFirst({
      where: { caseId: ingest.caseId! },
    });
    expect(decision?.action).toBe('NO_RECOVERY');
    expect(decision?.reasonText).toContain('REASON_DISABLED');

    const attempts = await prisma.recoveryAttempt.count({
      where: { caseId: ingest.caseId! },
    });
    expect(attempts).toBe(0);
  });
});
