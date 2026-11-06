const PROHIBITED_KEYS = new Set([
  'card',
  'bank',
  'vpa',
  'email',
  'contact',
  'cvv',
  'card_number',
]);

export function redactWebhookPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactWebhookPayload);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (PROHIBITED_KEYS.has(key)) {
        continue;
      }
      out[key] = redactWebhookPayload(child);
    }
    return out;
  }
  return value;
}

export function payloadContainsProhibitedKeys(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(payloadContainsProhibitedKeys);
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (PROHIBITED_KEYS.has(key)) {
        return true;
      }
      if (payloadContainsProhibitedKeys(child)) {
        return true;
      }
    }
  }
  return false;
}
