import type { FastApiPredictResponse } from '@/lib/recovery/python-client';

export function approvalRequiredMlFixture(): FastApiPredictResponse {
  return {
    ...smartRetryMlFixture(),
    guardrail: {
      result: 'blocked',
      rule_ids: ['BASE_RECOVERY_ATTEMPT', 'APPROVAL_REQUIRED'],
      final_action: 'SMART_RETRY',
      reason_text:
        'Smart retry recommended. Guardrail APPROVAL_REQUIRED blocked order creation.',
      recommended_method: null,
    },
  };
}

export function subscriptionCancelledBlockedFixture(): FastApiPredictResponse {
  return {
    prediction: {
      failure_probability: null,
      risk_level: 'medium',
      model_version: 'gb-2026-10-30-synthetic',
      recovery_probability: null,
      recovery_probability_source: 'not_trained',
    },
    decision: {
      failure_probability: 0,
      risk_level: 'medium',
      revenue_at_risk: 0,
      decision: 'NO_ACTION',
      recommended_action: 'No recovery.',
      priority: 'LOW',
      reason: 'Cancelled subscription; no automatic retry.',
      rule_ids: ['BASE_NO_ACTION'],
    },
    strategy: {
      strategy: 'NO_RECOVERY',
      recommended_delay_minutes: null,
      max_attempts_remaining: 0,
      reason: 'Subscription cancelled.',
    },
    guardrail: {
      result: 'blocked',
      rule_ids: ['REASON_DISABLED'],
      final_action: 'NO_RECOVERY',
      reason_text: 'Guardrail REASON_DISABLED blocked execution for cancelled subscription.',
      recommended_method: null,
    },
    outcome: {
      recovery_attempted: false,
      outcome: 'no_action',
      recovery_success: false,
      simulated_recovery_probability: 0,
      recovered_amount: 0,
      revenue_at_risk: 0,
      revenue_recovered: 0,
      reason: 'Blocked.',
    },
  };
}

export function smartRetryMlFixture(): FastApiPredictResponse {
  return {
    prediction: {
      failure_probability: 0.72,
      risk_level: 'high',
      model_version: 'gb-2026-10-30-synthetic',
      recovery_probability: null,
      recovery_probability_source: 'not_trained',
    },
    decision: {
      failure_probability: 0.72,
      risk_level: 'high',
      revenue_at_risk: 359.28,
      decision: 'RECOVERY_ATTEMPT',
      recommended_action: 'Execute automated smart recovery workflow immediately.',
      priority: 'HIGH',
      reason: 'Smart retry recommended.',
      rule_ids: ['BASE_RECOVERY_ATTEMPT'],
    },
    strategy: {
      strategy: 'SMART_RETRY',
      recommended_delay_minutes: 0,
      max_attempts_remaining: 3,
      reason: 'Retry soon.',
    },
    guardrail: {
      result: 'passed',
      rule_ids: ['BASE_RECOVERY_ATTEMPT'],
      final_action: 'SMART_RETRY',
      reason_text:
        'Base evaluation: RECOVERY_ATTEMPT (Predicted failure probability: 72.00%). Strategy SMART_RETRY with a 0 minute delay. Guardrail passed.',
    },
    outcome: {
      recovery_attempted: true,
      outcome: 'not_recovered',
      recovery_success: false,
      simulated_recovery_probability: 0.41,
      recovered_amount: 0,
      revenue_at_risk: 359.28,
      revenue_recovered: 0,
      reason: 'Simulated not recovered.',
    },
  };
}

export function customerCancelledMlFixture(): FastApiPredictResponse {
  return {
    prediction: {
      failure_probability: null,
      risk_level: 'medium',
      model_version: 'gb-2026-10-30-synthetic',
      recovery_probability: null,
      recovery_probability_source: 'not_trained',
    },
    decision: {
      failure_probability: 0,
      risk_level: 'medium',
      revenue_at_risk: 0,
      decision: 'NO_ACTION',
      recommended_action: 'No recovery.',
      priority: 'LOW',
      reason: 'Customer cancelled; no recovery.',
      rule_ids: ['BASE_NO_ACTION'],
    },
    strategy: {
      strategy: 'NO_RECOVERY',
      recommended_delay_minutes: null,
      max_attempts_remaining: 0,
      reason: 'Failure reason is not eligible for automatic retry.',
    },
    guardrail: {
      result: 'blocked',
      rule_ids: ['REASON_DISABLED'],
      final_action: 'NO_RECOVERY',
      reason_text:
        'Customer cancelled or disabled reason; no recovery. Guardrail REASON_DISABLED blocked execution.',
    },
    outcome: {
      recovery_attempted: false,
      outcome: 'no_action',
      recovery_success: false,
      simulated_recovery_probability: 0,
      recovered_amount: 0,
      revenue_at_risk: 0,
      revenue_recovered: 0,
      reason: 'Guardrail REASON_DISABLED blocked execution.',
    },
  };
}
