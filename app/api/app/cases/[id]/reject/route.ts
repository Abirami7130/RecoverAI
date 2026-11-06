import { NextResponse } from 'next/server';
import { requireAppSession } from '@/lib/app/require-session';
import { requireRole } from '@/lib/auth';
import { apiError } from '@/lib/api-error';
import { rejectRecoveryCase } from '@/lib/app/case-approval';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireAppSession();
  if ('error' in auth) return auth.error;

  const roleCheck = requireRole(auth.session, ['owner', 'operator']);
  if (!roleCheck.ok) {
    return apiError('FORBIDDEN', 'Operators or owners only.', 403);
  }

  const result = await rejectRecoveryCase({
    caseId: context.params.id,
    merchantId: auth.session.user.merchantId,
    actorUserId: auth.session.user.id,
  });

  if ('notFound' in result && result.notFound) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Case not found.' } },
      { status: 404 }
    );
  }

  if ('invalidStatus' in result && result.invalidStatus) {
    return apiError(
      'INVALID_STATE',
      `Case is not awaiting approval (status: ${result.status}).`,
      409
    );
  }

  return NextResponse.json({ ok: true });
}
