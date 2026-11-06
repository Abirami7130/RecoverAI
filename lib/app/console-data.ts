import { prisma } from '@/lib/db';
import { modelMetadataForApi } from '@/lib/ml/model-metadata';

const OPEN_STATUSES = ['open', 'awaiting_payment', 'monitoring', 'needs_approval'];

export async function getAnalyticsOverview(merchantId: string) {
  const verifiedAgg = await prisma.recoveryCase.aggregate({
    where: { merchantId, verifiedRecoveredPaise: { gt: 0 } },
    _sum: { verifiedRecoveredPaise: true },
    _count: { _all: true },
  });

  const verifiedFromPayments = await prisma.payment.aggregate({
    where: {
      merchantId,
      status: 'captured',
      recoveryCaseId: { not: null },
    },
    _sum: { amountPaise: true },
  });

  const verifiedRecoveredPaise =
    verifiedFromPayments._sum.amountPaise ?? verifiedAgg._sum.verifiedRecoveredPaise ?? 0;

  const verifiedCaseCount = await prisma.recoveryCase.count({
    where: { merchantId, status: 'recovered' },
  });

  const openCaseCount = await prisma.recoveryCase.count({
    where: { merchantId, status: { in: OPEN_STATUSES } },
  });

  const decisions = await prisma.recoveryDecisionRecord.findMany({
    where: { recoveryCase: { merchantId } },
    select: { simulatedOutcome: true, action: true, guardrailResult: true, ruleIdsJson: true },
  });

  const simulatedOutcomeCounts = {
    recovered: 0,
    not_recovered: 0,
    no_action: 0,
  };

  for (const d of decisions) {
    const outcome = d.simulatedOutcome ?? 'no_action';
    if (outcome === 'recovered') simulatedOutcomeCounts.recovered += 1;
    else if (outcome === 'not_recovered') simulatedOutcomeCounts.not_recovered += 1;
    else simulatedOutcomeCounts.no_action += 1;
  }

  const actionCounts: Record<string, number> = {};
  const guardrailBlockCounts: Record<string, number> = {};

  for (const d of decisions) {
    actionCounts[d.action] = (actionCounts[d.action] ?? 0) + 1;
    if (d.guardrailResult === 'blocked') {
      try {
        const ids = JSON.parse(d.ruleIdsJson) as string[];
        for (const id of ids) {
          guardrailBlockCounts[id] = (guardrailBlockCounts[id] ?? 0) + 1;
        }
      } catch {
        /* ignore */
      }
    }
  }

  const failures = await prisma.paymentFailure.groupBy({
    by: ['normalizedReason'],
    where: { payment: { merchantId } },
    _count: { _all: true },
  });

  const failuresByReason = failures.map((row) => ({
    normalizedReason: row.normalizedReason,
    count: row._count._all,
  }));

  const recoveredCases = await prisma.recoveryCase.findMany({
    where: { merchantId, status: 'recovered' },
    select: { originPaymentId: true, verifiedRecoveredPaise: true },
  });

  const originIds = recoveredCases.map((c) => c.originPaymentId);
  const originFailures = await prisma.paymentFailure.findMany({
    where: { paymentId: { in: originIds } },
    orderBy: { occurredAt: 'desc' },
  });
  const reasonByOrigin = new Map<string, string>();
  for (const f of originFailures) {
    if (!reasonByOrigin.has(f.paymentId)) {
      reasonByOrigin.set(f.paymentId, f.normalizedReason);
    }
  }

  const capturesByReasonMap: Record<string, number> = {};
  for (const c of recoveredCases) {
    const reason = reasonByOrigin.get(c.originPaymentId) ?? 'GENERIC_FAILURE';
    capturesByReasonMap[reason] = (capturesByReasonMap[reason] ?? 0) + 1;
  }

  const capturesByReason = Object.entries(capturesByReasonMap).map(
    ([normalizedReason, count]) => ({ normalizedReason, count })
  );

  return {
    currency: 'INR',
    verifiedRecoveredPaise,
    verifiedCaseCount,
    openCaseCount,
    simulatedOutcomeCounts,
    note: 'simulatedOutcomeCounts are not revenue',
    actionCounts,
    guardrailBlockCounts,
    failuresByReason,
    capturesByReason,
    model: modelMetadataForApi(),
  };
}

