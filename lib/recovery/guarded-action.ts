import type { FastApiPredictResponse } from '@/lib/recovery/python-client';

export function resolveGuardedAction(fastApiResult: FastApiPredictResponse) {
  const guardrail = fastApiResult.guardrail;
  const strategy = guardrail?.final_action ?? fastApiResult.strategy.strategy;
  const guardrailResult = guardrail?.result ?? 'passed';
  const ruleIds = guardrail?.rule_ids ?? fastApiResult.decision.rule_ids ?? [];
  const reasonText = guardrail?.reason_text ?? fastApiResult.decision.reason;
  const recommendedMethod = guardrail?.recommended_method ?? null;
  return { strategy, guardrailResult, ruleIds, reasonText, recommendedMethod };
}
