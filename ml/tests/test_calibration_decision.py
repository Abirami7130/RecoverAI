import os
import sys

SRC = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC))

from calibrate_failure_model import should_adopt_calibration  # noqa: E402


def test_does_not_adopt_when_brier_worsens():
    assert should_adopt_calibration(0.10, 0.12) is False


def test_adopts_when_brier_improves():
    assert should_adopt_calibration(0.12, 0.10) is True
