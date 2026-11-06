import crypto from 'crypto';

export function compareHexDigests(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(provided, 'hex')
    );
  } catch {
    return false;
  }
}
