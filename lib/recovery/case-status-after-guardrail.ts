import { strategyCreatesRecoveryOrder } from '@/lib/recovery/strategy-helpers';

export function caseStatusAfterGuardrail(
  strategy: string,
  guardrailResult: string,
  ruleIds: string[]
): string {
  if (
    guardrailResult === 'blocked' &&
    ruleIds.includes('APPROVAL_REQUIRED') &&
    strategyCreatesRecoveryOrder(strategy)
  ) {
    return 'needs_approval';
  }
  if (strategyCreatesRecoveryOrder(strategy)) {
    return guardrailResult === 'passed' ? 'open' : 'open';
  }
  if (strategy === 'MONITOR') {
    return 'monitoring';
  }
  return 'stopped';
}
