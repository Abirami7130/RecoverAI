import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score

def main():
    print("Step 6.1: Running Baseline Model Diagnostics...\n")
    
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
    
    # 3. Reproduce train/test split
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
    
    X_train_processed = preprocessor.fit_transform(X_train)
    X_test_processed = preprocessor.transform(X_test)
    
    # 5. Train the identical baseline model
    print("Training baseline Random Forest model...")
    rf_model = RandomForestClassifier(
        n_estimators=200, 
        random_state=42, 
        n_jobs=-1
    )
    rf_model.fit(X_train_processed, y_train)
    
    # 6. Analyze Feature Importance
    print("\n--- Top 15 Feature Importances ---")
    
    # Extract feature names after OneHotEncoding
    cat_encoder = preprocessor.named_transformers_['cat']
    cat_feature_names = cat_encoder.get_feature_names_out(categorical_features)
    
    # Combine numerical and categorical feature names
    all_feature_names = np.concatenate([numerical_features, cat_feature_names])
    
    # Get importance scores from the model
    importances = rf_model.feature_importances_
    
    # Create a DataFrame to sort and display them easily
    feature_importance_df = pd.DataFrame({
        'Feature': all_feature_names,
        'Importance': importances
    }).sort_values(by='Importance', ascending=False)
    
    # Print the top 15
    for idx, row in feature_importance_df.head(15).iterrows():
        print(f"{row['Feature']:<35} {row['Importance']:.4f}")
        
    # 7. Analyze predicted probabilities across thresholds
    print("\n--- Classification Threshold Analysis ---")
    # Get probabilities for class 1 (payment_failed)
    y_proba = rf_model.predict_proba(X_test_processed)[:, 1]
    
    thresholds = [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70]
    
    # Lists to store metrics for plotting
    precisions = []
    recalls = []
    f1_scores = []
    
    print(f"{'threshold':<10} | {'precision':<10} | {'recall':<10} | {'f1'}")
    print("-" * 45)
    
    for t in thresholds:
        # Convert probabilities to 1 if >= threshold, else 0
        y_pred_thresh = (y_proba >= t).astype(int)
        
        # Calculate metrics (zero_division=0 prevents errors if precision drops to 0)
        p = precision_score(y_test, y_pred_thresh, zero_division=0)
        r = recall_score(y_test, y_pred_thresh)
        f1 = f1_score(y_test, y_pred_thresh, zero_division=0)
        
        precisions.append(p)
        recalls.append(r)
        f1_scores.append(f1)
        
        print(f"{t:<10.2f} | {p:<10.4f} | {r:<10.4f} | {f1:.4f}")
        
    # 8. Calculate ROC-AUC again
    roc_auc = roc_auc_score(y_test, y_proba)
    print(f"\nROC-AUC Score: {roc_auc:.4f}")
    
    # 9. Plot the metrics
    plt.figure(figsize=(8, 5))
    plt.plot(thresholds, precisions, marker='o', label='Precision', color='blue')
    plt.plot(thresholds, recalls, marker='o', label='Recall', color='red')
    plt.plot(thresholds, f1_scores, marker='o', label='F1 Score', color='green')
    
    plt.title('Performance Metrics vs Classification Threshold')
    plt.xlabel('Classification Threshold')
    plt.ylabel('Score')
    plt.xticks(thresholds)
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.legend()
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    main()
