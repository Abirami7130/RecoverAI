import { createFakeRazorpayGateway } from './fake-razorpay-gateway';

export interface CreateOrderInput {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  id: string;
  amount: number;
  currency: string;
}

export interface FetchedPayment {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
}

export interface RazorpayGateway {
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  fetchPayment(paymentId: string): Promise<FetchedPayment>;
  verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean;
  verifyWebhookSignature(input: {
    rawBody: string;
    signature: string;
  }): boolean;
}

let gatewayOverride: RazorpayGateway | null = null;
let cachedFakeGateway: RazorpayGateway | null = null;

export function setRazorpayGatewayForTests(gateway: RazorpayGateway | null) {
  gatewayOverride = gateway;
}

export function resetCachedFakeRazorpayGatewayForTests() {
  cachedFakeGateway = null;
}

export function getRazorpayGateway(): RazorpayGateway {
  if (gatewayOverride) {
    return gatewayOverride;
  }
  if (process.env.RAZORPAY_USE_FAKE === 'true') {
    if (!cachedFakeGateway) {
      cachedFakeGateway = createFakeRazorpayGateway();
    }
    return cachedFakeGateway;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createLiveRazorpayGateway } = require('./razorpay-live-gateway');
  return createLiveRazorpayGateway();
}
