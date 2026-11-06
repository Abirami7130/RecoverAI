import { prisma, getDemoMerchantContext } from '@/lib/db';
import {
  assemblePredictInput,
  featureRecordJson,
  loadHistoryFeaturesForCustomer,
  mapPaymentMethodForModel,
} from '@/lib/ml/persisted-history-features';
import { normalizeFailureReason } from '@/lib/recovery/normalize-reason';
import {
  buildFailSafeDecision,
  predictTransaction,
  type FastApiPredictResponse,
} from '@/lib/recovery/python-client';
import {
  caseStatusAfterDecision,
  strategyCreatesRecoveryOrder,
} from '@/lib/recovery/strategy-helpers';
import { writeAudit } from '@/lib/audit';
import { presentRecoveryDecision } from '@/lib/recovery/present-decision';
import { resolveGuardedAction } from '@/lib/recovery/guarded-action';
import { handleRecoveryPaymentFailure } from '@/lib/recovery/handle-recovery-payment-failure';
import { merchantPolicyForMl } from '@/lib/recovery/merchant-policy-for-ml';

export interface IngestFailureInput {
  razorpayOrderId: string;
  razorpayPaymentId?: string | null;
  amountInr: number;
  errorCode?: string;
  errorDescription?: string;
  errorReason?: string;
  paymentMethod?: string;
  source: 'browser' | 'webhook';
  rawEventId?: string | null;
  occurredAt?: Date;
}

export interface IngestFailureResult {
  caseId: string | null;
  duplicate: boolean;
  skippedReason?: string;
  recoveryDecision?: ReturnType<typeof presentRecoveryDecision>;
  fastApiResult?: FastApiPredictResponse;
  mlFailSafe?: boolean;
  guardrailResult?: string;
  ruleIds?: string[];
}

const MODEL_VERSION = 'recoverai-v1-local';

class CaseDuplicateError extends Error {
  constructor(public caseId: string) {
    super('CASE_DUPLICATE');
    this.name = 'CaseDuplicateError';
  }
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}

function mapPaymentMethod(raw?: string): string {
  return mapPaymentMethodForModel(raw);
}

async function buildDuplicateResult(
  existingCaseId: string,
  input: IngestFailureInput
): Promise<IngestFailureResult> {
  const lastDecision = await prisma.recoveryDecisionRecord.findFirst({
    where: { caseId: existingCaseId },
    orderBy: { createdAt: 'desc' },
  });
  const normalizedReason = normalizeFailureReason(
    input.errorReason ?? '',
    input.errorDescription ?? ''
  );
  const recoveryDecision = lastDecision
    ? presentRecoveryDecision(
        {
          prediction: {
            failure_probability: 0.5,
            risk_level: 'medium',
          },
          decision: {
            failure_probability: 0.5,
            decision: lastDecision.action,
            reason: lastDecision.reasonText,
          },
          strategy: {
            strategy: lastDecision.action,
            recommended_delay_minutes: lastDecision.delayMinutes,
          },
          outcome: {
            outcome: lastDecision.simulatedOutcome ?? 'no_action',
            simulated_recovery_probability: lastDecision.simulatedProbability ?? 0,
          },
        },
        input.errorCode ?? '',
        input.errorDescription ?? '',
        normalizedReason
      )
    : undefined;

  return {
    caseId: existingCaseId,
    duplicate: true,
    recoveryDecision,
  };
}

