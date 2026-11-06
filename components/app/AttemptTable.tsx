export default function AttemptTable({
  attempts,
}: {
  attempts: Array<{
    id: string;
    status: string;
    scheduledFor: string;
    razorpayOrderId: string | null;
    blockReason: string | null;
  }>;
}) {
  if (attempts.length === 0) {
    return <p className="text-[14px] text-app-ink-soft">No attempts recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto border border-app-line rounded-[8px]">
      <table className="w-full min-w-[640px] text-[14px]">
        <thead className="bg-app-muted text-app-ink-soft text-left">
          <tr>
            <th className="px-[12px] py-[10px]">Scheduled</th>
            <th className="px-[12px] py-[10px]">Status</th>
            <th className="px-[12px] py-[10px]">Recovery order</th>
            <th className="px-[12px] py-[10px]">Block reason</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id} className="border-t border-app-line">
              <td className="px-[12px] py-[10px]">
                {new Date(a.scheduledFor).toLocaleString('en-IN')}
              </td>
              <td className="px-[12px] py-[10px]">{a.status}</td>
              <td className="px-[12px] py-[10px] font-mono text-[12px]">
                {a.razorpayOrderId ?? '—'}
              </td>
              <td className="px-[12px] py-[10px]">{a.blockReason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
