"""
ml/src/recovery_decision.py

RecoverAI Revenue-Aware Decision Engine

This module combines Machine Learning payment failure probability predictions
with expected financial exposure (revenue at risk) to route transactions into
appropriate recovery workflows.

NOTE: Revenue-aware decision policy is a business-policy layer, not an ML prediction.
"""

import os
import sys

# Ensure module path imports work smoothly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


def decide_recovery(transaction_data: dict, prediction_result: dict) -> dict:
    """Determines the recovery decision and priority for a payment transaction.

    Combines baseline ML failure probability with financial exposure calculation
    (revenue_at_risk) to apply revenue-aware elevation business rules.

    Parameters:
    -----------
    transaction_data : dict
        Contains transaction attributes (amount, retry_count, subscription_status, etc.)
    prediction_result : dict
        Contains ML model prediction outputs (failure_probability, risk_level)

    Returns:
    --------
    dict
        Structured recovery decision including financial exposure, action, priority, and reason.
    """
    # Extract transaction parameters
    amount = float(transaction_data.get("amount", 0.0))
    retry_count = int(transaction_data.get("retry_count", 0))
    sub_status = str(
        transaction_data.get("subscription_status", "active")
    ).lower()

    # Extract prediction parameters
    failure_prob = float(prediction_result.get("failure_probability", 0.0))
    risk_level = str(prediction_result.get("risk_level", "low"))

    # =========================================================================
    # 1. CALCULATE FINANCIAL EXPOSURE (REVENUE AT RISK)
    # =========================================================================
    # Revenue at risk represents expected revenue loss exposure: (Amount * Failure Probability)
    revenue_at_risk = amount * failure_prob

    # =========================================================================
    # 2. BASELINE PROBABILITY POLICY
    # =========================================================================
    if failure_prob < 0.25:
        baseline_decision = "NO_ACTION"
    elif failure_prob < 0.60:
        baseline_decision = "MONITOR"
    elif failure_prob < 0.85:
        baseline_decision = "RECOVERY_ATTEMPT"
    else:
        baseline_decision = "PRIORITY_RECOVERY"

    # =========================================================================
    # 3. REVENUE-AWARE OVERRIDE POLICY
    # =========================================================================
    # Rule: If failure_probability >= 0.25 AND revenue_at_risk >= 5000, elevate decision by ONE level.
    # NO_ACTION (prob < 0.25) is NEVER elevated purely due to transaction amount.
    final_decision = baseline_decision
    elevated = False

    if failure_prob >= 0.25 and revenue_at_risk >= 5000.0:
        if baseline_decision == "MONITOR":
            final_decision = "RECOVERY_ATTEMPT"
            elevated = True
        elif baseline_decision == "RECOVERY_ATTEMPT":
            final_decision = "PRIORITY_RECOVERY"
            elevated = True
        # PRIORITY_RECOVERY is already the maximum decision tier

    # =========================================================================
    # 4. PRIORITY & RECOMMENDED ACTION MAPPING
    # =========================================================================
    priority_map = {
        "NO_ACTION": "LOW",
        "MONITOR": "MEDIUM",
        "RECOVERY_ATTEMPT": "HIGH",
        "PRIORITY_RECOVERY": "CRITICAL",
    }

    action_map = {
        "NO_ACTION": "No action required. Risk is within acceptable operational thresholds.",
        "MONITOR": "Monitor transaction status. Prepare asynchronous recovery retry if failure occurs.",
        "RECOVERY_ATTEMPT": "Execute automated smart recovery workflow immediately.",
        "PRIORITY_RECOVERY": "Escalate to high-priority immediate multi-channel recovery workflow.",
    }

    priority = priority_map[final_decision]
    recommended_action = action_map[final_decision]

    # =========================================================================
    # 5. EXPLANATORY REASON BUILDER
    # =========================================================================
    reasons = []

    # Baseline evaluation explanation
    reasons.append(
        f"Base evaluation: {baseline_decision} (Predicted failure probability: {failure_prob:.2%})."
    )

    # Elevation / Revenue exposure note
    if elevated:
        reasons.append(
            f"Decision elevated to {final_decision} due to high expected financial exposure "
            f"(Revenue at Risk: ₹{revenue_at_risk:,.2f} >= ₹5,000.00 threshold)."
        )
    elif amount >= 5000.0:
        if failure_prob < 0.25:
            reasons.append(
                f"High transaction value detected (₹{amount:,.2f}), but failure probability ({failure_prob:.2%}) "
                "is below intervention threshold (0.25). Remained NO_ACTION."
            )
        else:
            reasons.append(
                f"High transaction value (₹{amount:,.2f}), but expected revenue at risk "
                f"(₹{revenue_at_risk:,.2f}) did not exceed the ₹5,000 elevation threshold."
            )

    # Retry count context
    if retry_count >= 2:
        reasons.append(
            f"Warning: Repeated retries detected ({retry_count} previous attempt(s))."
        )

    # Subscription status context
    if sub_status in ["paused", "cancelled"]:
        reasons.append(
            f"Warning: Subscription account status is currently '{sub_status}'."
        )

    reason_text = " ".join(reasons)

    # Return standardized decision payload
    return {
        "failure_probability": round(failure_prob, 4),
        "risk_level": risk_level,
        "revenue_at_risk": round(revenue_at_risk, 2),
        "decision": final_decision,
        "recommended_action": recommended_action,
        "priority": priority,
        "reason": reason_text,
    }


