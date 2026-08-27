import { ProviderMetrics, RiskLevel } from '../types';

export function calculateRiskScore(metrics: ProviderMetrics): number {
  // Latency: 35% weight. Ideal < 150ms. High risk > 800ms.
  const latencyRisk = Math.min(1, Math.max(0, (metrics.latencyMs - 150) / 650));

  // Success Rate: 30% weight. Ideal > 99.5%. High risk < 90%.
  const successRisk = Math.min(1, Math.max(0, (99.5 - metrics.successRate) / 9.5));

  // Error Rate: 20% weight. Ideal < 0.5%. High risk > 5%.
  const errorRisk = Math.min(1, Math.max(0, (metrics.errorRate - 0.5) / 4.5));

  // Timeout Rate: 15% weight. Ideal < 0.2%. High risk > 3%.
  const timeoutRisk = Math.min(1, Math.max(0, (metrics.timeoutRate - 0.2) / 2.8));

  const score = (latencyRisk * 35) + (successRisk * 30) + (errorRisk * 20) + (timeoutRisk * 15);

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'LOW';
  if (score < 60) return 'MEDIUM';
  return 'HIGH';
}
