/**
 * Operator-facing sentences for persisted Python rule ids (Section 7.7).
 */
export const RULE_GLOSSARY: Record<string, string> = {
  BASE_NO_ACTION:
    'Failure probability is below 0.25, so the policy does not retry',
  BASE_MONITOR: 'Failure probability is in the monitor band',
  BASE_RECOVERY_ATTEMPT: 'Failure probability is in the retry band',
  BASE_PRIORITY: 'Failure probability is at or above 0.85',
  ELEVATED_FOR_EXPOSURE:
    'Expected loss reached the merchant threshold, so the band moved up one step',
  ALREADY_CAPTURED: 'A payment on this case is already captured',
  REASON_DISABLED: 'The failure reason is not eligible for an automatic retry',
  ATTEMPT_CAP: 'The attempt limit is reached',
  COOLDOWN_APPLIED: 'The next time was moved to satisfy the cooldown',
  DUPLICATE_OPEN_ATTEMPT: 'An attempt is already open',
  ML_UNAVAILABLE_FAIL_SAFE:
    'The model did not return a probability, so no order was created',
  APPROVAL_REQUIRED: 'The amount requires a person to approve the retry',
};

export function sentencesForRuleIds(ruleIds: string[]): string[] {
  return ruleIds
    .map((id) => RULE_GLOSSARY[id])
    .filter((sentence): sentence is string => Boolean(sentence));
}

export function allGlossaryRuleIds(): string[] {
  return Object.keys(RULE_GLOSSARY);
}
