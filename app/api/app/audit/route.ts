import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAppSession } from '@/lib/app/require-session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAppSession();
  if ('error' in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const entityType = searchParams.get('entityType') ?? undefined;
  const entityId = searchParams.get('entityId') ?? undefined;
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);

  const rows = await prisma.auditLog.findMany({
    where: {
      merchantId: auth.session.user.merchantId,
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Number.isFinite(limit) ? limit : 50,
  });

  return NextResponse.json({
    entries: rows.map((row) => ({
      id: row.id,
      actorType: row.actorType,
      actorId: row.actorId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: JSON.parse(row.metadataJson) as Record<string, unknown>,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
