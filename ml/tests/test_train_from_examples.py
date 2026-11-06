import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TRAIN_SCRIPT = ROOT / "ml" / "src" / "train_from_examples.py"
JOBLIB = ROOT / "ml" / "models" / "recoverai_failure_model.joblib"


def _write_jsonl(path: Path, rows: int) -> None:
    lines = []
    for i in range(rows):
        feature = {
            "amount": 499.0,
            "retry_count": 1,
            "transactions_last_24h": 1,
            "time_since_last_payment_min": 60,
            "hour_of_day": 12,
            "day_of_week": 2,
            "customer_tenure_days": 100,
            "previous_payment_count": 5,
            "previous_failure_count": 1,
            "historical_success_rate": 0.8,
            "payment_method": "UPI",
            "subscription_status": "active",
            "context": {
                "normalized_reason": "ISSUER_TIMEOUT",
                "attempts_used": 1,
            },
        }
        lines.append(
            json.dumps(
                {
                    "caseId": f"case_{i}",
                    "attemptId": f"attempt_{i}",
                    "featureJson": json.dumps(feature),
                    "action": "SMART_RETRY",
                    "verifiedSuccess": i % 2 == 0,
                }
            )
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_trainer_refuses_fewer_than_200_rows():
    before_mtime = JOBLIB.stat().st_mtime
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "examples.jsonl"
        _write_jsonl(path, 5)
        proc = subprocess.run(
            [sys.executable, str(TRAIN_SCRIPT), "--path", str(path)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
    assert proc.returncode != 0
    assert "200" in proc.stderr
    assert JOBLIB.stat().st_mtime == before_mtime


def test_trainer_accepts_200_row_fixture_in_dry_run_without_touching_joblib():
    before_mtime = JOBLIB.stat().st_mtime
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "examples.jsonl"
        _write_jsonl(path, 200)
        proc = subprocess.run(
            [
                sys.executable,
                str(TRAIN_SCRIPT),
                "--path",
                str(path),
                "--dry-run",
            ],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
    assert proc.returncode == 0, proc.stderr
    assert "200" in proc.stdout
    assert JOBLIB.stat().st_mtime == before_mtime
