import { describe, expect, it } from 'vitest';
import { presentRecoveryDecision } from '@/lib/recovery/present-decision';
import { normalizeFailureReason } from '@/lib/recovery/normalize-reason';

describe('presentRecoveryDecision', () => {
  it('keeps SMART_RETRY as recommendedAction', () => {
    const decision = presentRecoveryDecision(
      {
        prediction: { failure_probability: 0.72, risk_level: 'high' },
        decision: {
          failure_probability: 0.72,
          decision: 'RECOVERY_ATTEMPT',
          reason: 'Base evaluation: RECOVERY_ATTEMPT',
        },
        strategy: {
          strategy: 'SMART_RETRY',
          recommended_delay_minutes: 30,
        },
        outcome: {
          outcome: 'not_recovered',
          simulated_recovery_probability: 0.41,
        },
      },
      'BAD_REQUEST_ERROR',
      'Payment failed',
      'GENERIC_FAILURE'
    );

    expect(decision.strategy).toBe('SMART_RETRY');
    expect(decision.recommendedAction).toBe('SMART_RETRY');
    expect(decision.recoveryProbability).toBeNull();
    expect(decision.failureProbability).toBe(0.72);
    expect(decision.confidence).toBeUndefined();
  });
});

describe('normalizeFailureReason', () => {
  it('maps payment_cancelled from fixture rules', () => {
    expect(
      normalizeFailureReason('payment_cancelled', 'Payment cancelled by user')
    ).toBe('CUSTOMER_CANCELLED');
  });
});
