"""
RecoverAI guardrail layer (Phase 3).

Python is the only action chooser: decision bands, strategy timing, and guardrails
run here. Next.js persists the returned final action and guardrail_result.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from predict_failure import predict_failure
from recovery_decision import decide_recovery
from recovery_strategy import recommend_recovery_strategy
from simulate_recovery import simulate_recovery

MODEL_VERSION = "gb-2026-10-30-synthetic"

DEFAULT_POLICY: dict[str, Any] = {
    "max_attempts": 3,
    "min_cooldown_minutes": 15,
    "elevation_revenue_at_risk_rupees": 5000.0,
    "disabled_reason_codes": [],
    "approval_threshold_paise": None,
    "retry_cancelled_subscriptions": False,
}

METHOD_ROTATION = ["UPI", "CARD", "NETBANKING", "WALLET"]


def _normalize_method(raw: str | None) -> str:
    if not raw:
        return "CARD"
    upper = raw.upper()
    if "UPI" in upper or "VPA" in upper:
        return "UPI"
    if "NET" in upper or "BANK" in upper:
        return "NETBANKING"
    if "WALLET" in upper or "PAYTM" in upper or "PHONEPE" in upper:
        return "WALLET"
    return "CARD"


def _recommend_payment_method(
    failed_method: str,
    normalized_reason: str,
    strategy_name: str,
) -> str | None:
    if normalized_reason != "AUTHENTICATION_FAILED" and strategy_name != "ALTERNATIVE_PAYMENT_METHOD":
        return None
    current = _normalize_method(failed_method)
    if current not in METHOD_ROTATION:
        return METHOD_ROTATION[0]
    idx = METHOD_ROTATION.index(current)
    if idx + 1 < len(METHOD_ROTATION):
        return METHOD_ROTATION[idx + 1]
    return METHOD_ROTATION[0]

STRATEGIES_THAT_CREATE_ORDERS = {
    "SMART_RETRY",
    "ALTERNATIVE_PAYMENT_METHOD",
    "PRIORITY_RECOVERY",
}


def _merge_policy(policy: dict[str, Any] | None) -> dict[str, Any]:
    merged = dict(DEFAULT_POLICY)
    if policy:
        merged.update(policy)
    return merged


def _parse_ts(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000.0 if value > 1e12 else value, tz=timezone.utc)
    if isinstance(value, str):
        text = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(text)
        except ValueError:
            return None
    return None


def _build_reason_text(
    decision: dict[str, Any],
    strategy: dict[str, Any],
    normalized_reason: str,
    guardrail_note: str,
) -> str:
    delay = strategy.get("recommended_delay_minutes")
    if delay is not None:
        strategy_line = (
            f"Strategy {strategy.get('strategy')} with a {delay} minute delay."
        )
    else:
        strategy_line = f"Strategy {strategy.get('strategy')}."
    parts = [
        decision.get("reason", ""),
        strategy_line,
        f"Failure reason {normalized_reason} "
        + (
            "blocks an automatic retry."
            if normalized_reason in ("CUSTOMER_CANCELLED",)
            else "does not block a retry."
        ),
        guardrail_note,
    ]
    return " ".join(p for p in parts if p)


def _no_ml_prediction() -> dict[str, Any]:
    return {
        "failure_probability": None,
        "risk_level": "medium",
        "model_version": MODEL_VERSION,
        "recovery_probability": None,
        "recovery_probability_source": "not_trained",
    }


def _outcome_no_action(revenue_at_risk: float = 0.0, reason: str = "") -> dict[str, Any]:
    return {
        "recovery_attempted": False,
        "outcome": "no_action",
        "recovery_success": False,
        "simulated_recovery_probability": 0.0,
        "recovered_amount": 0.0,
        "revenue_at_risk": revenue_at_risk,
        "revenue_recovered": 0.0,
        "reason": reason or "No recovery action triggered.",
    }


def evaluate_recovery_case(
    transaction_data: dict[str, Any],
    context: dict[str, Any] | None = None,
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ctx = context or {}
    pol = _merge_policy(policy)

    normalized_reason = str(ctx.get("normalized_reason") or "GENERIC_FAILURE")
    origin_status = str(ctx.get("origin_payment_status") or "failed").lower()
    attempts_used = int(ctx.get("attempts_used", transaction_data.get("retry_count", 0)))
    open_attempt_exists = bool(ctx.get("open_attempt_exists", False))
    amount_paise = int(
        ctx.get("amount_paise") or round(float(transaction_data.get("amount", 0.0)) * 100)
    )
    last_finished_at = _parse_ts(ctx.get("last_attempt_finished_at"))
    now = _parse_ts(ctx.get("now")) or datetime.now(timezone.utc)

    rule_ids: list[str] = []

    if origin_status == "captured":
        rule_ids.append("ALREADY_CAPTURED")
        strategy = {
            "strategy": "NO_RECOVERY",
            "recommended_delay_minutes": None,
            "max_attempts_remaining": 0,
            "reason": "Origin payment already captured.",
        }
        decision = {
            "failure_probability": None,
            "decision": "NO_ACTION",
            "rule_ids": ["BASE_NO_ACTION"],
            "reason": "Payment already captured; no recovery scheduled.",
            "revenue_at_risk": 0.0,
            "priority": "LOW",
            "recommended_action": "No recovery.",
        }
        guardrail_note = "Guardrail ALREADY_CAPTURED blocked execution."
        return {
            "transaction": transaction_data,
            "prediction": _no_ml_prediction(),
            "decision": decision,
            "strategy": strategy,
            "guardrail": {
                "result": "blocked",
                "rule_ids": rule_ids,
                "final_action": "NO_RECOVERY",
                "reason_text": _build_reason_text(
                    decision, strategy, normalized_reason, guardrail_note
                ),
                "recommended_method": None,
            },
            "outcome": _outcome_no_action(reason=guardrail_note),
        }

    disabled_codes = set(pol.get("disabled_reason_codes") or [])
    if normalized_reason == "CUSTOMER_CANCELLED" or normalized_reason in disabled_codes:
        rule_ids.append("REASON_DISABLED")
        strategy = {
            "strategy": "NO_RECOVERY",
            "recommended_delay_minutes": None,
            "max_attempts_remaining": 0,
            "reason": "Failure reason is not eligible for automatic retry.",
        }
        decision = {
            "failure_probability": None,
            "decision": "NO_ACTION",
            "rule_ids": ["BASE_NO_ACTION"],
            "reason": "Customer cancelled or disabled reason; no recovery.",
            "revenue_at_risk": 0.0,
            "priority": "LOW",
            "recommended_action": "No recovery.",
        }
        guardrail_note = "Guardrail REASON_DISABLED blocked execution."
        return {
            "transaction": transaction_data,
            "prediction": _no_ml_prediction(),
            "decision": decision,
            "strategy": strategy,
            "guardrail": {
                "result": "blocked",
                "rule_ids": rule_ids,
                "final_action": "NO_RECOVERY",
                "reason_text": _build_reason_text(
                    decision, strategy, normalized_reason, guardrail_note
                ),
                "recommended_method": None,
            },
            "outcome": _outcome_no_action(reason=guardrail_note),
        }

    subscription_status = str(
        transaction_data.get("subscription_status") or ctx.get("subscription_status") or "active"
    ).lower()
    if subscription_status == "cancelled" and not bool(
        pol.get("retry_cancelled_subscriptions", False)
    ):
        rule_ids.append("REASON_DISABLED")
        strategy = {
            "strategy": "NO_RECOVERY",
            "recommended_delay_minutes": None,
            "max_attempts_remaining": 0,
            "reason": "Subscription is cancelled; automatic retry is disabled by policy.",
        }
        decision = {
            "failure_probability": None,
            "decision": "NO_ACTION",
            "rule_ids": ["BASE_NO_ACTION"],
            "reason": "Cancelled subscription; no automatic retry.",
            "revenue_at_risk": 0.0,
            "priority": "LOW",
            "recommended_action": "No recovery.",
        }
        guardrail_note = "Guardrail REASON_DISABLED blocked execution for cancelled subscription."
        return {
            "transaction": transaction_data,
            "prediction": _no_ml_prediction(),
            "decision": decision,
            "strategy": strategy,
            "guardrail": {
                "result": "blocked",
                "rule_ids": rule_ids,
                "final_action": "NO_RECOVERY",
                "reason_text": _build_reason_text(
                    decision, strategy, normalized_reason, guardrail_note
                ),
                "recommended_method": None,
            },
            "outcome": _outcome_no_action(reason=guardrail_note),
        }

    try:
        prediction = predict_failure(transaction_data)
    except FileNotFoundError as exc:
        rule_ids.append("ML_UNAVAILABLE_FAIL_SAFE")
        strategy = {
            "strategy": "MONITOR",
            "recommended_delay_minutes": None,
            "max_attempts_remaining": 0,
            "reason": "ML model unavailable; monitoring only.",
        }
        decision = {
            "failure_probability": None,
            "decision": "MONITOR",
            "rule_ids": ["BASE_MONITOR"],
            "reason": str(exc),
            "revenue_at_risk": 0.0,
            "priority": "MEDIUM",
            "recommended_action": "Monitor only.",
        }
        guardrail_note = "Guardrail ML_UNAVAILABLE_FAIL_SAFE applied."
        return {
            "transaction": transaction_data,
            "prediction": _no_ml_prediction(),
            "decision": decision,
            "strategy": strategy,
            "guardrail": {
                "result": "blocked",
                "rule_ids": rule_ids,
                "final_action": "MONITOR",
                "reason_text": guardrail_note,
                "recommended_method": None,
            },
            "outcome": _outcome_no_action(reason=guardrail_note),
        }

    prediction = {
        **prediction,
        "model_version": MODEL_VERSION,
        "recovery_probability": None,
        "recovery_probability_source": "not_trained",
    }

    decision = decide_recovery(
        transaction_data,
        prediction,
        elevation_threshold_rupees=float(pol["elevation_revenue_at_risk_rupees"]),
    )
    rule_ids.extend(decision.get("rule_ids", []))

    strategy = recommend_recovery_strategy(
        transaction_data,
        decision,
        max_attempts=int(pol["max_attempts"]),
    )

    final_action = strategy["strategy"]
    guardrail_result = "passed"
    guardrail_note = "Guardrail passed."

    if attempts_used >= int(pol["max_attempts"]):
        rule_ids.append("ATTEMPT_CAP")
        guardrail_result = "blocked"
        guardrail_note = "Guardrail ATTEMPT_CAP blocked execution."
    elif open_attempt_exists:
        rule_ids.append("DUPLICATE_OPEN_ATTEMPT")
        guardrail_result = "blocked"
        guardrail_note = "Guardrail DUPLICATE_OPEN_ATTEMPT blocked execution."
    else:
        delay_minutes = strategy.get("recommended_delay_minutes")
        if (
            last_finished_at is not None
            and delay_minutes is not None
            and final_action in STRATEGIES_THAT_CREATE_ORDERS
        ):
            cooldown = timedelta(minutes=int(pol["min_cooldown_minutes"]))
            earliest = last_finished_at + cooldown
            scheduled = now + timedelta(minutes=int(delay_minutes))
            if scheduled < earliest:
                strategy = dict(strategy)
                extra_minutes = int((earliest - now).total_seconds() // 60)
                strategy["recommended_delay_minutes"] = max(
                    int(delay_minutes), extra_minutes
                )
                rule_ids.append("COOLDOWN_APPLIED")
                guardrail_note = "Guardrail COOLDOWN_APPLIED rescheduled the attempt."

        approval_threshold = pol.get("approval_threshold_paise")
        if approval_threshold is not None and amount_paise >= int(approval_threshold):
            rule_ids.append("APPROVAL_REQUIRED")
            guardrail_result = "blocked"
            guardrail_note = "Guardrail APPROVAL_REQUIRED blocked order creation."

    if guardrail_result == "blocked" and "ML_UNAVAILABLE_FAIL_SAFE" not in rule_ids:
        if final_action in STRATEGIES_THAT_CREATE_ORDERS and (
            "ATTEMPT_CAP" in rule_ids
            or "DUPLICATE_OPEN_ATTEMPT" in rule_ids
            or "APPROVAL_REQUIRED" in rule_ids
        ):
            pass

    outcome = simulate_recovery(
        transaction_data,
        {
            "failure_probability": prediction["failure_probability"],
            "risk_level": prediction["risk_level"],
        },
        decision,
        strategy,
    )

    reason_text = _build_reason_text(
        decision, strategy, normalized_reason, guardrail_note
    )

    recommended_method = _recommend_payment_method(
        str(transaction_data.get("payment_method") or ""),
        normalized_reason,
        final_action,
    )
    if recommended_method:
        reason_text = f"{reason_text} Suggested method {recommended_method} (shopper may choose another at checkout)."

    return {
        "transaction": transaction_data,
        "prediction": prediction,
        "decision": decision,
        "strategy": strategy,
        "guardrail": {
            "result": guardrail_result,
            "rule_ids": rule_ids,
            "final_action": final_action,
            "reason_text": reason_text,
            "recommended_method": recommended_method,
        },
        "outcome": outcome,
    }


def export_rule_ids_fixture() -> list[str]:
    """Returns rule ids emitted across representative guardrail paths."""
    base_tx = {
        "payment_id": "order_fixture",
        "amount": 6000.0,
        "retry_count": 0,
        "transactions_last_24h": 1,
        "time_since_last_payment_min": 60.0,
        "hour_of_day": 12,
        "day_of_week": 2,
        "subscription_status": "active",
        "customer_tenure_days": 180,
        "previous_payment_count": 5,
        "previous_failure_count": 1,
        "historical_success_rate": 0.8,
        "payment_method": "UPI",
    }
    scenarios = [
        {"normalized_reason": "ISSUER_TIMEOUT", "attempts_used": 0},
        {"normalized_reason": "CUSTOMER_CANCELLED", "attempts_used": 0},
        {"normalized_reason": "ISSUER_TIMEOUT", "attempts_used": 3},
        {"normalized_reason": "ISSUER_TIMEOUT", "origin_payment_status": "captured"},
    ]
    ids: set[str] = set()
    for ctx_extra in scenarios:
        ctx = {
            "amount_paise": 600000,
            "origin_payment_status": "failed",
            **ctx_extra,
        }
        result = evaluate_recovery_case(base_tx, context=ctx)
        ids.update(result["guardrail"]["rule_ids"])
        ids.update(result["decision"].get("rule_ids", []))
    return sorted(ids)
