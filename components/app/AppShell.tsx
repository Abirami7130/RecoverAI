'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV = [
  { href: '/app', label: 'Dashboard' },
  { href: '/app/cases', label: 'Cases' },
  { href: '/app/approvals', label: 'Approvals' },
  { href: '/app/analytics', label: 'Analytics' },
  { href: '/app/audit', label: 'Audit' },
  { href: '/app/settings', label: 'Settings' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const merchantName = session?.user?.merchantName ?? 'Merchant';

  return (
    <div className="min-h-screen bg-app-bg text-app-ink flex flex-col md:flex-row">
      <aside className="w-full md:w-[240px] border-b md:border-b-0 md:border-r border-app-line bg-app-elevated p-[16px] flex flex-col gap-[16px]">
        <div>
          <p className="text-[12px] uppercase tracking-[1.2px] text-app-ink-soft">
            RecoverAI Console
          </p>
          <p className="font-semibold text-[18px] mt-[4px]">{merchantName}</p>
          <span className="inline-flex mt-[8px] px-[10px] py-[4px] rounded-full bg-app-accent text-app-accent-ink text-[11px] font-bold uppercase tracking-wide">
            Test mode
          </span>
        </div>

        <nav className="hidden md:flex flex-col gap-[6px]">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/app' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-[8px] px-[12px] py-[10px] text-[14px] transition-colors ${
                  active
                    ? 'bg-app-accent text-app-accent-ink font-semibold'
                    : 'text-app-ink-soft hover:bg-app-muted'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <select
          className="md:hidden border border-app-line rounded-[8px] px-[12px] py-[10px] bg-app-elevated text-[14px]"
          value={NAV.find((n) => pathname.startsWith(n.href) && n.href !== '/app')?.href ?? '/app'}
          onChange={(e) => {
            window.location.href = e.target.value;
          }}
        >
          {NAV.map((item) => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="mt-auto text-left text-[14px] text-app-ink-soft hover:text-app-ink underline-offset-2 hover:underline"
        >
          Log out
        </button>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="border-b border-app-line bg-app-elevated px-[24px] py-[16px] flex items-center justify-between">
          <h1 className="text-[14px] font-medium text-app-ink-soft">
            Operator console — verified totals only from Razorpay captures
          </h1>
        </header>
        <main className="max-w-[1120px] mx-auto px-[24px] py-[32px]">{children}</main>
      </div>
    </div>
  );
}
