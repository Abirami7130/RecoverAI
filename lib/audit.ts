import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './db';

export interface AuditInput {
  merchantId?: string | null;
  actorType: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

type TxClient = Prisma.TransactionClient | PrismaClient;

export async function writeAudit(
  input: AuditInput,
  tx: TxClient = prisma
) {
  const metadata = input.metadata ?? {};
  return tx.auditLog.create({
    data: {
      merchantId: input.merchantId ?? null,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: JSON.stringify(metadata),
    },
  });
}
