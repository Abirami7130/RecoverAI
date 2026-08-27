import pandas as pd
import numpy as np
import os

def generate_customer_profiles(num_customers=10000):
    """Step 3A: Generate base customer profiles."""
    np.random.seed(42)
    
    customer_ids = [f"CUST_{i:05d}" for i in range(1, num_customers + 1)]
    customer_tenure_days = np.random.randint(30, 1800, size=num_customers)
    previous_payment_count = np.random.randint(1, 120, size=num_customers)
    previous_failure_count = np.random.binomial(n=previous_payment_count, p=0.05)
    
    successful_payments = previous_payment_count - previous_failure_count
    historical_success_rate = successful_payments / previous_payment_count
    
    customers_df = pd.DataFrame({
        'customer_id': customer_ids,
        'customer_tenure_days': customer_tenure_days,
        'previous_payment_count': previous_payment_count,
        'previous_failure_count': previous_failure_count,
        'historical_success_rate': np.round(historical_success_rate, 4)
    })
    return customers_df

def generate_payment_attempts(customers_df, num_attempts=50000):
    """Step 3B: Generate payment attempts based on existing customers."""
    np.random.seed(42)
    
    sampled_customer_ids = np.random.choice(customers_df['customer_id'], size=num_attempts, replace=True)
    payment_ids = [f"PAY_{i:06d}" for i in range(1, num_attempts + 1)]
    
    amounts = np.random.lognormal(mean=5.5, sigma=1.0, size=num_attempts).round(2)
    payment_methods = np.random.choice(
        ['UPI', 'CARD', 'NETBANKING', 'WALLET'], 
        p=[0.55, 0.30, 0.10, 0.05], size=num_attempts
    )
    retry_counts = np.random.choice(
        [0, 1, 2, 3], p=[0.85, 0.10, 0.04, 0.01], size=num_attempts
    )
    transactions_last_24h = np.random.poisson(lam=1.2, size=num_attempts)
    time_since_last_payment_min = np.random.exponential(scale=1440, size=num_attempts).round(0)
    hour_of_day = np.random.randint(0, 24, size=num_attempts)
    day_of_week = np.random.randint(0, 7, size=num_attempts)
    subscription_status = np.random.choice(
        ['active', 'paused', 'cancelled'], p=[0.90, 0.08, 0.02], size=num_attempts
    )
    
    attempts_df = pd.DataFrame({
        'payment_id': payment_ids,
        'customer_id': sampled_customer_ids,
        'amount': amounts,
        'payment_method': payment_methods,
        'retry_count': retry_counts,
        'transactions_last_24h': transactions_last_24h,
        'time_since_last_payment_min': time_since_last_payment_min,
        'hour_of_day': hour_of_day,
        'day_of_week': day_of_week,
        'subscription_status': subscription_status
    })
    
    final_df = pd.merge(attempts_df, customers_df, on='customer_id', how='left')
    return final_df

def generate_payment_outcomes(df):
    """Step 3C: Generate realistic, probabilistically sampled payment outcomes."""
    np.random.seed(42)
    df = df.copy() # Avoid changing the original dataframe directly
    
    # We build a 'raw score' of failure risk. We start with a negative number 
    # so that by default, the probability of failure is low.
    base_risk = -3.5
    
    # 1. History factor: Customers with a lower historical success rate get a higher penalty.
    history_risk = (1.0 - df['historical_success_rate']) * 5.0
    
    # 2. Retry factor: If this payment is already a retry, it is much more likely to fail again.
    retry_risk = df['retry_count'] * 1.5
    
    # 3. Velocity factor: Spikes in recent transactions can indicate insufficient funds or fraud limits.
    velocity_risk = (df['transactions_last_24h'] >= 3).astype(float) * 1.2
    
    # 4. Amount factor: Very large amounts fail slightly more often due to banking limits.
    amount_risk = np.log1p(df['amount']) * 0.1
    
    # 5. Method factor: Some gateways/methods are slightly more prone to failure.
    method_risk = df['payment_method'].map({
        'WALLET': -0.3,
        'UPI': 0.0,
        'CARD': 0.3,
        'NETBANKING': 0.5
    }).fillna(0)
    
    # 6. Time factor: Late night/early morning payments (0 AM - 4 AM) often hit bank maintenance windows.
    time_risk = ((df['hour_of_day'] >= 0) & (df['hour_of_day'] <= 4)).astype(float) * 0.8
    
    # 7. Status factor: Payments for paused or cancelled subscriptions are highly likely to fail/be blocked.
    status_risk = df['subscription_status'].map({
        'active': 0.0,
        'paused': 1.5,
        'cancelled': 2.5
    }).fillna(0)
    
    # Add all factors together
    raw_risk_score = (
        base_risk + history_risk + retry_risk + velocity_risk + 
        amount_risk + method_risk + time_risk + status_risk
    )
    
    # Convert the raw score to a probability between 0.0 and 1.0 using the sigmoid function
    hidden_probability = 1 / (1 + np.exp(-raw_risk_score))
    
    # Sample 0 or 1 based on the calculated probability (Binomial distribution with n=1)
    df['payment_failed'] = np.random.binomial(n=1, p=hidden_probability)
    
    return df

if __name__ == "__main__":
    print("Step 3A: Generating synthetic customer profiles...")
    customers_df = generate_customer_profiles(10000)
    
    print("Step 3B: Generating payment attempts...")
    payments_df = generate_payment_attempts(customers_df, 50000)
    
    print("Step 3C: Generating payment outcomes...")
    final_df = generate_payment_outcomes(payments_df)
    
    # --- Verifications ---
    print("\nRunning validations...")
    assert len(final_df) == 50000, f"Error: Expected 50000 rows, got {len(final_df)}"
    assert final_df.isnull().sum().sum() == 0, "Error: Missing values found in dataset!"
    assert set(final_df['payment_failed'].unique()).issubset({0, 1}), "Error: payment_failed contains values other than 0 or 1"
    assert final_df['payment_id'].nunique() == 50000, "Error: duplicate payment_ids found!"
    assert final_df['customer_id'].isin(customers_df['customer_id']).all(), "Error: unmatched customer_ids found!"
    print("All validations passed.")
    
    # --- Metrics ---
    total_rows = len(final_df)
    failed_count = final_df['payment_failed'].sum()
    success_count = total_rows - failed_count
    failure_rate = (failed_count / total_rows) * 100
    
    print(f"\n--- Dataset Summary ---")
    print(f"Total rows: {total_rows}")
    print(f"Successful payments: {success_count}")
    print(f"Failed payments: {failed_count}")
    print(f"Overall failure rate: {failure_rate:.2f}%")
    
    print("\n--- First 5 rows ---")
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', 1000)
    print(final_df.head())
    
    # --- Save File ---
    output_dir = "ml/data"
    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, "payment_failure_dataset.csv")
    final_df.to_csv(file_path, index=False)
    print(f"\nDataset successfully saved to: {file_path}")