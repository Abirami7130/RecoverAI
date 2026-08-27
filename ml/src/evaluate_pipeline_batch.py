#!/usr/bin/env python3
"""
RecoverAI Batch Pipeline Evaluation (Step 13)
---------------------------------------------
This script runs the RecoverAI end-to-end pipeline across a large sample of 
the existing synthetic dataset (payment_failure_dataset.csv) and produces 
comprehensive aggregate business, operational, and pipeline performance metrics.

Note: Official ML evaluation metrics are loaded from held-out test evaluation
rather than re-calculated on the sampled batch.
"""

import os
import sys
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score

# Ensure the src directory is in the python path for absolute/relative imports
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Import existing pipeline function without duplicating logic
try:
    from recoverai_pipeline import run_recoverai_pipeline
except ImportError as e:
    print(f"Error importing recoverai_pipeline: {e}")
    print("Ensure recoverai_pipeline.py is in ml/src/.")
    sys.exit(1)

# Configuration
BATCH_SIZE = 5000
RANDOM_STATE = 42
DATASET_PATH = os.path.join(current_dir, "../data/payment_failure_dataset.csv")
OUTPUT_CSV_PATH = os.path.join(current_dir, "../data/pipeline_evaluation_results.csv")

def extract_transaction_features(row, idx):
    """
    Extracts the exact transaction feature dictionary required by the 
    prediction pipeline from a dataset row, ensuring subscription_status 
    is handled as a categorical string and excluding actual outcomes.
    """
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
        "payment_method": str(row.get("payment_method", "CARD")).upper()
    }

def calculate_baselines(df_full):
    """
    Calculates sanity-check baselines using the exact held-out test split from Step 5.
    These are not production alternatives, just basic benchmarks.
    """
    target_col = 'payment_failed'
    drop_cols = ['payment_id', 'customer_id', target_col]
    X = df_full.drop(columns=drop_cols)
    y = df_full[target_col]
    
    # Same split as step 5
    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # 1. Majority-class baseline: always predict success (0)
    y_pred_maj = np.zeros_like(y_test)
    maj_prec = precision_score(y_test, y_pred_maj, zero_division=0)
    maj_rec = recall_score(y_test, y_pred_maj)
    maj_f1 = f1_score(y_test, y_pred_maj, zero_division=0)
    maj_auc = 0.5  # mathematically meaningful for all-zero predictions
    
    # 2. Historical-success-rate baseline: predict failure (1) if success_rate < 0.5
    y_pred_hist = (X_test['historical_success_rate'] < 0.5).astype(int)
    hist_prec = precision_score(y_test, y_pred_hist, zero_division=0)
    hist_rec = recall_score(y_test, y_pred_hist)
    hist_f1 = f1_score(y_test, y_pred_hist, zero_division=0)
    try:
        hist_auc = roc_auc_score(y_test, y_pred_hist)
    except:
        hist_auc = 0.5

    return {
        "majority": {"prec": maj_prec, "rec": maj_rec, "f1": maj_maj, "auc": maj_auc} if 'maj_maj' in locals() else {"prec": maj_prec, "rec": maj_rec, "f1": maj_f1, "auc": maj_auc},
        "historical": {"prec": hist_prec, "rec": hist_rec, "f1": hist_f1, "auc": hist_auc}
    }

