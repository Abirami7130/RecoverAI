import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertUser(
  email: string,
  name: string,
  password: string,
  merchantId: string,
  role: string
) {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name, passwordHash },
    create: { email: email.toLowerCase(), name, passwordHash },
  });

  await prisma.membership.upsert({
    where: {
      userId_merchantId: { userId: user.id, merchantId },
    },
    update: { role },
    create: { userId: user.id, merchantId, role },
  });
}

async function main() {
  const merchant = await prisma.merchant.upsert({
    where: { id: 'seed_merchant_demo' },
    update: { name: 'RecoverAI Demo' },
    create: {
      id: 'seed_merchant_demo',
      name: 'RecoverAI Demo',
    },
  });

  const tenureStartedAt = new Date();
  tenureStartedAt.setDate(tenureStartedAt.getDate() - 180);

  await prisma.customer.upsert({
    where: {
      merchantId_externalRef: {
        merchantId: merchant.id,
        externalRef: 'demo_customer_001',
      },
    },
    update: {
      subscriptionStatus: 'active',
      tenureStartedAt,
    },
    create: {
      merchantId: merchant.id,
      externalRef: 'demo_customer_001',
      subscriptionStatus: 'active',
      tenureStartedAt,
    },
  });

  await prisma.merchantPolicy.updateMany({
    where: { merchantId: merchant.id, active: true },
    data: { active: false },
  });

  const latest = await prisma.merchantPolicy.findFirst({
    where: { merchantId: merchant.id },
    orderBy: { version: 'desc' },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  await prisma.merchantPolicy.create({
    data: {
      merchantId: merchant.id,
      version: nextVersion,
      active: true,
      maxAttempts: 3,
      minCooldownMinutes: 15,
      elevationRevenueAtRiskPaise: 500_000,
      disabledReasonCodesJson: '[]',
    },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await upsertUser(adminEmail, 'Demo Owner', adminPassword, merchant.id, 'owner');
    console.info(`Seeded owner login for ${adminEmail}`);
  } else {
    console.info('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — no login user created.');
  }

  const viewerEmail = process.env.SEED_VIEWER_EMAIL?.trim();
  const viewerPassword = process.env.SEED_VIEWER_PASSWORD;
  if (viewerEmail && viewerPassword) {
    await upsertUser(viewerEmail, 'Demo Viewer', viewerPassword, merchant.id, 'viewer');
    console.info(`Seeded viewer login for ${viewerEmail}`);
  }

  console.info('Seeded RecoverAI Demo merchant, demo_customer_001, and active policy.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
