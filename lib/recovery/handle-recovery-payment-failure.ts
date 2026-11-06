import { prisma, getDemoMerchantContext } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { normalizeFailureReason } from '@/lib/recovery/normalize-reason';
import type { IngestFailureInput, IngestFailureResult } from '@/lib/recovery/ingest-failure';

function mapPaymentMethod(raw?: string): string {
  if (!raw) return 'CARD';
  const upper = raw.toUpperCase();
  if (upper.includes('UPI') || upper.includes('VPA')) return 'UPI';
  if (upper.includes('NET') || upper.includes('BANK')) return 'NETBANKING';
  if (upper.includes('WALLET') || upper.includes('PAYTM') || upper.includes('PHONEPE')) {
    return 'WALLET';
  }
  return 'CARD';
}

async function countAttemptsUsed(caseId: string): Promise<number> {
  return prisma.recoveryAttempt.count({
    where: {
      caseId,
      status: {
        in: ['awaiting_payment', 'succeeded', 'failed', 'running'],
      },
    },
  });
}

/**
 * Recovery-order payment.failed — updates the existing case; never opens a new case.
 */
export async function handleRecoveryPaymentFailure(
  input: IngestFailureInput,
  payment: {
    id: string;
    merchantId: string;
    recoveryCaseId: string | null;
    status: string;
    razorpayPaymentId?: string | null;
  }
): Promise<IngestFailureResult> {
  const caseId = payment.recoveryCaseId;
  if (!caseId) {
    return { caseId: null, duplicate: false, skippedReason: 'PAYMENT_NOT_FOUND' };
  }

  const normalizedReason = normalizeFailureReason(
    input.errorReason ?? '',
    input.errorDescription ?? ''
  );
  const occurredAt = input.occurredAt ?? new Date();
  const { policy } = await getDemoMerchantContext();
  const maxAttempts = policy?.maxAttempts ?? 3;

  const result = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'failed',
        method: mapPaymentMethod(input.paymentMethod),
        razorpayPaymentId:
          input.razorpayPaymentId ?? payment.razorpayPaymentId ?? undefined,
      },
    });

    try {
      await tx.paymentFailure.create({
        data: {
          paymentId: payment.id,
          source: input.source,
          errorCode: input.errorCode ?? null,
          errorReason: input.errorReason ?? null,
          errorDescription: input.errorDescription ?? null,
          normalizedReason,
          rawEventId: input.rawEventId ?? null,
          occurredAt,
        },
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        // Duplicate webhook event id — idempotent.
      } else {
        throw err;
      }
    }

    const attempt = await tx.recoveryAttempt.findFirst({
      where: {
        caseId,
        razorpayOrderId: input.razorpayOrderId,
      },
    });

    if (attempt) {
      await tx.recoveryAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'failed',
          blockReason: 'RECOVERY_PAYMENT_FAILED',
          finishedAt: occurredAt,
        },
      });
    }

    const attemptsUsed = await tx.recoveryAttempt.count({
      where: {
        caseId,
        status: {
          in: ['awaiting_payment', 'succeeded', 'failed', 'running'],
        },
      },
    });

    const nextCaseStatus =
      attemptsUsed >= maxAttempts ? 'stopped' : 'open';
    const closePayload =
      attemptsUsed >= maxAttempts
        ? {
            closedAt: occurredAt,
            closeReason: 'attempts_exhausted' as const,
          }
        : { closedAt: null, closeReason: null };

    await tx.recoveryCase.update({
      where: { id: caseId },
      data: {
        status: nextCaseStatus,
        ...closePayload,
      },
    });

    await writeAudit(
      {
        merchantId: payment.merchantId,
        actorType: 'system',
        action: 'RECOVERY_PAYMENT_FAILED',
        entityType: 'RecoveryCase',
        entityId: caseId,
        metadata: {
          paymentId: payment.id,
          orderId: input.razorpayOrderId,
          attemptsUsed,
          maxAttempts,
        },
      },
      tx
    );

    return { caseId, attemptsUsed, nextCaseStatus };
  });

  return {
    caseId: result.caseId,
    duplicate: false,
    skippedReason:
      result.nextCaseStatus === 'stopped' ? 'ATTEMPTS_EXHAUSTED' : undefined,
  };
}
