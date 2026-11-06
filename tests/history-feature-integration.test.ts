import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma, getDemoMerchantContext } from '@/lib/db';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import { operatorRetryCase } from '@/lib/app/operator-retry';
import { setPredictTransactionForTests } from '@/lib/recovery/python-client';
import type { PredictTransactionInput } from '@/lib/recovery/python-client';
import {
  getCaseDetailForMerchant,
  listCasesForMerchant,
} from '@/lib/app/console-data';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { resetTestCaseState } from './helpers/integration';
import { predictWithRecoveraiPipeline } from './helpers/local-pipeline';

const DAY_MS = 24 * 60 * 60 * 1000;

async function useRealPipeline() {
  const seen: PredictTransactionInput[] = [];
  setPredictTransactionForTests(async (input) => {
    seen.push(input);
    return predictWithRecoveraiPipeline(input);
  });
  return seen;
}

async function setTenure(customerId: string, occurredAt: Date, days: number) {
  await prisma.customer.update({
    where: { id: customerId },
    data: { tenureStartedAt: new Date(occurredAt.getTime() - days * DAY_MS) },
  });
}

async function insertTerminalPayment(input: {
  merchantId: string;
  customerId: string;
  status: 'captured' | 'failed';
  createdAt: Date;
  method?: string;
}) {
  return prisma.payment.create({
    data: {
      merchantId: input.merchantId,
      customerId: input.customerId,
      razorpayOrderId: `hist_${crypto.randomUUID()}`,
      amountPaise: 49900,
      currency: 'INR',
      status: input.status,
      method: input.method ?? 'UPI',
      createdAt: input.createdAt,
    },
  });
}