export async function listCasesForMerchant(
  merchantId: string,
  options: { status?: string; limit: number; cursor?: string | null }
) {
  const limit = Math.min(Math.max(options.limit, 1), 100);
  const where: {
    merchantId: string;
    status?: string;
  } = { merchantId };

  if (options.status) {
    where.status = options.status;
  }

  const rows = await prisma.recoveryCase.findMany({
    where,
    orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(options.cursor
      ? { cursor: { id: options.cursor }, skip: 1 }
      : {}),
    include: {
      payments: { where: { parentPaymentId: null }, take: 1 },
      predictions: { orderBy: { createdAt: 'desc' }, take: 1 },
      decisions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const hasMore = rows.length > limit;
  const cases = hasMore ? rows.slice(0, limit) : rows;

  const originIds = cases.map((c) => c.originPaymentId);
  const failureRows = await prisma.paymentFailure.findMany({
    where: { paymentId: { in: originIds } },
    orderBy: { occurredAt: 'desc' },
  });
  const reasonByPayment = new Map<string, string>();
  for (const f of failureRows) {
    if (!reasonByPayment.has(f.paymentId)) {
      reasonByPayment.set(f.paymentId, f.normalizedReason);
    }
  }

  const mapped = cases.map((c) => {
    const decision = c.decisions[0];
    const prediction = c.predictions[0];
    return {
      id: c.id,
      status: c.status,
      amountPaise: c.amountPaise,
      normalizedReason: reasonByPayment.get(c.originPaymentId) ?? 'GENERIC_FAILURE',
      action: decision?.action ?? 'MONITOR',
      failureProbability: prediction?.failureProbability ?? null,
      verifiedRecoveredPaise: c.verifiedRecoveredPaise,
      openedAt: c.openedAt.toISOString(),
    };
  });

  const last = cases[cases.length - 1];
  const nextCursor = hasMore && last ? last.id : null;

  return { cases: mapped, nextCursor };
}

export async function getCaseDetailForMerchant(merchantId: string, caseId: string) {
  const recoveryCase = await prisma.recoveryCase.findFirst({
    where: { id: caseId, merchantId },
    include: {
      customer: true,
      predictions: { orderBy: { createdAt: 'desc' } },
      decisions: { orderBy: { createdAt: 'asc' } },
      attempts: { orderBy: { scheduledFor: 'asc' } },
      payments: true,
    },
  });

  if (!recoveryCase) {
    return null;
  }

  const linkedOrigin = recoveryCase.payments.find((p) => p.id === recoveryCase.originPaymentId);
  const origin =
    linkedOrigin ??
    (await prisma.payment.findFirst({
      where: { id: recoveryCase.originPaymentId, merchantId },
    }));
  const failures = origin
    ? await prisma.paymentFailure.findMany({
        where: { paymentId: origin.id },
        orderBy: { occurredAt: 'desc' },
      })
    : [];

  const latestPrediction = recoveryCase.predictions[0];
  let featureSource: string | null = null;
  if (latestPrediction) {
    try {
      const parsed = JSON.parse(latestPrediction.featureJson) as {
        feature_source?: string;
      };
      featureSource = parsed.feature_source ?? null;
    } catch {
      featureSource = null;
    }
  }

  return {
    case: {
      id: recoveryCase.id,
      status: recoveryCase.status,
      amountPaise: recoveryCase.amountPaise,
      verifiedRecoveredPaise: recoveryCase.verifiedRecoveredPaise,
      openedAt: recoveryCase.openedAt.toISOString(),
      closedAt: recoveryCase.closedAt?.toISOString() ?? null,
      closeReason: recoveryCase.closeReason,
      subscriptionStatus: recoveryCase.customer?.subscriptionStatus ?? null,
    },
    originPayment: origin
      ? {
          id: origin.id,
          razorpayOrderId: origin.razorpayOrderId,
          razorpayPaymentId: origin.razorpayPaymentId,
          status: origin.status,
          amountPaise: origin.amountPaise,
          method: origin.method,
          capturedAt: origin.capturedAt?.toISOString() ?? null,
        }
      : null,
    failures: failures.map((f) => ({
      id: f.id,
      source: f.source,
      errorCode: f.errorCode,
      errorReason: f.errorReason,
      errorDescription: f.errorDescription,
      normalizedReason: f.normalizedReason,
      occurredAt: f.occurredAt.toISOString(),
    })),
    predictions: recoveryCase.predictions.map((p) => ({
      id: p.id,
      modelVersion: p.modelVersion,
      failureProbability: p.failureProbability,
      riskLevel: p.riskLevel,
      recoveryProbability: p.recoveryProbability,
      recoveryProbabilitySource: p.recoveryProbabilitySource,
      featureSource,
      createdAt: p.createdAt.toISOString(),
    })),
    decisions: recoveryCase.decisions.map((d) => ({
      id: d.id,
      action: d.action,
      priority: d.priority,
      delayMinutes: d.delayMinutes,
      guardrailResult: d.guardrailResult,
      reasonText: d.reasonText,
      ruleIds: JSON.parse(d.ruleIdsJson) as string[],
      simulatedOutcome: d.simulatedOutcome,
      simulatedProbability: d.simulatedProbability,
      recommendedMethod: d.recommendedMethod,
      createdAt: d.createdAt.toISOString(),
    })),
    attempts: recoveryCase.attempts.map((a) => ({
      id: a.id,
      status: a.status,
      scheduledFor: a.scheduledFor.toISOString(),
      startedAt: a.startedAt?.toISOString() ?? null,
      finishedAt: a.finishedAt?.toISOString() ?? null,
      razorpayOrderId: a.razorpayOrderId,
      blockReason: a.blockReason,
    })),
    payments: recoveryCase.payments.map((p) => ({
      id: p.id,
      razorpayOrderId: p.razorpayOrderId,
      razorpayPaymentId: p.razorpayPaymentId,
      status: p.status,
      amountPaise: p.amountPaise,
      capturedAt: p.capturedAt?.toISOString() ?? null,
      parentPaymentId: p.parentPaymentId,
    })),
  };
}