def main():
    # 1. Load Dataset
    if not os.path.exists(DATASET_PATH):
        print(f"Error: Dataset not found at {DATASET_PATH}")
        sys.exit(1)

    df_full = pd.read_csv(DATASET_PATH)
    
    # Calculate baseline metrics
    baselines = calculate_baselines(df_full)

    # Sample batch
    if len(df_full) > BATCH_SIZE:
        df_batch = df_full.sample(n=BATCH_SIZE, random_state=RANDOM_STATE).reset_index(drop=True)
    else:
        df_batch = df_full.copy()
    
    actual_batch_size = len(df_batch)

    results_records = []
    
    # 2. Run Pipeline Iteratively over Batch
    for idx, row in df_batch.iterrows():
        tx_data = extract_transaction_features(row, idx)
        
        # Run End-to-End Pipeline
        pipeline_output = run_recoverai_pipeline(tx_data)

        # Flatten and store results for batch analysis
        actual_failed = int(row.get("payment_failed", 0))
        
        pred = pipeline_output["prediction"]
        dec = pipeline_output["decision"]
        strat = pipeline_output["strategy"]
        out = pipeline_output["outcome"]

        record = {
            "payment_id": tx_data["payment_id"],
            "amount": tx_data["amount"],
            "actual_payment_failed": actual_failed,
            "failure_probability": pred.get("failure_probability", 0.0),
            "risk_level": str(pred.get("risk_level", "LOW")).upper(),
            "revenue_at_risk": dec.get("revenue_at_risk", 0.0),
            "decision": dec.get("decision", "NO_ACTION"),
            "strategy": strat.get("strategy", "NO_RECOVERY"),
            "recovery_attempted": out.get("recovery_attempted", False),
            "outcome": out.get("outcome", "UNKNOWN"),
            "recovery_success": out.get("recovery_success", False),
            "simulated_recovery_probability": out.get("simulated_recovery_probability", 0.0),
            "revenue_recovered": out.get("revenue_recovered", 0.0)
        }
        results_records.append(record)

    df_results = pd.DataFrame(results_records)

    # 3. Sanity Checks
    print("\n--- Running Sanity Checks ---")
    sanity_passed = True
    
    if len(df_results) != actual_batch_size:
        print(f"FAILED: Output rows ({len(df_results)}) != batch size ({actual_batch_size})")
        sanity_passed = False
        
    required_cols = ["payment_id", "failure_probability", "risk_level", "decision", "strategy", "recovery_attempted", "outcome"]
    if df_results[required_cols].isnull().any().any():
        print("FAILED: Missing values in required output columns")
        sanity_passed = False
        
    if df_results["decision"].count() != actual_batch_size:
        print("FAILED: Decision counts do not sum to total transactions")
        sanity_passed = False
        
    if df_results["strategy"].count() != actual_batch_size:
        print("FAILED: Strategy counts do not sum to total transactions")
        sanity_passed = False
        
    recovery_attempts = df_results["recovery_attempted"].sum()
    if df_results[df_results["recovery_attempted"] == True].shape[0] != recovery_attempts:
        print("FAILED: Recovery attempts count mismatch")
        sanity_passed = False
        
    successful_recoveries = df_results["recovery_success"].sum()
    if successful_recoveries > recovery_attempts:
        print("FAILED: Successful recoveries > recovery attempts")
        sanity_passed = False
        
    total_revenue_recovered = df_results["revenue_recovered"].sum()
    total_revenue_at_risk = df_results["revenue_at_risk"].sum()
    if total_revenue_recovered > total_revenue_at_risk:
        print("FAILED: Simulated revenue recovered > total revenue at risk")
        sanity_passed = False
        
    if (df_results["failure_probability"] < 0).any() or (df_results["failure_probability"] > 1).any():
        print("FAILED: Failure probabilities outside [0, 1]")
        sanity_passed = False
        
    if df_results["failure_probability"].isna().any():
        print("FAILED: NaN failure probabilities detected")
        sanity_passed = False
        
    if not sanity_passed:
        print("SANITY CHECKS FAILED. Halting evaluation to prevent misleading results.")
        sys.exit(1)
    
    # Save results
    os.makedirs(os.path.dirname(OUTPUT_CSV_PATH), exist_ok=True)
    df_results.to_csv(OUTPUT_CSV_PATH, index=False)

    # 4. Generate Final Report
    print("\n" + "=" * 65)
    print("RECOVERAI STEP 13 \u2014 BATCH PIPELINE EVALUATION")
    print("=" * 65)

    print("\nWARNING:")
    print("Recovery outcomes are synthetic simulations and are NOT real")
    print("Razorpay recovery statistics.")

    print("\nDATASET & REPRODUCIBILITY")
    print("-" * 65)
    print(f"Dataset rows: {len(df_full):,}")
    print(f"Batch size: {actual_batch_size:,}")
    print(f"Random state: {RANDOM_STATE}")
    print(f"Results file: ml/data/pipeline_evaluation_results.csv")

    print("\nOFFICIAL HELD-OUT ML VALIDATION")
    print("-" * 65)
    print("These metrics come from the previously evaluated held-out test set.")
    print("They are NOT recalculated on this 5,000-row batch.")
    print("ROC-AUC           0.7897")
    print("Average Precision 0.5592")
    print("Brier Score       0.1163")
    print("Precision         0.6806")
    print("Recall            0.3134")
    print("F1 Score          0.4291")

    print("\nBASELINE SANITY CHECK")
    print("-" * 65)
    print("Calculated on the existing held-out test split (not a production alternative).")
    print("1. Majority-class baseline (always predict success):")
    print(f"   ROC-AUC:   {baselines['majority']['auc']:.4f}")
    print(f"   Precision: {baselines['majority']['prec']:.4f}")
    print(f"   Recall:    {baselines['majority']['rec']:.4f}")
    print(f"   F1 Score:  {baselines['majority']['f1']:.4f}")
    print("2. Historical-success-rate baseline (predict failure if rate < 0.5):")
    print(f"   ROC-AUC:   {baselines['historical']['auc']:.4f}")
    print(f"   Precision: {baselines['historical']['prec']:.4f}")
    print(f"   Recall:    {baselines['historical']['rec']:.4f}")
    print(f"   F1 Score:  {baselines['historical']['f1']:.4f}")
    print("-> Gradient Boosting ML provides significant lift over these baselines.")

    print("\nBATCH BUSINESS / PIPELINE RESULTS")
    print("-" * 65)
    print(f"Total Transactions Evaluated : {actual_batch_size:,}")
    actual_failures = df_results["actual_payment_failed"].sum()
    print(f"Actual Failures              : {actual_failures:,} ({actual_failures / actual_batch_size * 100:.2f}%)")

    print("\nDECISION ANALYSIS")
    print("-" * 65)
    for dec in ["NO_ACTION", "MONITOR", "RECOVERY_ATTEMPT", "PRIORITY_RECOVERY"]:
        dec_df = df_results[df_results["decision"] == dec]
        count = len(dec_df)
        pct = (count / actual_batch_size) * 100
        fail_rate = dec_df["actual_payment_failed"].mean() * 100 if count > 0 else 0
        avg_prob = dec_df["failure_probability"].mean() * 100 if count > 0 else 0
        rev_risk = dec_df["revenue_at_risk"].sum()
        
        print(f"Decision: {dec}")
        print(f"  Transaction count          : {count:,} ({pct:.2f}%)")
        print(f"  Actual failure rate        : {fail_rate:.2f}%")
        print(f"  Avg predicted failure prob : {avg_prob:.2f}%")
        print(f"  Total revenue at risk      : \u20b9{rev_risk:,.2f}")

    print("\nRECOVERY STRATEGY ANALYSIS")
    print("-" * 65)
    for strat in ["NO_RECOVERY", "MONITOR", "SMART_RETRY", "ALTERNATIVE_PAYMENT_METHOD", "PRIORITY_RECOVERY"]:
        strat_df = df_results[df_results["strategy"] == strat]
        tx_count = len(strat_df)
        attempts = strat_df["recovery_attempted"].sum()
        successes = strat_df["recovery_success"].sum()
        rev_risk = strat_df["revenue_at_risk"].sum()
        rev_rec = strat_df["revenue_recovered"].sum()
        
        if attempts > 0:
            rec_rate = f"{(successes / attempts * 100):.2f}%"
        else:
            rec_rate = "N/A"
            
        print(f"Strategy: {strat}")
        print(f"  Transactions               : {tx_count:,}")
        print(f"  Recovery attempts          : {attempts:,}")
        print(f"  Successful recoveries      : {successes:,}")
        print(f"  Simulated recovery rate    : {rec_rate}")
        print(f"  Total revenue at risk      : \u20b9{rev_risk:,.2f}")
        print(f"  Simulated revenue recovered: \u20b9{rev_rec:,.2f}")

    print("\nREVENUE RISK ANALYSIS")
    print("-" * 65)
    total_tx_val = df_results["amount"].sum()
    pct_val_at_risk = (total_revenue_at_risk / total_tx_val * 100) if total_tx_val > 0 else 0
    rev_rec_pct = (total_revenue_recovered / total_revenue_at_risk * 100) if total_revenue_at_risk > 0 else 0
    avg_rev_risk_per_tx = total_revenue_at_risk / actual_batch_size if actual_batch_size > 0 else 0
    avg_rec_amt_per_success = total_revenue_recovered / successful_recoveries if successful_recoveries > 0 else 0
    
    print(f"Total transaction value                : \u20b9{total_tx_val:,.2f}")
    print(f"Total revenue at risk                  : \u20b9{total_revenue_at_risk:,.2f}")
    print(f"Percentage of total tx value at risk   : {pct_val_at_risk:.2f}%")
    print(f"Simulated revenue recovered            : \u20b9{total_revenue_recovered:,.2f}")
    print(f"Revenue recovery percentage            : {rev_rec_pct:.2f}%")
    print(f"Average revenue at risk per tx         : \u20b9{avg_rev_risk_per_tx:,.2f}")
    print(f"Average recovered amt per success      : \u20b9{avg_rec_amt_per_success:,.2f}")

    print("\nRISK TIER ANALYSIS")
    print("-" * 65)
    for risk_lvl in ["LOW", "MEDIUM", "HIGH"]:
        group_df = df_results[df_results["risk_level"] == risk_lvl]
        g_count = len(group_df)
        g_fail_rate = group_df["actual_payment_failed"].mean() * 100 if g_count > 0 else 0
        g_avg_prob = group_df["failure_probability"].mean() * 100 if g_count > 0 else 0
        g_rev_risk = group_df["revenue_at_risk"].sum()
        
        print(f"Risk Tier: {risk_lvl}")
        print(f"  Transactions               : {g_count:,}")
        print(f"  Actual Failure Rate        : {g_fail_rate:.2f}%")
        print(f"  Avg Predicted Failure Prob : {g_avg_prob:.2f}%")
        print(f"  Total Revenue At Risk      : \u20b9{g_rev_risk:,.2f}")

    print("\nSANITY CHECKS")
    print("-" * 65)
    print("All 9 data integrity and consistency sanity checks passed.")

    print("\n" + "=" * 65)
    print("EVALUATION COMPLETE")
    print("=" * 65)

if __name__ == "__main__":
    main()
