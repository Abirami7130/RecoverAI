import { DataOrigin, TerminalState } from '@/lib/types';

export function resolveTerminalState(input: {
  dataOrigin: DataOrigin;
  simulatedOutcome?: string;
  strategy?: string;
  mlAvailable: boolean;
}): TerminalState {
  if (!input.mlAvailable) {
    return 'ml_unavailable';
  }

  if (input.dataOrigin === 'simulation') {
    return 'simulated_demo_complete';
  }

  const outcome = input.simulatedOutcome?.toLowerCase();
  const strategy = input.strategy;

  if (
    outcome === 'no_action' ||
    strategy === 'NO_RECOVERY' ||
    strategy === 'MONITOR'
  ) {
    return 'not_attempted';
  }

  if (outcome === 'recovered') {
    return 'simulated_recovered';
  }

  if (outcome === 'not_recovered') {
    return 'simulated_not_recovered';
  }

  return 'simulated_not_recovered';
}

export function getStep5Title(terminalState?: TerminalState): string {
  switch (terminalState) {
    case 'simulated_recovered':
      return 'Simulated recovery';
    case 'simulated_not_recovered':
      return 'Not recovered';
    case 'not_attempted':
      return 'No retry scheduled';
    case 'simulated_demo_complete':
      return 'Demo step complete';
    case 'ml_unavailable':
      return 'Decision unavailable';
    default:
      return 'Demo step complete';
  }
}

export function getHeaderStatusLabel(
  step: number,
  terminalState?: TerminalState
): string {
  if (step < 5) {
    return 'Processing';
  }
  switch (terminalState) {
    case 'simulated_recovered':
      return 'Simulated recovered';
    case 'simulated_not_recovered':
      return 'Not recovered';
    case 'not_attempted':
      return 'Closed';
    case 'ml_unavailable':
      return 'Unavailable';
    default:
      return 'Complete';
  }
}
