import crypto from 'crypto';
import Razorpay from 'razorpay';
import { compareCheckoutSignatures } from './compare-signature';
import type {
  CreateOrderInput,
  CreateOrderResult,
  FetchedPayment,
  RazorpayGateway,
} from './razorpay-gateway';

export function createLiveRazorpayGateway(): RazorpayGateway {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required');
  }

  const client = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return {
    async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
      const order = await client.orders.create({
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
      });
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
      };
    },

    async fetchPayment(paymentId: string): Promise<FetchedPayment> {
      const payment = await client.payments.fetch(paymentId);
      return {
        id: payment.id,
        order_id: payment.order_id,
        status: payment.status,
        amount: Number(payment.amount),
        currency: payment.currency,
      };
    },

    verifyCheckoutSignature({ orderId, paymentId, signature }) {
      return compareCheckoutSignatures(
        orderId,
        paymentId,
        keySecret,
        signature
      );
    },

    verifyWebhookSignature({ rawBody, signature }) {
      if (!webhookSecret || !signature) {
        return false;
      }
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      if (expected.length !== signature.length) {
        return false;
      }
      try {
        return crypto.timingSafeEqual(
          Buffer.from(expected, 'hex'),
          Buffer.from(signature, 'hex')
        );
      } catch {
        return false;
      }
    },
  };
}
