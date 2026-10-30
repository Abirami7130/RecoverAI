import reasonMap from '@/fixtures/reason-map.json';

export type NormalizedReason =
  | 'CUSTOMER_CANCELLED'
  | 'ISSUER_TIMEOUT'
  | 'INSUFFICIENT_FUNDS'
  | 'AUTHENTICATION_FAILED'
  | 'ISSUER_DOWNTIME'
  | 'GENERIC_FAILURE';

function haystack(errorReason: string, errorDescription: string): string {
  return `${errorReason} ${errorDescription}`.toLowerCase();
}

/**
 * Deterministic Razorpay failure → normalized reason (Section 6.2).
 */
export function normalizeFailureReason(
  errorReason: string,
  errorDescription: string
): NormalizedReason {
  const text = haystack(errorReason ?? '', errorDescription ?? '');

  for (const rule of reasonMap.rules) {
    for (const fragment of rule.match) {
      if (text.includes(fragment.toLowerCase())) {
        return rule.normalizedReason as NormalizedReason;
      }
    }
  }

  return reasonMap.default as NormalizedReason;
}
