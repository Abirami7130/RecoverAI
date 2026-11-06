import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export let prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export function resetPrismaForTests() {
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect();
  }
  prisma = createPrismaClient();
  globalForPrisma.prisma = prisma;
}

export const DEMO_CUSTOMER_EXTERNAL_REF = 'demo_customer_001';

export async function getDemoMerchantContext() {
  const merchant = await prisma.merchant.findFirst({
    where: { name: 'RecoverAI Demo' },
    include: {
      customers: {
        where: { externalRef: DEMO_CUSTOMER_EXTERNAL_REF },
        take: 1,
      },
      policies: { where: { active: true }, take: 1 },
    },
  });

  if (!merchant || merchant.customers.length === 0) {
    throw new Error('Demo merchant not seeded. Run: npx prisma db seed');
  }

  return {
    merchant,
    customer: merchant.customers[0],
    policy: merchant.policies[0] ?? null,
  };
}
