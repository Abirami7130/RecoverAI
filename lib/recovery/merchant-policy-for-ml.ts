import type { MerchantPolicy } from '@prisma/client';

export interface MerchantPolicyMlPayload {
  max_attempts: number;
  min_cooldown_minutes: number;
  elevation_revenue_at_risk_rupees: number;
  disabled_reason_codes: string[];
  approval_threshold_paise: number | null;
  retry_cancelled_subscriptions: boolean;
}

export function merchantPolicyForMl(
  policy: MerchantPolicy | null | undefined
): MerchantPolicyMlPayload {
  const disabled = policy
    ? (JSON.parse(policy.disabledReasonCodesJson) as string[])
    : [];
  return {
    max_attempts: policy?.maxAttempts ?? 3,
    min_cooldown_minutes: policy?.minCooldownMinutes ?? 15,
    elevation_revenue_at_risk_rupees:
      (policy?.elevationRevenueAtRiskPaise ?? 500_000) / 100,
    disabled_reason_codes: disabled,
    approval_threshold_paise: policy?.approvalThresholdPaise ?? null,
    retry_cancelled_subscriptions: policy?.retryCancelledSubscriptions ?? false,
  };
}
