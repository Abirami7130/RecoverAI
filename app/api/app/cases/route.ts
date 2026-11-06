import { NextRequest, NextResponse } from 'next/server';
import { requireAppSession } from '@/lib/app/require-session';
import { listCasesForMerchant } from '@/lib/app/console-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAppSession();
  if ('error' in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') ?? undefined;
  const limit = Number(searchParams.get('limit') ?? '20');
  const cursor = searchParams.get('cursor');

  const result = await listCasesForMerchant(auth.session.user.merchantId, {
    status: status || undefined,
    limit: Number.isFinite(limit) ? limit : 20,
    cursor,
  });

  return NextResponse.json(result);
}
