#!/usr/bin/env python3
"""
Held-out calibration experiment for the synthetic failure model.
Updates ml/models/model_metadata.json with printed metrics only.
Keeps the existing joblib bytes unless test Brier improves after calibration.
"""

from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone

import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.frozen import FrozenEstimator
from sklearn.metrics import brier_score_loss
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

current_dir = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(current_dir, "..", "data", "payment_failure_dataset.csv")
MODEL_PATH = os.path.join(current_dir, "..", "models", "recoverai_failure_model.joblib")
ARCHIVE_DIR = os.path.join(current_dir, "..", "models", "archive")
METADATA_PATH = os.path.join(current_dir, "..", "models", "model_metadata.json")

NUMERIC = [
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
CATEGORICAL = ["payment_method", "subscription_status"]


def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
        ]
    )
    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "classifier",
                GradientBoostingClassifier(
                    n_estimators=200,
                    learning_rate=0.05,
                    max_depth=3,
                    random_state=42,
                ),
            ),
        ]
    )


def should_adopt_calibration(brier_before: float, brier_after: float) -> bool:
    return brier_after < brier_before


def main() -> int:
    df = pd.read_csv(DATASET_PATH)
    target_col = "payment_failed"
    drop_cols = ["payment_id", "customer_id", target_col]
    X = df.drop(columns=drop_cols)
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    X_fit, X_val, y_fit, y_val = train_test_split(
        X_train, y_train, test_size=0.25, random_state=42, stratify=y_train
    )

    base = build_pipeline()
    base.fit(X_fit, y_fit)
    brier_before = brier_score_loss(y_test, base.predict_proba(X_test)[:, 1])

    calibrated = CalibratedClassifierCV(
        FrozenEstimator(base), method="isotonic", cv=2
    )
    calibrated.fit(X_val, y_val)
    brier_after = brier_score_loss(y_test, calibrated.predict_proba(X_test)[:, 1])

    with open(METADATA_PATH, encoding="utf-8") as handle:
        metadata = json.load(handle)

    metadata["model_version"] = metadata.get("model_version", "gb-2026-10-30-synthetic")
    metadata["dataset"] = metadata.get("dataset", "synthetic_v1")
    metadata["split"] = {"test_size": 0.2, "random_state": 42, "stratify": True}
    metadata["brier_score_test_uncalibrated"] = float(brier_before)
    metadata["brier_score_test_calibrated"] = float(brier_after)
    metadata["generatedAt"] = datetime.now(timezone.utc).isoformat()

    adopted = should_adopt_calibration(brier_before, brier_after)
    if adopted:
        os.makedirs(ARCHIVE_DIR, exist_ok=True)
        previous_version = metadata["model_version"]
        if os.path.isfile(MODEL_PATH):
            shutil.copy2(
                MODEL_PATH,
                os.path.join(ARCHIVE_DIR, f"{previous_version}.joblib"),
            )
        joblib.dump(calibrated, MODEL_PATH)
        metadata["calibration"] = "isotonic_adopted"
        metadata["brier_score_test"] = float(brier_after)
        metadata["replaces"] = previous_version
        print(f"Calibration adopted: Brier {brier_before:.4f} -> {brier_after:.4f}")
    else:
        metadata["calibration"] = "not_adopted"
        metadata["brier_score_test"] = float(brier_before)
        print(
            f"Calibration not adopted: Brier before={brier_before:.4f} after={brier_after:.4f}"
        )

    with open(METADATA_PATH, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=4)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
