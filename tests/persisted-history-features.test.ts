import { describe, expect, it } from 'vitest';
import {
  UNOBSERVED_MINUTES_SINCE_LAST_PAYMENT,
  deriveHistoryFeatures,
} from '@/lib/ml/persisted-history-features';

const occurredAt = new Date('2026-11-03T02:00:00.000Z');

describe('deriveHistoryFeatures', () => {
  it('does not invent payments when none were observed', () => {
    const features = deriveHistoryFeatures({
      occurredAt,
      subscriptionStatus: 'active',
      tenureStartedAt: new Date(occurredAt.getTime() - 30 * 24 * 60 * 60 * 1000),
      customerCreatedAt: occurredAt,
      priorPayments: [],
    });

    expect(features.feature_source).toBe('insufficient_history');
    expect(features.previous_payment_count).toBe(0);
    expect(features.previous_failure_count).toBe(0);
    expect(features.transactions_last_24h).toBe(0);
    expect(features.historical_success_rate).toBe(1);
    expect(features.time_since_last_payment_known).toBe(false);
    expect(features.time_since_last_payment_min).toBe(UNOBSERVED_MINUTES_SINCE_LAST_PAYMENT);
    expect(features.customer_tenure_days).toBe(30);
  });

  it('counts only terminal payments at or before the failure', () => {
    const features = deriveHistoryFeatures({
      occurredAt,
      subscriptionStatus: 'active',
      tenureStartedAt: null,
      customerCreatedAt: new Date(occurredAt.getTime() - 10 * 24 * 60 * 60 * 1000),
      priorPayments: [
        {
          status: 'failed',
          createdAt: new Date(occurredAt.getTime() - 120 * 60 * 1000),
        },
        {
          status: 'failed',
          createdAt: new Date(occurredAt.getTime() - 48 * 60 * 60 * 1000),
        },
        {
          status: 'created',
          createdAt: new Date(occurredAt.getTime() - 30 * 60 * 1000),
        },
        {
          status: 'captured',
          createdAt: new Date(occurredAt.getTime() + 60 * 1000),
        },
      ],
    });

    expect(features.feature_source).toBe('payment_history');
    expect(features.previous_payment_count).toBe(2);
    expect(features.previous_failure_count).toBe(2);
    expect(features.historical_success_rate).toBe(0);
    expect(features.transactions_last_24h).toBe(1);
    expect(features.time_since_last_payment_known).toBe(true);
    expect(features.time_since_last_payment_min).toBe(120);
    expect(features.tenure_known).toBe(true);
    expect(features.customer_tenure_days).toBe(10);
  });
});
