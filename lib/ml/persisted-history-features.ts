import { prisma } from '@/lib/db';
import type { MerchantPolicyMlPayload } from '@/lib/recovery/merchant-policy-for-ml';
import type { PredictTransactionInput } from '@/lib/recovery/python-client';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Minutes placeholder required by the model when no prior terminal payment exists.
 * This is not an observed payment. Callers persist `time_since_last_payment_known: false`.
 * A rate of 0 with zero payments is not used: the failure model reads that as
 * "every observed payment failed" and raises the failure probability.
 */
export const UNOBSERVED_MINUTES_SINCE_LAST_PAYMENT = 1440;

const TERMINAL_STATUSES = new Set(['captured', 'failed']);

export interface PriorPaymentObservation {
  createdAt: Date;
  status: string;
}

export interface HistoryObservationInput {
  occurredAt: Date;
  subscriptionStatus: string | null;
  tenureStartedAt: Date | null;
  customerCreatedAt: Date | null;
  priorPayments: PriorPaymentObservation[];
}

export interface DerivedHistoryFeatures {
  transactions_last_24h: number;
  time_since_last_payment_min: number;
  subscription_status: string;
  customer_tenure_days: number;
  previous_payment_count: number;
  previous_failure_count: number;
  historical_success_rate: number;
  feature_source: 'payment_history' | 'insufficient_history';
  time_since_last_payment_known: boolean;
  tenure_known: boolean;
  subscription_known: boolean;
}

export function mapPaymentMethodForModel(raw?: string | null): string {
  if (!raw) return 'CARD';
  const upper = raw.toUpperCase();
  if (upper.includes('UPI') || upper.includes('VPA')) return 'UPI';
  if (upper.includes('NET') || upper.includes('BANK')) return 'NETBANKING';
  if (upper.includes('WALLET') || upper.includes('PAYTM') || upper.includes('PHONEPE')) {
    return 'WALLET';
  }
  return 'CARD';
}

/**
 * Builds model history features from terminal payments that already exist.
 * Payments that are not captured or failed are ignored. An empty history does
 * not invent failures: counts stay 0 and the success rate stays 1 (no observed
 * failures), with feature_source `insufficient_history`.
 */
export function deriveHistoryFeatures(input: HistoryObservationInput): DerivedHistoryFeatures {
  const occurredMs = input.occurredAt.getTime();
  const prior = input.priorPayments.filter(
    (payment) =>
      TERMINAL_STATUSES.has(payment.status) && payment.createdAt.getTime() <= occurredMs
  );

  const previous_payment_count = prior.length;
  const previous_failure_count = prior.filter((payment) => payment.status === 'failed').length;
  const historyObserved = previous_payment_count > 0;
  const historical_success_rate = historyObserved
    ? Number(
        ((previous_payment_count - previous_failure_count) / previous_payment_count).toFixed(4)
      )
    : 1;

  const windowStart = occurredMs - DAY_MS;
  const transactions_last_24h = prior.filter(
    (payment) => payment.createdAt.getTime() >= windowStart
  ).length;

  let time_since_last_payment_min = UNOBSERVED_MINUTES_SINCE_LAST_PAYMENT;
  let time_since_last_payment_known = false;
  if (historyObserved) {
    const lastMs = prior.reduce(
      (latest, payment) => Math.max(latest, payment.createdAt.getTime()),
      0
    );
    time_since_last_payment_min = Math.max(0, Math.round((occurredMs - lastMs) / 60000));
    time_since_last_payment_known = true;
  }

  const tenureAnchor = input.tenureStartedAt ?? input.customerCreatedAt;
  const customer_tenure_days = tenureAnchor
    ? Math.max(0, Math.round((occurredMs - tenureAnchor.getTime()) / DAY_MS))
    : 0;

  return {
    transactions_last_24h,
    time_since_last_payment_min,
    subscription_status: input.subscriptionStatus || 'active',
    customer_tenure_days,
    previous_payment_count,
    previous_failure_count,
    historical_success_rate,
    feature_source: historyObserved ? 'payment_history' : 'insufficient_history',
    time_since_last_payment_known,
    tenure_known: tenureAnchor != null,
    subscription_known: Boolean(input.subscriptionStatus),
  };
}

export async function loadHistoryFeaturesForCustomer(input: {
  customerId: string | null;
  excludePaymentId: string;
  occurredAt: Date;
}): Promise<DerivedHistoryFeatures> {
  if (!input.customerId) {
    return deriveHistoryFeatures({
      occurredAt: input.occurredAt,
      subscriptionStatus: null,
      tenureStartedAt: null,
      customerCreatedAt: null,
      priorPayments: [],
    });
  }

  const [customer, priorPayments] = await Promise.all([
    prisma.customer.findUnique({ where: { id: input.customerId } }),
    prisma.payment.findMany({
      where: {
        customerId: input.customerId,
        id: { not: input.excludePaymentId },
        recoveryCaseId: null,
        parentPaymentId: null,
        status: { in: ['captured', 'failed'] },
        createdAt: { lte: input.occurredAt },
      },
      select: { createdAt: true, status: true },
    }),
  ]);

  return deriveHistoryFeatures({
    occurredAt: input.occurredAt,
    subscriptionStatus: customer?.subscriptionStatus ?? null,
    tenureStartedAt: customer?.tenureStartedAt ?? null,
    customerCreatedAt: customer?.createdAt ?? null,
    priorPayments,
  });
}

export function assemblePredictInput(args: {
  razorpayOrderId: string;
  amountInr: number;
  occurredAt: Date;
  paymentMethod: string;
  history: DerivedHistoryFeatures;
  attemptsUsed: number;
  normalizedReason: string;
  amountPaise: number;
  originPaymentStatus: string;
  openAttemptExists: boolean;
  lastAttemptFinishedAt?: Date | null;
  policy: MerchantPolicyMlPayload;
}): PredictTransactionInput {
  return {
    payment_id: args.razorpayOrderId,
    amount: args.amountInr,
    retry_count: args.attemptsUsed,
    hour_of_day: args.occurredAt.getHours(),
    day_of_week: args.occurredAt.getDay(),
    transactions_last_24h: args.history.transactions_last_24h,
    time_since_last_payment_min: args.history.time_since_last_payment_min,
    subscription_status: args.history.subscription_status,
    customer_tenure_days: args.history.customer_tenure_days,
    previous_payment_count: args.history.previous_payment_count,
    previous_failure_count: args.history.previous_failure_count,
    historical_success_rate: args.history.historical_success_rate,
    payment_method: args.paymentMethod,
    context: {
      normalized_reason: args.normalizedReason,
      attempts_used: args.attemptsUsed,
      amount_paise: args.amountPaise,
      origin_payment_status: args.originPaymentStatus,
      open_attempt_exists: args.openAttemptExists,
      ...(args.lastAttemptFinishedAt
        ? { last_attempt_finished_at: args.lastAttemptFinishedAt.toISOString() }
        : {}),
    },
    policy: args.policy,
  };
}

export function featureRecordJson(
  transactionInput: PredictTransactionInput,
  history: DerivedHistoryFeatures,
  extra?: Record<string, unknown>
): string {
  return JSON.stringify({
    ...transactionInput,
    feature_source: history.feature_source,
    time_since_last_payment_known: history.time_since_last_payment_known,
    tenure_known: history.tenure_known,
    subscription_known: history.subscription_known,
    ...extra,
  });
}
