export interface SyntheticTransaction {
  id: string;
  status: 'success' | 'failed';
  amount: number;
  timestamp: number; // Unix ms
}

export interface SyntheticCustomer {
  id: string;
  createdAt: number;
  subscriptionStatus: 'active' | 'paused' | 'cancelled';
  transactions: SyntheticTransaction[];
}

/**
 * Returns a deterministic demo customer history relative to the requested time.
 * This ensures that time_since_last_payment and tenure are always realistic
 * no matter when the buildathon demo is run.
 */
export function getDemoCustomer(customerId: string, currentTimeMs: number): SyntheticCustomer | null {
  if (customerId !== 'demo_customer_001') {
    return null;
  }

  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;

  // Fixed realistic interval: customer created ~180 days ago
  const createdAt = currentTimeMs - 180 * DAY;
  
  // 10 payments total: 9 successful, 1 failed (yielding 0.90 success rate)
  // We use deterministic relative offsets
  const transactions: SyntheticTransaction[] = [
    { id: 'tx_10', status: 'success', amount: 499, timestamp: currentTimeMs - 1 * HOUR },     // 1 hour ago
    { id: 'tx_9', status: 'failed', amount: 499, timestamp: currentTimeMs - 15 * DAY },      // 15 days ago
    { id: 'tx_8', status: 'success', amount: 499, timestamp: currentTimeMs - 30 * DAY },     // 30 days ago
    { id: 'tx_7', status: 'success', amount: 499, timestamp: currentTimeMs - 45 * DAY },     // 45 days ago
    { id: 'tx_6', status: 'success', amount: 499, timestamp: currentTimeMs - 60 * DAY },     // 60 days ago
    { id: 'tx_5', status: 'success', amount: 499, timestamp: currentTimeMs - 75 * DAY },     // 75 days ago
    { id: 'tx_4', status: 'success', amount: 499, timestamp: currentTimeMs - 90 * DAY },     // 90 days ago
    { id: 'tx_3', status: 'success', amount: 499, timestamp: currentTimeMs - 105 * DAY },    // 105 days ago
    { id: 'tx_2', status: 'success', amount: 499, timestamp: currentTimeMs - 120 * DAY },    // 120 days ago
    { id: 'tx_1', status: 'success', amount: 499, timestamp: currentTimeMs - 135 * DAY },    // 135 days ago
  ];

  return {
    id: 'demo_customer_001',
    createdAt,
    subscriptionStatus: 'active',
    transactions
  };
}
