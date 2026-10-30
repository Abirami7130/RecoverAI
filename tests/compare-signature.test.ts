import { describe, expect, it } from 'vitest';
import { compareCheckoutSignatures } from '@/lib/payments/compare-signature';
import crypto from 'crypto';

describe('compareCheckoutSignatures', () => {
  const secret = 'test_secret_key';
  const orderId = 'order_test_123';
  const paymentId = 'pay_test_456';

  it('returns false when hex lengths differ without throwing', () => {
    const valid = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(() =>
      compareCheckoutSignatures(orderId, paymentId, secret, valid.slice(0, -2))
    ).not.toThrow();

    expect(
      compareCheckoutSignatures(orderId, paymentId, secret, valid.slice(0, -2))
    ).toBe(false);
  });

  it('returns true for a matching HMAC', () => {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(
      compareCheckoutSignatures(orderId, paymentId, secret, signature)
    ).toBe(true);
  });
});
