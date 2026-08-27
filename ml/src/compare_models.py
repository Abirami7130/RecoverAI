import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, 
    precision_score, 
    recall_score, 
    f1_score, 
    roc_auc_score
)

def main():
    print("Step 6.2: Comparing Random Forest vs Gradient Boosting...\n")
    
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
    
    # Fit on training data ONLY, transform both
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
    
    print("Training Gradient Boosting Classifier...")
    gb_model.fit(X_train_processed, y_train)
    
    # 7. Evaluate Default Metrics (Threshold = 0.50)
    models = {'Random Forest': rf_model, 'Gradient Boosting': gb_model}
    default_metrics = {}
    
    print("\n" + "="*70)
    print(f"{'model':<20} | {'accuracy':<8} | {'precision':<9} | {'recall':<8} | {'f1':<8} | {'roc_auc':<8}")
    print("-" * 70)
    
    for name, model in models.items():
        y_pred = model.predict(X_test_processed)
        y_proba = model.predict_proba(X_test_processed)[:, 1]
        
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        roc_auc = roc_auc_score(y_test, y_proba)
        
        default_metrics[name] = {'ROC_AUC': roc_auc} # Store for later comparison
        
        print(f"{name:<20} | {acc:<8.4f} | {prec:<9.4f} | {rec:<8.4f} | {f1:<8.4f} | {roc_auc:<8.4f}")
    
    # 8. Evaluate Thresholds
    thresholds = [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60]
    
    max_f1_scores = {} # To keep track of the best F1 for each model
    
    for name, model in models.items():
        print(f"\n--- {name} Threshold Diagnostics ---")
        print(f"{'threshold':<10} | {'precision':<10} | {'recall':<10} | {'f1'}")
        print("-" * 45)
        
        y_proba = model.predict_proba(X_test_processed)[:, 1]
        best_f1 = 0
        
        for t in thresholds:
            y_pred_thresh = (y_proba >= t).astype(int)
            p = precision_score(y_test, y_pred_thresh, zero_division=0)
            r = recall_score(y_test, y_pred_thresh)
            f1 = f1_score(y_test, y_pred_thresh, zero_division=0)
            
            if f1 > best_f1:
                best_f1 = f1
                
            print(f"{t:<10.2f} | {p:<10.4f} | {r:<10.4f} | {f1:.4f}")
            
        max_f1_scores[name] = best_f1

    # 9. Print Conclusion Statement
    print("\n" + "="*70)
    
    rf_auc = default_metrics['Random Forest']['ROC_AUC']
    gb_auc = default_metrics['Gradient Boosting']['ROC_AUC']
    
    rf_f1 = max_f1_scores['Random Forest']
    gb_f1 = max_f1_scores['Gradient Boosting']
    
    auc_winner = 'Gradient Boosting' if gb_auc > rf_auc else 'Random Forest'
    f1_winner = 'Gradient Boosting' if gb_f1 > rf_f1 else 'Random Forest'
    
    print(f"Results Summary:")
    print(f"- {auc_winner} has the higher overall ROC-AUC ({max(gb_auc, rf_auc):.4f} vs {min(gb_auc, rf_auc):.4f}).")
    print(f"- {f1_winner} achieved the higher maximum F1 score across tested thresholds ({max(gb_f1, rf_f1):.4f} vs {min(gb_f1, rf_f1):.4f}).")
    print("="*70)

    # 10. Visualization: ROC-AUC and Max F1 Comparison
    metrics_names = ['ROC-AUC', 'Max F1 (Across Thresholds)']
    rf_scores = [rf_auc, rf_f1]
    gb_scores = [gb_auc, gb_f1]
    
    x = np.arange(len(metrics_names))
    width = 0.35
    
    fig, ax = plt.subplots(figsize=(8, 5))
    rects1 = ax.bar(x - width/2, rf_scores, width, label='Random Forest', color='skyblue')
    rects2 = ax.bar(x + width/2, gb_scores, width, label='Gradient Boosting', color='lightcoral')
    
    ax.set_ylabel('Score')
    ax.set_title('Random Forest vs Gradient Boosting Performance')
    ax.set_xticks(x)
    ax.set_xticklabels(metrics_names)
    ax.set_ylim([0, 1.0])
    ax.legend(loc='lower right')
    
    # Add labels on top of bars
    for rects in [rects1, rects2]:
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f'{height:.4f}',
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 3),  # 3 points vertical offset
                        textcoords="offset points",
                        ha='center', va='bottom')
                        
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    main()