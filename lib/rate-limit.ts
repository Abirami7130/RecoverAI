const buckets = new Map<string, number[]>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

/**
 * In-memory sliding window rate limiter (per IP).
 * Multiple Node processes do not share this counter.
 */
export function checkRateLimit(
  key: string,
  options?: RateLimitOptions
): { allowed: boolean; retryAfterMs?: number } {
  const limit = options?.limit ?? MAX_REQUESTS;
  const windowMs = options?.windowMs ?? WINDOW_MS;
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    return { allowed: false, retryAfterMs: oldest + windowMs - now };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true };
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return headers.get('x-real-ip') ?? 'unknown';
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
