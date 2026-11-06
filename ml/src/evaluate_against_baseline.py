#!/usr/bin/env python3
"""
Compare model policy vs retry-everything vs never-retry on the synthetic CSV.
Revenue numbers are simulated (same simulate_recovery draw), not live Razorpay stats.
This script must not claim live or production validation.
"""

from __future__ import annotations

import json
import os
import sys

import pandas as pd
from sklearn.model_selection import train_test_split

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from guardrails import evaluate_recovery_case  # noqa: E402
from simulate_recovery import simulate_recovery  # noqa: E402

DATASET_PATH = os.path.join(current_dir, "..", "data", "payment_failure_dataset.csv")
SAMPLE_SIZE = 500
RANDOM_STATE = 42

FORBIDDEN_OUTPUT_SUBSTRINGS = ("production-ready", "production validated")


def row_to_transaction(row, idx: int) -> dict:
    return {
        "payment_id": str(row.get("payment_id", f"TX_{idx}")),
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
        "payment_method": str(row.get("payment_method", "CARD")).upper(),
    }


def simulate_policy(
    policy_name: str,
    tx: dict,
    prediction: dict,
    normalized_reason: str,
) -> dict:
    if policy_name == "never_retry":
        decision = {
            "failure_probability": prediction.get("failure_probability"),
            "decision": "NO_ACTION",
            "rule_ids": ["BASELINE_NEVER_RETRY"],
            "reason": "Baseline never-retry policy.",
            "revenue_at_risk": tx["amount"],
            "priority": "LOW",
            "recommended_action": "No recovery.",
        }
        strategy = {
            "strategy": "NO_RECOVERY",
            "recommended_delay_minutes": None,
            "max_attempts_remaining": 0,
            "reason": "Baseline never-retry.",
        }
    elif policy_name == "retry_everything":
        if normalized_reason == "CUSTOMER_CANCELLED":
            decision = {
                "failure_probability": prediction.get("failure_probability"),
                "decision": "NO_ACTION",
                "rule_ids": ["BASELINE_RETRY_EVERYTHING_SKIP_CANCEL"],
                "reason": "Customer cancelled; baseline skips retry.",
                "revenue_at_risk": tx["amount"],
                "priority": "LOW",
                "recommended_action": "No recovery.",
            }
            strategy = {
                "strategy": "NO_RECOVERY",
                "recommended_delay_minutes": None,
                "max_attempts_remaining": 0,
                "reason": "Baseline skip cancelled.",
            }
        else:
            decision = {
                "failure_probability": prediction.get("failure_probability"),
                "decision": "RECOVERY_ATTEMPT",
                "rule_ids": ["BASELINE_RETRY_EVERYTHING"],
                "reason": "Baseline retry-everything policy.",
                "revenue_at_risk": tx["amount"],
                "priority": "HIGH",
                "recommended_action": "Retry.",
            }
            strategy = {
                "strategy": "SMART_RETRY",
                "recommended_delay_minutes": 15,
                "max_attempts_remaining": 3,
                "reason": "Baseline smart retry.",
            }
    else:
        raise ValueError(f"Unknown baseline policy {policy_name}")

    return simulate_recovery(tx, prediction, decision, strategy)


def aggregate(outcomes: list[dict]) -> dict:
    attempted = sum(1 for o in outcomes if o.get("recovery_attempted"))
    recovered = sum(1 for o in outcomes if o.get("outcome") == "recovered")
    revenue = sum(float(o.get("revenue_recovered", 0.0)) for o in outcomes)
    return {
        "attempt_count": attempted,
        "simulated_recovered_count": recovered,
        "simulated_recovered_rupees": round(revenue, 2),
        "dataset_label": "simulated",
    }


def main() -> int:
    df = pd.read_csv(DATASET_PATH)
    failed = df[df["payment_failed"] == 1]
    sample = failed.sample(n=min(SAMPLE_SIZE, len(failed)), random_state=RANDOM_STATE)

    model_outcomes: list[dict] = []
    retry_outcomes: list[dict] = []
    never_outcomes: list[dict] = []

    for idx, row in sample.iterrows():
        tx = row_to_transaction(row, idx)
        ctx = {
            "normalized_reason": "GENERIC_FAILURE",
            "attempts_used": int(row.get("retry_count", 0)),
            "amount_paise": int(round(tx["amount"] * 100)),
            "origin_payment_status": "failed",
        }
        model_result = evaluate_recovery_case(tx, context=ctx)
        prediction = model_result["prediction"]
        model_outcomes.append(model_result["outcome"])

        retry_outcomes.append(
            simulate_policy("retry_everything", tx, prediction, ctx["normalized_reason"])
        )
        never_outcomes.append(
            simulate_policy("never_retry", tx, prediction, ctx["normalized_reason"])
        )

    report = {
        "model_policy": aggregate(model_outcomes),
        "retry_everything": aggregate(retry_outcomes),
        "never_retry": aggregate(never_outcomes),
        "sample_size": len(sample),
        "note": "simulated recovery revenue from simulate_recovery; not verified Razorpay capture",
    }

    encoded = json.dumps(report, indent=2)
    lowered = encoded.lower()
    for forbidden in FORBIDDEN_OUTPUT_SUBSTRINGS:
        if forbidden in lowered:
            print("Refusing to emit baseline report containing forbidden production claim.", file=sys.stderr)
            return 2

    print(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
