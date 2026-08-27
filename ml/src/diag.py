import json
from recoverai_pipeline import run_recoverai_pipeline
tx_2 = {
    "amount": 120.0,
    "retry_count": 1,
    "transactions_last_24h": 3,
    "time_since_last_payment_min": 120.0,
    "hour_of_day": 18,
    "day_of_week": 4,
    "subscription_status": "active",
    "customer_tenure_days": 90,
    "previous_payment_count": 5,
    "previous_failure_count": 1,
    "historical_success_rate": 0.83,
    "payment_method": "CARD"
}
res = run_recoverai_pipeline(tx_2)
print(json.dumps(res, indent=2))
