import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

/** Shared password crypto (scrypt) for all identity repositories — no new dependencies. */
export function newSalt(): string {
  return randomUUID().replace(/-/g, '');
}

export function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

export function verifyPasswordHash(
  password: string,
  salt: string,
  expectedHex: string,
): boolean {
  const attempt = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return attempt.length === expected.length && timingSafeEqual(attempt, expected);
}
