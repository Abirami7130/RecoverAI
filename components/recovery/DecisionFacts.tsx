'use client';

import { RecoveryDecision } from '@/lib/types';

interface DecisionFactsProps {
  decision: RecoveryDecision;
}

export default function DecisionFacts({ decision }: DecisionFactsProps) {
  const strategy =
    decision.strategy ?? decision.recommendedAction ?? 'UNKNOWN';
  const failureProbability = decision.failureProbability;
  const simulatedRecoveryProbability = decision.simulatedRecoveryProbability;

  return (
    <div className="mt-[8px] bg-light-ice/10 border border-light-ice/20 rounded-[8px] p-[16px] flex flex-col gap-[12px]">
      <p className="font-sans font-medium text-[14px] leading-[20px] text-dark-navy">
        {decision.diagnosis}
      </p>

      <div className="flex flex-col gap-[4px] pt-[12px] border-t border-light-ice/20">
        <span className="font-sans font-bold text-[12px] leading-[16px] tracking-[1.2px] text-ice-blue uppercase">
          Recovery decision
        </span>
        <span className="font-sans font-medium text-[12px] leading-[16px] text-dark-navy/70">
          Strategy: {strategy}
        </span>
        <span className="font-sans font-semibold text-[14px] leading-[20px] text-dark-navy">
          {decision.actionLabel}
        </span>
      </div>

      <div className="flex flex-col gap-[6px] pt-[4px]">
        {typeof failureProbability === 'number' && (
          <span className="font-sans font-medium text-[12px] leading-[16px] text-dark-navy/70">
            Failure probability:{' '}
            <span className="font-bold text-ice-blue">
              {(failureProbability * 100).toFixed(0)}%
            </span>
          </span>
        )}
        {typeof simulatedRecoveryProbability === 'number' && (
          <span className="font-sans font-medium text-[12px] leading-[16px] text-dark-navy/70">
            Simulated recovery probability:{' '}
            <span className="font-semibold text-dark-navy">
              {(simulatedRecoveryProbability * 100).toFixed(0)}% (simulated)
            </span>
          </span>
        )}
        <span className="font-sans font-medium text-[12px] leading-[16px] text-dark-navy/70">
          Alternate route:{' '}
          <span className="font-semibold text-dark-navy">
            {decision.useAlternateRoute ? 'Enabled' : 'Not required'}
          </span>
        </span>
      </div>
    </div>
  );
}
