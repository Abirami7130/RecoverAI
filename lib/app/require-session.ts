import { NextResponse } from 'next/server';
import { getAppSession } from '@/lib/auth';
import { apiError } from '@/lib/api-error';

export async function requireAppSession() {
  const session = await getAppSession();
  if (!session) {
    return {
      error: apiError('UNAUTHENTICATED', 'Sign in required.', 401),
    };
  }
  return { session };
}
