import os
import sys
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Ensure the ml/src directory is in the path so we can import the pipeline
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(current_dir, "src")
sys.path.append(src_dir)

try:
    from recoverai_pipeline import run_recoverai_pipeline
except ImportError as e:
    print(f"Failed to import pipeline modules: {e}")
    print("Ensure predict_failure.py, recovery_decision.py, recovery_strategy.py, simulate_recovery.py, and recoverai_pipeline.py exist in ml/src/.")
    raise

# Initialize FastAPI application
app = FastAPI(
    title="RecoverAI ML API",
    description="API bridge for the RecoverAI transaction prediction and recovery pipeline",
    version="1.0.0"
)

# Define the expected input schema with sensible validations
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

@app.get("/health")
def health_check():
    """
    Basic health check endpoint to verify the API is running.
    """
    return {"status": "ok"}

@app.post("/predict")
def predict_transaction(transaction: TransactionInput):
    """
    Accepts a raw transaction payload, runs it through the RecoverAI E2E pipeline,
    and returns the prediction, decision, strategy, and simulated outcome.
    """
    try:
        # Convert Pydantic model to a standard dictionary (compatible with FastAPI v1/v2)
        tx_data = getattr(transaction, "model_dump", transaction.dict)()
        
        # Run the existing pipeline without duplicating logic
        result = run_recoverai_pipeline(tx_data)
        
        return result
    except Exception as e:
        # Catch and surface any internal pipeline errors cleanly
        raise HTTPException(status_code=500, detail=f"Pipeline Error: {str(e)}")