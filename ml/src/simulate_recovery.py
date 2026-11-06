import hashlib
import os
import sys
import pandas as pd

# Standardize python path so imports work whether run from root or ml/src/
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import existing RecoverAI components
try:
    from predict_failure import predict_failure
    from recovery_decision import decide_recovery
    from recovery_strategy import recommend_recovery_strategy
except ImportError as e:
    raise ImportError(
        "RecoverAI simulation requires predict_failure, recovery_decision, and recovery_strategy."
    ) from e


# ==============================================================================
# PART 1, 2, 3, 4, 5 — SINGLE TRANSACTION SIMULATION ENGINE
# ==============================================================================
def simulate_recovery(
    transaction_data: dict,
    prediction_result: dict,
    decision_result: dict,
    strategy_result: dict,
) -> dict:
    """Simulates a payment recovery attempt using deterministic business rules.

    WARNING: This output is a synthetic simulation for prototype testing and not
    real payment performance data.
    """
    amount = float(transaction_data.get("amount", 0.0))
    payment_id = str(transaction_data.get("payment_id", "tx_unknown"))
    retry_count = int(transaction_data.get("retry_count", 0))

    raw_prob = prediction_result.get("failure_probability")
    failure_prob = float(raw_prob if raw_prob is not None else 0.0)
    decision = decision_result.get("decision", "NO_ACTION")
    strategy = strategy_result.get("strategy", "NONE")

    # Part 5 — Revenue at Risk
    # Use the consistent probabilistic revenue-at-risk value
    # calculated by the decision engine.
    revenue_at_risk = float(decision_result.get("revenue_at_risk", 0.0))

    # Part 2 — No Recovery Cases
    if decision in ["NO_ACTION", "MONITOR"]:
        return {
            "recovery_attempted": False,
            "outcome": "no_action",
            "recovery_success": False,
            "simulated_recovery_probability": 0.0,
            "recovered_amount": 0.0,
            "revenue_at_risk": revenue_at_risk,
            "revenue_recovered": 0.0,
            "reason": f"Decision engine marked transaction as {decision}. No recovery action triggered.",
        }

    # Part 3 — Simulated Recovery Probability Formula
    # Base probability decreases as failure risk increases
    base_prob = 0.80 - (failure_prob * 0.45)

    # Strategy adjustments
    strategy_boost = 0.0
    if strategy == "SMART_RETRY":
        strategy_boost = 0.05
    elif strategy == "PRIORITY_RECOVERY":
        strategy_boost = 0.08
    elif strategy == "ALTERNATIVE_PAYMENT_METHOD":
        strategy_boost = 0.12

    # Penalty for repeated past failures/retries
    retry_penalty = retry_count * -0.05

    # Compute raw probability and clamp bounds between 5% and 90%
    raw_simulated_prob = base_prob + strategy_boost + retry_penalty
    simulated_recovery_probability = max(0.05, min(0.90, raw_simulated_prob))

    # Part 4 — Deterministic Pseudo-Random Outcome Generator
    # Generate reproducible integer seed from string payment_id
    hash_digest = hashlib.md5(payment_id.encode("utf-8")).hexdigest()
    seed_value = int(hash_digest, 16) % (2**32)

    # Simple pseudo-random float generator in range [0.0, 1.0)
    # Using LCG deterministic calculation: (a * seed + c) % m
    pseudo_random_val = ((1103515245 * seed_value + 12345) % (2**31)) / float(
        2**31
    )

    # Recovery succeeds if pseudo-random draw falls within calculated recovery probability window
    if pseudo_random_val <= simulated_recovery_probability:
        outcome = "recovered"
        recovery_success = True
        recovered_amount = amount
        revenue_recovered = amount
        reason = f"Simulated recovery successful (Draw: {pseudo_random_val:.3f} <= Prob: {simulated_recovery_probability:.3f})."
    else:
        outcome = "not_recovered"
        recovery_success = False
        recovered_amount = 0.0
        revenue_recovered = 0.0
        reason = f"Simulated recovery failed (Draw: {pseudo_random_val:.3f} > Prob: {simulated_recovery_probability:.3f})."

    return {
        "recovery_attempted": True,
        "outcome": outcome,
        "recovery_success": recovery_success,
        "simulated_recovery_probability": round(
            simulated_recovery_probability, 4
        ),
        "recovered_amount": recovered_amount,
        "revenue_at_risk": revenue_at_risk,
        "revenue_recovered": revenue_recovered,
        "reason": reason,
    }


