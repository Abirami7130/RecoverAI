import { NextRequest, NextResponse } from 'next/server';
import { simulationService } from '@/lib/engines/simulation-service';
import { RecoveryDecision } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recovery/trigger
 *
 * Receives a Razorpay payment failure event from the browser, enriches it with
 * derived/demo features, calls the EXISTING FastAPI ML /predict endpoint, and
 * injects the resulting recovery decision into the live simulation service.
 *
 * ─── ML FIELD CLASSIFICATION ──────────────────────────────────────────────────
 *
 * RAZORPAY-DERIVED (observed directly from the Razorpay failure event):
 *   • payment_id             → razorpay_order_id  (Razorpay order ID)
 *   • amount                 → amountInr          (paise ÷ 100, from Razorpay order)
 *   • payment_method         → mapped from error.reason / method field
 *
 * DERIVED (computed server-side from known facts at the moment of failure):
 *   • retry_count            → always 0 for the initial failure (this is the first attempt)
 *   • hour_of_day            → JavaScript Date hour at time of failure
 *   • day_of_week            → JavaScript Date weekday at time of failure
 *
 * DEMO / DEFAULT (unavailable from Razorpay — clearly documented assumptions):
 *   These values are fixed demo defaults. They are NOT fabricated customer data.
 *   The FastAPI model requires all 12 numeric/categorical fields to run.
 *   None of these values are presented to the user as real Razorpay data.
 *
 *   • time_since_last_payment_min  = 60     (demo: 1 hour since last attempt)
 *   • transactions_last_24h        = 1      (demo: typical single-transaction session)
 *   • subscription_status          = "active"  (demo: the most common training-set state)
 *   • customer_tenure_days         = 180    (demo: 6-month median-tenure customer)
 *   • previous_payment_count       = 10     (demo: established customer baseline)
 *   • previous_failure_count       = 1      (demo: one historical failure on record)
 *   • historical_success_rate      = 0.90   (demo: good-standing customer)
 *
 * ─── RECOVERY OUTCOME DISCLAIMER ──────────────────────────────────────────────
 *
 * The ML pipeline's "outcome.outcome" field (recovered / not_recovered) is a
 * SYNTHETIC SIMULATION based on a deterministic pseudo-random formula tied to
 * the payment_id hash. It does NOT represent an actual Razorpay recovery.
 * No real money is moved. The UI must reflect this clearly.
 */

/** Shape of the body the browser sends to this endpoint. */
interface TriggerBody {
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amountInr: number;
  errorCode: string;
  errorDescription: string;
  errorReason: string;
  /** payment_method as reported by the Razorpay SDK (optional) */
  payment_method?: string;
}

/** Minimal FastAPI response shape we consume. */
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

/**
 * Maps a Razorpay errorReason / payment method string to one of the four
 * categorical values the model was trained on: UPI | CARD | NETBANKING | WALLET
 *
 * Razorpay does not always surface the exact method in the failure callback,
 * so we do best-effort mapping and fall back to CARD (the second-most common
 * training-set category).
 */
function mapPaymentMethod(raw?: string): 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' {
  if (!raw) return 'CARD'; // safe fallback
  const upper = raw.toUpperCase();
  if (upper.includes('UPI') || upper.includes('VPA')) return 'UPI';
  if (upper.includes('NET') || upper.includes('BANK')) return 'NETBANKING';
  if (upper.includes('WALLET') || upper.includes('PAYTM') || upper.includes('PHONEPE')) return 'WALLET';
  return 'CARD';
}

/**
 * Translates the FastAPI pipeline response into the RecoveryDecision shape
 * that the existing simulation-service and LiveRecoveryPath expect.
 */
function buildRecoveryDecision(
  fastApiResult: FastApiPredictResponse,
  errorCode: string
): RecoveryDecision {
  const { decision, strategy } = fastApiResult;

  // Map FastAPI strategy → existing RecoveryAction enum
  const actionMap: Record<string, RecoveryDecision['recommendedAction']> = {
    NO_ACTION: 'NO_ACTION',
    MONITOR: 'DELAYED_RETRY',
    RECOVERY_ATTEMPT: 'DELAYED_RETRY',
    PRIORITY_RECOVERY: 'RETRY_ALTERNATE_PROVIDER',
    SMART_RETRY: 'DELAYED_RETRY',
    ALTERNATIVE_PAYMENT_METHOD: 'FALLBACK_PAYMENT_ROUTE',
    PRIORITY_RECOVERY_STRATEGY: 'SCHEDULED_RECOVERY_WINDOW',
  };

  const actionLabelMap: Record<string, string> = {
    NO_ACTION: 'No recovery action required',
    MONITOR: 'Delayed retry',
    RECOVERY_ATTEMPT: 'Delayed retry',
    PRIORITY_RECOVERY: 'Retry via alternate provider',
    SMART_RETRY: 'Delayed retry',
    ALTERNATIVE_PAYMENT_METHOD: 'Fallback payment route',
    PRIORITY_RECOVERY_STRATEGY: 'Scheduled recovery window',
  };

  const recommendedAction =
    actionMap[strategy.strategy] ?? actionMap[decision.decision] ?? 'DELAYED_RETRY';

  const actionLabel =
    actionLabelMap[strategy.strategy] ?? actionLabelMap[decision.decision] ?? 'Delayed retry';

  // Convert delay minutes → ms (cap at 8000 ms for demo visual timing)
  const retryDelayMs = strategy.recommended_delay_minutes
    ? strategy.recommended_delay_minutes * 60 * 1000
    : 30_000;

  const useAlternateRoute = recommendedAction === 'RETRY_ALTERNATE_PROVIDER'
    || recommendedAction === 'FALLBACK_PAYMENT_ROUTE'
    || recommendedAction === 'SCHEDULED_RECOVERY_WINDOW';

  return {
    failureReason: errorCode || 'RAZORPAY_PAYMENT_FAILURE',
    diagnosis: decision.reason,
    recommendedAction,
    actionLabel,
    retryDelayMs,
    useAlternateRoute,
    confidence: fastApiResult.prediction.failure_probability,
  };
}

