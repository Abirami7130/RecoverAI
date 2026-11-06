import { prisma } from '@/lib/db';
import { getRazorpayGateway } from '@/lib/payments/razorpay-gateway';
import { writeAudit } from '@/lib/audit';
import { getDemoMerchantContext } from '@/lib/db';

export interface WorkerTickResult {
  claimed: number;
  succeeded: number;
  awaitingPayment: number;
  blocked: number;
  failed: number;
  skipped: number;
}

const CLAIM_LIMIT = 20;
const STALE_RUNNING_MS = 2 * 60 * 1000;
const AWAITING_TIMEOUT_MS = 24 * 60 * 60 * 1000;

async function releaseStaleRunning(now: Date) {
  const cutoff = new Date(now.getTime() - STALE_RUNNING_MS);
  const stale = await prisma.recoveryAttempt.findMany({
    where: {
      status: 'running',
      startedAt: { lt: cutoff },
    },
  });

  for (const attempt of stale) {
    await prisma.recoveryAttempt.update({
      where: { id: attempt.id },
      data: { status: 'pending', startedAt: null },
    });
    await writeAudit({
      actorType: 'system',
      action: 'LOCK_EXPIRED',
      entityType: 'RecoveryAttempt',
      entityId: attempt.id,
      metadata: {},
    });
  }
}

async function failAwaitingTimeouts(now: Date) {
  const cutoff = new Date(now.getTime() - AWAITING_TIMEOUT_MS);
  const timedOut = await prisma.recoveryAttempt.findMany({
    where: {
      status: 'awaiting_payment',
      updatedAt: { lt: cutoff },
    },
  });

  for (const attempt of timedOut) {
    await prisma.recoveryAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'failed',
        blockReason: 'AWAITING_TIMEOUT',
        finishedAt: now,
      },
    });
  }
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

async function caseHasCapturedPayment(caseId: string): Promise<boolean> {
  const captured = await prisma.payment.findFirst({
    where: { recoveryCaseId: caseId, status: 'captured' },
  });
  if (captured) {
    return true;
  }
  const recoveryCase = await prisma.recoveryCase.findUnique({
    where: { id: caseId },
  });
  if (!recoveryCase) {
    return false;
  }
  const origin = await prisma.payment.findUnique({
    where: { id: recoveryCase.originPaymentId },
  });
  return origin?.status === 'captured';
}

export async function runDueAttempts(now: Date): Promise<WorkerTickResult> {
  const result: WorkerTickResult = {
    claimed: 0,
    succeeded: 0,
    awaitingPayment: 0,
    blocked: 0,
    failed: 0,
    skipped: 0,
  };

  await releaseStaleRunning(now);
  await failAwaitingTimeouts(now);

  const due = await prisma.recoveryAttempt.findMany({
    where: {
      status: 'pending',
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: 'asc' },
    take: CLAIM_LIMIT,
  });

  const gateway = getRazorpayGateway();
  const { policy } = await getDemoMerchantContext();
  const maxAttempts = policy?.maxAttempts ?? 3;

  for (const candidate of due) {
    const claim = await prisma.recoveryAttempt.updateMany({
      where: { id: candidate.id, status: 'pending' },
      data: { status: 'running', startedAt: now },
    });

    if (claim.count === 0) {
      continue;
    }

    result.claimed += 1;

    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id: candidate.caseId },
    });

    if (!recoveryCase) {
      await prisma.recoveryAttempt.update({
        where: { id: candidate.id },
        data: { status: 'failed', finishedAt: now },
      });
      result.failed += 1;
      continue;
    }

    if (recoveryCase.status === 'needs_approval') {
      await prisma.recoveryAttempt.update({
        where: { id: candidate.id },
        data: {
          status: 'skipped',
          blockReason: 'NEEDS_APPROVAL',
          finishedAt: now,
        },
      });
      result.skipped += 1;
      continue;
    }

    if (await caseHasCapturedPayment(recoveryCase.id)) {
      await prisma.recoveryAttempt.update({
        where: { id: candidate.id },
        data: {
          status: 'skipped',
          blockReason: 'ALREADY_CAPTURED',
          finishedAt: now,
        },
      });
      await writeAudit({
        merchantId: recoveryCase.merchantId,
        actorType: 'system',
        action: 'ATTEMPT_SKIPPED',
        entityType: 'RecoveryAttempt',
        entityId: candidate.id,
        metadata: { blockReason: 'ALREADY_CAPTURED' },
      });
      result.skipped += 1;
      continue;
    }

    const attemptsUsed = await countAttemptsUsed(recoveryCase.id);
    if (attemptsUsed > maxAttempts) {
      await prisma.recoveryAttempt.update({
        where: { id: candidate.id },
        data: {
          status: 'blocked',
          blockReason: 'MAX_ATTEMPTS',
          finishedAt: now,
        },
      });
      result.blocked += 1;
      continue;
    }

    const placeholderOrderId = `local_${candidate.id}`;
    const paymentRecord = await prisma.payment.create({
      data: {
        merchantId: recoveryCase.merchantId,
        customerId: recoveryCase.customerId,
        razorpayOrderId: placeholderOrderId,
        amountPaise: recoveryCase.amountPaise,
        status: 'created',
        recoveryCaseId: recoveryCase.id,
        parentPaymentId: recoveryCase.originPaymentId,
      },
    });

    try {
      const order = await gateway.createOrder({
        amountPaise: recoveryCase.amountPaise,
        currency: 'INR',
        receipt: `rcpt_${paymentRecord.id}`,
        notes: {
          caseId: recoveryCase.id,
          attemptId: candidate.id,
        },
      });

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: paymentRecord.id },
          data: { razorpayOrderId: order.id },
        });
        await tx.recoveryAttempt.update({
          where: { id: candidate.id },
          data: {
            status: 'awaiting_payment',
            razorpayOrderId: order.id,
            finishedAt: null,
          },
        });
        await tx.recoveryCase.update({
          where: { id: recoveryCase.id },
          data: { status: 'awaiting_payment' },
        });
        await writeAudit(
          {
            merchantId: recoveryCase.merchantId,
            actorType: 'system',
            action: 'ACTION_ORDER_CREATED',
            entityType: 'RecoveryAttempt',
            entityId: candidate.id,
            metadata: { orderId: order.id },
          },
          tx
        );
      });

      result.awaitingPayment += 1;
    } catch (err: unknown) {
      await prisma.payment.delete({ where: { id: paymentRecord.id } }).catch(() => {});
      const gatewayError = err instanceof Error ? err.name : 'GatewayError';
      await prisma.recoveryAttempt.update({
        where: { id: candidate.id },
        data: { status: 'failed', finishedAt: now },
      });
      await writeAudit({
        merchantId: recoveryCase.merchantId,
        actorType: 'system',
        action: 'ORDER_CREATE_FAILED',
        entityType: 'RecoveryAttempt',
        entityId: candidate.id,
        metadata: { gateway_error: gatewayError },
      });
      result.failed += 1;
    }
  }

  return result;
}
