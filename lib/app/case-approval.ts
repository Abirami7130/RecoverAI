import { prisma } from '@/lib/db';
import { writeAudit } from '@/lib/audit';
import { strategyCreatesRecoveryOrder } from '@/lib/recovery/strategy-helpers';

export async function approveRecoveryCase(input: {
  caseId: string;
  merchantId: string;
  actorUserId: string;
}) {
  const recoveryCase = await prisma.recoveryCase.findFirst({
    where: { id: input.caseId, merchantId: input.merchantId },
    include: {
      decisions: { orderBy: { createdAt: 'desc' }, take: 1 },
      attempts: true,
    },
  });

  if (!recoveryCase) {
    return { notFound: true as const };
  }

  const openAttempt = recoveryCase.attempts.find((a) =>
    ['pending', 'running', 'awaiting_payment'].includes(a.status)
  );
  if (openAttempt) {
    return { duplicate: true as const, attemptId: openAttempt.id };
  }

  if (recoveryCase.status !== 'needs_approval') {
    return { invalidStatus: true as const, status: recoveryCase.status };
  }

  const decision = recoveryCase.decisions[0];
  if (!decision || !strategyCreatesRecoveryOrder(decision.action)) {
    return { error: 'NO_APPROVABLE_STRATEGY' as const };
  }

  const idempotencyKey = `case:${recoveryCase.id}:approval:decision:${decision.id}`;
  const existing = await prisma.recoveryAttempt.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return { duplicate: true as const, attemptId: existing.id };
  }

  const delayMinutes = decision.delayMinutes ?? 0;
  const scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);

  const attemptId = await prisma.$transaction(async (tx) => {
    const attempt = await tx.recoveryAttempt.create({
      data: {
        caseId: recoveryCase.id,
        decisionId: decision.id,
        idempotencyKey,
        status: 'pending',
        scheduledFor,
      },
    });

    await tx.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: { status: 'open' },
    });

    await writeAudit(
      {
        merchantId: input.merchantId,
        actorType: 'user',
        actorId: input.actorUserId,
        action: 'CASE_APPROVED',
        entityType: 'RecoveryCase',
        entityId: recoveryCase.id,
        metadata: { attemptId: attempt.id, decisionId: decision.id },
      },
      tx
    );

    return attempt.id;
  });

  return { duplicate: false as const, attemptId };
}

export async function rejectRecoveryCase(input: {
  caseId: string;
  merchantId: string;
  actorUserId: string;
}) {
  const recoveryCase = await prisma.recoveryCase.findFirst({
    where: { id: input.caseId, merchantId: input.merchantId },
  });

  if (!recoveryCase) {
    return { notFound: true as const };
  }

  if (recoveryCase.status !== 'needs_approval') {
    return { invalidStatus: true as const, status: recoveryCase.status };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.recoveryCase.update({
      where: { id: recoveryCase.id },
      data: {
        status: 'stopped',
        closeReason: 'operator_rejected',
        closedAt: now,
      },
    });

    await writeAudit(
      {
        merchantId: input.merchantId,
        actorType: 'user',
        actorId: input.actorUserId,
        action: 'CASE_REJECTED',
        entityType: 'RecoveryCase',
        entityId: recoveryCase.id,
        metadata: { closeReason: 'operator_rejected' },
      },
      tx
    );
  });

  return { ok: true as const };
}
