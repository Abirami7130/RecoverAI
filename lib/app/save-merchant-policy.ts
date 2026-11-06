import { prisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';

export interface SaveMerchantPolicyInput {
  merchantId: string;
  actorUserId: string;
  maxAttempts: number;
  minCooldownMinutes: number;
  elevationRevenueAtRiskPaise: number;
  approvalThresholdPaise: number | null;
  disabledReasonCodes: string[];
  retryCancelledSubscriptions: boolean;
}

export async function saveMerchantPolicy(input: SaveMerchantPolicyInput) {
  return prisma.$transaction(async (tx) => {
    const active = await tx.merchantPolicy.findFirst({
      where: { merchantId: input.merchantId, active: true },
    });

    if (active) {
      await tx.merchantPolicy.update({
        where: { id: active.id },
        data: { active: false },
      });
    }

    const latest = await tx.merchantPolicy.findFirst({
      where: { merchantId: input.merchantId },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    const created = await tx.merchantPolicy.create({
      data: {
        merchantId: input.merchantId,
        version,
        active: true,
        maxAttempts: input.maxAttempts,
        minCooldownMinutes: input.minCooldownMinutes,
        elevationRevenueAtRiskPaise: input.elevationRevenueAtRiskPaise,
        approvalThresholdPaise: input.approvalThresholdPaise,
        disabledReasonCodesJson: JSON.stringify(input.disabledReasonCodes),
        retryCancelledSubscriptions: input.retryCancelledSubscriptions,
      },
    });

    await writeAudit(
      {
        merchantId: input.merchantId,
        actorType: 'user',
        actorId: input.actorUserId,
        action: 'POLICY_VERSION_CREATED',
        entityType: 'MerchantPolicy',
        entityId: created.id,
        metadata: {
          version: created.version,
          maxAttempts: created.maxAttempts,
          approvalThresholdPaise: created.approvalThresholdPaise,
        },
      },
      tx
    );

    return created;
  });
}
