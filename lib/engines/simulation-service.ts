import { MonitoringState, RecoveryDecision, RecoveryEvent } from '../types';
import { calculateRiskScore, getRiskLevel } from './risk-engine';
import { executeRecoveryAction } from './recovery-execution-engine';
import {
  applySessionCredit,
  createInitialAccounting,
} from '../recovery/accounting';

const DEMO_ANIMATION_DECISION: RecoveryDecision = {
  failureReason: 'SIMULATED_DEGRADATION',
  diagnosis: 'Demo animation. This action was not chosen by the recovery policy.',
  recommendedAction: 'MONITOR',
  actionLabel: 'Demo animation only',
  retryDelayMs: 0,
  useAlternateRoute: false,
  demoAnimation: true,
};

class SimulationService {
  private accounting = createInitialAccounting();

  private state: MonitoringState = {
    metrics: {
      latencyMs: 120,
      successRate: 99.2,
      errorRate: 0.5,
      timeoutRate: 0.3,
      volume: 15420,
      source: 'simulated',
    },
    riskScore: 5,
    riskLevel: 'LOW',
    riskExposure: 842000,
    revenueRecovered: 0,
    transactionsSaved: 0,
    accounting: createInitialAccounting(),
    activeRecovery: {
      id: 9281,
      amount: 12450,
      step: 5,
      executionStatus: 'SUCCESS',
      dataOrigin: 'simulation',
      terminalState: 'simulated_demo_complete',
      errorDescription: 'Simulated provider degradation',
      decision: DEMO_ANIMATION_DECISION,
    },
    latestDecision: DEMO_ANIMATION_DECISION,
    timestamp: Date.now(),
  };

  private lastTick = Date.now();
  private realEventActive = false;

  public tick() {
    const now = Date.now();
    if (now - this.lastTick < 2000) return;

    this.lastTick = now;
    this.state.timestamp = now;
    this.syncAccountingAliases();

    this.simulateProviderMetrics();
    this.processRiskEngine();
    this.processRecoveryEngine();
  }

  public injectRealEvent(event: {
    amount: number;
    decision: RecoveryDecision;
    errorDescription: string;
    normalizedReason: string;
  }) {
    this.realEventActive = true;

    const recoveryEvent: RecoveryEvent = {
      id: Math.floor(Math.random() * 9000) + 1000,
      amount: event.amount,
      step: 1,
      executionStatus: 'IDLE',
      dataOrigin: 'razorpay_failure',
      errorDescription: event.errorDescription,
      normalizedReason: event.normalizedReason,
      failureProbability: event.decision.failureProbability,
      simulatedRecoveryProbability: event.decision.simulatedRecoveryProbability,
      simulatedOutcome: event.decision.simulatedOutcome,
      strategy: event.decision.strategy,
      decision: event.decision,
    };

    this.state.activeRecovery = recoveryEvent;
    this.state.latestDecision = event.decision;
  }

  private simulateProviderMetrics() {
    const isOngoingOutage = this.state.activeRecovery.step < 5;
    const isDegraded = isOngoingOutage || Math.random() > 0.7;

    const baseLatency = isDegraded ? 600 : 100;
    const latencyJitter = Math.floor(Math.random() * 300);

    this.state.metrics = {
      latencyMs: baseLatency + latencyJitter,
      successRate: isDegraded ? 85 + Math.random() * 10 : 99.1 + Math.random(),
      errorRate: isDegraded ? 4 + Math.random() * 3 : 0.4 + Math.random() * 0.5,
      timeoutRate: isDegraded ? 2.5 + Math.random() * 2 : 0.2 + Math.random() * 0.3,
      volume: this.state.metrics.volume + Math.floor(Math.random() * 5),
      source: 'simulated',
    };
  }

  private processRiskEngine() {
    this.state.riskScore = calculateRiskScore(this.state.metrics);
    this.state.riskLevel = getRiskLevel(this.state.riskScore);
  }

  private processRecoveryEngine() {
    const now = Date.now();

    if (!this.realEventActive) {
      this.state.latestDecision = DEMO_ANIMATION_DECISION;
    }

    if (
      this.state.riskLevel === 'HIGH' &&
      this.state.activeRecovery.step === 5 &&
      !this.realEventActive
    ) {
      const failureAmount = Math.floor(Math.random() * (25000 - 3000 + 1) + 3000);

      this.state.riskExposure += failureAmount;

      this.state.activeRecovery = {
        id: Math.floor(Math.random() * 9000) + 1000,
        amount: failureAmount,
        step: 1,
        executionStatus: 'IDLE',
        dataOrigin: 'simulation',
        errorDescription: 'Simulated provider degradation',
        decision: DEMO_ANIMATION_DECISION,
      };
      return;
    }

    const recovery = this.state.activeRecovery;
    if (recovery.step < 5) {
      if (recovery.step === 1) {
        recovery.step = 2;
      } else if (recovery.step === 2) {
        recovery.step = 3;
      } else if (recovery.step === 3) {
        recovery.step = 4;
      } else if (recovery.step === 4) {
        const updatedRecovery = executeRecoveryAction(recovery, now);

        if (updatedRecovery.step === 5) {
          this.accounting = applySessionCredit(
            this.accounting,
            updatedRecovery.amount,
            updatedRecovery.terminalState ?? 'simulated_demo_complete',
            updatedRecovery.dataOrigin ?? 'simulation'
          );
          this.syncAccountingAliases();

          if (updatedRecovery.dataOrigin === 'razorpay_failure') {
            this.realEventActive = false;
          }
        }

        this.state.activeRecovery = updatedRecovery;
      }
    }
  }

  private syncAccountingAliases() {
    this.state.accounting = this.accounting;
    this.state.revenueRecovered = this.accounting.sessionSimulatedRecoveredInr;
    this.state.transactionsSaved = this.accounting.sessionSimulatedTransactions;
  }

  public getState(): MonitoringState {
    this.syncAccountingAliases();
    return this.state;
  }

  public getAccounting() {
    return this.accounting;
  }
}

const globalForSimulation = globalThis as unknown as {
  simulationService: SimulationService | undefined;
};

export const simulationService =
  globalForSimulation.simulationService ?? new SimulationService();

if (process.env.NODE_ENV !== 'production') {
  globalForSimulation.simulationService = simulationService;
}
