import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    roc_auc_score, 
    average_precision_score, 
    brier_score_loss
)
from sklearn.calibration import calibration_curve

def main():
    print("Step 6.3: Validating Model Probabilities...\n")
    
    # 1. Load the dataset
    file_path = "ml/data/payment_failure_dataset.csv"
    try:
        df = pd.read_csv(file_path)
    except FileNotFoundError:
        file_path = "../data/payment_failure_dataset.csv"
        df = pd.read_csv(file_path)
        
    # 2. Define target and separate features
    target_col = 'payment_failed'
    drop_cols = ['payment_id', 'customer_id', target_col]
    
    X = df.drop(columns=drop_cols)
    y = df[target_col]
    
    # 3. Reproduce the 80/20 train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=0.2, 
        random_state=42, 
        stratify=y
    )
    
    # 4. Reproduce Preprocessing
    numerical_features = [
        'amount', 'retry_count', 'transactions_last_24h', 
        'time_since_last_payment_min', 'hour_of_day', 'day_of_week', 
        'customer_tenure_days', 'previous_payment_count', 
        'previous_failure_count', 'historical_success_rate'
    ]
    
    categorical_features = ['payment_method', 'subscription_status']
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numerical_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
        ]
    )
    
    # Fit preprocessing ONLY on training data
    print("Preprocessing data...")
    X_train_processed = preprocessor.fit_transform(X_train)
    X_test_processed = preprocessor.transform(X_test)
    
    # 5. Initialize Models
    rf_model = RandomForestClassifier(
        n_estimators=200, 
        random_state=42, 
        n_jobs=-1
    )
    
    gb_model = GradientBoostingClassifier(
        n_estimators=200, 
        learning_rate=0.05, 
        max_depth=3, 
        random_state=42
    )
    
    # 6. Train Models
    print("Training Random Forest Classifier...")
    rf_model.fit(X_train_processed, y_train)
    
    print("Training Gradient Boosting Classifier...\n")
    gb_model.fit(X_train_processed, y_train)
    
    # 7. Generate probabilities and calculate metrics
    models = {
        'Random Forest': rf_model, 
        'Gradient Boosting': gb_model
    }
    
    prob_dict = {}
    
    print("-" * 65)
    print(f"{'model':<20} | {'roc_auc':<10} | {'average_precision':<18} | {'brier_score'}")
    print("-" * 65)
    
    for name, model in models.items():
        y_proba = model.predict_proba(X_test_processed)[:, 1]
        prob_dict[name] = y_proba
        
        roc_auc = roc_auc_score(y_test, y_proba)
        avg_precision = average_precision_score(y_test, y_proba)
        brier = brier_score_loss(y_test, y_proba)
        
        print(f"{name:<20} | {roc_auc:<10.4f} | {avg_precision:<18.4f} | {brier:.4f}")
    
    # 8. Gradient Boosting Specific Analysis
    gb_proba = prob_dict['Gradient Boosting']
    
    total_tx = len(y_test)
    actual_rate = y_test.mean()
    avg_pred = gb_proba.mean()
    
    print("\n" + "="*65)
    print("GRADIENT BOOSTING - PROBABILITY VALIDATION")
    print("="*65)
    print(f"Total test transactions:           {total_tx}")
    print(f"Overall actual failure rate:       {actual_rate:.4f}")
    print(f"Overall average predicted prob:    {avg_pred:.4f}\n")
    
    print("--- Gradient Boosting Probability Buckets ---")
    print(f"{'Probability Range':<18} | {'Transactions':<12} | {'Avg Pred Prob':<15} | {'Actual Rate'}")
    print("-" * 65)
    
    # Define explicitly requested ranges
    ranges = [
        (0.00, 0.10), (0.10, 0.20), (0.20, 0.30), (0.30, 0.40), 
        (0.40, 0.50), (0.50, 0.60), (0.60, 0.70), (0.70, 0.80), 
        (0.80, 0.90), (0.90, 1.00)
    ]
    
    for lower, upper in ranges:
        # Create mask for current bucket. Include upper bound only if it's the final bucket.
        if upper == 1.00:
            mask = (gb_proba >= lower) & (gb_proba <= upper)
        else:
            mask = (gb_proba >= lower) & (gb_proba < upper)
            
        bucket_y_test = y_test[mask]
        bucket_proba = gb_proba[mask]
        
        count = len(bucket_y_test)
        if count > 0:
            bucket_avg_pred = bucket_proba.mean()
            bucket_actual_rate = bucket_y_test.mean()
        else:
            bucket_avg_pred = 0.0
            bucket_actual_rate = 0.0
            
        bucket_name = f"{lower:.2f}-{upper:.2f}"
        print(f"{bucket_name:<18} | {count:<12} | {bucket_avg_pred:<15.4f} | {bucket_actual_rate:.4f}")

    # 9. Plot Calibration Curves
    plt.figure(figsize=(8, 6))
    
    # Perfect calibration reference line
    plt.plot([0, 1], [0, 1], "k:", label="Perfectly calibrated")
    
    for name in models.keys():
        fraction_of_positives, mean_predicted_value = calibration_curve(
            y_test, prob_dict[name], n_bins=10, strategy='quantile'
        )
        plt.plot(mean_predicted_value, fraction_of_positives, "s-", label=f"{name}")

    plt.xlabel("Mean predicted probability")
    plt.ylabel("Fraction of actual positives (failures)")
    plt.title("Calibration Curve (Reliability Diagram)")
    plt.legend(loc="lower right")
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    main()