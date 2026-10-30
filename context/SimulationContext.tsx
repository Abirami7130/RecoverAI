'use client';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  ProviderMetrics,
  RecoveryEvent,
  MonitoringState,
  RiskLevel,
  RecoveryDecision,
  RecoveryAccounting,
} from '@/lib/types';
import { createInitialAccounting } from '@/lib/recovery/accounting';

interface SimulationContextType {
  metrics: ProviderMetrics;
  riskScore: number;
  riskLevel: RiskLevel;
  riskExposure: number;
  revenueRecovered: number;
  transactionsSaved: number;
  accounting: RecoveryAccounting;
  activeRecovery: RecoveryEvent;
  latestDecision?: RecoveryDecision;
  timestamp: number;
  formatLakhs: (val: number) => string;
  formatCurrency: (val: number) => string;
}

const SimulationContext = createContext<SimulationContextType | null>(null);

const defaultAccounting = createInitialAccounting();

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [monitoringState, setMonitoringState] = useState<MonitoringState | null>(null);

  useEffect(() => {
    const fetchMonitoringData = async () => {
      try {
        const res = await fetch('/api/monitoring');
        if (!res.ok) throw new Error('Failed to fetch monitoring data');
        const data: MonitoringState = await res.json();
        setMonitoringState(data);
      } catch (error) {
        console.error('Monitoring API error:', error);
      }
    };

    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 2500);
    return () => clearInterval(interval);
  }, []);

  const formatLakhs = (val: number) => {
    const lakhs = val / 100000;
    return Number.isInteger(lakhs) ? lakhs.toString() : lakhs.toFixed(2).replace(/\.00$/, '');
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const accounting = monitoringState?.accounting ?? defaultAccounting;

  const contextValue: SimulationContextType = {
    metrics: monitoringState?.metrics || {
      latencyMs: 120,
      successRate: 99.2,
      errorRate: 0.5,
      timeoutRate: 0.3,
      volume: 15420,
    },
    riskScore: monitoringState?.riskScore || 5,
    riskLevel: monitoringState?.riskLevel || 'LOW',
    riskExposure: monitoringState?.riskExposure || 842000,
    revenueRecovered: accounting.sessionSimulatedRecoveredInr,
    transactionsSaved: accounting.sessionSimulatedTransactions,
    accounting,
    activeRecovery: monitoringState?.activeRecovery || {
      id: 9281,
      amount: 12450,
      step: 5,
      dataOrigin: 'simulation',
      terminalState: 'simulated_demo_complete',
      errorDescription: 'Simulated provider degradation',
    },
    latestDecision: monitoringState?.latestDecision,
    timestamp: monitoringState?.timestamp || Date.now(),
    formatLakhs,
    formatCurrency,
  };

  return (
    <SimulationContext.Provider value={contextValue}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation must be used within a SimulationProvider');
  return context;
}
