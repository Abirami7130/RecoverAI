import { prisma } from '@/lib/db';
import { getAppSession } from '@/lib/auth';
import AuditTable from '@/components/app/AuditTable';

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { entityType?: string; entityId?: string };
}) {
  const session = await getAppSession();
  if (!session) return null;

  const rows = await prisma.auditLog.findMany({
    where: {
      merchantId: session.user.merchantId,
      ...(searchParams.entityType ? { entityType: searchParams.entityType } : {}),
      ...(searchParams.entityId ? { entityId: searchParams.entityId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-[20px]">
      <div>
        <h2 className="text-[28px] font-semibold">Audit trail</h2>
        <p className="text-[14px] text-app-ink-soft mt-[4px]">
          Append-only log of system and operator actions.
        </p>
      </div>
      <AuditTable
        entries={rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          actorType: r.actorType,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
        }))}
      />
    </div>
  );
}
