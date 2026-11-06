import Link from 'next/link';
import { getAppSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function SettingsPage() {
  const session = await getAppSession();
  if (!session) return null;

  const merchant = await prisma.merchant.findUnique({
    where: { id: session.user.merchantId },
  });

  let mlHealth = 'unknown';
  try {
    const base = process.env.INTERNAL_WORKER_BASE_URL ?? 'http://127.0.0.1:3000';
    const res = await fetch(`${base}/api/health`, { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as { ml?: string };
      mlHealth = json.ml ?? 'unknown';
    }
  } catch {
    mlHealth = 'unreachable';
  }

  return (
    <div className="flex flex-col gap-[20px] max-w-[640px]">
      <h2 className="text-[28px] font-semibold">Merchant settings</h2>
      <dl className="border border-app-line rounded-[8px] bg-app-elevated p-[16px] text-[14px] flex flex-col gap-[10px]">
        <div className="flex justify-between">
          <dt>Merchant</dt>
          <dd>{merchant?.name}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Your role</dt>
          <dd>{session.user.role}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Database</dt>
          <dd>SQLite (local)</dd>
        </div>
        <div className="flex justify-between">
          <dt>Webhook secret configured</dt>
          <dd>{process.env.RAZORPAY_WEBHOOK_SECRET ? 'Yes' : 'No'}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Razorpay key configured</dt>
          <dd>
            {process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID
              ? 'Yes'
              : 'No'}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>ML health</dt>
          <dd>{mlHealth}</dd>
        </div>
      </dl>
      <Link href="/app/settings/policy" className="text-app-accent font-semibold text-[14px]">
        View recovery policy →
      </Link>
    </div>
  );
}
