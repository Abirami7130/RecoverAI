import crypto from 'crypto';
import { prisma, getDemoMerchantContext } from '@/lib/db';
import { getRazorpayGateway } from '@/lib/payments/razorpay-gateway';

export type CreateDemoOrderResult =
  | {
      ok: true;
      order_id: string;
      amount: number;
      currency: string;
      payment_record_id: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
    };

const inflightByIdempotencyKey = new Map<string, Promise<CreateDemoOrderResult>>();

export function resetCreateOrderInflightForTests() {
  inflightByIdempotencyKey.clear();
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}

function isLocalPlaceholderOrderId(orderId: string): boolean {
  return orderId.startsWith('local_');
}

async function waitForResolvedOrder(
  paymentId: string,
  maxMs = 5_000
): Promise<{ orderId: string; amountPaise: number; currency: string } | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const row = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (row && !isLocalPlaceholderOrderId(row.razorpayOrderId)) {
      return {
        orderId: row.razorpayOrderId,
        amountPaise: row.amountPaise,
        currency: row.currency,
      };
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

async function createDemoOrderInternal(input: {
  amountInr: number;
  idempotencyKey?: string | null;
}): Promise<CreateDemoOrderResult> {
  const { merchant, customer } = await getDemoMerchantContext();
  const amountPaise = Math.round(input.amountInr * 100);
  const gateway = getRazorpayGateway();

  if (input.idempotencyKey) {
    const existing = await prisma.payment.findUnique({
      where: { createIdempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.amountPaise !== amountPaise) {
        return {
          ok: false,
          status: 409,
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency-Key was already used with a different amount.',
        };
      }
      if (isLocalPlaceholderOrderId(existing.razorpayOrderId)) {
        const resolved = await waitForResolvedOrder(existing.id);
        if (resolved) {
          return {
            ok: true,
            order_id: resolved.orderId,
            amount: resolved.amountPaise,
            currency: resolved.currency,
            payment_record_id: existing.id,
          };
        }
      }
      return {
        ok: true,
        order_id: existing.razorpayOrderId,
        amount: existing.amountPaise,
        currency: existing.currency,
        payment_record_id: existing.id,
      };
    }
  }

  let paymentRecord;
  try {
    paymentRecord = await prisma.payment.create({
      data: {
        merchantId: merchant.id,
        customerId: customer.id,
        razorpayOrderId: `local_${crypto.randomUUID()}`,
        amountPaise,
        currency: 'INR',
        status: 'created',
        createIdempotencyKey: input.idempotencyKey ?? null,
      },
    });
  } catch (err: unknown) {
    if (input.idempotencyKey && isPrismaUniqueViolation(err)) {
      const raced = await prisma.payment.findUnique({
        where: { createIdempotencyKey: input.idempotencyKey },
      });
      if (raced) {
        if (raced.amountPaise !== amountPaise) {
          return {
            ok: false as const,
            status: 409,
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Idempotency-Key was already used with a different amount.',
          };
        }
        if (isLocalPlaceholderOrderId(raced.razorpayOrderId)) {
          const resolved = await waitForResolvedOrder(raced.id);
          if (resolved) {
            return {
              ok: true,
              order_id: resolved.orderId,
              amount: resolved.amountPaise,
              currency: resolved.currency,
              payment_record_id: raced.id,
            };
          }
        }
        return {
          ok: true,
          order_id: raced.razorpayOrderId,
          amount: raced.amountPaise,
          currency: raced.currency,
          payment_record_id: raced.id,
        };
      }
    }
    throw err;
  }

  try {
    const order = await gateway.createOrder({
      amountPaise,
      currency: 'INR',
      receipt: `rcpt_${paymentRecord.id}`,
      notes: { paymentRecordId: paymentRecord.id },
    });

    await prisma.payment.update({
      where: { id: paymentRecord.id },
      data: { razorpayOrderId: order.id },
    });

    return {
      ok: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      payment_record_id: paymentRecord.id,
    };
  } catch (err: unknown) {
    await prisma.payment.delete({ where: { id: paymentRecord.id } }).catch(() => {});
    throw err;
  }
}

export async function createDemoOrder(input: {
  amountInr: number;
  idempotencyKey?: string | null;
}): Promise<CreateDemoOrderResult> {
  if (!input.idempotencyKey) {
    return createDemoOrderInternal(input);
  }

  const key = input.idempotencyKey;
  const inflight = inflightByIdempotencyKey.get(key);
  if (inflight) {
    return inflight;
  }

  const promise = createDemoOrderInternal(input).finally(() => {
    inflightByIdempotencyKey.delete(key);
  });
  inflightByIdempotencyKey.set(key, promise);
  return promise;
}
