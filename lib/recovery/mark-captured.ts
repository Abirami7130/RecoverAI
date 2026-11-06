import { prisma } from '@/lib/db';
import { getRazorpayGateway } from '@/lib/payments/razorpay-gateway';
import { writeAudit } from '@/lib/audit';
import { recordTrainingExampleAfterRazorpayFetch } from '@/lib/recovery/record-training-example';

/**
 * The only function that may set RecoveryCase.status to recovered
 * and increment verifiedRecoveredPaise.
 */
export async function markCaptured(localPaymentId: string): Promise<{
  updated: boolean;
  caseId?: string;
  reason?: string;
}> {
  const payment = await prisma.payment.findUnique({
    where: { id: localPaymentId },
    include: { recoveryCase: true },
  });

  if (!payment) {
    return { updated: false, reason: 'NOT_FOUND' };
  }

  if (payment.status === 'captured') {
    return { updated: false, reason: 'ALREADY_CAPTURED', caseId: payment.recoveryCaseId ?? undefined };
  }

  if (!payment.razorpayPaymentId) {
    return { updated: false, reason: 'NO_RAZORPAY_PAYMENT_ID' };
  }

  const gateway = getRazorpayGateway();
  let remote;
  try {
    remote = await gateway.fetchPayment(payment.razorpayPaymentId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.name : 'GatewayError';
    await writeAudit({
      merchantId: payment.merchantId,
      actorType: 'system',
      action: 'FETCH_PAYMENT_FAILED',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { gateway_error: message },
    });
    return { updated: false, reason: 'FETCH_FAILED' };
  }

  if (remote.status !== 'captured') {
    return { updated: false, reason: 'NOT_CAPTURED' };
  }

  if (remote.amount !== payment.amountPaise) {
    await writeAudit({
      merchantId: payment.merchantId,
      actorType: 'system',
      action: 'AMOUNT_MISMATCH',
      entityType: 'Payment',
      entityId: payment.id,
      metadata: {
        expectedPaise: payment.amountPaise,
        remotePaise: remote.amount,
      },
    });
    return { updated: false, reason: 'AMOUNT_MISMATCH' };
  }

  const now = new Date();

  let caseIdToRecover = payment.recoveryCaseId;
  if (!caseIdToRecover) {
    const originCase = await prisma.recoveryCase.findFirst({
      where: {
        originPaymentId: payment.id,
        status: { in: ['open', 'awaiting_payment', 'monitoring'] },
      },
    });
    caseIdToRecover = originCase?.id ?? null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'captured',
        capturedAt: now,
      },
    });

    if (caseIdToRecover) {
      await tx.recoveryCase.update({
        where: { id: caseIdToRecover },
        data: {
          status: 'recovered',
          verifiedRecoveredPaise: payment.amountPaise,
          closedAt: now,
          closeReason: 'verified_capture',
        },
      });

      const skipAttemptWhere: {
        caseId: string;
        status: { in: string[] };
        razorpayOrderId?: { not: string };
      } = {
        caseId: caseIdToRecover,
        status: { in: ['pending', 'running', 'awaiting_payment'] },
      };
      if (payment.recoveryCaseId && payment.razorpayOrderId) {
        skipAttemptWhere.razorpayOrderId = { not: payment.razorpayOrderId };
      }

      await tx.recoveryAttempt.updateMany({
        where: skipAttemptWhere,
        data: {
          status: 'skipped',
          blockReason: 'ALREADY_CAPTURED',
          finishedAt: now,
        },
      });

      await writeAudit(
        {
          merchantId: payment.merchantId,
          actorType: 'system',
          action: 'CASE_RECOVERED',
          entityType: 'RecoveryCase',
          entityId: caseIdToRecover,
          metadata: { paymentId: payment.id, amountPaise: payment.amountPaise },
        },
        tx
      );
    }
  });

  if (payment.recoveryCaseId && payment.parentPaymentId) {
    await recordTrainingExampleAfterRazorpayFetch(payment.id, true, now);
  }

  return { updated: true, caseId: caseIdToRecover ?? undefined };
}

export async function markCapturedByRazorpayPaymentId(
  razorpayPaymentId: string
): Promise<{ updated: boolean; caseId?: string; reason?: string }> {
  const payment = await prisma.payment.findUnique({
    where: { razorpayPaymentId },
  });
  if (!payment) {
    return { updated: false, reason: 'NOT_FOUND' };
  }
  return markCaptured(payment.id);
}
