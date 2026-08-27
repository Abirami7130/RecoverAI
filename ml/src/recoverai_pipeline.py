#!/usr/bin/env python3
"""
RecoverAI End-to-End Recovery Pipeline (Step 12)
------------------------------------------------
This script integrates all core components of the RecoverAI system into a 
single, cohesive end-to-end pipeline. It coordinates:
1. ML Failure Prediction
2. Revenue-Aware Decision Making
3. Recovery Strategy Generation
4. Recovery Outcome Simulation

It takes a raw transaction dictionary, passes it through each modular step
without duplicating logic, and outputs a complete, structured JSON-like trace.
"""

import json
import sys
import os

# Ensure the src directory is in the python path for absolute/relative imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Import existing modular components without duplicating logic
try:
    from predict_failure import predict_failure
    from recovery_decision import decide_recovery
    from recovery_strategy import recommend_recovery_strategy
    from simulate_recovery import simulate_recovery
except ImportError as e:
    print(f"Error importing required modules: {e}")
    print("Ensure predict_failure.py, recovery_decision.py, recovery_strategy.py, and simulate_recovery.py are in ml/src/.")
    raise


def run_recoverai_pipeline(transaction_data):
    """
    Runs the complete RecoverAI end-to-end recovery pipeline for a given transaction.

    Args:
        transaction_data (dict): Raw transaction data dictionary containing features
                                 available BEFORE a payment outcome is known.

    Returns:
        dict: A structured dictionary containing the transaction, prediction,
              decision, strategy, and simulated outcome.
    """
    # Step 1: Run ML Failure Prediction
    # Calls the prediction model to determine failure probability and risk tier
    prediction_result = predict_failure(transaction_data)

    # Step 2: Run Revenue-Aware Decision Engine
    # Combines prediction results with transaction financial data (amount)
    decision_result = decide_recovery(transaction_data, prediction_result)

    # Step 3: Run Recovery Strategy Engine
    # Determines the appropriate recovery tactic, delay, and retry limits
    strategy_result = recommend_recovery_strategy(transaction_data, decision_result)

    # Step 4: Run Recovery Outcome Simulation
    # Simulates whether the recovery strategy will succeed
    outcome_result = simulate_recovery(
        transaction_data,
        prediction_result,
        decision_result,
        strategy_result
    )

    # Assemble and return the complete end-to-end pipeline trace
    pipeline_result = {
        "transaction": transaction_data,
        "prediction": prediction_result,
        "decision": decision_result,
        "strategy": strategy_result,
        "outcome": outcome_result
    }

    return pipeline_result


def print_pipeline_trace(result):
    """
    Pretty prints the pipeline trace for a single transaction according to the required spec.
    """
    tx = result["transaction"]
    pred = result["prediction"]
    dec = result["decision"]
    strat = result["strategy"]
    out = result["outcome"]

    print("=" * 60)
    print("RECOVERAI END-TO-END PIPELINE")
    print("=" * 60)
    
    print("\nTRANSACTION")
    print(json.dumps(tx, indent=2))

    print("\nML PREDICTION")
    print(f"Failure Probability: {pred.get('failure_probability', 0.0):.4f}")
    print(f"Risk Level: {pred.get('risk_level', 'UNKNOWN')}")

    print("\nDECISION")
    print(f"Revenue at Risk: ₹{dec.get('revenue_at_risk', 0.0):.2f}")
    print(f"Decision: {dec.get('decision', 'UNKNOWN')}")
    print(f"Priority: {dec.get('priority', 'UNKNOWN')}")

    print("\nRECOVERY STRATEGY")
    print(f"Strategy: {strat.get('strategy', 'UNKNOWN')}")
    print(f"Recommended Delay: {strat.get('recommended_delay_minutes', 0)} minutes")
    print(f"Maximum Attempts Remaining: {strat.get('max_attempts_remaining', 0)}")

    print("\nSIMULATED OUTCOME")
    print(f"Recovery Attempted: {out.get('recovery_attempted', False)}")
    print(f"Outcome: {out.get('outcome', 'UNKNOWN')}")
    print(f"Simulated Recovery Probability: {out.get('simulated_recovery_probability', 0.0):.4f}")
    print(f"Revenue Recovered: ₹{out.get('revenue_recovered', 0.0):.2f}")
    print("=" * 60)


def main():
    """
    Main entry point with 5 realistic test cases representing different risk and value profiles.
    """
    # Test Case 1: Low-risk payment (Strong history, low retries, trusted method)
    tx_1 = {
        "amount": 49.99,
        "retry_count": 0,
        "transactions_last_24h": 1,
        "time_since_last_payment_min": 1440.0,
        "hour_of_day": 14,
        "day_of_week": 2,
        "subscription_status": "active",
        "customer_tenure_days": 365,
        "previous_payment_count": 24,
        "previous_failure_count": 0,
        "historical_success_rate": 1.0,
        "payment_method": "UPI"
    }

    # Test Case 2: Moderate-risk payment (Some recent activity, minor history gaps)
    tx_2 = {
        "amount": 120.00,
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

    # Test Case 3: High-risk payment (Frequent recent transactions, low success rate)
    tx_3 = {
        "amount": 250.00,
        "retry_count": 2,
        "transactions_last_24h": 6,
        "time_since_last_payment_min": 15.0,
        "hour_of_day": 23,
        "day_of_week": 5,
        "subscription_status": "cancelled",
        "customer_tenure_days": 10,
        "previous_payment_count": 5,
        "previous_failure_count": 3,
        "historical_success_rate": 0.40,
        "payment_method": "CARD"
    }

    # Test Case 4: High-value moderate-risk payment (Large ticket size, standard indicators)
    tx_4 = {
        "amount": 1500.00,
        "retry_count": 0,
        "transactions_last_24h": 1,
        "time_since_last_payment_min": 2880.0,
        "hour_of_day": 10,
        "day_of_week": 1,
        "subscription_status": "active",
        "customer_tenure_days": 500,
        "previous_payment_count": 15,
        "previous_failure_count": 1,
        "historical_success_rate": 0.93,
        "payment_method": "NETBANKING"
    }

    # Test Case 5: Very-high-risk payment with repeated retries (High failure count, erratic timing)
    tx_5 = {
        "amount": 450.00,
        "retry_count": 4,
        "transactions_last_24h": 10,
        "time_since_last_payment_min": 2.0,
        "hour_of_day": 3,
        "day_of_week": 6,
        "subscription_status": "cancelled",
        "customer_tenure_days": 5,
        "previous_payment_count": 7,
        "previous_failure_count": 6,
        "historical_success_rate": 0.1429,
        "payment_method": "CARD"
    }

    test_transactions = [tx_1, tx_2, tx_3, tx_4, tx_5]

    # Execute pipeline for each test case and print trace
    for idx, tx in enumerate(test_transactions, start=1):
        print(f"\nRunning Test Case {idx}...")
        pipeline_output = run_recoverai_pipeline(tx)
        print_pipeline_trace(pipeline_output)
        print("\n")

    print("PIPELINE COMPLETE")
    print("\nWARNING:")
    print("Recovery outcomes are synthetic simulations and are NOT real Razorpay recovery statistics.")


if __name__ == "__main__":
    main()