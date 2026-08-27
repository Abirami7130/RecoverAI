import { MonitoringState, RecoveryDecision } from '../types';
import { calculateRiskScore, getRiskLevel } from './risk-engine';
import { makeRecoveryDecision } from './recovery-decision-engine';
import { executeRecoveryAction } from './recovery-execution-engine';

class SimulationService {
  private state: MonitoringState = {
    metrics: {
      latencyMs: 120,
      successRate: 99.2,
      errorRate: 0.5,
      timeoutRate: 0.3,
      volume: 15420,
    },
    riskScore: 5,
    riskLevel: 'LOW',
    riskExposure: 842000,
    revenueRecovered: 700000,
    transactionsSaved: 280,
    activeRecovery: {
      id: 9281,
      amount: 12450,
      step: 5,
      executionStatus: 'SUCCESS',
      decision: {
        failureReason: 'HIGH_LATENCY_TIMEOUT',
        diagnosis: 'Payment provider experiencing elevated latency',
        recommendedAction: 'DELAYED_RETRY',
        actionLabel: 'Delayed retry',
        retryDelayMs: 60000,
        useAlternateRoute: false,
        confidence: 0.85,
      }
    },
    latestDecision: {
      failureReason: 'OPTIMAL_OPERATIONS',
      diagnosis: 'Payment provider metrics within optimal operating thresholds.',
      recommendedAction: 'NO_ACTION',
      actionLabel: 'No recovery action required',
      retryDelayMs: 0,
      useAlternateRoute: false,
      confidence: 0.98,
    },
    timestamp: Date.now(),
  };

  private lastTick = Date.now();

  /**
   * When true, a real Razorpay failure is being processed.
   * The random mock outage generator is suppressed until this event
   * completes (step 5) so the real recovery flow is visible in the UI.
   * The simulation engine otherwise continues running normally.
   */
  private realEventActive = false;

  public tick() {
    const now = Date.now();
    // Throttle engine updates to max once every 2 seconds
    if (now - this.lastTick < 2000) return; 
    
    this.lastTick = now;
    this.state.timestamp = now;

    // Ordered pipeline: Metrics -> Risk -> Decision -> Event Trigger/Execution
    this.simulateProviderMetrics();
    this.processRiskEngine();
    this.processRecoveryEngine();
  }

  /**
   * Injects a real Razorpay payment failure into the simulation.
   *
   * Called by POST /api/recovery/trigger after receiving the ML decision.
   * Sets realEventActive = true, which suppresses mock random outages
   * until this event reaches step 5 (RECOVERED / not_recovered).
   * The simulation engine keeps ticking normally for metrics and risk display.
   */
  public injectRealEvent(event: { amount: number; decision: RecoveryDecision }) {
    this.realEventActive = true;

    this.state.activeRecovery = {
      id: Math.floor(Math.random() * 9000) + 1000,
      amount: event.amount,
      step: 1,            // Start at DETECTED
      executionStatus: 'IDLE',
      decision: event.decision,
    };

    // Also expose the decision as latestDecision so the header card updates
    this.state.latestDecision = event.decision;
  }

  private simulateProviderMetrics() {
    // Keep provider degraded if a recovery is currently in progress (Steps 1-4)
    const isOngoingOutage = this.state.activeRecovery.step < 5;
    const isDegraded = isOngoingOutage || Math.random() > 0.7; // 30% chance to start new outage
    
    const baseLatency = isDegraded ? 600 : 100;
    const latencyJitter = Math.floor(Math.random() * 300);
    
    this.state.metrics = {
      latencyMs: baseLatency + latencyJitter,
      successRate: isDegraded ? 85 + (Math.random() * 10) : 99.1 + Math.random(),
      errorRate: isDegraded ? 4 + (Math.random() * 3) : 0.4 + (Math.random() * 0.5),
      timeoutRate: isDegraded ? 2.5 + (Math.random() * 2) : 0.2 + (Math.random() * 0.3),
      volume: this.state.metrics.volume + Math.floor(Math.random() * 5),
    };
  }

  private processRiskEngine() {
    this.state.riskScore = calculateRiskScore(this.state.metrics);
    this.state.riskLevel = getRiskLevel(this.state.riskScore);
  }

  private processRecoveryEngine() {
    const now = Date.now();

    // 1. Generate live decision based on live metrics and risk.
    //    Only propagate to latestDecision when no real Razorpay event is active
    //    (otherwise the mock tick would overwrite the real ML decision in the UI).
    const currentDecision = makeRecoveryDecision(
      this.state.metrics,
      this.state.riskScore,
      this.state.riskLevel
    );
    if (!this.realEventActive) {
      this.state.latestDecision = currentDecision;
    }

    // 2. Trigger new mock recovery ONLY if:
    //    a) risk is HIGH, AND
    //    b) the current recovery is idle (step 5), AND
    //    c) no real Razorpay event is currently being processed
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
        decision: currentDecision, // Lock in the specific decision for this outage event
      };
      return; 
    }

    // 3. Progress existing active recovery state machine
    const recovery = this.state.activeRecovery;
    if (recovery.step < 5) {
      
      // Step progressions
      if (recovery.step === 1) {
        recovery.step = 2; // Move to DIAGNOSING
      } else if (recovery.step === 2) {
        recovery.step = 3; // Move to PREDICTED
      } else if (recovery.step === 3) {
        recovery.step = 4; // Move to SCHEDULED
      } 
      else if (recovery.step === 4) {
        // Delegate to Phase 2.5 Execution Engine
        const updatedRecovery = executeRecoveryAction(recovery, now);
        
        // If the execution engine transitioned the event to SUCCESS (Step 5)
        if (updatedRecovery.step === 5) {
          this.state.revenueRecovered += updatedRecovery.amount;
          this.state.transactionsSaved += 1;
          // Real event has completed — re-enable the mock outage generator
          this.realEventActive = false;
        }
        
        this.state.activeRecovery = updatedRecovery;
      }
    }
  }

  public getState(): MonitoringState {
    return this.state;
  }
}

const globalForSimulation = globalThis as unknown as {
  simulationService: SimulationService | undefined;
};

export const simulationService = globalForSimulation.simulationService ?? new SimulationService();

if (process.env.NODE_ENV !== 'production') {
  globalForSimulation.simulationService = simulationService;
}