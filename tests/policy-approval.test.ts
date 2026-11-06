import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { PUT as putPolicy } from '@/app/api/app/settings/policy/route';
import { POST as approveCase } from '@/app/api/app/cases/[id]/approve/route';
import { POST as rejectCase } from '@/app/api/app/cases/[id]/reject/route';
import {
  setAppSessionForTests,
  resetAppSessionForTests,
  type AppSession,
} from '@/lib/auth';
import { prisma, getDemoMerchantContext } from '@/lib/db';
import {
  bindFakeGateway,
  resetTestCaseState,
} from './helpers/integration';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import { setPredictTransactionForTests } from '@/lib/recovery/python-client';
import {
  approvalRequiredMlFixture,
  smartRetryMlFixture,
  subscriptionCancelledBlockedFixture,
} from './helpers/ml-fixtures';
import { runDueAttempts } from '@/lib/recovery/worker';

function ownerSession(merchantId: string, userId: string): AppSession {
  return {
    user: {
      id: userId,
      email: 'owner@test.local',
      name: 'Owner',
      merchantId,
      merchantName: 'RecoverAI Demo',
      role: 'owner',
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

function viewerSession(merchantId: string, userId: string): AppSession {
  return {
    user: {
      id: userId,
      email: 'viewer@test.local',
      name: 'Viewer',
      merchantId,
      merchantName: 'RecoverAI Demo',
      role: 'viewer',
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  };
}

async function ensureDemoUsers(merchantId: string) {
  const ownerHash = await bcrypt.hash('testpass123', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@test.local' },
    update: { passwordHash: ownerHash },
    create: {
      email: 'owner@test.local',
      name: 'Owner',
      passwordHash: ownerHash,
    },
  });
  await prisma.membership.upsert({
    where: { userId_merchantId: { userId: owner.id, merchantId } },
    update: { role: 'owner' },
    create: { userId: owner.id, merchantId, role: 'owner' },
  });

  const viewerHash = await bcrypt.hash('testpass123', 10);
  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@test.local' },
    update: { passwordHash: viewerHash },
    create: {
      email: 'viewer@test.local',
      name: 'Viewer',
      passwordHash: viewerHash,
    },
  });
  await prisma.membership.upsert({
    where: { userId_merchantId: { userId: viewer.id, merchantId } },
    update: { role: 'viewer' },
    create: { userId: viewer.id, merchantId, role: 'viewer' },
  });

  return { owner, viewer };
}

describe('Phase 6 policy and approval', () => {
  beforeEach(async () => {
    resetAppSessionForTests();
    await resetTestCaseState();
  });

  it('saves policy version n+1 with exactly one active row', async () => {
    const { merchant } = await getDemoMerchantContext();
    const { owner } = await ensureDemoUsers(merchant.id);
    setAppSessionForTests(ownerSession(merchant.id, owner.id));

    const before = await prisma.merchantPolicy.findFirst({
      where: { merchantId: merchant.id, active: true },
    });

    const req = new NextRequest('http://localhost/api/app/settings/policy', {
      method: 'PUT',
      body: JSON.stringify({
        maxAttempts: 4,
        minCooldownMinutes: 20,
        elevationRevenueAtRiskPaise: 600_000,
        approvalThresholdPaise: 50_000,
        disabledReasonCodes: ['CUSTOMER_CANCELLED'],
        retryCancelledSubscriptions: false,
      }),
    });

    const res = await putPolicy(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe((before?.version ?? 0) + 1);

    const activeRows = await prisma.merchantPolicy.findMany({
      where: { merchantId: merchant.id, active: true },
    });
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0].maxAttempts).toBe(4);
  });

  it('viewer cannot PUT policy', async () => {
    const { merchant } = await getDemoMerchantContext();
    const { viewer } = await ensureDemoUsers(merchant.id);
    setAppSessionForTests(viewerSession(merchant.id, viewer.id));

    const req = new NextRequest('http://localhost/api/app/settings/policy', {
      method: 'PUT',
      body: JSON.stringify({
        maxAttempts: 2,
        minCooldownMinutes: 10,
        elevationRevenueAtRiskPaise: 100_000,
        approvalThresholdPaise: null,
        disabledReasonCodes: [],
      }),
    });

    const res = await putPolicy(req);
    expect(res.status).toBe(403);
  });

  it('approval required blocks attempt creation until approve', async () => {
    bindFakeGateway();
    setPredictTransactionForTests(async () => approvalRequiredMlFixture());

    const order = await createDemoOrder({ amountInr: 6000 });
    if (!order.ok) throw new Error('order failed');
    const ingested = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 6000,
      errorReason: 'payment_failed',
      errorDescription: 'issuer timeout',
      source: 'browser',
    });

    expect(ingested.caseId).toBeTruthy();
    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id: ingested.caseId! },
    });
    expect(recoveryCase?.status).toBe('needs_approval');

    const attempts = await prisma.recoveryAttempt.findMany({
      where: { caseId: ingested.caseId! },
    });
    expect(attempts).toHaveLength(0);

    const workerResult = await runDueAttempts(new Date());
    expect(workerResult.claimed).toBe(0);
  });

  it('approve creates one attempt and second approve is idempotent', async () => {
    bindFakeGateway();
    setPredictTransactionForTests(async () => approvalRequiredMlFixture());

    const { merchant } = await getDemoMerchantContext();
    const { owner } = await ensureDemoUsers(merchant.id);

    const order = await createDemoOrder({ amountInr: 8000 });
    if (!order.ok) throw new Error('order failed');
    const ingested = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 8000,
      errorReason: 'payment_failed',
      source: 'browser',
    });

    setAppSessionForTests(ownerSession(merchant.id, owner.id));
    const first = await approveCase(new Request('http://localhost'), {
      params: { id: ingested.caseId! },
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { duplicate: boolean; attemptId: string };
    expect(firstBody.duplicate).toBe(false);

    const attemptsAfter = await prisma.recoveryAttempt.count({
      where: { caseId: ingested.caseId! },
    });
    expect(attemptsAfter).toBe(1);

    const second = await approveCase(new Request('http://localhost'), {
      params: { id: ingested.caseId! },
    });
    const secondBody = (await second.json()) as { duplicate: boolean };
    expect(secondBody.duplicate).toBe(true);

    const attemptsStill = await prisma.recoveryAttempt.count({
      where: { caseId: ingested.caseId! },
    });
    expect(attemptsStill).toBe(1);
  });

  it('reject sets stopped with operator_rejected', async () => {
    setPredictTransactionForTests(async () => approvalRequiredMlFixture());
    const { merchant } = await getDemoMerchantContext();
    const { owner } = await ensureDemoUsers(merchant.id);

    const order = await createDemoOrder({ amountInr: 9000 });
    if (!order.ok) throw new Error('order failed');
    const ingested = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 9000,
      errorReason: 'payment_failed',
      source: 'browser',
    });

    setAppSessionForTests(ownerSession(merchant.id, owner.id));
    const res = await rejectCase(new Request('http://localhost'), {
      params: { id: ingested.caseId! },
    });
    expect(res.status).toBe(200);

    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id: ingested.caseId! },
    });
    expect(recoveryCase?.status).toBe('stopped');
    expect(recoveryCase?.closeReason).toBe('operator_rejected');
  });

  it('cancelled subscription does not create an attempt by default', async () => {
    const { merchant, customer } = await getDemoMerchantContext();
    await prisma.customer.update({
      where: { id: customer.id },
      data: { subscriptionStatus: 'cancelled' },
    });

    setPredictTransactionForTests(async (input) => {
      if (input.subscription_status === 'cancelled') {
        return subscriptionCancelledBlockedFixture();
      }
      return smartRetryMlFixture();
    });

    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');
    const ingested = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      errorReason: 'payment_failed',
      source: 'browser',
    });

    const attempts = await prisma.recoveryAttempt.count({
      where: { caseId: ingested.caseId! },
    });
    expect(attempts).toBe(0);
  });
});
