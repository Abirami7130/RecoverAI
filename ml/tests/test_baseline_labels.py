import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "ml" / "src" / "evaluate_against_baseline.py"


def test_baseline_script_labels_and_simulated():
    proc = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    lowered = proc.stdout.lower()
    assert "model_policy" in proc.stdout
    assert "retry_everything" in proc.stdout
    assert "never_retry" in proc.stdout
    assert "simulated" in lowered
    assert "production-ready" not in lowered


def test_baseline_json_parseable():
    proc = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(proc.stdout)
    assert payload["model_policy"]["dataset_label"] == "simulated"
