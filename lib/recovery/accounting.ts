import { DataOrigin, RecoveryAccounting, TerminalState } from '@/lib/types';

export const ILLUSTRATIVE_SAMPLE_RECOVERED_INR = 700_000;
export const ILLUSTRATIVE_SAMPLE_TRANSACTIONS = 280;
export const ILLUSTRATIVE_SAMPLE_LABEL =
  'Illustrative sample, not live recoveries';

export function createInitialAccounting(): RecoveryAccounting {
  return {
    illustrativeSampleRecoveredInr: ILLUSTRATIVE_SAMPLE_RECOVERED_INR,
    illustrativeSampleLabel: ILLUSTRATIVE_SAMPLE_LABEL,
    sessionSimulatedRecoveredInr: 0,
    verifiedRecoveredInr: 0,
    sessionSimulatedTransactions: 0,
    verifiedTransactions: 0,
  };
}

export function shouldCreditSessionSimulatedRecovery(
  terminalState: TerminalState,
  dataOrigin: DataOrigin
): boolean {
  return (
    dataOrigin === 'razorpay_failure' && terminalState === 'simulated_recovered'
  );
}

export function sessionCreditForTerminalEvent(
  amount: number,
  terminalState: TerminalState,
  dataOrigin: DataOrigin
): { inr: number; transactions: number } {
  if (!shouldCreditSessionSimulatedRecovery(terminalState, dataOrigin)) {
    return { inr: 0, transactions: 0 };
  }
  return { inr: amount, transactions: 1 };
}

export function applySessionCredit(
  accounting: RecoveryAccounting,
  amount: number,
  terminalState: TerminalState,
  dataOrigin: DataOrigin
): RecoveryAccounting {
  const credit = sessionCreditForTerminalEvent(amount, terminalState, dataOrigin);
  return {
    ...accounting,
    sessionSimulatedRecoveredInr:
      accounting.sessionSimulatedRecoveredInr + credit.inr,
    sessionSimulatedTransactions:
      accounting.sessionSimulatedTransactions + credit.transactions,
  };
}
