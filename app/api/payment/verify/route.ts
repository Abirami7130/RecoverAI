import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRazorpayGateway } from '@/lib/payments/razorpay-gateway';
import { markCaptured } from '@/lib/recovery/mark-captured';
import { recordTrainingExampleAfterRazorpayFetch } from '@/lib/recovery/record-training-example';
import { apiError } from '@/lib/api-error';
import {
  checkRateLimit,
  clientIpFromHeaders,
} from '@/lib/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const ip = clientIpFromHeaders(request.headers);
  const rate = checkRateLimit(`payment-verify:${ip}`);
  if (!rate.allowed) {
    return apiError(
      'RATE_LIMITED',
      'Too many payment verification requests. Try again shortly.',
      429
    );
  }

  if (!process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_USE_FAKE !== 'true') {
    console.error('[verify] RAZORPAY_KEY_SECRET is not set.');
    return apiError('INTERNAL', 'Payment service is not configured.', 500, {
      error: 'Payment service is not configured.',
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body.', 400, {
      error: 'Invalid JSON body.',
    });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'VALIDATION_ERROR',
      'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
      400,
      {
        error:
          'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
      }
    );
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    parsed.data;

  const gateway = getRazorpayGateway();
  const signaturesMatch = gateway.verifyCheckoutSignature({
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });

  if (!signaturesMatch) {
    console.warn('[verify] Signature mismatch for order:', razorpay_order_id);
    return NextResponse.json(
      { verified: false, error: 'Signature verification failed.' },
      { status: 400 }
    );
  }

  let remote;
  try {
    remote = await gateway.fetchPayment(razorpay_payment_id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[verify] fetchPayment failed:', message);
    return apiError('INTERNAL', 'Could not verify payment status with Razorpay.', 500, {
      error: 'Could not verify payment status with Razorpay.',
    });
  }

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: razorpay_order_id },
  });

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        razorpayPaymentId: razorpay_payment_id,
        ...(remote.status === 'failed' ? { status: 'failed' } : {}),
      },
    });
  }

  if (
    remote.status === 'captured' &&
    payment &&
    remote.amount === payment.amountPaise
  ) {
    await markCaptured(payment.id);
  } else if (payment && remote.status === 'failed') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });
    if (payment.recoveryCaseId && payment.parentPaymentId) {
      await recordTrainingExampleAfterRazorpayFetch(
        payment.id,
        false,
        new Date()
      );
    }
  } else if (payment && remote.status === 'authorized') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'authorized' },
    });
  }

  const refreshed = payment
    ? await prisma.payment.findUnique({ where: { id: payment.id } })
    : null;

  const countsAsRecovered =
    Boolean(refreshed?.recoveryCaseId) && remote.status === 'captured';

  return NextResponse.json(
    {
      verified: true,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      status: remote.status,
      amount_paise: remote.amount,
      counts_as_recovered_revenue: countsAsRecovered,
    },
    { status: 200 }
  );
}
