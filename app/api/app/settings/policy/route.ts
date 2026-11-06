import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAppSession } from '@/lib/app/require-session';
import { requireRole } from '@/lib/auth';
import { apiError } from '@/lib/api-error';
import { saveMerchantPolicy } from '@/lib/app/save-merchant-policy';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  maxAttempts: z.number().int().min(1).max(20),
  minCooldownMinutes: z.number().int().min(0).max(24 * 60),
  elevationRevenueAtRiskPaise: z.number().int().min(0),
  approvalThresholdPaise: z.number().int().min(0).nullable(),
  disabledReasonCodes: z.array(z.string().min(1)).max(50),
  retryCancelledSubscriptions: z.boolean().optional().default(false),
});

export async function PUT(request: NextRequest) {
  const auth = await requireAppSession();
  if ('error' in auth) return auth.error;

  const roleCheck = requireRole(auth.session, ['owner']);
  if (!roleCheck.ok) {
    return apiError('FORBIDDEN', 'Owners only.', 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body.', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid policy payload.', 400);
  }

  const policy = await saveMerchantPolicy({
    merchantId: auth.session.user.merchantId,
    actorUserId: auth.session.user.id,
    maxAttempts: parsed.data.maxAttempts,
    minCooldownMinutes: parsed.data.minCooldownMinutes,
    elevationRevenueAtRiskPaise: parsed.data.elevationRevenueAtRiskPaise,
    approvalThresholdPaise: parsed.data.approvalThresholdPaise,
    disabledReasonCodes: parsed.data.disabledReasonCodes,
    retryCancelledSubscriptions: parsed.data.retryCancelledSubscriptions,
  });

  return NextResponse.json({
    id: policy.id,
    version: policy.version,
    active: policy.active,
    maxAttempts: policy.maxAttempts,
    minCooldownMinutes: policy.minCooldownMinutes,
    elevationRevenueAtRiskPaise: policy.elevationRevenueAtRiskPaise,
    approvalThresholdPaise: policy.approvalThresholdPaise,
    disabledReasonCodes: JSON.parse(policy.disabledReasonCodesJson) as string[],
    retryCancelledSubscriptions: policy.retryCancelledSubscriptions,
  });
}
