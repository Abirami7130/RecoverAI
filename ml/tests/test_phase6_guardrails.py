import os
import sys

import pytest

SRC = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC))

from guardrails import evaluate_recovery_case  # noqa: E402


BASE_TX = {
    "payment_id": "order_test",
    "amount": 15000.0,
    "retry_count": 0,
    "transactions_last_24h": 6,
    "time_since_last_payment_min": 5.0,
    "hour_of_day": 23,
    "day_of_week": 5,
    "subscription_status": "active",
    "customer_tenure_days": 30,
    "previous_payment_count": 8,
    "previous_failure_count": 4,
    "historical_success_rate": 0.35,
    "payment_method": "UPI",
}


def test_approval_required_blocks_order_creation():
    result = evaluate_recovery_case(
        BASE_TX,
        context={
            "normalized_reason": "ISSUER_TIMEOUT",
            "attempts_used": 0,
            "amount_paise": 1_500_000,
            "origin_payment_status": "failed",
        },
        policy={"approval_threshold_paise": 1_000_000},
    )
    assert result["guardrail"]["result"] == "blocked"
    assert "APPROVAL_REQUIRED" in result["guardrail"]["rule_ids"]
    assert result["guardrail"]["final_action"] in {
        "SMART_RETRY",
        "PRIORITY_RECOVERY",
        "ALTERNATIVE_PAYMENT_METHOD",
    }


def test_cancelled_subscription_blocked_by_default():
    tx = {**BASE_TX, "subscription_status": "cancelled"}
    result = evaluate_recovery_case(
        tx,
        context={
            "normalized_reason": "ISSUER_TIMEOUT",
            "attempts_used": 0,
            "amount_paise": 49900,
            "origin_payment_status": "failed",
        },
        policy={"retry_cancelled_subscriptions": False},
    )
    assert result["guardrail"]["result"] == "blocked"
    assert "REASON_DISABLED" in result["guardrail"]["rule_ids"]


def test_recommends_next_payment_method_for_authentication_failed():
    tx = {**BASE_TX, "payment_method": "UPI", "amount": 499.0}
    result = evaluate_recovery_case(
        tx,
        context={
            "normalized_reason": "AUTHENTICATION_FAILED",
            "attempts_used": 0,
            "amount_paise": 49900,
            "origin_payment_status": "failed",
        },
        policy={"approval_threshold_paise": None},
    )
    assert result["guardrail"].get("recommended_method") == "CARD"
