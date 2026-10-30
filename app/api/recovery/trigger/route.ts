import { NextRequest, NextResponse } from 'next/server';
import { simulationService } from '@/lib/engines/simulation-service';
import { getDemoCustomer } from '@/lib/data/demo-customer-history';
import { buildCustomerHistoryFeatures } from '@/lib/ml/build-transaction-features';
import { normalizeFailureReason } from '@/lib/recovery/normalize-reason';
import { presentRecoveryDecision } from '@/lib/recovery/present-decision';

export const dynamic = 'force-dynamic';

interface TriggerBody {
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amountInr: number;
  errorCode: string;
  errorDescription: string;
  errorReason: string;
  payment_method?: string;
}

interface FastApiPredictResponse {
  prediction: {
    failure_probability: number;
    risk_level: 'low' | 'medium' | 'high';
  };
  decision: {
    failure_probability: number;
    risk_level: string;
    revenue_at_risk: number;
    decision: string;
    recommended_action: string;
    priority: string;
    reason: string;
  };
  strategy: {
    strategy: string;
    recommended_delay_minutes: number | null;
    max_attempts_remaining: number;
    reason: string;
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

function mapPaymentMethod(raw?: string): 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' {
  if (!raw) return 'CARD';
  const upper = raw.toUpperCase();
  if (upper.includes('UPI') || upper.includes('VPA')) return 'UPI';
  if (upper.includes('NET') || upper.includes('BANK')) return 'NETBANKING';
  if (upper.includes('WALLET') || upper.includes('PAYTM') || upper.includes('PHONEPE')) {
    return 'WALLET';
  }
  return 'CARD';
}

export async function POST(request: NextRequest) {
  let body: TriggerBody;
  try {
    body = (await request.json()) as TriggerBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const {
    razorpay_order_id,
    amountInr,
    errorCode,
    errorDescription,
    errorReason,
    payment_method,
    razorpay_payment_id,
  } = body;

  if (!razorpay_order_id || !amountInr || amountInr <= 0) {
    return NextResponse.json(
      { error: 'razorpay_order_id and a positive amountInr are required.' },
      { status: 400 }
    );
  }

  const normalizedReason = normalizeFailureReason(
    errorReason ?? '',
    errorDescription ?? ''
  );

  const now = new Date();

  const razorpayDerived = {
    payment_id: razorpay_order_id,
    amount: amountInr,
    payment_method: mapPaymentMethod(payment_method ?? errorReason),
  };

  const derived = {
    retry_count: 0,
    hour_of_day: now.getHours(),
    day_of_week: now.getDay(),
  };

  const demoCustomer = getDemoCustomer('demo_customer_001', now.getTime());
  if (!demoCustomer) {
    return NextResponse.json({ error: 'Demo customer not found.' }, { status: 500 });
  }
  const syntheticHistory = buildCustomerHistoryFeatures(demoCustomer, now.getTime());

  const transactionInput = {
    ...razorpayDerived,
    ...derived,
    ...syntheticHistory,
  };

  const fastApiUrl = process.env.FASTAPI_URL ?? 'http://localhost:8000';

  let fastApiResult: FastApiPredictResponse;
  try {
    const res = await fetch(`${fastApiUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transactionInput),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[recovery/trigger] FastAPI error ${res.status}:`, detail);
      return NextResponse.json(
        { error: 'ML prediction service returned an error.', detail },
        { status: 502 }
      );
    }

    fastApiResult = (await res.json()) as FastApiPredictResponse;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[recovery/trigger] Could not reach FastAPI:', msg);
    return NextResponse.json(
      {
        error: 'ML prediction service is not reachable.',
        detail: msg,
        hint: 'Start the FastAPI server: cd ml && uvicorn api:app --reload',
      },
      { status: 503 }
    );
  }

  const recoveryDecision = presentRecoveryDecision(
    fastApiResult,
    errorCode,
    errorDescription,
    normalizedReason
  );

  simulationService.injectRealEvent({
    amount: amountInr,
    decision: recoveryDecision,
    errorDescription,
    normalizedReason,
  });

  const accounting = simulationService.getAccounting();

  return NextResponse.json(
    {
      status: 'injected',
      dataClassification: {
        razorpay_derived: {
          payment_id: razorpayDerived.payment_id,
          amount_inr: razorpayDerived.amount,
          payment_method_mapped: razorpayDerived.payment_method,
          razorpay_payment_id: razorpay_payment_id ?? null,
          error_code: errorCode,
          error_description: errorDescription,
          error_reason: errorReason,
          normalized_reason: normalizedReason,
        },
        derived_from_server_time: {
          retry_count: derived.retry_count,
          hour_of_day: derived.hour_of_day,
          day_of_week: derived.day_of_week,
        },
        synthetic_history: syntheticHistory,
      },
      mlResult: {
        failure_probability: fastApiResult.prediction.failure_probability,
        risk_level: fastApiResult.prediction.risk_level,
        decision: fastApiResult.decision.decision,
        strategy: fastApiResult.strategy.strategy,
        simulated_outcome: fastApiResult.outcome.outcome,
        simulated_recovery_probability:
          fastApiResult.outcome.simulated_recovery_probability,
        simulation_disclaimer:
          'Outcome is a synthetic simulation (deterministic pseudo-random formula). ' +
          'It does NOT represent an actual Razorpay payment recovery.',
      },
      recoveryDecision,
      accounting: {
        verifiedRecoveredInr: accounting.verifiedRecoveredInr,
        sessionSimulatedRecoveredInr: accounting.sessionSimulatedRecoveredInr,
        countedThisEventAsRecovered: false,
      },
    },
    { status: 200 }
  );
}
