import { RecoveryEvent } from '../types';

/**
 * PHASE 2.5: Recovery Execution Engine
 * Deterministically processes a recovery decision through execution states.
 */
export function executeRecoveryAction(
  event: RecoveryEvent,
  currentTimeMs: number
): RecoveryEvent {
  const updatedEvent = { ...event };
  
  // If no action is required, immediately resolve
  if (!updatedEvent.decision || updatedEvent.decision.recommendedAction === 'NO_ACTION') {
    updatedEvent.executionStatus = 'SUCCESS';
    updatedEvent.step = 5;
    return updatedEvent;
  }

  // Initialize execution state machine
  if (!updatedEvent.executionStatus || updatedEvent.executionStatus === 'IDLE') {
    updatedEvent.executionStatus = 'SCHEDULED';
    updatedEvent.executionStartTime = currentTimeMs;
  }

  const elapsedMs = currentTimeMs - (updatedEvent.executionStartTime || currentTimeMs);
  
  // Note: For demo purposes, we scale down very long simulated delays (like 5 minutes) 
  // to a maximum of 8 seconds so the UI simulation completes visually without hanging.
  const simulatedDelayMs = Math.min(updatedEvent.decision.retryDelayMs, 8000);

  if (updatedEvent.executionStatus === 'SCHEDULED') {
    // Wait for the requested retry delay
    if (elapsedMs >= simulatedDelayMs) {
      updatedEvent.executionStatus = 'EXECUTING';
      updatedEvent.executionStartTime = currentTimeMs; // Reset timer for execution duration
    }
  } 
  else if (updatedEvent.executionStatus === 'EXECUTING') {
    // Simulate 2 seconds of active network/processing time for the fallback payment attempt
    if (elapsedMs >= 2000) {
      updatedEvent.executionStatus = 'SUCCESS';
      updatedEvent.step = 5; // Triggers the final RECOVERED visual state in the UI
    }
  }

  return updatedEvent;
}