# ==============================================================================
# PART 6 — BATCH SIMULATION
# ==============================================================================
def simulate_batch(transactions: list) -> pd.DataFrame:
    """Processes multiple synthetic transactions through full RecoverAI end-to-end pipeline."""
    batch_records = []

    for tx in transactions:
        # Step 1: Predict Failure Risk
        pred_res = predict_failure(tx)

        # Step 2: Decide Action Path
        dec_res = decide_recovery(tx, pred_res)

        # Step 3: Recommend Execution Strategy & Timing
        strat_res = recommend_recovery_strategy(tx, dec_res)

        # Step 4: Simulate Outcome
        sim_res = simulate_recovery(tx, pred_res, dec_res, strat_res)

        # Combine into standardized row
        row = {
            "payment_id": tx.get("payment_id", "N/A"),
            "amount": float(tx.get("amount", 0.0)),
            "failure_probability": round(
                float(pred_res.get("failure_probability", 0.0)), 4
            ),
            "risk_level": pred_res.get("risk_level", "low"),
            "decision": dec_res.get("decision", "NO_ACTION"),
            "strategy": strat_res.get("strategy", "NONE"),
            "recovery_attempted": sim_res["recovery_attempted"],
            "outcome": sim_res["outcome"],
            "recovery_success": sim_res["recovery_success"],
            "simulated_recovery_probability": sim_res[
                "simulated_recovery_probability"
            ],
            "recovered_amount": sim_res["recovered_amount"],
            "revenue_at_risk": sim_res["revenue_at_risk"],
            "revenue_recovered": sim_res["revenue_recovered"],
        }
        batch_records.append(row)

    return pd.DataFrame(batch_records)


