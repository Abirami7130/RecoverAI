import os
import sys

SRC = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC))

from predict_failure import predict_failure  # noqa: E402


def test_predict_failure_includes_model_metadata_fields():
    tx = {
        "amount": 29.99,
        "retry_count": 0,
        "transactions_last_24h": 0,
        "time_since_last_payment_min": 10000,
        "hour_of_day": 14,
        "day_of_week": 3,
        "customer_tenure_days": 365,
        "previous_payment_count": 12,
        "previous_failure_count": 0,
        "historical_success_rate": 1.0,
        "payment_method": "UPI",
        "subscription_status": "active",
    }
    result = predict_failure(tx)
    assert result["recovery_probability"] is None
    assert result["recovery_probability_source"] == "not_trained"
    assert "model_version" in result
    assert result["model_version"]
