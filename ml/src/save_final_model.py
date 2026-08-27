import os
import json
import joblib
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.ensemble import GradientBoostingClassifier

def main():
    print("Step 7: Packaging Final ML Model...\n")
    
    # 1. Create the ml/models directory if it doesn't exist
    os.makedirs("ml/models", exist_ok=True)
    
    # 2. Load the entire dataset
    file_path = "ml/data/payment_failure_dataset.csv"
    try:
        df = pd.read_csv(file_path)
    except FileNotFoundError:
        file_path = "../data/payment_failure_dataset.csv"
        df = pd.read_csv(file_path)
        
    print(f"Loaded dataset with {len(df)} rows.")
    
    # 3. Define target and features
    target_col = 'payment_failed'
    drop_cols = ['payment_id', 'customer_id', target_col]
    
    X = df.drop(columns=drop_cols)
    y = df[target_col]
    
    numerical_features = [
        'amount', 'retry_count', 'transactions_last_24h', 
        'time_since_last_payment_min', 'hour_of_day', 'day_of_week', 
        'customer_tenure_days', 'previous_payment_count', 
        'previous_failure_count', 'historical_success_rate'
    ]
    
    categorical_features = ['payment_method', 'subscription_status']
    
    # 4. Build the Preprocessor
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numerical_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
        ]
    )
    
    # 5. Define the Final Model Configuration
    gb_model = GradientBoostingClassifier(
        n_estimators=200, 
        learning_rate=0.05, 
        max_depth=3, 
        random_state=42
    )
    
    # 6. Create the Scikit-Learn Pipeline
    # A Pipeline chains the preprocessor and the model together into a single object
    final_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', gb_model)
    ])
    
    # 7. Fit the Pipeline on ALL available data
    # (Since model selection is done, we use 100% of the data to maximize learning)
    print("Fitting final pipeline on all 50,000 rows...")
    final_pipeline.fit(X, y)
    
    # 8. Save the Complete Pipeline
    model_save_path = "ml/models/recoverai_failure_model.joblib"
    joblib.dump(final_pipeline, model_save_path)
    print(f"\nModel successfully saved to: {model_save_path}")
    
    # 9. Create and Save Metadata
    # These metrics are from our prior held-out test evaluation.
    metadata = {
        "model_type": "GradientBoostingClassifier",
        "n_estimators": 200,
        "learning_rate": 0.05,
        "max_depth": 3,
        "random_state": 42,
        "operating_threshold": 0.25,
        "roc_auc_test": 0.7897,
        "average_precision_test": 0.5592,
        "brier_score_test": 0.1163,
        "best_test_f1": 0.5256,
        "best_test_f1_threshold": 0.25,
        "training_rows": 50000,
        "target": "payment_failed"
    }
    
    metadata_save_path = "ml/models/model_metadata.json"
    with open(metadata_save_path, 'w') as f:
        json.dump(metadata, f, indent=4)
    print(f"Metadata successfully saved to: {metadata_save_path}\n")
    
    # 10. Verification Step
    print("-" * 50)
    print("VERIFICATION: Testing the saved pipeline")
    print("-" * 50)
    
    # Load the model back from disk
    loaded_pipeline = joblib.load(model_save_path)
    
    # Create 3 realistic sample transactions using a pandas DataFrame
    # Note: Column names must match the training features exactly
    sample_data = pd.DataFrame([
        {
            # Low Risk Example: active user, UPI, first try, great history, day time
            'amount': 45.0, 'retry_count': 0, 'transactions_last_24h': 1, 
            'time_since_last_payment_min': 4320, 'hour_of_day': 14, 'day_of_week': 2, 
            'customer_tenure_days': 400, 'previous_payment_count': 20, 
            'previous_failure_count': 0, 'historical_success_rate': 1.0, 
            'payment_method': 'UPI', 'subscription_status': 'active'
        },
        {
            # Medium Risk Example: card payment, 1 retry, recent transactions, late night
            'amount': 150.0, 'retry_count': 1, 'transactions_last_24h': 4, 
            'time_since_last_payment_min': 120, 'hour_of_day': 2, 'day_of_week': 5, 
            'customer_tenure_days': 120, 'previous_payment_count': 5, 
            'previous_failure_count': 1, 'historical_success_rate': 0.8, 
            'payment_method': 'CARD', 'subscription_status': 'active'
        },
        {
            # High Risk Example: cancelled sub, 3 retries, poor history
            'amount': 89.99, 'retry_count': 3, 'transactions_last_24h': 2, 
            'time_since_last_payment_min': 5, 'hour_of_day': 10, 'day_of_week': 1, 
            'customer_tenure_days': 45, 'previous_payment_count': 8, 
            'previous_failure_count': 4, 'historical_success_rate': 0.5, 
            'payment_method': 'NETBANKING', 'subscription_status': 'cancelled'
        }
    ])
    
    # Predict probabilities (we want the probability of class 1: payment_failed)
    predictions = loaded_pipeline.predict_proba(sample_data)[:, 1]
    
    for i, prob in enumerate(predictions, 1):
        print(f"Example {i} Predicted Failure Probability: {prob:.4f}")
        
    print("\nVerification successful. The pipeline correctly processes raw data.")

if __name__ == "__main__":
    main()