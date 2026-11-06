-- Phase 6: policy retry flag and decision method recommendation
ALTER TABLE "MerchantPolicy" ADD COLUMN "retryCancelledSubscriptions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RecoveryDecisionRecord" ADD COLUMN "recommendedMethod" TEXT;