export async function POST(request: NextRequest) {
  // ── 1. Parse request ──────────────────────────────────────────────────────
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

  // ── 2. Build the FastAPI TransactionInput ────────────────────────────────
  const now = new Date();

  /**
   * Documented field-by-field breakdown:
   *
   *  ✅ RAZORPAY-DERIVED
   */
  const razorpayDerived = {
    payment_id: razorpay_order_id,                           // Razorpay order ID
    amount: amountInr,                                        // Exact INR amount from Razorpay
    payment_method: mapPaymentMethod(payment_method ?? errorReason), // Best-effort from failure event
  };

  /**
   *  ✅ DERIVED (computed from server time at moment of failure)
   */
  const derived = {
    retry_count: 0,                          // This IS the first attempt — retry=0 is factual
    hour_of_day: now.getHours(),             // Current server hour (0-23)
    day_of_week: now.getDay(),               // Current server weekday (0=Sun … 6=Sat)
  };

  /**
   *  ⚠️ DEMO / DEFAULT — not fabricated customer data; required by model to run
   */
  const demoDefaults = {
    time_since_last_payment_min: 60,         // Demo: 1 hour (typical session gap)
    transactions_last_24h: 1,               // Demo: single-attempt session
    subscription_status: 'active',           // Demo: most common training-set category
    customer_tenure_days: 180,              // Demo: 6-month median tenure
    previous_payment_count: 10,             // Demo: established customer
    previous_failure_count: 1,              // Demo: one prior failure in history
    historical_success_rate: 0.90,          // Demo: good-standing customer
  };

  const transactionInput = {
    ...razorpayDerived,
    ...derived,
    ...demoDefaults,
  };

  // ── 3. Call the existing FastAPI /predict endpoint ────────────────────────
  const fastApiUrl = process.env.FASTAPI_URL ?? 'http://localhost:8000';

  let fastApiResult: FastApiPredictResponse;
  try {
    const res = await fetch(`${fastApiUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transactionInput),
      // 10-second timeout via AbortController
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

  // ── 4. Build RecoveryDecision in the existing simulation format ───────────
  const recoveryDecision = buildRecoveryDecision(fastApiResult, errorCode);

  // ── 5. Inject the real event into the simulation service ─────────────────
  //
  // injectRealEvent() will:
  //   • Set activeRecovery to step 1 (DETECTED) with the real amount/decision
  //   • Raise a flag so the random mock outage generator does NOT overwrite it
  //
  simulationService.injectRealEvent({
    amount: amountInr,
    decision: recoveryDecision,
  });

  // ── 6. Return a transparent response to the frontend ─────────────────────
  return NextResponse.json(
    {
      status: 'injected',
      /**
       * Clearly distinguished field groups returned to client for transparency
       */
      dataClassification: {
        razorpay_derived: {
          payment_id: razorpayDerived.payment_id,
          amount_inr: razorpayDerived.amount,
          payment_method_mapped: razorpayDerived.payment_method,
          razorpay_payment_id: razorpay_payment_id ?? null,
          error_code: errorCode,
          error_description: errorDescription,
          error_reason: errorReason,
        },
        derived_from_server_time: {
          retry_count: derived.retry_count,
          hour_of_day: derived.hour_of_day,
          day_of_week: derived.day_of_week,
        },
        demo_defaults: demoDefaults,
      },
      mlResult: {
        failure_probability: fastApiResult.prediction.failure_probability,
        risk_level: fastApiResult.prediction.risk_level,
        decision: fastApiResult.decision.decision,
        strategy: fastApiResult.strategy.strategy,
        /**
         * IMPORTANT: The outcome below is a SYNTHETIC SIMULATION.
         * It does NOT represent an actual Razorpay fund recovery.
         * No real money was moved.
         */
        simulated_outcome: fastApiResult.outcome.outcome,
        simulated_recovery_probability: fastApiResult.outcome.simulated_recovery_probability,
        simulation_disclaimer:
          'Outcome is a synthetic simulation (deterministic pseudo-random formula). ' +
          'It does NOT represent an actual Razorpay payment recovery.',
      },
      recoveryDecision,
    },
    { status: 200 }
  );
}
