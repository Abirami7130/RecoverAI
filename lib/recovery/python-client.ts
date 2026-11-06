import type { MerchantPolicyMlPayload } from '@/lib/recovery/merchant-policy-for-ml';

export interface PredictContextInput {
  normalized_reason?: string;
  gateway_latency_ms?: number;
  gateway_error_rate?: number;
  attempts_used?: number;
  amount_paise?: number;
  origin_payment_status?: string;
  open_attempt_exists?: boolean;
  last_attempt_finished_at?: string;
}

export interface FastApiPredictResponse {
  prediction: {
    failure_probability: number | null;
    risk_level: string;
    model_version?: string;
    recovery_probability?: number | null;
    recovery_probability_source?: string;
  };
  decision: {
    failure_probability: number;
    risk_level?: string;
    revenue_at_risk: number;
    decision: string;
    recommended_action: string;
    priority: string;
    reason: string;
    rule_ids?: string[];
  };
  strategy: {
    strategy: string;
    recommended_delay_minutes: number | null;
    max_attempts_remaining: number;
    reason: string;
  };
  guardrail?: {
    result: 'passed' | 'blocked';
    rule_ids: string[];
    final_action: string;
    reason_text: string;
    recommended_method?: string | null;
  };
  outcome: {
    recovery_attempted: boolean;
    outcome: string;
    recovery_success: boolean;
    simulated_recovery_probability: number;
    recovered_amount: number;
    revenue_at_risk: number;
    revenue_recovered: number;
    reason: string;
  };
}

export interface PredictTransactionInput {
  payment_id: string;
  amount: number;
  retry_count: number;
  transactions_last_24h: number;
  time_since_last_payment_min: number;
  hour_of_day: number;
  day_of_week: number;
  subscription_status: string;
  customer_tenure_days: number;
  previous_payment_count: number;
  previous_failure_count: number;
  historical_success_rate: number;
  payment_method: string;
  context?: PredictContextInput;
  policy?: MerchantPolicyMlPayload;
}

export class MlUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MlUpstreamError';
  }
}

export class MlUnreachableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MlUnreachableError';
  }
}

let predictOverride: ((input: PredictTransactionInput) => Promise<FastApiPredictResponse>) | null =
  null;

export function setPredictTransactionForTests(
  fn: ((input: PredictTransactionInput) => Promise<FastApiPredictResponse>) | null
) {
  predictOverride = fn;
}

export async function predictTransaction(
  input: PredictTransactionInput
): Promise<FastApiPredictResponse> {
  if (predictOverride) {
    return predictOverride(input);
  }
  const fastApiUrl = process.env.FASTAPI_URL ?? 'http://localhost:8000';

  try {
    const res = await fetch(`${fastApiUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new MlUpstreamError(detail || `HTTP ${res.status}`);
    }

    return (await res.json()) as FastApiPredictResponse;
  } catch (err: unknown) {
    if (err instanceof MlUpstreamError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new MlUnreachableError(msg);
  }
}

export function buildFailSafeDecision(): FastApiPredictResponse {
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
      decision: 'MONITOR',
      recommended_action: 'Monitor only.',
      priority: 'MEDIUM',
      reason: 'ML service unavailable; monitoring only.',
      rule_ids: ['BASE_MONITOR'],
    },
    strategy: {
      strategy: 'MONITOR',
      recommended_delay_minutes: null,
      max_attempts_remaining: 0,
      reason: 'Fail-safe monitor while ML is unavailable.',
    },
    guardrail: {
      result: 'blocked',
      rule_ids: ['ML_UNAVAILABLE_FAIL_SAFE'],
      final_action: 'MONITOR',
      reason_text:
        'The model did not return a probability, so no order was created.',
    },
    outcome: {
      recovery_attempted: false,
      outcome: 'no_action',
      recovery_success: false,
      simulated_recovery_probability: 0,
      recovered_amount: 0,
      revenue_at_risk: 0,
      revenue_recovered: 0,
      reason: 'No simulation when ML is unavailable.',
    },
  };
}
