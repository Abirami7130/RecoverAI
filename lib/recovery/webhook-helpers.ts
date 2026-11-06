import { prisma } from '@/lib/db';

export async function findCaseIdForOrder(
  razorpayOrderId: string
): Promise<string | null> {
  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId },
  });
  if (!payment) {
    return null;
  }
  const recoveryCase = await prisma.recoveryCase.findFirst({
    where: { originPaymentId: payment.id },
    orderBy: { openedAt: 'desc' },
  });
  return recoveryCase?.id ?? null;
}
