import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { simulationService } from '@/lib/engines/simulation-service';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import { apiError } from '@/lib/api-error';
import {
  checkRateLimit,
  clientIpFromHeaders,
} from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const triggerSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().nullable().optional(),
  amountInr: z.number().finite().positive(),
  errorCode: z.string().optional(),
  errorDescription: z.string().optional(),
  errorReason: z.string().optional(),
  payment_method: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  const rate = checkRateLimit(`recovery-trigger:${ip}`);
  if (!rate.allowed) {
    return apiError(
      'RATE_LIMITED',
      'Too many recovery trigger requests. Try again shortly.',
      429
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body.', 400, {
      error: 'Invalid JSON body.',
    });
  }

  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'VALIDATION_ERROR',
      'razorpay_order_id and a positive amountInr are required.',
      400,
      { error: 'razorpay_order_id and a positive amountInr are required.' }
    );
  }

  const {
    razorpay_order_id,
    amountInr,
    errorCode = '',
    errorDescription = '',
    errorReason = '',
    payment_method,
    razorpay_payment_id,
  } = parsed.data;

  let ingest;
  try {
    ingest = await ingestFailure({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id ?? null,
      amountInr,
      errorCode,
      errorDescription,
      errorReason,
      paymentMethod: payment_method,
      source: 'browser',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[recovery/trigger] ingestFailure failed:', message);
    return apiError('INTERNAL', 'Could not record payment failure.', 500, {
      error: 'Could not record payment failure.',
    });
  }

  if (ingest.skippedReason === 'PAYMENT_NOT_FOUND') {
    return apiError('NOT_FOUND', 'No payment record for this order.', 404, {
      error: 'No payment record for this order.',
    });
  }

  if (ingest.skippedReason === 'ALREADY_CAPTURED') {
    return NextResponse.json(
      {
        status: 'skipped',
        reason: 'ALREADY_CAPTURED',
        duplicate: false,
      },
      { status: 200 }
    );
  }

  const recoveryDecision = ingest.recoveryDecision;
  if (recoveryDecision) {
    simulationService.injectRealEvent({
      amount: amountInr,
      decision: recoveryDecision,
      errorDescription,
      normalizedReason:
        recoveryDecision.normalizedReason ??
        recoveryDecision.failureReason ??
        'GENERIC_FAILURE',
    });
  }

  const accounting = simulationService.getAccounting();

  return NextResponse.json(
    {
      status: ingest.duplicate ? 'duplicate' : 'injected',
      duplicate: ingest.duplicate,
      caseId: ingest.caseId,
      recoveryDecision,
      guardrailResult: ingest.guardrailResult,
      ruleIds: ingest.ruleIds,
      accounting: {
        verifiedRecoveredInr: accounting.verifiedRecoveredInr,
        sessionSimulatedRecoveredInr: accounting.sessionSimulatedRecoveredInr,
        countedThisEventAsRecovered: false,
      },
    },
    { status: 200 }
  );
}
