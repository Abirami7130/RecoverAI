import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

file_path = 'ml/data/payment_failure_dataset.csv'
df = pd.read_csv(file_path)

print("Dataset loaded successfully.")
df.head()
print(f"Total Rows: {df.shape[0]}")
print(f"Total Columns: {df.shape[1]}")
df.info()
print("--- Missing Values ---")
print(df.isnull().sum())
print("\n--- Duplicate Payment IDs ---")
print(df['payment_id'].duplicated().sum())
print("\n--- Duplicate Rows ---")
print(df.duplicated().sum())
df.describe().round(2)
target_counts = df['payment_failed'].value_counts()
target_pct = df['payment_failed'].value_counts(normalize=True) * 100
print("Target Counts:")
print(target_counts)
print("\nTarget Percentages (%):")
print(target_pct.round(2))
print("--- Failure Rate by Payment Method (%) ---")
print((df.groupby('payment_method')['payment_failed'].mean() * 100).round(2))
print("\n--- Failure Rate by Retry Count (%) ---")
print((df.groupby('retry_count')['payment_failed'].mean() * 100).round(2))
print("\n--- Failure Rate by Subscription Status (%) ---")
print((df.groupby('subscription_status')['payment_failed'].mean() * 100).round(2))
df['success_rate_bin'] = pd.cut(df['historical_success_rate'], bins=[0.0, 0.5, 0.8, 0.9, 0.95, 1.0])
print("--- Failure Rate by Historical Success Rate Bins (%) ---")
print((df.groupby('success_rate_bin', observed=False)['payment_failed'].mean() * 100).round(2))
df['amount_bin'] = pd.cut(df['amount'], bins=[0, 50, 250, 1000, 5000])
print("\n--- Failure Rate by Amount Ranges (%) ---")
print((df.groupby('amount_bin', observed=False)['payment_failed'].mean() * 100).round(2))
print("--- Failure Rate by Hour of Day (%) ---")
print((df.groupby('hour_of_day')['payment_failed'].mean() * 100).round(2))
print("\n--- Failure Rate by Transactions in Last 24h (%) ---")
print((df.groupby('transactions_last_24h')['payment_failed'].mean() * 100).round(2))

# Disable plt.show() for headless test
# sns.set_theme(style="whitegrid")
# plt.figure(figsize=(16, 12))
# ...
