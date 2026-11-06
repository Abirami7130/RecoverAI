import Link from 'next/link';
import { getAppSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import PolicyForm from '@/components/app/PolicyForm';

export default async function PolicySettingsPage() {
  const session = await getAppSession();
  if (!session) return null;

  const policy = await prisma.merchantPolicy.findFirst({
    where: { merchantId: session.user.merchantId, active: true },
  });

  const readOnly = session.user.role !== 'owner';

  return (
    <div className="flex flex-col gap-[20px] max-w-[720px]">
      <Link href="/app/settings" className="text-[13px] text-app-accent">
        ← Settings
      </Link>
      <h2 className="text-[28px] font-semibold">Recovery policy</h2>
      <p className="text-[14px] text-app-ink-soft">
        {readOnly
          ? 'View-only for your role. Owners can save a new version.'
          : 'Saving creates version n+1 and deactivates the previous row in one transaction.'}
      </p>

      {!policy ? (
        <p className="text-[14px] text-app-ink-soft">No active policy found.</p>
      ) : (
        <PolicyForm
          readOnly={readOnly}
          initial={{
            version: policy.version,
            maxAttempts: policy.maxAttempts,
            minCooldownMinutes: policy.minCooldownMinutes,
            elevationRevenueAtRiskPaise: policy.elevationRevenueAtRiskPaise,
            approvalThresholdPaise: policy.approvalThresholdPaise,
            disabledReasonCodes: JSON.parse(policy.disabledReasonCodesJson) as string[],
            retryCancelledSubscriptions: policy.retryCancelledSubscriptions,
          }}
        />
      )}
    </div>
  );
}