# ==============================================================================
# PART 7 — TEST SCENARIOS & EXECUTION
# ==============================================================================
if __name__ == "__main__":
    # Header & Mandatory Warning Notice
    print("=" * 75)
    print("RECOVERAI SIMULATED RECOVERY OUTCOME")
    print("=" * 75)
    print("WARNING:")
    print(
        "All recovery probabilities and outcomes in this script are synthetic simulations."
    )
    print("They are NOT real Razorpay recovery statistics.\n")

    # 10 Representative Test Scenarios
    scenarios = [
        # Scenario 1: Low risk standard transaction
        {
            "payment_id": "PAY_1001_LOW",
            "amount": 499.00,
            "retry_count": 0,
            "transactions_last_24h": 1,
            "time_since_last_payment_min": 1440,
            "hour_of_day": 14,
            "day_of_week": 2,
            "customer_tenure_days": 365,
            "previous_payment_count": 20,
            "previous_failure_count": 0,
            "historical_success_rate": 1.0,
            "payment_method": "upi",
            "subscription_status": "active",
            "mock_prob": 0.08,
        },
        # Scenario 2: Moderate risk transaction
        {
            "payment_id": "PAY_1002_MOD",
            "amount": 1499.00,
            "retry_count": 1,
            "transactions_last_24h": 3,
            "time_since_last_payment_min": 60,
            "hour_of_day": 10,
            "day_of_week": 1,
            "customer_tenure_days": 45,
            "previous_payment_count": 5,
            "previous_failure_count": 1,
            "historical_success_rate": 0.80,
            "payment_method": "card",
            "subscription_status": "active",
            "mock_prob": 0.38,
        },
        # Scenario 3: High risk transaction needing recovery
        {
            "payment_id": "PAY_1003_HIGH",
            "amount": 2999.00,
            "retry_count": 2,
            "transactions_last_24h": 5,
            "time_since_last_payment_min": 15,
            "hour_of_day": 23,
            "day_of_week": 5,
            "customer_tenure_days": 12,
            "previous_payment_count": 3,
            "previous_failure_count": 2,
            "historical_success_rate": 0.33,
            "payment_method": "card",
            "subscription_status": "past_due",
            "mock_prob": 0.68,
        },
        # Scenario 4: Very high risk transaction
        {
            "payment_id": "PAY_1004_VHIGH",
            "amount": 8500.00,
            "retry_count": 3,
            "transactions_last_24h": 8,
            "time_since_last_payment_min": 5,
            "hour_of_day": 3,
            "day_of_week": 6,
            "customer_tenure_days": 2,
            "previous_payment_count": 2,
            "previous_failure_count": 2,
            "historical_success_rate": 0.0,
            "payment_method": "netbanking",
            "subscription_status": "past_due",
            "mock_prob": 0.89,
        },
        # Scenario 5: First retry scenario
        {
            "payment_id": "PAY_1005_RETRY1",
            "amount": 999.00,
            "retry_count": 1,
            "transactions_last_24h": 2,
            "time_since_last_payment_min": 30,
            "hour_of_day": 11,
            "day_of_week": 3,
            "customer_tenure_days": 120,
            "previous_payment_count": 8,
            "previous_failure_count": 1,
            "historical_success_rate": 0.875,
            "payment_method": "upi",
            "subscription_status": "active",
            "mock_prob": 0.55,
        },
        # Scenario 6: Repeated retries scenario
        {
            "payment_id": "PAY_1006_RETRY4",
            "amount": 1200.00,
            "retry_count": 4,
            "transactions_last_24h": 10,
            "time_since_last_payment_min": 2,
            "hour_of_day": 19,
            "day_of_week": 4,
            "customer_tenure_days": 180,
            "previous_payment_count": 12,
            "previous_failure_count": 4,
            "historical_success_rate": 0.66,
            "payment_method": "card",
            "subscription_status": "past_due",
            "mock_prob": 0.72,
        },
        # Scenario 7: High amount transaction
        {
            "payment_id": "PAY_1007_HIGHVAL",
            "amount": 49999.00,
            "retry_count": 1,
            "transactions_last_24h": 1,
            "time_since_last_payment_min": 300,
            "hour_of_day": 16,
            "day_of_week": 0,
            "customer_tenure_days": 500,
            "previous_payment_count": 25,
            "previous_failure_count": 2,
            "historical_success_rate": 0.92,
            "payment_method": "netbanking",
            "subscription_status": "active",
            "mock_prob": 0.62,
        },
        # Scenario 8: Cancelled subscription status
        {
            "payment_id": "PAY_1008_CANC",
            "amount": 799.00,
            "retry_count": 0,
            "transactions_last_24h": 1,
            "time_since_last_payment_min": 2880,
            "hour_of_day": 9,
            "day_of_week": 2,
            "customer_tenure_days": 90,
            "previous_payment_count": 3,
            "previous_failure_count": 1,
            "historical_success_rate": 0.66,
            "payment_method": "card",
            "subscription_status": "cancelled",
            "mock_prob": 0.82,
        },
        # Scenario 9: Alternative payment method scenario
        {
            "payment_id": "PAY_1009_ALTPAY",
            "amount": 2499.00,
            "retry_count": 2,
            "transactions_last_24h": 4,
            "time_since_last_payment_min": 120,
            "hour_of_day": 18,
            "day_of_week": 3,
            "customer_tenure_days": 60,
            "previous_payment_count": 6,
            "previous_failure_count": 2,
            "historical_success_rate": 0.66,
            "payment_method": "wallet",
            "subscription_status": "past_due",
            "mock_prob": 0.65,
        },
        # Scenario 10: Priority recovery scenario
        {
            "payment_id": "PAY_1010_PRIORITY",
            "amount": 15000.00,
            "retry_count": 1,
            "transactions_last_24h": 2,
            "time_since_last_payment_min": 45,
            "hour_of_day": 15,
            "day_of_week": 1,
            "customer_tenure_days": 200,
            "previous_payment_count": 15,
            "previous_failure_count": 3,
            "historical_success_rate": 0.80,
            "payment_method": "card",
            "subscription_status": "active",
            "mock_prob": 0.78,
        },
    ]

    # Run batch simulation
    results_df = simulate_batch(scenarios)

    # Display scenario summary table
    print("SCENARIO SIMULATION RESULTS TABLE:")
    print("-" * 135)
    display_cols = [
        "payment_id",
        "amount",
        "failure_probability",
        "decision",
        "strategy",
        "recovery_attempted",
        "outcome",
        "simulated_recovery_probability",
        "revenue_at_risk",
        "revenue_recovered",
    ]
    print(results_df[display_cols].to_string(index=False))
    print("-" * 135 + "\n")

    # ==========================================================================
    # PART 8 — BATCH METRICS & AGGREGATE SUMMARY
    # ==========================================================================
    total_tx = len(results_df)
    attempts_df = results_df[results_df["recovery_attempted"] == True]
    total_attempts = len(attempts_df)

    successful_recoveries = len(
        results_df[results_df["recovery_success"] == True]
    )
    failed_attempts = total_attempts - successful_recoveries

    # Safe division for simulated recovery rate
    simulated_recovery_rate = (
        (successful_recoveries / total_attempts * 100)
        if total_attempts > 0
        else 0.0
    )

    total_revenue_at_risk = results_df["revenue_at_risk"].sum()
    total_revenue_recovered = results_df["revenue_recovered"].sum()

    # Safe division for revenue recovery percentage
    revenue_recovery_pct = (
        (total_revenue_recovered / total_revenue_at_risk * 100)
        if total_revenue_at_risk > 0
        else 0.0
    )

    print("=" * 65)
    print("RECOVERAI SIMULATION SUMMARY")
    print("=" * 65)
    print(f"1. Total Transactions Simulated:    {total_tx}")
    print(f"2. Transactions Requiring Recovery: {total_attempts}")
    print(f"3. Successful Recoveries:          {successful_recoveries}")
    print(f"4. Failed Recovery Attempts:        {failed_attempts}")
    print(f"5. Simulated Recovery Rate:         {simulated_recovery_rate:.2f}%")
    print(f"6. Total Revenue at Risk:           ₹{total_revenue_at_risk:,.2f}")
    print(
        f"7. Total Revenue Recovered:         ₹{total_revenue_recovered:,.2f}"
    )
    print(f"8. Revenue Recovery Percentage:     {revenue_recovery_pct:.2f}%")
    print("=" * 65)