import Link from 'next/link';

export interface CaseRow {
  id: string;
  status: string;
  amountPaise: number;
  normalizedReason: string;
  action: string;
  failureProbability: number | null;
  verifiedRecoveredPaise: number;
  openedAt: string;
}

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default function CaseTable({
  cases,
  emptyMessage,
}: {
  cases: CaseRow[];
  emptyMessage: string;
}) {
  if (cases.length === 0) {
    return (
      <p className="text-[14px] text-app-ink-soft border border-app-line rounded-[8px] p-[24px] bg-app-elevated">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-app-line rounded-[8px] bg-app-elevated">
      <table className="w-full min-w-[720px] text-[14px] tabular-nums">
        <thead className="bg-app-muted text-app-ink-soft text-left">
          <tr>
            <th className="px-[12px] py-[10px] font-semibold">Opened</th>
            <th className="px-[12px] py-[10px] font-semibold">Amount</th>
            <th className="px-[12px] py-[10px] font-semibold">Reason</th>
            <th className="px-[12px] py-[10px] font-semibold">Strategy</th>
            <th className="px-[12px] py-[10px] font-semibold">Failure P</th>
            <th className="px-[12px] py-[10px] font-semibold">Status</th>
            <th className="px-[12px] py-[10px] font-semibold">Verified</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} className="border-t border-app-line hover:bg-app-muted/40">
              <td className="px-[12px] py-[10px]">
                <Link href={`/app/cases/${c.id}`} className="text-app-accent font-medium">
                  {new Date(c.openedAt).toLocaleString('en-IN')}
                </Link>
              </td>
              <td className="px-[12px] py-[10px]">{formatInr(c.amountPaise)}</td>
              <td className="px-[12px] py-[10px]">{c.normalizedReason}</td>
              <td className="px-[12px] py-[10px]">{c.action}</td>
              <td className="px-[12px] py-[10px]">
                {c.failureProbability != null
                  ? `${(c.failureProbability * 100).toFixed(0)}%`
                  : '—'}
              </td>
              <td className="px-[12px] py-[10px]">{c.status}</td>
              <td className="px-[12px] py-[10px]">{formatInr(c.verifiedRecoveredPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CaseQueueEmptyState() {
  return (
    <p className="text-[14px] text-app-ink-soft">
      No open cases. A Razorpay test failure will appear here.
    </p>
  );
}
