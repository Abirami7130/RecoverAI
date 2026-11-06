import Link from 'next/link';
import { getAppSession } from '@/lib/auth';
import { getAnalyticsOverview, listCasesForMerchant } from '@/lib/app/console-data';

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default async function DashboardPage() {
  const session = await getAppSession();
  if (!session) return null;

  const overview = await getAnalyticsOverview(session.user.merchantId);
  const recent = await listCasesForMerchant(session.user.merchantId, {
    limit: 5,
    cursor: null,
  });

  const simulatedTotal =
    overview.simulatedOutcomeCounts.recovered +
    overview.simulatedOutcomeCounts.not_recovered +
    overview.simulatedOutcomeCounts.no_action;

  return (
    <div className="flex flex-col gap-[32px]">
      <div>
        <h2 className="text-[28px] font-semibold text-app-ink">
          {session.user.merchantName}
        </h2>
        <p className="text-[14px] text-app-ink-soft mt-[4px]">
          Verified totals come from Razorpay captures only.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px]">
        {[
          { label: 'Open cases', value: String(overview.openCaseCount) },
          {
            label: 'Verified recovered',
            value: formatInr(overview.verifiedRecoveredPaise),
          },
          { label: 'Verified cases', value: String(overview.verifiedCaseCount) },
          {
            label: 'Simulated decisions',
            value: String(simulatedTotal),
            note: overview.note,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="border border-app-line rounded-[8px] bg-app-elevated p-[16px]"
          >
            <p className="text-[12px] uppercase tracking-[1.2px] text-app-ink-soft">
              {card.label}
            </p>
            <p className="text-[24px] font-semibold tabular-nums mt-[8px]">{card.value}</p>
            {'note' in card && card.note && (
              <p className="text-[12px] text-app-sim mt-[6px]">{card.note}</p>
            )}
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-[12px]">
          <h3 className="text-[18px] font-semibold">Newest open cases</h3>
          <Link
            href="/app/cases"
            className="text-[14px] font-semibold text-app-accent"
          >
            View queue
          </Link>
        </div>
        <ul className="border border-app-line rounded-[8px] bg-app-elevated divide-y divide-app-line">
          {recent.cases.length === 0 ? (
            <li className="p-[16px] text-[14px] text-app-ink-soft">
              No open cases. A Razorpay test failure will appear here.
            </li>
          ) : (
            recent.cases.map((c) => (
              <li key={c.id} className="p-[16px] flex justify-between gap-[12px]">
                <div>
                  <Link href={`/app/cases/${c.id}`} className="text-app-accent font-medium">
                    {c.normalizedReason}
                  </Link>
                  <p className="text-[13px] text-app-ink-soft mt-[4px]">
                    {c.action} · {c.status}
                  </p>
                </div>
                <span className="tabular-nums text-[14px]">{formatInr(c.amountPaise)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
