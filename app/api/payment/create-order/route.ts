import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import { apiError } from '@/lib/api-error';
import {
  checkRateLimit,
  clientIpFromHeaders,
} from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const createOrderSchema = z.object({
  amount: z.number().finite().positive().max(500_000),
});

export async function POST(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  const rate = checkRateLimit(`create-order:${ip}`);
  if (!rate.allowed) {
    return apiError(
      'RATE_LIMITED',
      'Too many order creation requests. Try again shortly.',
      429
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Request body must be valid JSON.', 400);
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'VALIDATION_ERROR',
      'amount must be a positive number of rupees.',
      400,
      {
        details: [{ field: 'amount', issue: 'invalid' }],
        error: 'amount must be a positive number of rupees.',
      }
    );
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    if (process.env.RAZORPAY_USE_FAKE !== 'true') {
      console.error('[create-order] Missing Razorpay env vars.');
      return apiError(
        'INTERNAL',
        'Payment service is not configured. Contact support.',
        500,
        { error: 'Payment service is not configured. Contact support.' }
      );
    }
  }

  const idempotencyKey = request.headers.get('Idempotency-Key');

  try {
    const result = await createDemoOrder({
      amountInr: parsed.data.amount,
      idempotencyKey,
    });

    if (!result.ok) {
      return apiError(result.code, result.message, result.status, {
        error: result.message,
      });
    }

    return NextResponse.json(
      {
        order_id: result.order_id,
        amount: result.amount,
        currency: result.currency,
        payment_record_id: result.payment_record_id,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[create-order] Failed:', message);
    return apiError('INTERNAL', 'Failed to create payment order. Please try again.', 500, {
      error: 'Failed to create payment order. Please try again.',
    });
  }
}
