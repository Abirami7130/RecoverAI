#!/usr/bin/env python3
"""
Train a verified-data failure model from exported examples.
Refuses to run when fewer than 200 labeled rows are present.
Does not overwrite the active synthetic artifact unless training succeeds.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime, timezone

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

MIN_ROWS = 200
MODEL_PATH = os.path.join("ml", "models", "recoverai_failure_model.joblib")
ARCHIVE_DIR = os.path.join("ml", "models", "archive")
METADATA_PATH = os.path.join("ml", "models", "model_metadata.json")

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
    "attempts_used",
]
CATEGORICAL = ["payment_method", "subscription_status", "normalized_reason"]


def load_jsonl(path: str) -> list[dict]:
    rows: list[dict] = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            text = line.strip()
            if text:
                rows.append(json.loads(text))
    return rows


def flatten_row(row: dict) -> dict:
    features = json.loads(row["featureJson"]) if isinstance(row.get("featureJson"), str) else row.get("featureJson", {})
    context = features.get("context") or {}
    return {
        "amount": float(features.get("amount", 0)),
        "retry_count": int(features.get("retry_count", 0)),
        "transactions_last_24h": int(features.get("transactions_last_24h", 0)),
        "time_since_last_payment_min": float(features.get("time_since_last_payment_min", 0)),
        "hour_of_day": int(features.get("hour_of_day", 0)),
        "day_of_week": int(features.get("day_of_week", 0)),
        "customer_tenure_days": int(features.get("customer_tenure_days", 0)),
        "previous_payment_count": int(features.get("previous_payment_count", 0)),
        "previous_failure_count": int(features.get("previous_failure_count", 0)),
        "historical_success_rate": float(features.get("historical_success_rate", 0)),
        "payment_method": str(features.get("payment_method", "CARD")),
        "subscription_status": str(features.get("subscription_status", "active")),
        "normalized_reason": str(context.get("normalized_reason") or "GENERIC_FAILURE"),
        "attempts_used": int(context.get("attempts_used", features.get("retry_count", 0))),
        "verified_success": bool(row.get("verifiedSuccess")),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--path",
        default=os.path.join("data", "training", "examples.jsonl"),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate row count and exit without replacing the active joblib artifact",
    )
    args = parser.parse_args()

    if not os.path.isfile(args.path):
        print(
            f"Need at least {MIN_ROWS} verified training rows; export file missing at {args.path}.",
            file=sys.stderr,
        )
        print("The synthetic model remains active.", file=sys.stderr)
        return 1

    raw = load_jsonl(args.path)
    if len(raw) < MIN_ROWS:
        print(
            f"Need at least {MIN_ROWS} verified training rows; found {len(raw)}.",
            file=sys.stderr,
        )
        print("The synthetic model remains active.", file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"Validated {len(raw)} rows; synthetic model remains active (dry-run).")
        return 0

    flat = [flatten_row(row) for row in raw]
    df = pd.DataFrame(flat)
    y = (~df["verified_success"]).astype(int)
    X = df.drop(columns=["verified_success"])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
        ]
    )
    pipeline = Pipeline(
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
    pipeline.fit(X_train, y_train)
    prob = pipeline.predict_proba(X_test)[:, 1]
    roc = roc_auc_score(y_test, prob)
    brier = brier_score_loss(y_test, prob)

    version = f"verified-{datetime.now(timezone.utc).strftime('%Y%m%d')}"
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    if os.path.isfile(MODEL_PATH):
        shutil.copy2(MODEL_PATH, os.path.join(ARCHIVE_DIR, f"{version}-previous.joblib"))

    joblib.dump(pipeline, MODEL_PATH)

    metadata = {
        "model_version": version,
        "model_type": "GradientBoostingClassifier",
        "dataset": "verified_export",
        "row_count": len(raw),
        "split": {"test_size": 0.2, "random_state": 42, "stratify": True},
        "roc_auc_test": float(roc),
        "average_precision_test": None,
        "brier_score_test": float(brier),
        "calibration": "not_applicable",
        "replaces": "gb-2026-10-30-synthetic",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "target": "payment_failed",
    }
    with open(METADATA_PATH, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle, indent=4)

    print(f"Trained verified model on {len(raw)} rows.")
    print(f"roc_auc_test={roc:.4f} brier_score_test={brier:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
