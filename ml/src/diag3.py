from simulate_recovery import simulate_recovery
import random
random.seed(1)
# we can just mock the inputs to simulate_recovery to force a success
tx = {"amount": 100.0, "retry_count": 0, "transactions_last_24h": 1, "time_since_last_payment_min": 100}
pred = {"failure_probability": 0.5, "risk_level": "medium"}
dec = {"decision": "RECOVERY_ATTEMPT", "revenue_at_risk": 50.0}
strat = {"strategy": "SMART_RETRY"}

# loop to find a success
for i in range(100):
    res = simulate_recovery(tx, pred, dec, strat)
    if res.get("outcome") != "not_recovered":
        print(res)
        break
