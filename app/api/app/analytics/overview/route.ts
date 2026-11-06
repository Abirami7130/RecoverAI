import { NextResponse } from 'next/server';
import { requireAppSession } from '@/lib/app/require-session';
import { getAnalyticsOverview } from '@/lib/app/console-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAppSession();
  if ('error' in auth) return auth.error;

  const overview = await getAnalyticsOverview(auth.session.user.merchantId);
  return NextResponse.json(overview);
}
