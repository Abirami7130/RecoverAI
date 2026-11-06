import os
import sys
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(current_dir, "src")
sys.path.append(src_dir)

try:
    from recoverai_pipeline import run_recoverai_pipeline
except ImportError as e:
    print(f"Failed to import pipeline modules: {e}")
    raise

app = FastAPI(
    title="RecoverAI ML API",
    description="API bridge for the RecoverAI transaction prediction and recovery pipeline",
    version="1.0.0",
)


class PredictContext(BaseModel):
    normalized_reason: Optional[str] = None
    gateway_latency_ms: Optional[float] = None
    gateway_error_rate: Optional[float] = None
    attempts_used: Optional[int] = Field(default=None, ge=0)
    amount_paise: Optional[int] = Field(default=None, ge=0)
    origin_payment_status: Optional[str] = None
    open_attempt_exists: Optional[bool] = None
    last_attempt_finished_at: Optional[str] = None


class MerchantPolicyInput(BaseModel):
    max_attempts: Optional[int] = Field(default=None, ge=1)
    min_cooldown_minutes: Optional[int] = Field(default=None, ge=0)
    elevation_revenue_at_risk_rupees: Optional[float] = Field(default=None, ge=0)
    disabled_reason_codes: Optional[list[str]] = None
    approval_threshold_paise: Optional[int] = Field(default=None, ge=0)
    retry_cancelled_subscriptions: Optional[bool] = None


class TransactionInput(BaseModel):
    payment_id: str
    amount: float = Field(..., ge=0.0, description="Transaction amount")
    retry_count: int = Field(..., ge=0, description="Number of previous attempts")
    transactions_last_24h: int = Field(..., ge=0, description="Transactions attempted in the last 24 hours")
    time_since_last_payment_min: float = Field(..., ge=0.0, description="Minutes since last payment attempt")
    hour_of_day: int = Field(..., ge=0, le=23, description="Hour of the day (0-23)")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of the week (0-6)")
    subscription_status: str = Field(..., description="Categorical subscription status (e.g., active, none)")
    customer_tenure_days: int = Field(..., ge=0, description="Customer tenure in days")
    previous_payment_count: int = Field(..., ge=0, description="Total successful payments historically")
    previous_failure_count: int = Field(..., ge=0, description="Total failed payments historically")
    historical_success_rate: float = Field(..., ge=0.0, le=1.0, description="Ratio of successful to total historical payments")
    payment_method: str = Field(..., description="Categorical payment method (e.g., card, UPI)")
    context: Optional[PredictContext] = None
    policy: Optional[MerchantPolicyInput] = None


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/predict")
def predict_transaction(transaction: TransactionInput):
    try:
        tx_data = getattr(transaction, "model_dump", transaction.dict)()
        context: dict[str, Any] | None = tx_data.pop("context", None)
        policy: dict[str, Any] | None = tx_data.pop("policy", None)
        if context is not None and hasattr(context, "model_dump"):
            context = context.model_dump(exclude_none=True)
        if policy is not None and hasattr(policy, "model_dump"):
            policy = policy.model_dump(exclude_none=True)

        result = run_recoverai_pipeline(tx_data, context=context, policy=policy)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline Error: {str(e)}") from e
