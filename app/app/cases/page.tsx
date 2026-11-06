import { getAppSession } from '@/lib/auth';
import { listCasesForMerchant } from '@/lib/app/console-data';
import CaseTable from '@/components/app/CaseTable';

export default async function CasesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await getAppSession();
  if (!session) return null;

  const { cases } = await listCasesForMerchant(session.user.merchantId, {
    status: searchParams.status,
    limit: 50,
    cursor: null,
  });

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-[12px]">
        <div>
          <h2 className="text-[28px] font-semibold">Recovery case queue</h2>
          <p className="text-[14px] text-app-ink-soft mt-[4px]">
            Rows link to stored Razorpay failures and Python decisions.
          </p>
        </div>
        <form className="flex gap-[8px] text-[14px]">
          <label className="flex items-center gap-[8px]">
            Status
            <select
              name="status"
              defaultValue={searchParams.status ?? ''}
              className="border border-app-line rounded-[8px] px-[8px] py-[6px] bg-app-elevated"
            >
              <option value="">All</option>
              <option value="open">open</option>
              <option value="monitoring">monitoring</option>
              <option value="awaiting_payment">awaiting_payment</option>
              <option value="recovered">recovered</option>
              <option value="stopped">stopped</option>
            </select>
          </label>
          <button
            type="submit"
            className="px-[12px] py-[6px] rounded-[8px] bg-app-accent text-app-accent-ink font-semibold min-h-[40px]"
          >
            Filter
          </button>
        </form>
      </div>

      <CaseTable
        cases={cases}
        emptyMessage="No open cases. A Razorpay test failure will appear here."
      />
    </div>
  );
}
