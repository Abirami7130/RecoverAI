import crypto from 'crypto';

/**
 * Constant-time comparison for shared secrets (e.g. WORKER_SECRET).
 */
export function compareSecrets(expected: string, provided: string): boolean {
  if (!expected || !provided) {
    return false;
  }
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
