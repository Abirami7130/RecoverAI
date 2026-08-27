export interface ProviderMetrics {
  latencyMs: number;
  successRate: number;
  errorRate: number;
  timeoutRate: number;
  volume: number;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type RecoveryAction = 
  | 'NO_ACTION'
  | 'DELAYED_RETRY'
  | 'RETRY_ALTERNATE_PROVIDER'
  | 'FALLBACK_PAYMENT_ROUTE'
  | 'SCHEDULED_RECOVERY_WINDOW';

export type ExecutionStatus = 'IDLE' | 'SCHEDULED' | 'EXECUTING' | 'SUCCESS' | 'FAILED';

export interface RecoveryDecision {
  failureReason: string;
  diagnosis: string;
  recommendedAction: RecoveryAction;
  actionLabel: string;
  retryDelayMs: number;
  useAlternateRoute: boolean;
  confidence: number;
}

export interface RecoveryEvent {
  id: number;
  amount: number;
  step: number; // 1: DETECTED, 2: DIAGNOSING, 3: PREDICTED, 4: SCHEDULED, 5: RECOVERED
  decision?: RecoveryDecision;
  executionStatus?: ExecutionStatus;
  executionStartTime?: number;
}

export interface MonitoringState {
  metrics: ProviderMetrics;
  riskScore: number;
  riskLevel: RiskLevel;
  riskExposure: number;
  revenueRecovered: number;
  transactionsSaved: number;
  activeRecovery: RecoveryEvent;
  latestDecision?: RecoveryDecision;
  timestamp: number;
}

/**
 * Represents a real Razorpay payment failure event.
 * Contains ONLY values that Razorpay actually returns — nothing fabricated.
 */
export interface RazorpayPaymentFailure {
  /** Razorpay order ID (e.g. "order_Pxxxxxxx") */
  orderId: string;
  /** Razorpay payment ID if one was created before failure, otherwise null */
  paymentId: string | null;
  /** Amount in INR rupees (converted from paise) */
  amountInr: number;
  /** Razorpay error code e.g. "BAD_REQUEST_ERROR" */
  errorCode: string;
  /** Human-readable description returned by Razorpay */
  errorDescription: string;
  /** Razorpay error reason e.g. "payment_cancelled" */
  errorReason: string;
  /** Unix ms timestamp of the failure */
  timestamp: number;
}