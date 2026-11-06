import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAppSession } from '@/lib/app/require-session';
import { requireRole } from '@/lib/auth';
import { apiError } from '@/lib/api-error';
import { operatorRetryCase } from '@/lib/app/operator-retry';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  reason: z.string().min(1).max(500),
});

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const auth = await requireAppSession();
  if ('error' in auth) return auth.error;

  const roleCheck = requireRole(auth.session, ['owner', 'operator']);
  if (!roleCheck.ok) {
    return apiError('FORBIDDEN', 'Operators or owners only.', 403);
  }

  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey) {
    return apiError('VALIDATION_ERROR', 'Idempotency-Key header is required.', 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body.', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'reason is required.', 400);
  }

  const result = await operatorRetryCase({
    caseId: context.params.id,
    merchantId: auth.session.user.merchantId,
    actorUserId: auth.session.user.id,
    reason: parsed.data.reason,
    idempotencyKey,
  });

  if ('notFound' in result && result.notFound) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Case not found.' } },
      { status: 404 }
    );
  }

  if ('duplicate' in result && result.duplicate) {
    return NextResponse.json({
      duplicate: true,
      attemptId: result.attemptId,
    });
  }

  if ('error' in result) {
    return apiError('INTERNAL', 'Could not schedule retry.', 500);
  }

  return NextResponse.json({
    duplicate: false,
    strategy: result.strategy,
    guardrailResult: result.guardrailResult,
    ruleIds: result.ruleIds,
    attemptId: result.attemptId,
  });
}
