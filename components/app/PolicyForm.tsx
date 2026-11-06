'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface PolicyFormValues {
  maxAttempts: number;
  minCooldownMinutes: number;
  elevationRevenueAtRiskPaise: number;
  approvalThresholdPaise: number | null;
  disabledReasonCodes: string[];
  retryCancelledSubscriptions: boolean;
}

export default function PolicyForm({
  initial,
  readOnly,
}: {
  initial: PolicyFormValues & { version: number };
  readOnly: boolean;
}) {
  const router = useRouter();
  const [maxAttempts, setMaxAttempts] = useState(String(initial.maxAttempts));
  const [minCooldownMinutes, setMinCooldownMinutes] = useState(
    String(initial.minCooldownMinutes)
  );
  const [elevation, setElevation] = useState(String(initial.elevationRevenueAtRiskPaise));
  const [approvalThreshold, setApprovalThreshold] = useState(
    initial.approvalThresholdPaise != null ? String(initial.approvalThresholdPaise) : ''
  );
  const [disabledCodes, setDisabledCodes] = useState(
    initial.disabledReasonCodes.join(', ')
  );
  const [retryCancelled, setRetryCancelled] = useState(initial.retryCancelledSubscriptions);
  const [version, setVersion] = useState(initial.version);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setSaving(true);
    try {
      const payload = {
        maxAttempts: Number(maxAttempts),
        minCooldownMinutes: Number(minCooldownMinutes),
        elevationRevenueAtRiskPaise: Number(elevation),
        approvalThresholdPaise: approvalThreshold.trim()
          ? Number(approvalThreshold)
          : null,
        disabledReasonCodes: disabledCodes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        retryCancelledSubscriptions: retryCancelled,
      };
      const res = await fetch('/api/app/settings/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { version?: number; error?: { message?: string } };
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not save policy.');
        return;
      }
      if (data.version != null) {
        setVersion(data.version);
      }
      router.refresh();
    } catch {
      setError('Network error while saving policy.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-app-line rounded-[8px] bg-app-elevated p-[16px] flex flex-col gap-[14px] max-w-[720px]"
    >
      <p className="text-[13px] text-app-ink-soft">
        Active policy version: <span className="tabular-nums font-semibold">{version}</span>
      </p>

      <label className="flex flex-col gap-[6px] text-[14px]">
        Max attempts
        <input
          type="number"
          min={1}
          max={20}
          disabled={readOnly}
          value={maxAttempts}
          onChange={(e) => setMaxAttempts(e.target.value)}
          className="border border-app-line rounded-[8px] px-[12px] py-[10px] disabled:opacity-60"
        />
      </label>

      <label className="flex flex-col gap-[6px] text-[14px]">
        Cooldown (minutes)
        <input
          type="number"
          min={0}
          disabled={readOnly}
          value={minCooldownMinutes}
          onChange={(e) => setMinCooldownMinutes(e.target.value)}
          className="border border-app-line rounded-[8px] px-[12px] py-[10px] disabled:opacity-60"
        />
      </label>

      <label className="flex flex-col gap-[6px] text-[14px]">
        Elevation threshold (paise)
        <input
          type="number"
          min={0}
          disabled={readOnly}
          value={elevation}
          onChange={(e) => setElevation(e.target.value)}
          className="border border-app-line rounded-[8px] px-[12px] py-[10px] disabled:opacity-60"
        />
      </label>

      <label className="flex flex-col gap-[6px] text-[14px]">
        Approval threshold (paise, empty = off)
        <input
          type="number"
          min={0}
          disabled={readOnly}
          value={approvalThreshold}
          onChange={(e) => setApprovalThreshold(e.target.value)}
          className="border border-app-line rounded-[8px] px-[12px] py-[10px] disabled:opacity-60"
        />
      </label>

      <label className="flex flex-col gap-[6px] text-[14px]">
        Disabled reason codes (comma-separated)
        <input
          type="text"
          disabled={readOnly}
          value={disabledCodes}
          onChange={(e) => setDisabledCodes(e.target.value)}
          className="border border-app-line rounded-[8px] px-[12px] py-[10px] disabled:opacity-60"
        />
      </label>

      <label className="flex items-center gap-[10px] text-[14px]">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={retryCancelled}
          onChange={(e) => setRetryCancelled(e.target.checked)}
        />
        Retry cancelled subscriptions
      </label>

      {error && <p className="text-[14px] text-red-700">{error}</p>}

      {!readOnly && (
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-[8px] bg-app-accent text-app-accent-ink px-[16px] py-[10px] text-[14px] font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save new policy version'}
        </button>
      )}
    </form>
  );
}