export async function ingestFailure(
  input: IngestFailureInput
): Promise<IngestFailureResult> {
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: input.razorpayOrderId },
  });

  if (!payment) {
    return { caseId: null, duplicate: false, skippedReason: 'PAYMENT_NOT_FOUND' };
  }

  if (payment.recoveryCaseId) {
    return handleRecoveryPaymentFailure(input, payment);
  }

  if (payment.status === 'captured') {
    return { caseId: null, duplicate: false, skippedReason: 'ALREADY_CAPTURED' };
  }

  const existingCase = await prisma.recoveryCase.findUnique({
    where: { originPaymentId: payment.id },
  });
  if (existingCase) {
    return buildDuplicateResult(existingCase.id, input);
  }

  const normalizedReason = normalizeFailureReason(
    input.errorReason ?? '',
    input.errorDescription ?? ''
  );
  const occurredAt = input.occurredAt ?? new Date();
  const { merchant, customer, policy } = await getDemoMerchantContext();

  const amountPaise = Math.round(input.amountInr * 100);
  // A new origin failure has no RecoveryCase and therefore no RecoveryAttempt rows.
  const attemptsUsed = 0;
  const history = await loadHistoryFeaturesForCustomer({
    customerId: payment.customerId,
    excludePaymentId: payment.id,
    occurredAt,
  });

  const transactionInput = assemblePredictInput({
    razorpayOrderId: input.razorpayOrderId,
    amountInr: input.amountInr,
    occurredAt,
    paymentMethod: mapPaymentMethod(input.paymentMethod ?? input.errorReason),
    history,
    attemptsUsed,
    normalizedReason,
    amountPaise,
    originPaymentStatus: payment.status,
    openAttemptExists: false,
    policy: merchantPolicyForMl(policy),
  });

  let fastApiResult: FastApiPredictResponse;
  let mlFailSafe = false;

  try {
    fastApiResult = await predictTransaction(transactionInput);
  } catch {
    fastApiResult = buildFailSafeDecision();
    mlFailSafe = true;
  }

  const { strategy, guardrailResult, ruleIds, reasonText, recommendedMethod } =
    resolveGuardedAction(fastApiResult);
  const delayMinutes = fastApiResult.strategy.recommended_delay_minutes ?? 0;

  const recoveryDecision = presentRecoveryDecision(
    fastApiResult,
    input.errorCode ?? '',
    input.errorDescription ?? '',
    normalizedReason,
    ruleIds
  );

  try {
    const caseId = await prisma.$transaction(async (tx) => {
      const existingInTx = await tx.recoveryCase.findUnique({
        where: { originPaymentId: payment.id },
      });
      if (existingInTx) {
        throw new CaseDuplicateError(existingInTx.id);
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'failed',
          method: mapPaymentMethod(input.paymentMethod),
          razorpayPaymentId: input.razorpayPaymentId ?? payment.razorpayPaymentId,
        },
      });

      try {
        await tx.paymentFailure.create({
          data: {
            paymentId: payment.id,
            source: input.source,
            errorCode: input.errorCode ?? null,
            errorReason: input.errorReason ?? null,
            errorDescription: input.errorDescription ?? null,
            normalizedReason,
            rawEventId: input.rawEventId ?? null,
            occurredAt,
          },
        });
      } catch (err: unknown) {
        if (!isPrismaUniqueViolation(err)) {
          throw err;
        }
      }

      let recoveryCase;
      try {
        recoveryCase = await tx.recoveryCase.create({
          data: {
            merchantId: merchant.id,
            customerId: customer.id,
            originPaymentId: payment.id,
            status: 'open',
            amountPaise,
          },
        });
      } catch (err: unknown) {
        if (isPrismaUniqueViolation(err)) {
          const winner = await tx.recoveryCase.findUnique({
            where: { originPaymentId: payment.id },
          });
          if (winner) {
            throw new CaseDuplicateError(winner.id);
          }
        }
        throw err;
      }

      const prediction = await tx.mlPrediction.create({
        data: {
          caseId: recoveryCase.id,
          modelVersion: MODEL_VERSION,
          failureProbability: fastApiResult.prediction.failure_probability ?? 0,
          riskLevel: fastApiResult.prediction.risk_level,
          recoveryProbability: null,
          recoveryProbabilitySource: 'not_trained',
          featureJson: featureRecordJson(transactionInput, history),
        },
      });

      const decision = await tx.recoveryDecisionRecord.create({
        data: {
          caseId: recoveryCase.id,
          predictionId: prediction.id,
          action: strategy,
          priority: fastApiResult.decision.priority ?? 'medium',
          revenueAtRiskPaise: Math.round(
            (fastApiResult.decision.revenue_at_risk ?? input.amountInr) * 100
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

      const nextStatus = caseStatusAfterDecision(strategy, guardrailResult, ruleIds);
      await tx.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: { status: nextStatus },
      });

      if (
        strategyCreatesRecoveryOrder(strategy) &&
        guardrailResult === 'passed'
      ) {
        const scheduledFor = new Date(
          occurredAt.getTime() + delayMinutes * 60 * 1000
        );
        await tx.recoveryAttempt.create({
          data: {
            caseId: recoveryCase.id,
            decisionId: decision.id,
            idempotencyKey: `case:${recoveryCase.id}:decision:${decision.id}:n:1`,
            status: 'pending',
            scheduledFor,
          },
        });
      }

      await writeAudit(
        {
          merchantId: merchant.id,
          actorType: 'system',
          action: 'CASE_OPENED',
          entityType: 'RecoveryCase',
          entityId: recoveryCase.id,
          metadata: {
            source: input.source,
            normalizedReason,
            strategy,
            mlFailSafe,
          },
        },
        tx
      );

      return recoveryCase.id;
    });

    return {
      caseId,
      duplicate: false,
      recoveryDecision,
      fastApiResult,
      mlFailSafe,
      guardrailResult,
      ruleIds,
    };
  } catch (err: unknown) {
    if (err instanceof CaseDuplicateError) {
      return buildDuplicateResult(err.caseId, input);
    }
    throw err;
  }
}
