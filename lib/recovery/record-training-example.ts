import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

/**
 * Inserts one TrainingExample when a recovery attempt reaches a terminal state
 * after Razorpay status was fetched (markCaptured or payment verify + fetchPayment).
 * Webhook-only failures and simulated outcomes must not call this.
 */
export async function recordTrainingExampleAfterRazorpayFetch(
  paymentId: string,
  verifiedSuccess: boolean,
  finishedAt: Date = new Date(),
  tx?: Prisma.TransactionClient
): Promise<{ inserted: boolean; reason?: string }> {
  const db = tx ?? prisma;

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment?.recoveryCaseId || !payment.parentPaymentId) {
    return { inserted: false, reason: 'NOT_RECOVERY_ORDER' };
  }

  const attempt = await db.recoveryAttempt.findFirst({
    where: {
      caseId: payment.recoveryCaseId,
      razorpayOrderId: payment.razorpayOrderId,
    },
  });

  if (!attempt) {
    return { inserted: false, reason: 'NO_ATTEMPT' };
  }

  const existing = await db.trainingExample.findUnique({
    where: { attemptId: attempt.id },
  });
  if (existing) {
    return { inserted: false, reason: 'ALREADY_RECORDED' };
  }

  const decision = await db.recoveryDecisionRecord.findUnique({
    where: { id: attempt.decisionId },
  });
  if (!decision) {
    return { inserted: false, reason: 'NO_DECISION' };
  }

  const prediction = decision.predictionId
    ? await db.mlPrediction.findUnique({
        where: { id: decision.predictionId },
      })
    : await db.mlPrediction.findFirst({
        where: { caseId: payment.recoveryCaseId },
        orderBy: { createdAt: 'desc' },
      });

  const featureJson =
    prediction?.featureJson ??
    JSON.stringify({ feature_source: 'missing_prediction' });

  await db.trainingExample.create({
    data: {
      caseId: payment.recoveryCaseId,
      attemptId: attempt.id,
      featureJson,
      action: decision.action,
      verifiedSuccess,
    },
  });

  const terminalStatus = verifiedSuccess ? 'succeeded' : 'failed';
  await db.recoveryAttempt.update({
    where: { id: attempt.id },
    data: {
      status: terminalStatus,
      finishedAt,
      blockReason: verifiedSuccess ? null : attempt.blockReason,
      resultPaymentId: verifiedSuccess ? payment.id : attempt.resultPaymentId,
    },
  });

  return { inserted: true };
}
