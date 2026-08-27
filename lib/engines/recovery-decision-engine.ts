import { ProviderMetrics, RecoveryDecision, RiskLevel } from '../types';

export function makeRecoveryDecision(
  metrics: ProviderMetrics,
  riskScore: number,
  riskLevel: RiskLevel
): RecoveryDecision {
  // Low Risk Case: No action required
  if (riskLevel === 'LOW') {
    return {
      failureReason: 'OPTIMAL_OPERATIONS',
      diagnosis: 'Payment provider metrics within optimal operating thresholds.',
      recommendedAction: 'NO_ACTION',
      actionLabel: 'No recovery action required',
      retryDelayMs: 0,
      useAlternateRoute: false,
      confidence: 0.98,
    };
  }

  // Evaluate metric thresholds
  const isHighLatency = metrics.latencyMs > 500;
  const isHighTimeout = metrics.timeoutRate > 2.0;
  const isHighErrorRate = metrics.errorRate > 4.0;
  const isLowSuccessRate = metrics.successRate < 92.0;

  // Count degraded metric signals
  const degradedSignalCount = [
    isHighLatency,
    isHighTimeout,
    isHighErrorRate,
    isLowSuccessRate,
  ].filter(Boolean).length;

  // Multiple signals degraded (Instability)
  if (degradedSignalCount >= 3) {
    return {
      failureReason: 'MULTI_SIGNAL_DEGRADATION',
      diagnosis: 'Payment provider instability detected',
      recommendedAction: 'SCHEDULED_RECOVERY_WINDOW',
      actionLabel: 'Schedule retry during predicted recovery window',
      retryDelayMs: 300000, // 5 minutes
      useAlternateRoute: true,
      confidence: 0.92,
    };
  }

  // High error rate
  if (isHighErrorRate) {
    return {
      failureReason: 'ELEVATED_ERROR_RATE',
      diagnosis: 'Payment provider error rate elevated',
      recommendedAction: 'RETRY_ALTERNATE_PROVIDER',
      actionLabel: 'Retry through alternate provider',
      retryDelayMs: 5000, // 5 seconds
      useAlternateRoute: true,
      confidence: 0.89,
    };
  }

  // Low success rate
  if (isLowSuccessRate) {
    return {
      failureReason: 'DEGRADED_SUCCESS_RATE',
      diagnosis: 'Provider success rate degraded',
      recommendedAction: 'FALLBACK_PAYMENT_ROUTE',
      actionLabel: 'Fallback payment route',
      retryDelayMs: 15000, // 15 seconds
      useAlternateRoute: true,
      confidence: 0.87,
    };
  }

  // High latency / timeout
  if (isHighLatency || isHighTimeout) {
    return {
      failureReason: 'HIGH_LATENCY_TIMEOUT',
      diagnosis: 'Payment provider experiencing elevated latency',
      recommendedAction: 'DELAYED_RETRY',
      actionLabel: 'Delayed retry',
      retryDelayMs: 60000, // 60 seconds
      useAlternateRoute: false,
      confidence: 0.85,
    };
  }

  // Default fallback for MEDIUM risk
  return {
    failureReason: 'MODERATE_JITTER',
    diagnosis: 'Moderate provider performance jitter detected',
    recommendedAction: 'DELAYED_RETRY',
    actionLabel: 'Delayed retry with backoff',
    retryDelayMs: 30000, // 30 seconds
    useAlternateRoute: false,
    confidence: 0.80,
  };
}
