# ml/src/recovery_strategy.py

def recommend_recovery_strategy(
    transaction_data,
    decision_result,
    max_attempts: int = 3,
):
    """
    RecoverAI Smart Recovery Strategy and Timing Layer (Step 10).
    
    This function acts as a business-policy layer that maps the decision engine's 
    output and transaction context to specific recovery strategies, retry delays, 
    and remaining attempts. 
    
    Note: These rules are explainable initial policies, not learned ML timing models, 
    designed to be replaced once real historical recovery outcome data becomes available.
    
    Args:
        transaction_data (dict): Raw features of the payment transaction.
        decision_result (dict): The output from Step 9 containing decision, probability, etc.
                                  
    Returns:
        dict: A structured strategy payload containing strategy, delay, attempts, and reason.
    """
    # 1. Extract inputs from decision result and raw transaction data
    decision = decision_result.get("decision", "NO_ACTION")
    prob = decision_result.get("failure_probability", 0.0)
    
    retry_count = transaction_data.get("retry_count", 0)
    sub_status = transaction_data.get("subscription_status", "active")
    amount = transaction_data.get("amount", 0.0)
    
    # 2. Determine base strategy and recommended delay based on the decision and retry count
    if decision == "NO_ACTION":
        strategy = "NO_RECOVERY"
        recommended_delay_minutes = None
        base_reason = "Transaction requires no recovery action."
        
    elif decision == "MONITOR":
        strategy = "MONITOR"
        recommended_delay_minutes = None
        base_reason = "Transaction is under monitoring; no immediate delay needed."
        
    elif decision == "RECOVERY_ATTEMPT":
        if retry_count == 0:
            strategy = "SMART_RETRY"
            recommended_delay_minutes = 30
            base_reason = "First recovery attempt scheduled with a short 30-minute delay."
        elif retry_count == 1:
            strategy = "SMART_RETRY"
            recommended_delay_minutes = 120
            base_reason = "Second recovery attempt scheduled with a 2-hour delay."
        elif retry_count == 2:
            strategy = "SMART_RETRY"
            recommended_delay_minutes = 360
            base_reason = "Third recovery attempt scheduled with a 6-hour delay."
        else: # retry_count >= 3
            strategy = "ALTERNATIVE_PAYMENT_METHOD"
            recommended_delay_minutes = 1440
            base_reason = "Maximum standard retries reached; routing to alternative payment method after 24 hours."
            
    elif decision == "PRIORITY_RECOVERY":
        if retry_count < 2:
            strategy = "PRIORITY_RECOVERY"
            recommended_delay_minutes = 15
            base_reason = "High-priority recovery attempt scheduled with an expedited 15-minute delay."
        else:
            strategy = "ALTERNATIVE_PAYMENT_METHOD"
            recommended_delay_minutes = 60
            base_reason = "Priority recovery with prior retries; switching to alternative payment method after 1 hour."
            
    else:
        # Fallback safeguard
        strategy = "NO_RECOVERY"
        recommended_delay_minutes = None
        base_reason = "Unrecognized decision category."

    # 3. Calculate maximum remaining retry attempts
    max_attempts_remaining = max(0, max_attempts - retry_count)
    
    # 4. Build contextual reasoning layers
    reasons = [base_reason]
    
    if retry_count >= 2:
        reasons.append(f"Note: Repeated retry attempts have already occurred ({retry_count} prior attempts).")
        
    if sub_status in ["paused", "cancelled"]:
        reasons.append(f"Warning: Account subscription status is '{sub_status}'; consider an alternative payment method rather than blindly retrying.")
        
    if prob >= 0.85:
        reasons.append("High alert: Transaction exhibits very high predicted failure risk.")

    final_reason = " ".join(reasons)
    
    # 5. Return the structured strategy dictionary
    return {
        "strategy": strategy,
        "recommended_delay_minutes": recommended_delay_minutes,
        "max_attempts_remaining": max_attempts_remaining,
        "reason": final_reason
    }


def main():
    """
    Test section simulating the 8 required testing scenarios for Step 10.
    """
    print("Step 10: Testing Smart Recovery Strategy and Timing Engine...\n")
    print("=" * 80)
    
    # Define the 8 required test scenarios with sample transaction data and mock decision inputs
    scenarios = [
        (
            "1. Low Risk / No Action",
            {"retry_count": 0, "subscription_status": "active", "amount": 25.0},
            {"decision": "NO_ACTION", "failure_probability": 0.05}
        ),
        (
            "2. Moderate Risk / Monitor",
            {"retry_count": 0, "subscription_status": "active", "amount": 50.0},
            {"decision": "MONITOR", "failure_probability": 0.35}
        ),
        (
            "3. First Retry Candidate",
            {"retry_count": 0, "subscription_status": "active", "amount": 75.0},
            {"decision": "RECOVERY_ATTEMPT", "failure_probability": 0.65}
        ),
        (
            "4. Second Retry Candidate",
            {"retry_count": 1, "subscription_status": "active", "amount": 100.0},
            {"decision": "RECOVERY_ATTEMPT", "failure_probability": 0.70}
        ),
        (
            "5. Third Retry Candidate",
            {"retry_count": 2, "subscription_status": "active", "amount": 120.0},
            {"decision": "RECOVERY_ATTEMPT", "failure_probability": 0.75}
        ),
        (
            "6. Very High Risk with No Previous Retries",
            {"retry_count": 0, "subscription_status": "active", "amount": 200.0},
            {"decision": "PRIORITY_RECOVERY", "failure_probability": 0.88}
        ),
        (
            "7. Very High Risk with Repeated Retries",
            {"retry_count": 2, "subscription_status": "active", "amount": 600.0},
            {"decision": "PRIORITY_RECOVERY", "failure_probability": 0.92}
        ),
        (
            "8. Cancelled Subscription",
            {"retry_count": 1, "subscription_status": "cancelled", "amount": 150.0},
            {"decision": "RECOVERY_ATTEMPT", "failure_probability": 0.80}
        )
    ]
    
    # Execute scenarios and print formatted outputs
    for title, tx_data, dec_res in scenarios:
        print(f"Scenario: {title}")
        
        # Call the strategy recommendation function
        result = recommend_recovery_strategy(tx_data, dec_res)
        
        # Format display fields
        delay_str = f"{result['recommended_delay_minutes']} minutes" if result['recommended_delay_minutes'] is not None else "None"
        
        print(f"  - Failure Probability        : {dec_res['failure_probability'] * 100:.2f}%")
        print(f"  - Decision                   : {dec_res['decision']}")
        print(f"  - Strategy                   : {result['strategy']}")
        print(f"  - Recommended Delay          : {delay_str}")
        print(f"  - Maximum Attempts Remaining : {result['max_attempts_remaining']}")
        print(f"  - Reason                     : {result['reason']}")
        print("-" * 80)

if __name__ == "__main__":
    main()