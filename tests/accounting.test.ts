import { describe, expect, it } from 'vitest';
import {
  applySessionCredit,
  createInitialAccounting,
  sessionCreditForTerminalEvent,
} from '@/lib/recovery/accounting';
import { resolveTerminalState } from '@/lib/recovery/terminal-state';

describe('session simulated accounting', () => {
  it('does not credit NO_RECOVERY / not_attempted', () => {
    const terminal = resolveTerminalState({
      dataOrigin: 'razorpay_failure',
      simulatedOutcome: 'no_action',
      strategy: 'NO_RECOVERY',
      mlAvailable: true,
    });
    expect(terminal).toBe('not_attempted');
    expect(
      sessionCreditForTerminalEvent(499, terminal, 'razorpay_failure')
    ).toEqual({ inr: 0, transactions: 0 });
  });

  it('does not credit simulated not_recovered', () => {
    const terminal = resolveTerminalState({
      dataOrigin: 'razorpay_failure',
      simulatedOutcome: 'not_recovered',
      strategy: 'SMART_RETRY',
      mlAvailable: true,
    });
    expect(terminal).toBe('simulated_not_recovered');
    expect(
      sessionCreditForTerminalEvent(1200, terminal, 'razorpay_failure')
    ).toEqual({ inr: 0, transactions: 0 });
  });

  it('credits only simulated_recovered razorpay failures', () => {
    const terminal = resolveTerminalState({
      dataOrigin: 'razorpay_failure',
      simulatedOutcome: 'recovered',
      strategy: 'SMART_RETRY',
      mlAvailable: true,
    });
    expect(terminal).toBe('simulated_recovered');

    let accounting = createInitialAccounting();
    accounting = applySessionCredit(accounting, 499, terminal, 'razorpay_failure');
    expect(accounting.sessionSimulatedRecoveredInr).toBe(499);
    expect(accounting.sessionSimulatedTransactions).toBe(1);
    expect(accounting.verifiedRecoveredInr).toBe(0);
  });

  it('does not credit mock demo completion', () => {
    const terminal = resolveTerminalState({
      dataOrigin: 'simulation',
      mlAvailable: true,
    });
    expect(terminal).toBe('simulated_demo_complete');
    expect(
      sessionCreditForTerminalEvent(8000, terminal, 'simulation')
    ).toEqual({ inr: 0, transactions: 0 });
  });
});
