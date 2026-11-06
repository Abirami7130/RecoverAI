import Link from 'next/link';
import { getAppSession } from '@/lib/auth';
import { listCasesForMerchant } from '@/lib/app/console-data';
import CaseStatusBadge from '@/components/app/CaseStatusBadge';

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default async function ApprovalsPage() {
  const session = await getAppSession();
  if (!session) return null;

  const { cases } = await listCasesForMerchant(session.user.merchantId, {
    status: 'needs_approval',
    limit: 50,
  });

  return (
    <div className="flex flex-col gap-[20px]">
      <div>
        <h2 className="text-[28px] font-semibold">Approval queue</h2>
        <p className="text-[14px] text-app-ink-soft mt-[4px]">
          High-value retries waiting for an operator or owner before an order is scheduled.
        </p>
      </div>

      {cases.length === 0 ? (
        <p className="text-[14px] text-app-ink-soft border border-app-line rounded-[8px] p-[16px] bg-app-elevated">
          No cases waiting for approval.
        </p>
      ) : (
        <div className="overflow-x-auto border border-app-line rounded-[8px] bg-app-elevated">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead className="bg-app-muted text-app-ink-soft text-left">
              <tr>
                <th className="px-[12px] py-[10px]">Opened</th>
                <th className="px-[12px] py-[10px]">Amount</th>
                <th className="px-[12px] py-[10px]">Reason</th>
                <th className="px-[12px] py-[10px]">Strategy</th>
                <th className="px-[12px] py-[10px]">Status</th>
                <th className="px-[12px] py-[10px]"></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-t border-app-line">
                  <td className="px-[12px] py-[10px]">
                    {new Date(c.openedAt).toLocaleString('en-IN')}
                  </td>
                  <td className="px-[12px] py-[10px] tabular-nums">{formatInr(c.amountPaise)}</td>
                  <td className="px-[12px] py-[10px]">{c.normalizedReason}</td>
                  <td className="px-[12px] py-[10px]">{c.action}</td>
                  <td className="px-[12px] py-[10px]">
                    <CaseStatusBadge status={c.status} />
                  </td>
                  <td className="px-[12px] py-[10px]">
                    <Link href={`/app/cases/${c.id}`} className="text-app-accent font-semibold">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
