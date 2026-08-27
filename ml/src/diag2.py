import pandas as pd
from recoverai_pipeline import run_recoverai_pipeline
df = pd.read_csv("ml/data/payment_failure_dataset.csv").sample(50, random_state=42)
successes = 0
for idx, row in df.iterrows():
    tx = {
        "amount": float(row.get("amount", 0.0)),
        "retry_count": int(row.get("retry_count", 0)),
        "transactions_last_24h": int(row.get("transactions_last_24h", 0)),
        "time_since_last_payment_min": float(row.get("time_since_last_payment_min", 0.0)),
        "hour_of_day": int(row.get("hour_of_day", 0)),
        "day_of_week": int(row.get("day_of_week", 0)),
        "subscription_status": str(row.get("subscription_status", "active")),
        "customer_tenure_days": int(row.get("customer_tenure_days", 0)),
        "previous_payment_count": int(row.get("previous_payment_count", 0)),
        "previous_failure_count": int(row.get("previous_failure_count", 0)),
        "historical_success_rate": float(row.get("historical_success_rate", 0.0)),
        "payment_method": str(row.get("payment_method", "card"))
    }
    res = run_recoverai_pipeline(tx)
    if res["outcome"].get("recovery_success"):
        successes += 1
print(f"Successes in 50: {successes}")
