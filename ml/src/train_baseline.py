import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, 
    precision_score, 
    recall_score, 
    f1_score, 
    roc_auc_score, 
    classification_report, 
    confusion_matrix
)

def main():
    print("Step 6: Training Baseline Random Forest Model...\n")
    
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
    
    # 3. Reproduce the train/test split from Step 5
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=0.2, 
        random_state=42, 
        stratify=y
    )
    
    print(f"Number of training examples: {len(X_train)}")
    print(f"Number of test examples: {len(X_test)}\n")
    
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
    
    # 5. Fit preprocessing ONLY on X_train, then transform both
    print("Preprocessing data...")
    X_train_processed = preprocessor.fit_transform(X_train)
    X_test_processed = preprocessor.transform(X_test)
    
    # 6. Train the Random Forest Model
    print("Training Random Forest Classifier (this may take a few seconds)...")
    rf_model = RandomForestClassifier(
        n_estimators=200, 
        random_state=42, 
        n_jobs=-1  # Use all available CPU cores for faster training
    )
    
    # Train ONLY on the training data
    rf_model.fit(X_train_processed, y_train)
    
    # 7. Evaluate on the untouched test data
    print("Evaluating model on test data...\n")
    y_pred = rf_model.predict(X_test_processed)
    
    # Get probabilities for ROC-AUC (probability of class 1: payment_failed)
    y_proba = rf_model.predict_proba(X_test_processed)[:, 1]
    
    # 8. Calculate Metrics
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_proba)
    
    print("-" * 40)
    print("MODEL EVALUATION METRICS")
    print("-" * 40)
    print(f"Accuracy:  {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall:    {recall:.4f}")
    print(f"F1-score:  {f1:.4f}")
    print(f"ROC-AUC:   {roc_auc:.4f}\n")
    
    print("-" * 40)
    print("CLASSIFICATION REPORT")
    print("-" * 40)
    print(classification_report(y_test, y_pred))
    
    # 9. Confusion Matrix
    cm = confusion_matrix(y_test, y_pred)
    print("-" * 40)
    print("CONFUSION MATRIX (Rows=Actual, Columns=Predicted)")
    print("-" * 40)
    print("                  Predicted Success (0) | Predicted Fail (1)")
    print(f"Actual Success (0):      {cm[0,0]:<14} | {cm[0,1]}")
    print(f"Actual Fail (1):         {cm[1,0]:<14} | {cm[1,1]}\n")
    
    # 10. Visualize Confusion Matrix
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', cbar=False,
                xticklabels=['Predicted Success', 'Predicted Fail'],
                yticklabels=['Actual Success', 'Actual Fail'])
    plt.title('Random Forest Confusion Matrix')
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    main()
