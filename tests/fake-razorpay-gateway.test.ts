import { describe, it, expect, beforeEach } from 'vitest';
import { createDemoOrder } from '@/lib/payments/create-demo-order';
import {
  createFakeRazorpayGateway,
  resetFakeOrderIdSequenceForTests,
} from '@/lib/payments/fake-razorpay-gateway';
import {
  getRazorpayGateway,
  resetCachedFakeRazorpayGatewayForTests,
  setRazorpayGatewayForTests,
} from '@/lib/payments/razorpay-gateway';
import { prisma, getDemoMerchantContext } from '@/lib/db';
import {
  bindFakeGateway,
  resetTestCaseState,
} from './helpers/integration';

describe('fake Razorpay order ids', () => {
  beforeEach(async () => {
    await resetTestCaseState();
  });

  it('assigns unique order ids across multiple gateway instances', async () => {
    setRazorpayGatewayForTests(null);
    resetCachedFakeRazorpayGatewayForTests();

    const gatewayA = createFakeRazorpayGateway();
    const gatewayB = createFakeRazorpayGateway();

    const first = await gatewayA.createOrder({
      amountPaise: 100,
      currency: 'INR',
      receipt: 'rcpt_a',
    });
    const second = await gatewayB.createOrder({
      amountPaise: 200,
      currency: 'INR',
      receipt: 'rcpt_b',
    });
    const third = await gatewayA.createOrder({
      amountPaise: 300,
      currency: 'INR',
      receipt: 'rcpt_c',
    });

    const ids = [first.id, second.id, third.id];
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(id).toMatch(/^order_fake_\d+$/);
    }
  });

  it('getRazorpayGateway reuses one fake instance and still unique orders via createDemoOrder', async () => {
    setRazorpayGatewayForTests(null);
    resetCachedFakeRazorpayGatewayForTests();

    const gatewayOne = getRazorpayGateway();
    const gatewayTwo = getRazorpayGateway();
    expect(gatewayOne).toBe(gatewayTwo);

    const first = await createDemoOrder({ amountInr: 499 });
    const second = await createDemoOrder({ amountInr: 599 });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.order_id).not.toBe(second.order_id);

    const rows = await prisma.payment.findMany({
      where: { id: { in: [first.payment_record_id, second.payment_record_id] } },
      select: { razorpayOrderId: true },
    });
    const orderIds = rows.map((r) => r.razorpayOrderId);
    expect(new Set(orderIds).size).toBe(2);
  });

  it('does not reuse legacy counter-only ids after sequence reset (dev-server restart)', async () => {
    setRazorpayGatewayForTests(null);
    resetCachedFakeRazorpayGatewayForTests();
    resetFakeOrderIdSequenceForTests();

    const { merchant, customer } = await getDemoMerchantContext();

    const legacyId = 'order_fake_1';
    await prisma.payment.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,
        razorpayOrderId: legacyId,
        amountPaise: 49900,
        currency: 'INR',
        status: 'created',
      },
    });

    const gateway = createFakeRazorpayGateway();
    const fresh = await gateway.createOrder({
      amountPaise: 100,
      currency: 'INR',
      receipt: 'rcpt_restart',
    });

    expect(fresh.id).not.toBe(legacyId);
    expect(fresh.id).toMatch(/^order_fake_\d+$/);
  });

  it('simulates repeated getRazorpayGateway without singleton override (order sequence)', async () => {
    bindFakeGateway();
    setRazorpayGatewayForTests(null);
    resetCachedFakeRazorpayGatewayForTests();

    const orders = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createFakeRazorpayGateway().createOrder({
          amountPaise: 100 + i,
          currency: 'INR',
          receipt: `rcpt_${i}`,
        })
      )
    );

    const ids = orders.map((o) => o.id);
    expect(new Set(ids).size).toBe(5);
  });
});
