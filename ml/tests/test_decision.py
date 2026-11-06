import pytest
import os
import sys

SRC = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC))

from recovery_decision import decide_recovery  # noqa: E402


def test_probability_bands():
    tx = {"amount": 500.0, "retry_count": 0, "subscription_status": "active"}
    assert decide_recovery(tx, {"failure_probability": 0.10, "risk_level": "low"})[
        "decision"
    ] == "NO_ACTION"
    assert decide_recovery(tx, {"failure_probability": 0.40, "risk_level": "medium"})[
        "decision"
    ] == "MONITOR"
    assert decide_recovery(tx, {"failure_probability": 0.70, "risk_level": "high"})[
        "decision"
    ] == "RECOVERY_ATTEMPT"
    assert decide_recovery(tx, {"failure_probability": 0.90, "risk_level": "high"})[
        "decision"
    ] == "PRIORITY_RECOVERY"


def test_elevation_monitor_to_recovery():
    tx = {"amount": 15000.0, "retry_count": 0, "subscription_status": "active"}
    result = decide_recovery(tx, {"failure_probability": 0.40, "risk_level": "medium"})
    assert result["decision"] == "RECOVERY_ATTEMPT"
    assert "ELEVATED_FOR_EXPOSURE" in result["rule_ids"]


def test_no_elevation_from_no_action():
    tx = {"amount": 100000.0, "retry_count": 0, "subscription_status": "active"}
    result = decide_recovery(tx, {"failure_probability": 0.10, "risk_level": "low"})
    assert result["decision"] == "NO_ACTION"
    assert "ELEVATED_FOR_EXPOSURE" not in result["rule_ids"]
