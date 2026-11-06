import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database: 'ok' | 'error' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'error';
  }

  const fastApiUrl = process.env.FASTAPI_URL ?? 'http://localhost:8000';
  let ml: 'ok' | 'unreachable' = 'unreachable';
  try {
    const res = await fetch(`${fastApiUrl}/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (res.ok) {
      ml = 'ok';
    }
  } catch {
    ml = 'unreachable';
  }

  return NextResponse.json({
    app: 'ok',
    database,
    ml,
  });
}
