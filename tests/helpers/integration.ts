import { resetCreateOrderInflightForTests } from '@/lib/payments/create-demo-order';
import {
  createFakeRazorpayGateway,
  resetFakeOrderIdSequenceForTests,
} from '@/lib/payments/fake-razorpay-gateway';
import {
  resetCachedFakeRazorpayGatewayForTests,
  setRazorpayGatewayForTests,
} from '@/lib/payments/razorpay-gateway';
import { setPredictTransactionForTests } from '@/lib/recovery/python-client';
import { resetRateLimitsForTests } from '@/lib/rate-limit';
import { prisma, resetPrismaForTests } from '@/lib/db';

export function bindFakeGateway() {
  const gateway = createFakeRazorpayGateway(process.env.RAZORPAY_WEBHOOK_SECRET);
  setRazorpayGatewayForTests(gateway);
  return gateway;
}

export async function resetTestCaseState() {
  resetPrismaForTests();
  resetRateLimitsForTests();
  resetCreateOrderInflightForTests();
  resetFakeOrderIdSequenceForTests();
  resetCachedFakeRazorpayGatewayForTests();
  setPredictTransactionForTests(null);
  bindFakeGateway();

  await prisma.recoveryAttempt.deleteMany();
  await prisma.trainingExample.deleteMany();
  await prisma.recoveryDecisionRecord.deleteMany();
  await prisma.mlPrediction.deleteMany();
  await prisma.paymentFailure.deleteMany();
  await prisma.recoveryCase.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.auditLog.deleteMany();
}
