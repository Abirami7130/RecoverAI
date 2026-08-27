import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payment/verify
 *
 * Verifies a Razorpay payment signature server-side using HMAC-SHA256.
 * RAZORPAY_KEY_SECRET is used here and NEVER sent to the browser.
 *
 * Razorpay generates the signature as:
 *   HMAC-SHA256(order_id + "|" + payment_id, key_secret)
 *
 * Request body:
 *   {
 *     "razorpay_order_id":   "order_xxx",
 *     "razorpay_payment_id": "pay_xxx",
 *     "razorpay_signature":  "<hex string from Razorpay>"
 *   }
 *
 * Success (200):
 *   { "verified": true, "payment_id": "pay_xxx", "order_id": "order_xxx" }
 *
 * Failure (400):
 *   { "verified": false, "error": "Signature verification failed." }
 */
export async function POST(request: NextRequest) {
  // 1. Check that the secret key is available server-side
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error('[verify] RAZORPAY_KEY_SECRET is not set.');
    return NextResponse.json(
      { error: 'Payment service is not configured.' },
      { status: 500 }
    );
  }

  // 2. Parse request body
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

  // 3. All three fields are required
  if (
    typeof razorpay_order_id !== 'string' || !razorpay_order_id ||
    typeof razorpay_payment_id !== 'string' || !razorpay_payment_id ||
    typeof razorpay_signature !== 'string' || !razorpay_signature
  ) {
    return NextResponse.json(
      { error: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required.' },
      { status: 400 }
    );
  }

  // 4. Compute expected HMAC-SHA256 signature
  //    Razorpay spec: HMAC(order_id + "|" + payment_id, key_secret)
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  // 5. Timing-safe comparison to prevent timing attacks
  const signaturesMatch = crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(razorpay_signature, 'hex')
  );

  if (!signaturesMatch) {
    console.warn('[verify] Signature mismatch for order:', razorpay_order_id);
    return NextResponse.json(
      { verified: false, error: 'Signature verification failed.' },
      { status: 400 }
    );
  }

  // 6. Signature is valid — payment is genuine
  return NextResponse.json(
    {
      verified: true,
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
    },
    { status: 200 }
  );
}
