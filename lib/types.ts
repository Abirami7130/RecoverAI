export interface ProviderMetrics {
  latencyMs: number;
  successRate: number;
  errorRate: number;
  timeoutRate: number;
  volume: number;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Python strategy names shown on the landing page (Phase 1). */
export type RecoveryStrategy =
  | 'NO_RECOVERY'
  | 'MONITOR'
  | 'SMART_RETRY'
  | 'ALTERNATIVE_PAYMENT_METHOD'
  | 'PRIORITY_RECOVERY';

/** Legacy mock-engine labels still present during the same session. */
export type LegacyRecoveryAction =
  | 'NO_ACTION'
  | 'DELAYED_RETRY'
  | 'RETRY_ALTERNATE_PROVIDER'
  | 'FALLBACK_PAYMENT_ROUTE'
  | 'SCHEDULED_RECOVERY_WINDOW';

export type RecoveryAction = RecoveryStrategy | LegacyRecoveryAction;

export type ExecutionStatus =
  | 'IDLE'
  | 'SCHEDULED'
  | 'EXECUTING'
  | 'SUCCESS'
  | 'FAILED';

export type TerminalState =
  | 'simulated_recovered'
  | 'simulated_not_recovered'
  | 'not_attempted'
  | 'simulated_demo_complete'
  | 'ml_unavailable';

export type DataOrigin = 'simulation' | 'razorpay_failure';

export interface RecoveryAccounting {
  illustrativeSampleRecoveredInr: number;
  illustrativeSampleLabel: string;
  sessionSimulatedRecoveredInr: number;
  verifiedRecoveredInr: number;
  sessionSimulatedTransactions: number;
  verifiedTransactions: number;
}

export interface RecoveryDecision {
  failureReason: string;
  errorDescription?: string;
  normalizedReason?: string;
  diagnosis: string;
  /** Python decision band (e.g. RECOVERY_ATTEMPT). */
  decision?: string;
  strategy?: RecoveryStrategy;
  recommendedAction: RecoveryAction;
  actionLabel: string;
  retryDelayMs: number;
  useAlternateRoute: boolean;
  failureProbability?: number;
  recoveryProbability?: number | null;
  recoveryProbabilitySource?: string;
  simulatedOutcome?: string;
  simulatedRecoveryProbability?: number;
  /** @deprecated Phase 1 — use failureProbability */
  confidence?: number;
}

export interface RecoveryEvent {
  id: number;
  amount: number;
  step: number;
  decision?: RecoveryDecision;
  executionStatus?: ExecutionStatus;
  executionStartTime?: number;
  terminalState?: TerminalState;
  dataOrigin?: DataOrigin;
  errorDescription?: string;
  normalizedReason?: string;
  failureProbability?: number;
  simulatedRecoveryProbability?: number;
  simulatedOutcome?: string;
  strategy?: RecoveryStrategy;
}

export interface MonitoringState {
  metrics: ProviderMetrics;
  riskScore: number;
  riskLevel: RiskLevel;
  riskExposure: number;
  /** Deprecated alias of accounting.sessionSimulatedRecoveredInr */
  revenueRecovered: number;
  /** Deprecated alias of accounting.sessionSimulatedTransactions */
  transactionsSaved: number;
  accounting: RecoveryAccounting;
  activeRecovery: RecoveryEvent;
  latestDecision?: RecoveryDecision;
  timestamp: number;
}

/**
 * Represents a real Razorpay payment failure event.
 * Contains ONLY values that Razorpay actually returns — nothing fabricated.
 */
export interface RazorpayPaymentFailure {
  orderId: string;
  paymentId: string | null;
  amountInr: number;
  errorCode: string;
  errorDescription: string;
  errorReason: string;
  timestamp: number;
}
