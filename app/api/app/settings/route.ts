import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAppSession } from '@/lib/app/require-session';

export const dynamic = 'force-dynamic';

function maskKeyId(keyId: string | undefined): string | null {
  if (!keyId) return null;
  if (keyId.length <= 8) return 'rzp_****';
  return `${keyId.slice(0, 8)}****`;
}

export async function GET() {
  const auth = await requireAppSession();
  if ('error' in auth) return auth.error;

  const merchant = await prisma.merchant.findUnique({
    where: { id: auth.session.user.merchantId },
    include: { policies: { where: { active: true }, take: 1 } },
  });

  if (!merchant) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Merchant not found.' } },
      { status: 404 }
    );
  }

  const policy = merchant.policies[0];
  const publicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID;

  return NextResponse.json({
    merchantName: merchant.name,
    role: auth.session.user.role,
    webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    razorpayKeyConfigured: Boolean(publicKey),
    razorpayKeyPrefix: maskKeyId(publicKey),
    activePolicy: policy
      ? {
          version: policy.version,
          maxAttempts: policy.maxAttempts,
          minCooldownMinutes: policy.minCooldownMinutes,
          elevationRevenueAtRiskPaise: policy.elevationRevenueAtRiskPaise,
          approvalThresholdPaise: policy.approvalThresholdPaise,
          disabledReasonCodes: JSON.parse(policy.disabledReasonCodesJson) as string[],
          retryCancelledSubscriptions: policy.retryCancelledSubscriptions,
        }
      : null,
  });
}
