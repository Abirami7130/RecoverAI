import os
import sys

import pytest

SRC = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC))

from guardrails import evaluate_recovery_case  # noqa: E402


BASE_TX = {
    "payment_id": "order_test",
    "amount": 499.0,
    "retry_count": 0,
    "transactions_last_24h": 1,
    "time_since_last_payment_min": 60.0,
    "hour_of_day": 12,
    "day_of_week": 2,
    "subscription_status": "active",
    "customer_tenure_days": 180,
    "previous_payment_count": 5,
    "previous_failure_count": 1,
    "historical_success_rate": 0.8,
    "payment_method": "UPI",
}


def test_customer_cancelled_forces_no_recovery():
    result = evaluate_recovery_case(
        BASE_TX,
        context={
            "normalized_reason": "CUSTOMER_CANCELLED",
            "attempts_used": 0,
            "amount_paise": 49900,
            "origin_payment_status": "failed",
        },
    )
    assert result["guardrail"]["final_action"] == "NO_RECOVERY"
    assert result["guardrail"]["result"] == "blocked"
    assert "REASON_DISABLED" in result["guardrail"]["rule_ids"]


def test_attempt_cap_blocks_fourth_execution():
    result = evaluate_recovery_case(
        BASE_TX,
        context={
            "normalized_reason": "ISSUER_TIMEOUT",
            "attempts_used": 3,
            "amount_paise": 49900,
            "origin_payment_status": "failed",
        },
    )
    assert result["guardrail"]["result"] == "blocked"
    assert "ATTEMPT_CAP" in result["guardrail"]["rule_ids"]


def test_already_captured_blocks():
    result = evaluate_recovery_case(
        BASE_TX,
        context={
            "normalized_reason": "ISSUER_TIMEOUT",
            "attempts_used": 0,
            "amount_paise": 49900,
            "origin_payment_status": "captured",
        },
    )
    assert result["guardrail"]["final_action"] == "NO_RECOVERY"
    assert "ALREADY_CAPTURED" in result["guardrail"]["rule_ids"]
