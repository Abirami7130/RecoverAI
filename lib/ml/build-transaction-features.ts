import { SyntheticCustomer } from '../data/demo-customer-history';

/**
 * Calculates the required ML customer-history features dynamically 
 * from the stored synthetic transaction records.
 */
export function buildCustomerHistoryFeatures(customer: SyntheticCustomer, currentTimeMs: number) {
  const txs = customer.transactions;
  
  const previous_payment_count = txs.length;
  const previous_failure_count = txs.filter(t => t.status === 'failed').length;
  const successCount = previous_payment_count - previous_failure_count;
  const historical_success_rate = previous_payment_count > 0 ? successCount / previous_payment_count : 1.0;
  
  // Sort descending by timestamp to find the most recent
  const sortedTxs = [...txs].sort((a, b) => b.timestamp - a.timestamp);
  const lastTx = sortedTxs[0];
  
  const time_since_last_payment_min = lastTx 
    ? Math.max(0, (currentTimeMs - lastTx.timestamp) / 60000)
    : 1440;
    
  const transactions_last_24h = txs.filter(t => (currentTimeMs - t.timestamp) <= 24 * 60 * 60 * 1000).length;
  const customer_tenure_days = Math.max(0, (currentTimeMs - customer.createdAt) / (24 * 60 * 60 * 1000));
  
  return {
    time_since_last_payment_min: Math.round(time_since_last_payment_min),
    transactions_last_24h,
    subscription_status: customer.subscriptionStatus,
    customer_tenure_days: Math.round(customer_tenure_days),
    previous_payment_count,
    previous_failure_count,
    historical_success_rate: Number(historical_success_rate.toFixed(2))
  };
}
