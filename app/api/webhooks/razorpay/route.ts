import { NextRequest, NextResponse } from 'next/server';
import { getRazorpayGateway } from '@/lib/payments/razorpay-gateway';
import { processRazorpayWebhook } from '@/lib/recovery/process-webhook';
import { apiError } from '@/lib/api-error';
import { findCaseIdForOrder } from '@/lib/recovery/webhook-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const signature = request.headers.get('X-Razorpay-Signature');
  if (!signature) {
    return apiError('SIGNATURE_INVALID', 'Missing webhook signature.', 400);
  }

  const rawBody = await request.text();
  const gateway = getRazorpayGateway();

  if (!gateway.verifyWebhookSignature({ rawBody, signature })) {
    console.warn('[webhook] Invalid Razorpay signature');
    return apiError('SIGNATURE_INVALID', 'Webhook signature verification failed.', 400);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return apiError('VALIDATION_ERROR', 'Webhook body must be JSON.', 400);
  }

  try {
    const result = await processRazorpayWebhook(rawBody, parsed as Record<string, unknown>);

    let caseId = result.caseId;
    if (result.duplicate && !caseId) {
      const orderId = extractOrderId(parsed);
      if (orderId) {
        caseId = await findCaseIdForOrder(orderId);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        duplicate: result.duplicate,
        caseId,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[webhook] Processing error:', message);
    return apiError('INTERNAL', 'Webhook processing failed.', 500);
  }
}

function extractOrderId(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const payload = (parsed as { payload?: { payment?: { entity?: { order_id?: string } } } })
    .payload;
  return payload?.payment?.entity?.order_id ?? null;
}
