import pandas as pd
import joblib
import os
import json

# 1. Define the absolute path to the saved pipeline relative to this script
current_dir = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(current_dir, "..", "models", "recoverai_failure_model.joblib")
METADATA_PATH = os.path.join(current_dir, "..", "models", "model_metadata.json")

DEFAULT_MODEL_VERSION = "gb-2026-10-30-synthetic"


def _load_model_version() -> str:
    try:
        with open(METADATA_PATH, encoding="utf-8") as handle:
            meta = json.load(handle)
        return str(meta.get("model_version") or DEFAULT_MODEL_VERSION)
    except (OSError, json.JSONDecodeError):
        return DEFAULT_MODEL_VERSION

# Load the model globally so it only loads once when this file is imported 
# by a future backend server (loading models is slow, doing it once is efficient).
try:
    pipeline = joblib.load(MODEL_PATH)
except FileNotFoundError:
    pipeline = None
    print(f"Warning: Could not find model at {MODEL_PATH}. Ensure Step 7 was completed.")


def predict_failure(transaction_data):
    """
    Takes a dictionary of raw transaction data, validates it, and returns 
    the predicted probability of payment failure and a risk level classification.
    """
    # Define the exact feature names the model expects
    required_fields = {
        "amount",
        "retry_count",
        "transactions_last_24h",
        "time_since_last_payment_min",
        "hour_of_day",
        "day_of_week",
        "customer_tenure_days",
        "previous_payment_count",
        "previous_failure_count",
        "historical_success_rate",
        "payment_method",
        "subscription_status"
    }
    
    # Validate that all required fields are present in the input dictionary
    # by subtracting the keys we have from the keys we need
    missing_fields = required_fields - set(transaction_data.keys())
    if missing_fields:
        # Raise an error immediately with a clear list of what is missing
        raise ValueError(f"Missing required transaction fields: {', '.join(missing_fields)}")
        
    # Convert the raw dictionary into a Pandas DataFrame with exactly one row.
    # Wrapping the dictionary in a list [transaction_data] tells pandas it is a single record.
    df = pd.DataFrame([transaction_data])

    if pipeline is None:
        raise FileNotFoundError(
            f"Model pipeline not loaded. Expected artifact at {MODEL_PATH}"
        )

    failure_prob = pipeline.predict_proba(df)[0][1]
    
    # Determine the risk level based on our evaluated decision threshold
    # 0.25 was found to be the optimal operating threshold during Step 6.2 diagnostics
    if failure_prob < 0.25:
        risk_level = "low"
    elif 0.25 <= failure_prob < 0.60:
        risk_level = "medium"
    else:
        risk_level = "high"
        
    # Return a clean dictionary to whatever backend system called this function
    return {
        "failure_probability": float(failure_prob),
        "risk_level": risk_level,
        "model_version": _load_model_version(),
        "recovery_probability": None,
        "recovery_probability_source": "not_trained",
    }


def main():
    """
    Test section to verify the prediction interface works correctly.
    """
    print("Step 8: Testing ML Prediction Interface...\n")
    
    if pipeline is None:
        print("Exiting test: Model pipeline not loaded.")
        return
        
    # Example 1: Low Risk (Long tenure, perfect history, standard time, first try)
    example_1 = {
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
        "subscription_status": "active"
    }
    
    # Example 2: Medium Risk (Card retry, recent transactions, late night, slight history of failure)
    example_2 = {
        "amount": 150.00,
        "retry_count": 1,
        "transactions_last_24h": 2,
        "time_since_last_payment_min": 60,
        "hour_of_day": 2,
        "day_of_week": 6,
        "customer_tenure_days": 90,
        "previous_payment_count": 5,
        "previous_failure_count": 1,
        "historical_success_rate": 0.80,
        "payment_method": "CARD",
        "subscription_status": "active"
    }
    
    # Example 3: High Risk (Cancelled sub, 3 retries, terrible history, rapid transactions)
    example_3 = {
        "amount": 500.00,
        "retry_count": 3,
        "transactions_last_24h": 5,
        "time_since_last_payment_min": 15,
        "hour_of_day": 3,
        "day_of_week": 0,
        "customer_tenure_days": 30,
        "previous_payment_count": 2,
        "previous_failure_count": 2,
        "historical_success_rate": 0.0,
        "payment_method": "NETBANKING",
        "subscription_status": "cancelled"
    }
    
    examples = [example_1, example_2, example_3]
    
    # Run predictions and format the output
    for i, ex in enumerate(examples, 1):
        # Call our reusable function
        result = predict_failure(ex)
        
        # Format the float probability as a human-readable percentage 
        prob_percent = result["failure_probability"] * 100
        
        print(f"Example {i}")
        print(f"Failure Probability: {prob_percent:.2f}%")
        print(f"Risk Level: {result['risk_level']}\n")


if __name__ == "__main__":
    main()