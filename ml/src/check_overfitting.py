import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# ==========================================
# 1. LOAD DATASET
# ==========================================
data_path = "ml/data/payment_failure_dataset.csv"
df = pd.read_csv(data_path)

# ==========================================
# 2. FEATURE SELECTION & TARGET SETTING
# ==========================================
target_col = "payment_failed"
exclude_cols = ["payment_id", "customer_id", "payment_failed"]

X = df.drop(columns=exclude_cols)
y = df[target_col]

# Define feature types explicitly for preprocessing
num_features = [
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
]

cat_features = ["payment_method", "subscription_status"]

# ==========================================
# 3. TRAIN / TEST SPLIT
# ==========================================
# 80/20 split, stratified to preserve target balance
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Print dataset size and target distribution details
print("=" * 65)
print("DATASET ROW & FAILURE COUNTS")
print("=" * 65)
print(f"Training Rows:     {len(X_train):,}")
print(f"Test Rows:         {len(X_test):,}")
print(f"Training Failures: {y_train.sum():,} ({y_train.mean():.2%})")
print(f"Test Failures:     {y_test.sum():,} ({y_test.mean():.2%})")
print("=" * 65 + "\n")

# ==========================================
# 4. PREPROCESSING PIPELINE
# ==========================================
# Apply StandardScaler to numerical features & OneHotEncoder to categorical features
preprocessor = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), num_features),
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_features),
    ]
)

# ==========================================
# 5. MODEL SELECTION & TRAINING
# ==========================================
# Model configuration specified for final RecoverAI candidate
gb_model = GradientBoostingClassifier(
    n_estimators=200, learning_rate=0.05, max_depth=3, random_state=42
)

# Build unified pipeline
pipeline = Pipeline(
    steps=[("preprocessor", preprocessor), ("classifier", gb_model)]
)

# Fit preprocessing and model ONLY on training set to prevent data leakage
pipeline.fit(X_train, y_train)


# ==========================================
# 6. EVALUATION FUNCTION
# ==========================================
def evaluate_dataset(model, X_data, y_data):
    """Calculates classification metrics using hard predictions and class probabilities."""
    preds = model.predict(X_data)
    probs = model.predict_proba(X_data)[:, 1]  # Probability of payment_failed=1

    return {
        "accuracy": accuracy_score(y_data, preds),
        "precision": precision_score(y_data, preds),
        "recall": recall_score(y_data, preds),
        "f1": f1_score(y_data, preds),
        "roc_auc": roc_auc_score(y_data, probs),
        "average_precision": average_precision_score(y_data, probs),
        "brier_score": brier_score_loss(y_data, probs),
    }


# Compute evaluation metrics for both split sets
train_metrics = evaluate_dataset(pipeline, X_train, y_train)
test_metrics = evaluate_dataset(pipeline, X_test, y_test)

# ==========================================
# 7. PRINT COMPARISON TABLE
# ==========================================
print("PERFORMANCE METRICS TABLE")
print("-" * 105)
table_header = (
    "dataset    | accuracy   | precision  | recall     | f1         | "
    "roc_auc    | average_precision | brier_score"
)
print(table_header)
print("-" * 105)

for name, metrics in [("TRAIN", train_metrics), ("TEST", test_metrics)]:
    row = (
        f"{name:<10} | "
        f"{metrics['accuracy']:<10.4f} | "
        f"{metrics['precision']:<10.4f} | "
        f"{metrics['recall']:<10.4f} | "
        f"{metrics['f1']:<10.4f} | "
        f"{metrics['roc_auc']:<10.4f} | "
        f"{metrics['average_precision']:<17.4f} | "
        f"{metrics['brier_score']:<11.4f}"
    )
    print(row)
print("-" * 105 + "\n")

# ==========================================
# 8. GENERALIZATION GAP CALCULATION
# ==========================================
metrics_to_compare = [
    "roc_auc",
    "f1",
    "accuracy",
    "average_precision",
    "brier_score",
]

# Calculate Train Metric - Test Metric
gaps = {
    m: train_metrics[m] - test_metrics[m] for m in metrics_to_compare
}

print("TRAIN vs TEST GENERALIZATION GAP")
print("-" * 65)
print("Formula: Gap = (Training Metric - Test Metric)\n")

for m in metrics_to_compare:
    gap_val = gaps[m]
    if m == "brier_score":
        # Clarification note for Brier score where lower values indicate better calibration/error
        print(
            f"{m:<18}: {gap_val:+.4f}  *(Note: Brier score measures error; LOWER is better."
        )
        print(
            f"{'':<20}  A positive gap here means Train error is lower than Test error)*"
        )
    else:
        print(f"{m:<18}: {gap_val:+.4f}")
print("-" * 65 + "\n")

# ==========================================
# 9. INTERPRETATION & DIAGNOSTIC RESULT
# ==========================================
roc_gap = gaps["roc_auc"]

print("GENERALIZATION DIAGNOSTIC INTERPRETATION")
print("=" * 65)

# Diagnostic thresholds based on ROC-AUC comparison
if roc_gap > 0.05:
    print(
        f"RESULT: Possible Overfitting Flagged. Training ROC-AUC is higher by {roc_gap:.4f}."
    )
    print(
        "Action Item: Consider reducing n_estimators, decreasing max_depth, or tuning regularization."
    )
else:
    print(
        "RESULT: No strong evidence of severe overfitting from this comparison."
    )
    print(
        f"Training and Test ROC-AUC are reasonably close (Gap: {roc_gap:.4f})."
    )

print("\n* Contextual Note on Thresholds:")
print(
    "  A generalization gap below ~0.05 in ROC-AUC is commonly used as a helpful heuristic"
)
print(
    "  rule-of-thumb, rather than a strict mathematical rule. Assessment of overfitting should"
)
print(
    "  always take into account dataset scaling, business context, and operational tolerance."
)
print("=" * 65)