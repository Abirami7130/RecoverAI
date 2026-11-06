'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CaseApprovalActions({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function act(kind: 'approve' | 'reject') {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(`/api/app/cases/${caseId}/${kind}`, { method: 'POST' });
      const data = (await res.json()) as {
        error?: { message?: string };
        duplicate?: boolean;
        attemptId?: string | null;
      };
      if (!res.ok) {
        setMessage(data.error?.message ?? 'Request failed.');
        return;
      }
      if (kind === 'approve') {
        setMessage(
          data.duplicate
            ? 'Approval already recorded; existing attempt kept open.'
            : 'Approved — one recovery attempt scheduled.'
        );
      } else {
        setMessage('Case rejected and stopped.');
      }
      router.refresh();
    } catch {
      setMessage('Network error.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="border border-app-line rounded-[8px] bg-app-elevated p-[16px]">
      <h3 className="text-[12px] uppercase tracking-[1.2px] text-app-ink-soft mb-[8px]">
        Approval required
      </h3>
      <p className="text-[14px] text-app-ink-soft mb-[12px]">
        A high-value retry is waiting for a person. Approving schedules the stored strategy; it
        does not charge the customer until Razorpay captures a payment.
      </p>
      <div className="flex flex-wrap gap-[10px]">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act('approve')}
          className="rounded-[8px] bg-app-accent text-app-accent-ink px-[16px] py-[10px] text-[14px] font-semibold disabled:opacity-60"
        >
          {busy === 'approve' ? 'Approving…' : 'Approve retry'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => act('reject')}
          className="rounded-[8px] border border-app-line px-[16px] py-[10px] text-[14px] font-semibold disabled:opacity-60"
        >
          {busy === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
      {message && <p className="mt-[10px] text-[13px] text-app-ink-soft">{message}</p>}
    </section>
  );
}
