import { prisma } from '@/lib/db';
import {
  assemblePredictInput,
  featureRecordJson,
  loadHistoryFeaturesForCustomer,
  mapPaymentMethodForModel,
} from '@/lib/ml/persisted-history-features';
import {
  buildFailSafeDecision,
  predictTransaction,
} from '@/lib/recovery/python-client';
import {
  caseStatusAfterDecision,
  strategyCreatesRecoveryOrder,
} from '@/lib/recovery/strategy-helpers';
import { writeAudit } from '@/lib/audit';
import { resolveGuardedAction } from '@/lib/recovery/guarded-action';
import { merchantPolicyForMl } from '@/lib/recovery/merchant-policy-for-ml';
import { countAttemptsUsed, findOpenAttempt } from '@/lib/recovery/attempt-counts';

const MODEL_VERSION = 'recoverai-v1-local';

export async function operatorRetryCase(input: {
  caseId: string;
  merchantId: string;
  actorUserId: string;
  reason: string;
  idempotencyKey: string;
}) {
  const existing = await prisma.recoveryAttempt.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return { duplicate: true as const, attemptId: existing.id };
  }

  const recoveryCase = await prisma.recoveryCase.findFirst({
    where: { id: input.caseId, merchantId: input.merchantId },
  });

  if (!recoveryCase) {
    return { notFound: true as const };
  }

  const origin = await prisma.payment.findFirst({
    where: { id: recoveryCase.originPaymentId, merchantId: input.merchantId },
  });
  if (!origin) {
    return { error: 'ORIGIN_MISSING' as const };
  }

  const failure = await prisma.paymentFailure.findFirst({
    where: { paymentId: origin.id },
    orderBy: { occurredAt: 'desc' },
  });

  const normalizedReason = failure?.normalizedReason ?? 'GENERIC_FAILURE';
  const attemptsUsed = await countAttemptsUsed(recoveryCase.id);
  const openAttempt = await findOpenAttempt(recoveryCase.id);
  const lastFinished = await prisma.recoveryAttempt.findFirst({
    where: { caseId: recoveryCase.id, finishedAt: { not: null } },
    orderBy: { finishedAt: 'desc' },
  });

  const policy = await prisma.merchantPolicy.findFirst({
    where: { merchantId: input.merchantId, active: true },
  });

  const occurredAt = new Date();
  const history = await loadHistoryFeaturesForCustomer({
    customerId: origin.customerId ?? recoveryCase.customerId,
    excludePaymentId: origin.id,
    occurredAt,
  });

  const transactionInput = assemblePredictInput({
    razorpayOrderId: origin.razorpayOrderId,
    amountInr: recoveryCase.amountPaise / 100,
    occurredAt,
    paymentMethod: mapPaymentMethodForModel(origin.method),
    history,
    attemptsUsed,
    normalizedReason,
    amountPaise: recoveryCase.amountPaise,
    originPaymentStatus: origin.status,
    openAttemptExists: Boolean(openAttempt),
    lastAttemptFinishedAt: lastFinished?.finishedAt,
    policy: merchantPolicyForMl(policy),
  });

  let fastApiResult;
  try {
    fastApiResult = await predictTransaction(transactionInput);
  } catch {
    fastApiResult = buildFailSafeDecision();
  }

  const { strategy, guardrailResult, ruleIds, reasonText, recommendedMethod } =
    resolveGuardedAction(fastApiResult);
  const delayMinutes = fastApiResult.strategy.recommended_delay_minutes ?? 0;

  const attemptId = await prisma.$transaction(async (tx) => {
    const prediction = await tx.mlPrediction.create({
      data: {
        caseId: recoveryCase.id,
        modelVersion: MODEL_VERSION,
        failureProbability: fastApiResult.prediction.failure_probability ?? 0,
        riskLevel: fastApiResult.prediction.risk_level,
        recoveryProbability: null,
        recoveryProbabilitySource: 'not_trained',
        featureJson: featureRecordJson(transactionInput, history, {
          operatorReason: input.reason,
        }),
      },
    });

    const decision = await tx.recoveryDecisionRecord.create({
      data: {
        caseId: recoveryCase.id,
        predictionId: prediction.id,
        action: strategy,
        priority: fastApiResult.decision.priority ?? 'medium',
        revenueAtRiskPaise: Math.round(
          (fastApiResult.decision.revenue_at_risk ?? recoveryCase.amountPaise / 100) *
            100
        ),
        delayMinutes,
        maxAttemptsRemaining: policy?.maxAttempts ?? 3,
        guardrailResult,
        reasonText,
        ruleIdsJson: JSON.stringify(ruleIds),
        simulatedOutcome: fastApiResult.outcome.outcome,
        simulatedProbability: fastApiResult.outcome.simulated_recovery_probability,
        policyId: policy?.id ?? null,
        recommendedMethod,
      },
    });

    await tx.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: { status: caseStatusAfterDecision(strategy, guardrailResult, ruleIds) },
    });

    let attempt = null;
    if (strategyCreatesRecoveryOrder(strategy) && guardrailResult === 'passed') {
      attempt = await tx.recoveryAttempt.create({
        data: {
          caseId: recoveryCase.id,
          decisionId: decision.id,
          idempotencyKey: input.idempotencyKey,
          status: 'pending',
          scheduledFor: new Date(occurredAt.getTime() + delayMinutes * 60 * 1000),
        },
      });
    }

    await writeAudit(
      {
        merchantId: input.merchantId,
        actorType: 'user',
        actorId: input.actorUserId,
        action: 'OPERATOR_RETRY_REQUESTED',
        entityType: 'RecoveryCase',
        entityId: recoveryCase.id,
        metadata: {
          reason: input.reason,
          strategy,
          guardrailResult,
        },
      },
      tx
    );

    return attempt?.id ?? null;
  });

  return {
    duplicate: false as const,
    strategy,
    guardrailResult,
    ruleIds,
    attemptId,
  };
}
