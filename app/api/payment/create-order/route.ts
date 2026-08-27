import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';

// Force this route to always run on the server (never cached, never static).
// This is required for any route that reads secret env vars or hits an external API.
export const dynamic = 'force-dynamic';

/**
 * POST /api/payment/create-order
 *
 * Creates a Razorpay order in Test Mode for a given INR amount.
 * The Razorpay Key Secret never leaves this server-side handler.
 *
 * Request body:
 *   { "amount": <positive number in INR, e.g. 499.00> }
 *
 * Success response (200):
 *   { "order_id": "order_xxx", "amount": 49900, "currency": "INR" }
 *
 * Error responses:
 *   400 – missing or invalid amount
 *   500 – missing env vars, or Razorpay API error
 */
export async function POST(request: NextRequest) {
  // ── 1. Validate environment variables ──────────────────────────────────────
  // Both keys must be present before we attempt anything.
  // RAZORPAY_KEY_SECRET is server-only; it must NEVER be prefixed with NEXT_PUBLIC_.
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error(
      '[create-order] Missing Razorpay env vars. ' +
        'Ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in .env.local.'
    );
    return NextResponse.json(
      { error: 'Payment service is not configured. Contact support.' },
      { status: 500 }
    );
  }

  // ── 2. Parse and validate the request body ─────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  // Type-narrow: body must be a plain object with an `amount` field.
  if (
    typeof body !== 'object' ||
    body === null ||
    !('amount' in body)
  ) {
    return NextResponse.json(
      { error: 'Request body must include an "amount" field.' },
      { status: 400 }
    );
  }

  const rawAmount = (body as Record<string, unknown>).amount;

  // amount must be a finite positive number (INR rupees, e.g. 499.00).
  if (
    typeof rawAmount !== 'number' ||
    !isFinite(rawAmount) ||
    rawAmount <= 0
  ) {
    return NextResponse.json(
      { error: '"amount" must be a positive number representing INR (e.g. 499.00).' },
      { status: 400 }
    );
  }

  // ── 3. Convert INR to paise ────────────────────────────────────────────────
  // Razorpay requires the amount in the smallest currency unit.
  // For INR: 1 rupee = 100 paise.
  // Math.round prevents floating-point errors (e.g. 149.99 × 100 = 14998.999…).
  const amountInPaise = Math.round(rawAmount * 100);

  // ── 4. Instantiate the Razorpay client ────────────────────────────────────
  // We instantiate per-request here so that hot-reloaded env vars are always
  // picked up in development without restarting the server.
  const razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  // ── 5. Create the Razorpay order ──────────────────────────────────────────
  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,   // integer, in paise
      currency: 'INR',
      // receipt is optional but useful for correlating orders in Razorpay dashboard
      receipt: `rcpt_${Date.now()}`,
    });

    // Return only what the frontend needs.
    // NEVER include key_secret in this response.
    return NextResponse.json(
      {
        order_id: order.id,
        amount: order.amount,    // paise (integer), as echoed by Razorpay
        currency: order.currency, // 'INR'
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    // Razorpay SDK throws plain Error objects or objects with an `error` property.
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'error' in err
        ? JSON.stringify((err as { error: unknown }).error)
        : 'Unknown error';

    console.error('[create-order] Razorpay API error:', message);

    return NextResponse.json(
      { error: 'Failed to create payment order. Please try again.' },
      { status: 500 }
    );
  }
}

