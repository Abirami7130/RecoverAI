import crypto from 'crypto';

/**
 * Razorpay checkout signature compare (Phase 1).
 * Never throws on length mismatch — returns false instead.
 */
export function compareCheckoutSignatures(
  orderId: string,
  paymentId: string,
  keySecret: string,
  providedSignature: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature.length !== providedSignature.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch {
    return false;
  }
}
