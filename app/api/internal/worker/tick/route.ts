import { NextRequest, NextResponse } from 'next/server';
import { runDueAttempts } from '@/lib/recovery/worker';
import { apiError } from '@/lib/api-error';
import { compareSecrets } from '@/lib/security/compare-secret';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-worker-secret');
  const expected = process.env.WORKER_SECRET;

  if (!expected || !secret || !compareSecrets(expected, secret)) {
    return apiError('UNAUTHENTICATED', 'Invalid worker secret.', 401);
  }

  let now = new Date();
  try {
    const body = await request.json();
    if (body?.now && typeof body.now === 'string') {
      now = new Date(body.now);
    }
  } catch {
    // empty body is fine
  }

  const result = await runDueAttempts(now);
  return NextResponse.json(result, { status: 200 });
}