# =============================================================================
# MAIN / TEST SCENARIOS EXECUTION
# =============================================================================
if __name__ == "__main__":
    print("=" * 80)
    print("RECOVERAI REVENUE-AWARE DECISION ENGINE TEST RUN")
    print("=" * 80)
    print(
        "Notice: Revenue-aware decision policy is a business-policy layer, not an ML prediction.\n"
    )

    # Define test scenarios spanning low/high probability and low/high revenue exposure
    scenarios = [
        {
            "name": "Scenario 1: Low probability + low amount",
            "tx": {"amount": 500.0, "retry_count": 0, "subscription_status": "active"},
            "pred": {"failure_probability": 0.08, "risk_level": "low"},
        },
        {
            "name": "Scenario 2: Moderate probability + low amount",
            "tx": {"amount": 500.0, "retry_count": 0, "subscription_status": "active"},
            "pred": {"failure_probability": 0.40, "risk_level": "medium"},
        },
        {
            "name": "Scenario 3: Moderate probability + high amount (Elevated)",
            "tx": {"amount": 15000.0, "retry_count": 0, "subscription_status": "active"},
            "pred": {"failure_probability": 0.40, "risk_level": "medium"},
        },
        {
            "name": "Scenario 4: High probability + normal amount",
            "tx": {"amount": 2000.0, "retry_count": 1, "subscription_status": "active"},
            "pred": {"failure_probability": 0.72, "risk_level": "high"},
        },
        {
            "name": "Scenario 5: High probability + high amount (Elevated)",
            "tx": {"amount": 10000.0, "retry_count": 1, "subscription_status": "active"},
            "pred": {"failure_probability": 0.72, "risk_level": "high"},
        },
        {
            "name": "Scenario 6: Very high probability",
            "tx": {"amount": 1000.0, "retry_count": 0, "subscription_status": "active"},
            "pred": {"failure_probability": 0.92, "risk_level": "high"},
        },
        {
            "name": "Scenario 7: Very high amount but very low probability (No Elevation)",
            "tx": {"amount": 100000.0, "retry_count": 0, "subscription_status": "active"},
            "pred": {"failure_probability": 0.05, "risk_level": "low"},
        },
        {
            "name": "Scenario 8: Repeated retries + high financial exposure",
            "tx": {"amount": 12000.0, "retry_count": 3, "subscription_status": "past_due"},
            "pred": {"failure_probability": 0.45, "risk_level": "medium"},
        },
    ]

    for i, s in enumerate(scenarios, 1):
        tx_data = s["tx"]
        pred_res = s["pred"]
        decision_res = decide_recovery(tx_data, pred_res)

        print(f"[{s['name']}]")
        print(f"  Failure Probability: {decision_res['failure_probability']:.2%}")
        print(f"  Amount:              ₹{tx_data['amount']:,.2f}")
        print(f"  Revenue at Risk:     ₹{decision_res['revenue_at_risk']:,.2f}")
        print(f"  Risk Level:          {decision_res['risk_level']}")
        print(f"  Decision:            {decision_res['decision']}")
        print(f"  Priority:            {decision_res['priority']}")
        print(f"  Recommended Action:  {decision_res['recommended_action']}")
        print(f"  Reason:              {decision_res['reason']}")
        print("-" * 80)