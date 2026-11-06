import crypto from 'crypto';
import { compareHexDigests } from './compare-digest';
import type {
  CreateOrderInput,
  CreateOrderResult,
  FetchedPayment,
  RazorpayGateway,
} from './razorpay-gateway';

/** Process-wide sequence so every fake gateway instance gets distinct order ids. */
let fakeOrderSequence = 0;

export function resetFakeOrderIdSequenceForTests() {
  fakeOrderSequence = 0;
}

function allocateFakeOrderId(): string {
  fakeOrderSequence += 1;
  // Milliseconds + process-wide counter: unique across gateway instances and dev-server restarts
  // (a plain 1..N counter alone would reuse order_fake_1 after HMR/restart while DB rows remain).
  return `order_fake_${Date.now()}${fakeOrderSequence}`;
}

export interface FakeGatewayState {
  orders: Map<string, CreateOrderResult & { receipt: string; notes?: Record<string, string> }>;
  payments: Map<string, FetchedPayment>;
  createOrderCalls: number;
}

export function createFakeRazorpayGateway(
  webhookSecret = 'whsec_test_fake'
): RazorpayGateway & { state: FakeGatewayState } {
  const state: FakeGatewayState = {
    orders: new Map(),
    payments: new Map(),
    createOrderCalls: 0,
  };

  return {
    state,

    async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
      state.createOrderCalls += 1;
      const id = allocateFakeOrderId();
      const result = {
        id,
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
      };
      state.orders.set(id, result);
      return { id, amount: input.amountPaise, currency: input.currency };
    },

    async fetchPayment(paymentId: string): Promise<FetchedPayment> {
      const stored = state.payments.get(paymentId);
      if (stored) {
        return stored;
      }
      throw new Error(`Payment not found: ${paymentId}`);
    },

    verifyCheckoutSignature({ orderId, paymentId, signature }) {
      const keySecret = process.env.RAZORPAY_KEY_SECRET ?? 'test_secret';
      const expected = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      return compareHexDigests(expected, signature);
    },

    verifyWebhookSignature({ rawBody, signature }) {
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      return compareHexDigests(expected, signature);
    },
  };
}

export function seedFakePayment(
  gateway: ReturnType<typeof createFakeRazorpayGateway>,
  payment: FetchedPayment
) {
  gateway.state.payments.set(payment.id, payment);
}

export function nextFakePaymentId(gateway: ReturnType<typeof createFakeRazorpayGateway>): string {
  const n = gateway.state.payments.size + 1;
  return `pay_fake_${n}`;
}
