import { getAppSession } from '@/lib/auth';
import { getAnalyticsOverview } from '@/lib/app/console-data';
import { MODEL_METADATA_DISCLAIMER } from '@/lib/ml/model-metadata';

export default async function AnalyticsPage() {
  const session = await getAppSession();
  if (!session) return null;

  const overview = await getAnalyticsOverview(session.user.merchantId);

  return (
    <div className="flex flex-col gap-[28px]">
      <div>
        <h2 className="text-[28px] font-semibold">Payment failure analytics</h2>
        <p className="text-[14px] text-app-ink-soft mt-[4px]">
          Counts from stored cases — not the synthetic CSV.
        </p>
      </div>

      <section>
        <h3 className="text-[18px] font-semibold mb-[8px]">Failures by reason</h3>
        {overview.failuresByReason.length === 0 ? (
          <p className="text-[14px] text-app-ink-soft border border-app-line rounded-[8px] p-[16px] bg-app-elevated">
            No failure reasons recorded yet.
          </p>
        ) : (
          <table className="w-full border border-app-line rounded-[8px] bg-app-elevated text-[14px]">
            <thead className="bg-app-muted text-app-ink-soft text-left">
              <tr>
                <th className="px-[12px] py-[10px]">Reason</th>
                <th className="px-[12px] py-[10px]">Cases</th>
              </tr>
            </thead>
            <tbody>
              {overview.failuresByReason.map((row) => (
                <tr key={row.normalizedReason} className="border-t border-app-line">
                  <td className="px-[12px] py-[10px]">{row.normalizedReason}</td>
                  <td className="px-[12px] py-[10px] tabular-nums">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="text-[18px] font-semibold mb-[8px]">Verified captures by reason</h3>
        {overview.capturesByReason.length === 0 ? (
          <p className="text-[14px] text-app-ink-soft border border-app-line rounded-[8px] p-[16px] bg-app-elevated">
            No verified captures grouped by failure reason yet.
          </p>
        ) : (
          <table className="w-full border border-app-line rounded-[8px] bg-app-elevated text-[14px]">
            <thead className="bg-app-muted text-app-ink-soft text-left">
              <tr>
                <th className="px-[12px] py-[10px]">Reason</th>
                <th className="px-[12px] py-[10px]">Recovered cases</th>
              </tr>
            </thead>
            <tbody>
              {overview.capturesByReason.map((row) => (
                <tr key={row.normalizedReason} className="border-t border-app-line">
                  <td className="px-[12px] py-[10px]">{row.normalizedReason}</td>
                  <td className="px-[12px] py-[10px] tabular-nums">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h3 className="text-[18px] font-semibold mb-[8px]">Recovery strategy analytics</h3>
        <div className="grid md:grid-cols-2 gap-[16px]">
          <div className="border border-app-line rounded-[8px] bg-app-elevated p-[16px]">
            <p className="text-[12px] uppercase tracking-[1.2px] text-app-ink-soft mb-[8px]">
              Decisions by action
            </p>
            <ul className="text-[14px] flex flex-col gap-[6px]">
              {Object.entries(overview.actionCounts).map(([action, count]) => (
                <li key={action} className="flex justify-between">
                  <span>{action}</span>
                  <span className="tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-app-line rounded-[8px] bg-app-elevated p-[16px]">
            <p className="text-[12px] uppercase tracking-[1.2px] text-app-ink-soft mb-[8px]">
              Guardrail blocks
            </p>
            <ul className="text-[14px] flex flex-col gap-[6px]">
              {Object.entries(overview.guardrailBlockCounts).map(([id, count]) => (
                <li key={id} className="flex justify-between">
                  <span>{id}</span>
                  <span className="tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[18px] font-semibold mb-[8px]">Failure model metadata</h3>
        {!overview.model ? (
          <p className="text-[14px] text-app-ink-soft border border-app-line rounded-[8px] p-[16px] bg-app-elevated">
            Model metadata not found
          </p>
        ) : (
          <div className="border border-app-line rounded-[8px] bg-app-elevated p-[16px] text-[14px] flex flex-col gap-[8px]">
            <p className="text-[13px] text-app-ink-soft">{MODEL_METADATA_DISCLAIMER}</p>
            <dl className="grid sm:grid-cols-2 gap-x-[24px] gap-y-[6px]">
              <div className="flex justify-between gap-[12px]">
                <dt className="text-app-ink-soft">Model type</dt>
                <dd>{overview.model.modelType ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-[12px]">
                <dt className="text-app-ink-soft">Version</dt>
                <dd>{overview.model.version}</dd>
              </div>
              <div className="flex justify-between gap-[12px]">
                <dt className="text-app-ink-soft">Dataset</dt>
                <dd>{overview.model.dataset ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-[12px]">
                <dt className="text-app-ink-soft">Training rows</dt>
                <dd className="tabular-nums">
                  {overview.model.rowCount ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-[12px]">
                <dt className="text-app-ink-soft">ROC AUC (held-out test)</dt>
                <dd className="tabular-nums">
                  {overview.model.rocAuc != null
                    ? overview.model.rocAuc.toFixed(4)
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-[12px]">
                <dt className="text-app-ink-soft">Average precision (test)</dt>
                <dd className="tabular-nums">
                  {overview.model.averagePrecision != null
                    ? overview.model.averagePrecision.toFixed(4)
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-[12px]">
                <dt className="text-app-ink-soft">Brier score (test)</dt>
                <dd className="tabular-nums">
                  {overview.model.brier != null
                    ? overview.model.brier.toFixed(4)
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-[12px]">
                <dt className="text-app-ink-soft">Calibration</dt>
                <dd>{overview.model.calibration ?? '—'}</dd>
              </div>
            </dl>
            <p className="text-[12px] text-app-ink-soft pt-[8px] border-t border-app-line">
              Offline model report: synthetic or exported evaluation file
              {overview.model.generatedAt
                ? ` · generated ${overview.model.generatedAt}`
                : ''}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