describe('persisted history features', () => {
  let merchantId = '';
  let customerId = '';
  let originalTenure: Date | null = null;
  let policyId = '';
  let originalApproval: number | null = null;

  beforeEach(async () => {
    await resetTestCaseState();
    const { merchant, customer, policy } = await getDemoMerchantContext();
    merchantId = merchant.id;
    customerId = customer.id;
    originalTenure = customer.tenureStartedAt;
    policyId = policy?.id ?? '';
    originalApproval = policy?.approvalThresholdPaise ?? null;
    await useRealPipeline();
  });

  afterEach(async () => {
    setPredictTransactionForTests(null);
    if (customerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { tenureStartedAt: originalTenure, subscriptionStatus: 'active' },
      });
    }
    if (policyId) {
      await prisma.merchantPolicy.update({
        where: { id: policyId },
        data: { approvalThresholdPaise: originalApproval },
      });
    }
  });

  async function seedRepeatFailureHistory(occurredAt: Date) {
    await setTenure(customerId, occurredAt, 30);
    await insertTerminalPayment({
      merchantId,
      customerId,
      status: 'failed',
      method: 'UPI',
      createdAt: new Date(occurredAt.getTime() - 120 * 60 * 1000),
    });
    await insertTerminalPayment({
      merchantId,
      customerId,
      status: 'failed',
      method: 'UPI',
      createdAt: new Date(occurredAt.getTime() - 48 * 60 * 60 * 1000),
    });
  }

  it('persists SMART_RETRY from two observed failures and shows that stored action', async () => {
    const occurredAt = new Date();
    await seedRepeatFailureHistory(occurredAt);
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const ingest = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
      paymentMethod: 'UPI',
      errorReason: 'gateway timeout',
      errorDescription: 'issuer timeout',
      occurredAt,
    });

    expect(ingest.guardrailResult).toBe('passed');
    const decision = await prisma.recoveryDecisionRecord.findFirst({
      where: { caseId: ingest.caseId! },
    });
    expect(decision?.action).toBe('SMART_RETRY');
    expect(decision?.recommendedMethod).toBeNull();

    const prediction = await prisma.mlPrediction.findFirst({
      where: { caseId: ingest.caseId! },
    });
    const features = JSON.parse(prediction!.featureJson) as {
      feature_source: string;
      retry_count: number;
      previous_payment_count: number;
      previous_failure_count: number;
      historical_success_rate: number;
      transactions_last_24h: number;
      time_since_last_payment_min: number;
      customer_tenure_days: number;
      payment_method: string;
    };
    expect(features.feature_source).toBe('payment_history');
    expect(features.retry_count).toBe(0);
    expect(features.previous_payment_count).toBe(2);
    expect(features.previous_failure_count).toBe(2);
    expect(features.historical_success_rate).toBe(0);
    expect(features.transactions_last_24h).toBe(1);
    expect(features.time_since_last_payment_min).toBe(120);
    expect(features.customer_tenure_days).toBe(30);
    expect(features.payment_method).toBe('UPI');

    const detail = await getCaseDetailForMerchant(merchantId, ingest.caseId!);
    expect(detail?.decisions.at(-1)?.action).toBe('SMART_RETRY');
    const listed = await listCasesForMerchant(merchantId, { limit: 20 });
    expect(listed.cases.find((row) => row.id === ingest.caseId)?.action).toBe('SMART_RETRY');
  });

  it('persists ALTERNATIVE_PAYMENT_METHOD once two real attempts exist', async () => {
    const occurredAt = new Date();
    await seedRepeatFailureHistory(occurredAt);
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');

    const ingest = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
      paymentMethod: 'UPI',
      errorReason: 'gateway timeout',
      occurredAt,
    });
    expect(ingest.caseId).toBeTruthy();

    const firstDecision = await prisma.recoveryDecisionRecord.findFirstOrThrow({
      where: { caseId: ingest.caseId! },
    });
    const finishedAt = new Date(Date.now() - DAY_MS);
    await prisma.recoveryAttempt.updateMany({
      where: { caseId: ingest.caseId! },
      data: { status: 'failed', finishedAt },
    });
    await prisma.recoveryAttempt.create({
      data: {
        caseId: ingest.caseId!,
        decisionId: firstDecision.id,
        idempotencyKey: `prior:${ingest.caseId}:2`,
        status: 'failed',
        scheduledFor: finishedAt,
        finishedAt,
      },
    });

    const retry = await operatorRetryCase({
      caseId: ingest.caseId!,
      merchantId,
      actorUserId: 'operator_test',
      reason: 'second retry window elapsed',
      idempotencyKey: `op:${ingest.caseId}:alt`,
    });

    expect(retry).toMatchObject({
      duplicate: false,
      strategy: 'ALTERNATIVE_PAYMENT_METHOD',
      guardrailResult: 'passed',
    });

    const decision = await prisma.recoveryDecisionRecord.findFirst({
      where: { caseId: ingest.caseId! },
      orderBy: { createdAt: 'desc' },
    });
    expect(decision?.action).toBe('ALTERNATIVE_PAYMENT_METHOD');
    expect(decision?.recommendedMethod).toBe('CARD');

    const prediction = await prisma.mlPrediction.findFirst({
      where: { caseId: ingest.caseId! },
      orderBy: { createdAt: 'desc' },
    });
    const features = JSON.parse(prediction!.featureJson) as {
      retry_count: number;
      context: { attempts_used: number };
      feature_source: string;
    };
    expect(features.feature_source).toBe('payment_history');
    expect(features.retry_count).toBe(2);
    expect(features.context.attempts_used).toBe(2);

    const detail = await getCaseDetailForMerchant(merchantId, ingest.caseId!);
    const latest = detail?.decisions.at(-1);
    expect(latest?.action).toBe('ALTERNATIVE_PAYMENT_METHOD');
    expect(latest?.recommendedMethod).toBe('CARD');
  });

  it('keeps a low-risk captured history on NO_RECOVERY', async () => {
    const occurredAt = new Date();
    await setTenure(customerId, occurredAt, 180);
    await insertTerminalPayment({
      merchantId,
      customerId,
      status: 'captured',
      method: 'CARD',
      createdAt: new Date(occurredAt.getTime() - 60 * 60 * 1000),
    });
    for (let i = 2; i <= 9; i += 1) {
      await insertTerminalPayment({
        merchantId,
        customerId,
        status: 'captured',
        method: 'CARD',
        createdAt: new Date(occurredAt.getTime() - (i + 2) * DAY_MS),
      });
    }
    await insertTerminalPayment({
      merchantId,
      customerId,
      status: 'failed',
      method: 'CARD',
      createdAt: new Date(occurredAt.getTime() - 10 * DAY_MS),
    });

    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');
    const ingest = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
      paymentMethod: 'CARD',
      errorReason: 'gateway timeout',
      occurredAt,
    });

    const decision = await prisma.recoveryDecisionRecord.findFirst({
      where: { caseId: ingest.caseId! },
    });
    expect(decision?.action).toBe('NO_RECOVERY');
    const attempts = await prisma.recoveryAttempt.count({
      where: { caseId: ingest.caseId! },
    });
    expect(attempts).toBe(0);

    const prediction = await prisma.mlPrediction.findFirst({
      where: { caseId: ingest.caseId! },
    });
    const features = JSON.parse(prediction!.featureJson) as {
      previous_payment_count: number;
      previous_failure_count: number;
      historical_success_rate: number;
      feature_source: string;
    };
    expect(features.feature_source).toBe('payment_history');
    expect(features.previous_payment_count).toBe(10);
    expect(features.previous_failure_count).toBe(1);
    expect(features.historical_success_rate).toBe(0.9);
  });

  it('blocks a new attempt at the attempt cap without inventing another retry', async () => {
    const occurredAt = new Date();
    await seedRepeatFailureHistory(occurredAt);
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');
    const ingest = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
      paymentMethod: 'UPI',
      errorReason: 'gateway timeout',
      occurredAt,
    });
    const decision = await prisma.recoveryDecisionRecord.findFirstOrThrow({
      where: { caseId: ingest.caseId! },
    });
    const finishedAt = new Date(Date.now() - DAY_MS);
    await prisma.recoveryAttempt.updateMany({
      where: { caseId: ingest.caseId! },
      data: { status: 'failed', finishedAt },
    });
    await prisma.recoveryAttempt.createMany({
      data: [1, 2].map((n) => ({
        caseId: ingest.caseId!,
        decisionId: decision.id,
        idempotencyKey: `prior:${ingest.caseId}:${n}`,
        status: 'failed',
        scheduledFor: finishedAt,
        finishedAt,
      })),
    });

    const before = await prisma.recoveryAttempt.count({ where: { caseId: ingest.caseId! } });
    expect(before).toBe(3);

    const retry = await operatorRetryCase({
      caseId: ingest.caseId!,
      merchantId,
      actorUserId: 'operator_test',
      reason: 'cap check',
      idempotencyKey: `op:${ingest.caseId}:cap`,
    });

    expect(retry).toMatchObject({ guardrailResult: 'blocked', attemptId: null });
    expect(retry.ruleIds).toContain('ATTEMPT_CAP');
    const after = await prisma.recoveryAttempt.count({ where: { caseId: ingest.caseId! } });
    expect(after).toBe(3);
  });

  it('keeps approval required before any recovery order is created', async () => {
    await prisma.merchantPolicy.update({
      where: { id: policyId },
      data: { approvalThresholdPaise: 10_000 },
    });
    const occurredAt = new Date();
    await seedRepeatFailureHistory(occurredAt);
    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');
    const ingest = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
      paymentMethod: 'UPI',
      errorReason: 'gateway timeout',
      occurredAt,
    });

    expect(ingest.guardrailResult).toBe('blocked');
    expect(ingest.ruleIds).toContain('APPROVAL_REQUIRED');
    const decision = await prisma.recoveryDecisionRecord.findFirst({
      where: { caseId: ingest.caseId! },
    });
    expect(decision?.action).toBe('SMART_RETRY');
    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id: ingest.caseId! },
    });
    expect(recoveryCase?.status).toBe('needs_approval');
    const attempts = await prisma.recoveryAttempt.count({
      where: { caseId: ingest.caseId! },
    });
    expect(attempts).toBe(0);
  });

  it('does not borrow another customer history when the payment has no customer', async () => {
    const occurredAt = new Date();
    await seedRepeatFailureHistory(occurredAt);
    const payment = await prisma.payment.create({
      data: {
        merchantId,
        customerId: null,
        razorpayOrderId: `order_nocust_${crypto.randomUUID()}`,
        amountPaise: 49900,
        currency: 'INR',
        status: 'created',
      },
    });

    const ingest = await ingestFailure({
      razorpayOrderId: payment.razorpayOrderId,
      amountInr: 499,
      source: 'webhook',
      paymentMethod: 'CARD',
      errorReason: 'gateway timeout',
      occurredAt,
    });

    const decision = await prisma.recoveryDecisionRecord.findFirst({
      where: { caseId: ingest.caseId! },
    });
    expect(decision?.action).toBe('NO_RECOVERY');
    const prediction = await prisma.mlPrediction.findFirst({
      where: { caseId: ingest.caseId! },
    });
    const features = JSON.parse(prediction!.featureJson) as {
      feature_source: string;
      previous_payment_count: number;
      previous_failure_count: number;
      historical_success_rate: number;
      retry_count: number;
      time_since_last_payment_known: boolean;
    };
    expect(features.feature_source).toBe('insufficient_history');
    expect(features.previous_payment_count).toBe(0);
    expect(features.previous_failure_count).toBe(0);
    expect(features.historical_success_rate).toBe(1);
    expect(features.retry_count).toBe(0);
    expect(features.time_since_last_payment_known).toBe(false);
    expect(features.feature_source).not.toBe('demo_customer');
  });
});
