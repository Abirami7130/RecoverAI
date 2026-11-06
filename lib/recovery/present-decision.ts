import { RecoveryDecision, RecoveryStrategy } from '@/lib/types';

export interface FastApiPredictPayload {
  prediction: {
    failure_probability: number | null;
    risk_level: string;
  };
  decision: {
    failure_probability: number;
    decision: string;
    reason: string;
  };
  strategy: {
    strategy: string;
    recommended_delay_minutes: number | null;
  };
  outcome: {
    outcome: string;
    simulated_recovery_probability: number;
  };
}

const STRATEGY_LABELS: Record<string, string> = {
  NO_RECOVERY: 'No recovery scheduled',
  MONITOR: 'Monitoring for late capture',
  SMART_RETRY: 'Smart retry scheduled',
  ALTERNATIVE_PAYMENT_METHOD: 'Alternative payment method scheduled',
  PRIORITY_RECOVERY: 'Priority recovery scheduled',
  NO_ACTION: 'No recovery scheduled',
};

function asStrategy(raw: string): RecoveryStrategy {
  const allowed: RecoveryStrategy[] = [
    'NO_RECOVERY',
    'MONITOR',
    'SMART_RETRY',
    'ALTERNATIVE_PAYMENT_METHOD',
    'PRIORITY_RECOVERY',
  ];
  if (allowed.includes(raw as RecoveryStrategy)) {
    return raw as RecoveryStrategy;
  }
  return 'SMART_RETRY';
}

/**
 * Maps FastAPI /predict output to the landing RecoveryDecision shape.
 * Python strategy names are preserved (no DELAYED_RETRY collapse).
 */
export function presentRecoveryDecision(
  fastApiResult: FastApiPredictPayload,
  errorCode: string,
  errorDescription: string,
  normalizedReason: string,
  ruleIds: string[] = []
): RecoveryDecision {
  const guardrail = (fastApiResult as { guardrail?: { final_action?: string } })
    .guardrail;
  const strategy = asStrategy(
    guardrail?.final_action ?? fastApiResult.strategy.strategy
  );
  const actionLabel =
    STRATEGY_LABELS[strategy] ??
    STRATEGY_LABELS[fastApiResult.decision.decision] ??
    'Recovery action selected';

  const retryDelayMs = fastApiResult.strategy.recommended_delay_minutes
    ? fastApiResult.strategy.recommended_delay_minutes * 60 * 1000
    : 30_000;

  const useAlternateRoute =
    strategy === 'ALTERNATIVE_PAYMENT_METHOD' || strategy === 'PRIORITY_RECOVERY';

  return {
    failureReason: errorCode || 'RAZORPAY_PAYMENT_FAILURE',
    errorDescription,
    normalizedReason,
    diagnosis: fastApiResult.decision.reason,
    decision: fastApiResult.decision.decision,
    strategy,
    recommendedAction: strategy,
    actionLabel,
    retryDelayMs,
    useAlternateRoute,
    failureProbability:
      fastApiResult.prediction.failure_probability ?? undefined,
    recoveryProbability: null,
    recoveryProbabilitySource: 'not_trained',
    simulatedOutcome: fastApiResult.outcome.outcome,
    simulatedRecoveryProbability: fastApiResult.outcome.simulated_recovery_probability,
    ruleIds,
  };
}
