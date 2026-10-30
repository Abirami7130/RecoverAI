import { RecoveryEvent } from '../types';
import { resolveTerminalState } from '../recovery/terminal-state';

function skipsSimulatedExecution(event: RecoveryEvent): boolean {
  if (event.dataOrigin !== 'razorpay_failure') {
    return false;
  }

  const outcome = event.simulatedOutcome?.toLowerCase();
  const strategy = event.strategy ?? event.decision?.strategy;
  const action = event.decision?.recommendedAction;

  if (outcome === 'no_action') return true;
  if (strategy === 'NO_RECOVERY' || strategy === 'MONITOR') return true;
  if (
    action === 'NO_ACTION' ||
    action === 'NO_RECOVERY' ||
    action === 'MONITOR'
  ) {
    return true;
  }

  return false;
}

function finishTerminal(
  event: RecoveryEvent,
  executionStatus: RecoveryEvent['executionStatus']
): RecoveryEvent {
  const terminalState = resolveTerminalState({
    dataOrigin: event.dataOrigin ?? 'simulation',
    simulatedOutcome: event.simulatedOutcome,
    strategy: event.strategy ?? event.decision?.strategy,
    mlAvailable: event.terminalState !== 'ml_unavailable',
  });

  return {
    ...event,
    step: 5,
    executionStatus,
    terminalState,
  };
}

function runDemoDelay(
  event: RecoveryEvent,
  currentTimeMs: number
): RecoveryEvent {
  const updatedEvent: RecoveryEvent = { ...event };

  if (!updatedEvent.executionStatus || updatedEvent.executionStatus === 'IDLE') {
    updatedEvent.executionStatus = 'SCHEDULED';
    updatedEvent.executionStartTime = currentTimeMs;
  }

  const elapsedMs =
    currentTimeMs - (updatedEvent.executionStartTime || currentTimeMs);
  const simulatedDelayMs = Math.min(
    updatedEvent.decision?.retryDelayMs ?? 8000,
    8000
  );

  if (updatedEvent.executionStatus === 'SCHEDULED') {
    if (elapsedMs >= simulatedDelayMs) {
      updatedEvent.executionStatus = 'EXECUTING';
      updatedEvent.executionStartTime = currentTimeMs;
    }
    return updatedEvent;
  }

  if (updatedEvent.executionStatus === 'EXECUTING') {
    if (elapsedMs >= 2000) {
      const executionStatus =
        updatedEvent.dataOrigin === 'razorpay_failure' &&
        updatedEvent.simulatedOutcome?.toLowerCase() !== 'recovered'
          ? 'FAILED'
          : 'SUCCESS';
      return finishTerminal(updatedEvent, executionStatus);
    }
  }

  return updatedEvent;
}

/**
 * Advances in-memory recovery execution using Python simulated outcomes only.
 * Timers never imply a verified Razorpay capture.
 */
export function executeRecoveryAction(
  event: RecoveryEvent,
  currentTimeMs: number
): RecoveryEvent {
  if (skipsSimulatedExecution(event)) {
    return finishTerminal(event, 'SUCCESS');
  }

  return runDemoDelay(event, currentTimeMs);
}
