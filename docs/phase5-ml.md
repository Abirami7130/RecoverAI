# Phase 5 — ML improvements (operations)

Failure probabilities come from a gradient boosting model trained on 50,000 synthetic payments. They are not a measured live recovery rate.

## Training examples (verified outcomes)

`TrainingExample` rows are written only when a recovery attempt reaches a terminal state **after `fetchPayment`** (via `markCaptured` or payment verify). Webhook-only failures and Python `simulate_recovery` do **not** insert rows.

Export verified rows for offline retraining:

```bash
npm run export:training
```

Writes `data/training/examples.jsonl` (gitignored). Inspect with:

```bash
python ml/src/export_training_examples.py
```

Retrain manually when at least 200 verified rows exist:

```bash
python ml/src/train_from_examples.py
```

Use `--dry-run` to validate row count without replacing `ml/models/recoverai_failure_model.joblib`.

## Calibration and baselines

Held-out isotonic calibration experiment (updates `ml/models/model_metadata.json` only):

```bash
python ml/src/calibrate_failure_model.py
```

Compare model policy vs retry-everything vs never-retry on the synthetic CSV (simulated revenue):

```bash
python ml/src/evaluate_against_baseline.py
```

## Tests

```bash
npm test
ml/.venv/bin/python -m pytest ml/tests
```
