import { NextRequest, NextResponse } from 'next/server';
import { compareCheckoutSignatures } from '@/lib/payments/compare-signature';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error('[verify] RAZORPAY_KEY_SECRET is not set.');
    return NextResponse.json(
      { error: 'Payment service is not configured.' },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Request body must be an object.' }, { status: 400 });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = body as Record<string, unknown>;

  if (
    typeof razorpay_order_id !== 'string' ||
    !razorpay_order_id ||
    typeof razorpay_payment_id !== 'string' ||
    !razorpay_payment_id ||
    typeof razorpay_signature !== 'string' ||
    !razorpay_signature
  ) {
    return NextResponse.json(
      {
        error:
          'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.',
      },
      { status: 400 }
    );
  }

  const signaturesMatch = compareCheckoutSignatures(
    razorpay_order_id,
    razorpay_payment_id,
    keySecret,
    razorpay_signature
  );

  if (!signaturesMatch) {
    console.warn('[verify] Signature mismatch for order:', razorpay_order_id);
    return NextResponse.json(
      { verified: false, error: 'Signature verification failed.' },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      verified: true,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
    },
    { status: 200 }
  );
}
