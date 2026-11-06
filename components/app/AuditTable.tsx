export default function AuditTable({
  entries,
}: {
  entries: Array<{
    id: string;
    createdAt: string;
    actorType: string;
    action: string;
    entityType: string;
    entityId: string;
  }>;
}) {
  if (entries.length === 0) {
    return (
      <p className="text-[14px] text-app-ink-soft border border-app-line rounded-[8px] p-[24px] bg-app-elevated">
        No audit entries yet. Actions on cases and payments will appear here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-app-line rounded-[8px] bg-app-elevated">
      <table className="w-full min-w-[720px] text-[14px]">
        <thead className="bg-app-muted text-app-ink-soft text-left">
          <tr>
            <th className="px-[12px] py-[10px]">Time</th>
            <th className="px-[12px] py-[10px]">Actor</th>
            <th className="px-[12px] py-[10px]">Action</th>
            <th className="px-[12px] py-[10px]">Entity</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-app-line">
              <td className="px-[12px] py-[10px]">
                {new Date(e.createdAt).toLocaleString('en-IN')}
              </td>
              <td className="px-[12px] py-[10px]">{e.actorType}</td>
              <td className="px-[12px] py-[10px]">{e.action}</td>
              <td className="px-[12px] py-[10px]">
                {e.entityType} · {e.entityId.slice(0, 8)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
