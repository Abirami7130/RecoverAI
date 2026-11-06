'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }
    window.location.href = '/app';
  }

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-[24px]">
      <div className="w-full max-w-[420px] border border-app-line rounded-[12px] bg-app-elevated p-[32px] shadow-sm">
        <h1 className="text-[28px] font-semibold text-app-ink">Sign in</h1>
        <p className="text-[14px] text-app-ink-soft mt-[8px]">
          Operator console for RecoverAI demo merchant.
        </p>

        <form onSubmit={onSubmit} className="mt-[24px] flex flex-col gap-[16px]">
          <label className="flex flex-col gap-[6px] text-[14px]">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-app-line rounded-[8px] px-[12px] py-[10px] bg-app-bg"
            />
          </label>
          <label className="flex flex-col gap-[6px] text-[14px]">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-app-line rounded-[8px] px-[12px] py-[10px] bg-app-bg"
            />
          </label>
          {error && (
            <p className="text-[13px] text-app-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="min-h-[40px] rounded-[8px] bg-app-accent text-app-accent-ink font-semibold"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-[13px] text-app-ink-soft mt-[20px]">
          Ask an owner for an account.{' '}
          <Link href="/" className="text-app-accent underline">
            Back to landing
          </Link>
        </p>
      </div>
    </div>
  );
}
