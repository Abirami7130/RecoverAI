import { prisma } from '@/lib/db';
import { redactWebhookPayload } from '@/lib/payments/webhook-redaction';
import { ingestFailure } from '@/lib/recovery/ingest-failure';
import {
  markCaptured,
} from '@/lib/recovery/mark-captured';
import { writeAudit } from '@/lib/audit';
import { findCaseIdForOrder } from '@/lib/recovery/webhook-helpers';

const STALE_MS = 24 * 60 * 60 * 1000;

interface RazorpayWebhookBody {
  id?: string;
  event?: string;
  created_at?: number;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
    order?: { entity?: { id?: string; amount?: number } };
  };
}

interface RazorpayPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  status?: string;
  error_code?: string;
  error_description?: string;
  error_reason?: string;
  method?: string;
}

export async function processRazorpayWebhook(
  rawBody: string,
  parsed: RazorpayWebhookBody
): Promise<{ duplicate: boolean; caseId: string | null; processingStatus: string }> {
  const providerEventId = parsed.id ?? `missing_${Date.now()}`;
  const eventType = parsed.event ?? 'unknown';
  const redacted = redactWebhookPayload(JSON.parse(rawBody)) as RazorpayWebhookBody;
  const payloadJson = JSON.stringify(redacted);

  let webhookEvent;
  try {
    webhookEvent = await prisma.webhookEvent.create({
      data: {
        providerEventId,
        eventType,
        signatureValid: true,
        processingStatus: 'RECEIVED',
        payloadJson,
      },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      const existing = await prisma.webhookEvent.findUnique({
        where: { providerEventId },
      });
      let caseId: string | null = null;
      if (existing) {
        const orderId = parsed.payload?.payment?.entity?.order_id;
        if (orderId) {
          caseId = await findCaseIdForOrder(orderId);
        }
      }
      return {
        duplicate: true,
        caseId,
        processingStatus: 'DUPLICATE',
      };
    }
    throw err;
  }

  const createdAtMs = parsed.created_at ? parsed.created_at * 1000 : Date.now();
  if (Date.now() - createdAtMs > STALE_MS) {
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processingStatus: 'STALE', processedAt: new Date() },
    });
    return { duplicate: false, caseId: null, processingStatus: 'STALE' };
  }

  if (!['payment.failed', 'payment.captured', 'order.paid'].includes(eventType)) {
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processingStatus: 'IGNORED', processedAt: new Date() },
    });
    return { duplicate: false, caseId: null, processingStatus: 'IGNORED' };
  }

  const paymentEntity = parsed.payload?.payment?.entity;
  let caseId: string | null = null;

  try {
    if (eventType === 'payment.failed' && paymentEntity?.order_id) {
      const amountInr = (paymentEntity.amount ?? 0) / 100;
      const ingest = await ingestFailure({
        razorpayOrderId: paymentEntity.order_id,
        razorpayPaymentId: paymentEntity.id ?? null,
        amountInr: amountInr > 0 ? amountInr : 1,
        errorCode: paymentEntity.error_code,
        errorDescription: paymentEntity.error_description,
        errorReason: paymentEntity.error_reason,
        paymentMethod: paymentEntity.method,
        source: 'webhook',
        rawEventId: providerEventId,
        occurredAt: new Date(createdAtMs),
      });
      caseId = ingest.caseId;
      if (caseId) {
        await writeAudit({
          actorType: 'system',
          action: 'WEBHOOK_FAILURE_INGESTED',
          entityType: 'RecoveryCase',
          entityId: caseId,
          metadata: { eventId: providerEventId },
        });
      }
    }

    if (
      (eventType === 'payment.captured' || eventType === 'order.paid') &&
      paymentEntity?.id
    ) {
      const localPayment = await prisma.payment.findFirst({
        where: {
          OR: [
            { razorpayPaymentId: paymentEntity.id },
            { razorpayOrderId: paymentEntity.order_id ?? '' },
          ],
        },
      });

      if (localPayment) {
        await prisma.payment.update({
          where: { id: localPayment.id },
          data: {
            razorpayPaymentId: paymentEntity.id,
          },
        });
        const capture = await markCaptured(localPayment.id);
        caseId = capture.caseId ?? caseId;
      } else if (paymentEntity.order_id) {
        const orderPayment = await prisma.payment.findUnique({
          where: { razorpayOrderId: paymentEntity.order_id },
        });
        if (orderPayment) {
          await prisma.payment.update({
            where: { id: orderPayment.id },
            data: {
              razorpayPaymentId: paymentEntity.id,
            },
          });
          const byId = await markCaptured(orderPayment.id);
          caseId = byId.caseId ?? caseId;
        }
      }
    }

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processingStatus: 'PROCESSED', processedAt: new Date() },
    });
  } catch (err: unknown) {
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { processingStatus: 'ERROR', processedAt: new Date() },
    });
    throw err;
  }

  return { duplicate: false, caseId, processingStatus: 'PROCESSED' };
}
