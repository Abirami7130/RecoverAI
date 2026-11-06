import { describe, it, expect } from 'vitest';
import {
  payloadContainsProhibitedKeys,
  redactWebhookPayload,
} from '@/lib/payments/webhook-redaction';

describe('webhook payload redaction', () => {
  it('removes cvv and card_number from stored payloads', () => {
    const input = {
      payment: {
        entity: {
          id: 'pay_1',
          cvv: '123',
          card_number: '4111111111111111',
          email: 'user@example.com',
        },
      },
    };

    const redacted = redactWebhookPayload(input) as typeof input;
    expect(payloadContainsProhibitedKeys(redacted)).toBe(false);
    expect(JSON.stringify(redacted)).not.toContain('4111111111111111');
    expect(JSON.stringify(redacted)).not.toContain('"cvv"');
  });
});
