import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { GET as listCases } from '@/app/api/app/cases/route';
import { GET as getCase } from '@/app/api/app/cases/[id]/route';
import { POST as retryCase } from '@/app/api/app/cases/[id]/retry/route';
import { GET as analyticsOverview } from '@/app/api/app/analytics/overview/route';
import {
  setAppSessionForTests,
  resetAppSessionForTests,
  type AppSession,
} from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  bindFakeGateway,
  resetTestCaseState,
} from './helpers/integration';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import { setPredictTransactionForTests } from '@/lib/recovery/python-client';
import { smartRetryMlFixture } from './helpers/ml-fixtures';

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

describe('case API auth', () => {
  beforeEach(async () => {
    await resetTestCaseState();
    resetAppSessionForTests();
    setPredictTransactionForTests(async () => smartRetryMlFixture());
    bindFakeGateway();
  });

  it('returns 401 for unauthenticated case list', async () => {
    setAppSessionForTests(null);
    const res = await listCases(new NextRequest('http://localhost/api/app/cases'));
    expect(res.status).toBe(401);
  });

  it('returns 403 when viewer posts retry', async () => {
    const merchant = await prisma.merchant.findFirstOrThrow({
      where: { id: 'seed_merchant_demo' },
    });
    const { viewer } = await ensureDemoUsers(merchant.id);
    setAppSessionForTests(viewerSession(merchant.id, viewer.id));

    const order = await createDemoOrder({ amountInr: 499 });
    const ingest = await ingestFailure({
      razorpayOrderId: order.ok ? order.order_id : '',
      amountInr: 499,
      source: 'browser',
    });
    if (!ingest.caseId) throw new Error('no case');

    const res = await retryCase(
      new NextRequest('http://localhost/api/app/cases/x/retry', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'retry-1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'operator requested retry' }),
      }),
      { params: { id: ingest.caseId } }
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 for a case on another merchant', async () => {
    const demo = await prisma.merchant.findFirstOrThrow({
      where: { id: 'seed_merchant_demo' },
    });
    const { owner } = await ensureDemoUsers(demo.id);
    setAppSessionForTests(ownerSession(demo.id, owner.id));

    const otherMerchant = await prisma.merchant.create({
      data: { name: 'Other Merchant' },
    });
    const otherPayment = await prisma.payment.create({
      data: {
        merchantId: otherMerchant.id,
        razorpayOrderId: 'order_other_merchant',
        amountPaise: 10000,
        status: 'failed',
      },
    });
    const otherCase = await prisma.recoveryCase.create({
      data: {
        merchantId: otherMerchant.id,
        originPaymentId: otherPayment.id,
        status: 'open',
        amountPaise: 10000,
      },
    });

    const res = await getCase(new NextRequest('http://localhost/api/app/cases/x'), {
      params: { id: otherCase.id },
    });
    expect(res.status).toBe(404);
  });

  it('analytics verified total matches captured recovery payments', async () => {
    const demo = await prisma.merchant.findFirstOrThrow({
      where: { id: 'seed_merchant_demo' },
    });
    const { owner } = await ensureDemoUsers(demo.id);
    setAppSessionForTests(ownerSession(demo.id, owner.id));

    const order = await createDemoOrder({ amountInr: 499 });
    if (!order.ok) throw new Error('order failed');
    const ingest = await ingestFailure({
      razorpayOrderId: order.order_id,
      amountInr: 499,
      source: 'browser',
    });
    if (!ingest.caseId) throw new Error('no case');

    const origin = await prisma.payment.findUnique({
      where: { razorpayOrderId: order.order_id },
    });
    if (!origin) throw new Error('no origin payment');

    await prisma.payment.create({
      data: {
        merchantId: demo.id,
        customerId: origin.customerId,
        recoveryCaseId: ingest.caseId,
        parentPaymentId: origin.id,
        razorpayOrderId: 'order_fake_recovery_analytics',
        razorpayPaymentId: 'pay_fake_recovery_analytics',
        amountPaise: 49900,
        status: 'captured',
        capturedAt: new Date(),
      },
    });

    const res = await analyticsOverview();
    const json = await res.json();
    expect(json.verifiedRecoveredPaise).toBe(49900);
  });
});
