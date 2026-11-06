import { caseStatusAfterGuardrail } from '@/lib/recovery/case-status-after-guardrail';

export const STRATEGIES_THAT_CREATE_ORDERS = new Set([
  'SMART_RETRY',
  'ALTERNATIVE_PAYMENT_METHOD',
  'PRIORITY_RECOVERY',
]);

export function strategyCreatesRecoveryOrder(strategy: string): boolean {
  return STRATEGIES_THAT_CREATE_ORDERS.has(strategy);
}

export function caseStatusAfterDecision(
  strategy: string,
  guardrailResult = 'passed',
  ruleIds: string[] = []
): string {
  return caseStatusAfterGuardrail(strategy, guardrailResult, ruleIds);
}
