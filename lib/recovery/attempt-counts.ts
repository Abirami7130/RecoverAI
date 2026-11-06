import { prisma } from '@/lib/db';

/** Recovery attempts that count toward retry_count and the attempt cap. Skipped rows are not attempts. */
export async function countAttemptsUsed(caseId: string): Promise<number> {
  return prisma.recoveryAttempt.count({
    where: {
      caseId,
      status: { not: 'skipped' },
    },
  });
}

export async function findOpenAttempt(caseId: string) {
  return prisma.recoveryAttempt.findFirst({
    where: {
      caseId,
      status: { in: ['pending', 'running', 'awaiting_payment'] },
    },
  });
}
