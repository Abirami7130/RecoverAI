import { NextResponse } from 'next/server';
import { requireAppSession } from '@/lib/app/require-session';
import { getCaseDetailForMerchant } from '@/lib/app/console-data';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireAppSession();
  if ('error' in auth) return auth.error;

  const detail = await getCaseDetailForMerchant(
    auth.session.user.merchantId,
    context.params.id
  );

  if (!detail) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Case not found.' } },
      { status: 404 }
    );
  }

  return NextResponse.json(detail);
}
