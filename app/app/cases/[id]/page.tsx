import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAppSession } from '@/lib/auth';
import { getCaseDetailForMerchant } from '@/lib/app/console-data';
import CaseStatusBadge from '@/components/app/CaseStatusBadge';
import AttemptTable from '@/components/app/AttemptTable';
import DecisionFacts from '@/components/recovery/DecisionFacts';
import OpenRecoveryCheckoutButton from '@/components/app/OpenRecoveryCheckoutButton';
import CaseApprovalActions from '@/components/app/CaseApprovalActions';
import { sentencesForRuleIds } from '@/lib/recovery/rule-glossary';
import type { RecoveryDecision, RecoveryAction, RecoveryStrategy } from '@/lib/types';

function formatInr(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export default async function CaseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getAppSession();
  if (!session) return null;

  const detail = await getCaseDetailForMerchant(session.user.merchantId, params.id);
  if (!detail) notFound();

  const latestDecision = detail.decisions[detail.decisions.length - 1];
  const latestPrediction = detail.predictions[0];
  const latestFailure = detail.failures[0];
  const awaitingAttempt = detail.attempts.find((a) => a.status === 'awaiting_payment');

  const decisionFacts: RecoveryDecision | null = latestDecision
    ? {
        failureReason: latestFailure?.errorCode ?? 'RAZORPAY_PAYMENT_FAILURE',
        errorDescription: latestFailure?.errorDescription ?? '',
        normalizedReason: latestFailure?.normalizedReason,
        diagnosis: latestDecision.reasonText,
        strategy: latestDecision.action as RecoveryStrategy,
        recommendedAction: latestDecision.action as RecoveryAction,
        actionLabel: latestDecision.action,
        retryDelayMs: (latestDecision.delayMinutes ?? 0) * 60 * 1000,
        useAlternateRoute: latestDecision.action === 'ALTERNATIVE_PAYMENT_METHOD',
        failureProbability: latestPrediction?.failureProbability,
        recoveryProbability: latestPrediction?.recoveryProbability ?? null,
        recoveryProbabilitySource:
          latestPrediction?.recoveryProbabilitySource ?? 'not_trained',
        simulatedOutcome: latestDecision.simulatedOutcome ?? undefined,
        simulatedRecoveryProbability: latestDecision.simulatedProbability ?? undefined,
        ruleIds: latestDecision.ruleIds,
      }
    : null;

  return (
    <div className="flex flex-col gap-[28px]">
      <div className="flex flex-wrap items-start justify-between gap-[12px]">
        <div>
          <Link href="/app/cases" className="text-[13px] text-app-accent">
            ← Back to queue
          </Link>
          <h2 className="text-[28px] font-semibold mt-[8px]">Case {detail.case.id.slice(0, 8)}</h2>
        </div>
        <CaseStatusBadge status={detail.case.status} />
      </div>

      <section className="grid md:grid-cols-2 gap-[16px]">
        <div className="border border-app-line rounded-[8px] bg-app-elevated p-[16px]">
          <h3 className="text-[12px] uppercase tracking-[1.2px] text-app-ink-soft mb-[8px]">
            Summary
          </h3>
          <dl className="text-[14px] flex flex-col gap-[8px]">
            <div className="flex justify-between">
              <dt>Amount</dt>
              <dd className="tabular-nums">{formatInr(detail.case.amountPaise)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Subscription</dt>
              <dd>{detail.case.subscriptionStatus ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Normalized reason</dt>
              <dd>{latestFailure?.normalizedReason ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-[12px]">
              <dt>Razorpay order</dt>
              <dd className="font-mono text-[12px] break-all">
                {detail.originPayment?.razorpayOrderId ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Razorpay description</dt>
              <dd className="text-right max-w-[60%]">
                {latestFailure?.errorDescription ?? '—'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="border border-app-line rounded-[8px] bg-app-elevated p-[16px]">
          <h3 className="text-[12px] uppercase tracking-[1.2px] text-app-ink-soft mb-[8px]">
            Probabilities
          </h3>
          <ul className="text-[14px] flex flex-col gap-[8px]">
            <li>
              Failure probability:{' '}
              {latestPrediction
                ? `${(latestPrediction.failureProbability * 100).toFixed(0)}%`
                : '—'}
            </li>
            <li>
              Recovery probability:{' '}
              {latestPrediction?.recoveryProbability != null
                ? `${(latestPrediction.recoveryProbability * 100).toFixed(0)}%`
                : 'Not trained'}
            </li>
            {latestDecision?.simulatedOutcome && (
              <li className="text-app-sim">
                Simulated outcome: {latestDecision.simulatedOutcome} (
                {((latestDecision.simulatedProbability ?? 0) * 100).toFixed(0)}% simulated)
              </li>
            )}
            <li className="text-[13px] text-app-ink-soft">
              Model version: {latestPrediction?.modelVersion ?? '—'} · feature source:{' '}
              {latestPrediction?.featureSource ?? '—'}
            </li>
          </ul>
        </div>
      </section>

      {decisionFacts && (
        <section className="border border-app-line rounded-[8px] bg-app-elevated p-[16px]">
          <h3 className="text-[12px] uppercase tracking-[1.2px] text-app-ink-soft mb-[8px]">
            Decision
          </h3>
          <DecisionFacts decision={decisionFacts} />
          {latestDecision && (
            <ul className="mt-[12px] list-disc pl-[18px] text-[13px] text-app-ink-soft">
              {sentencesForRuleIds(latestDecision.ruleIds).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          {latestDecision?.recommendedMethod && (
            <p className="mt-[12px] text-[14px]">
              Suggested method:{' '}
              <span className="font-semibold">{latestDecision.recommendedMethod}</span>
              <span className="text-app-ink-soft">
                {' '}
                — recommendation only; checkout does not force this instrument.
              </span>
            </p>
          )}
        </section>
      )}

      {detail.case.status === 'needs_approval' && (
        <CaseApprovalActions caseId={detail.case.id} />
      )}

      {awaitingAttempt?.razorpayOrderId && (
        <section className="border border-app-line rounded-[8px] bg-app-elevated p-[16px]">
          <h3 className="text-[12px] uppercase tracking-[1.2px] text-app-ink-soft mb-[8px]">
            Recovery checkout
          </h3>
          <OpenRecoveryCheckoutButton
            orderId={awaitingAttempt.razorpayOrderId}
            amountPaise={detail.case.amountPaise}
          />
        </section>
      )}

      <section>
        <h3 className="text-[18px] font-semibold mb-[8px]">Attempts</h3>
        <AttemptTable attempts={detail.attempts} />
      </section>

      <section>
        <h3 className="text-[18px] font-semibold mb-[8px]">Payments</h3>
        <div className="overflow-x-auto border border-app-line rounded-[8px] bg-app-elevated">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead className="bg-app-muted text-app-ink-soft text-left">
              <tr>
                <th className="px-[12px] py-[10px]">Order</th>
                <th className="px-[12px] py-[10px]">Payment</th>
                <th className="px-[12px] py-[10px]">Status</th>
                <th className="px-[12px] py-[10px]">Captured</th>
              </tr>
            </thead>
            <tbody>
              {detail.payments.map((p) => (
                <tr key={p.id} className="border-t border-app-line">
                  <td className="px-[12px] py-[10px] font-mono text-[12px]">
                    {p.razorpayOrderId}
                  </td>
                  <td className="px-[12px] py-[10px] font-mono text-[12px]">
                    {p.razorpayPaymentId ?? '—'}
                  </td>
                  <td className="px-[12px] py-[10px]">{p.status}</td>
                  <td className="px-[12px] py-[10px]">
                    {p.capturedAt ? new Date(p.capturedAt).toLocaleString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link
        href={`/app/audit?entityType=RecoveryCase&entityId=${detail.case.id}`}
        className="text-[14px] text-app-accent font-semibold"
      >
        View audit for this case
      </Link>
    </div>
  );
}
