import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, pool } from '@/src/server/db/client';
import { users, sessions, authAttempts, auditLog } from '@/src/server/db/schema';
import { hashPassword, verifyPassword, hashPin, verifyPin } from '@/src/server/auth/password';
import { checkRateLimit, recordAuthAttempt } from '@/src/server/auth/rateLimit';
import {
  createSession,
  validateSessionToken,
  elevateSession,
  invalidateSession,
} from '@/src/server/auth/sessions';
import { eq } from 'drizzle-orm';

describe('Integration: Authentication, Password Hashing & RBAC', () => {
  const testUsername = `waiter_${Date.now()}`;
  const testPassword = 'Password@123';
  const testPin = '9876';
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const passwordHash = await hashPassword(testPassword);
    const pinHash = await hashPin(testPin);

    const [user] = await db
      .insert(users)
      .values({
        username: testUsername,
        displayName: 'Test Staff',
        passwordHash,
        adminPinHash: pinHash,
        roles: ['WAITER'],
        isActive: true,
      })
      .returning();

    testUserId = user.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it('accurately hashes and verifies passwords using Argon2id', async () => {
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user).toBeDefined();

    const isMatch = await verifyPassword(testPassword, user.passwordHash);
    expect(isMatch).toBe(true);

    const isWrong = await verifyPassword('WrongPassword', user.passwordHash);
    expect(isWrong).toBe(false);
  });

  it('accurately hashes and verifies admin PINs', async () => {
    const [user] = await db.select().from(users).where(eq(users.id, testUserId));
    expect(user.adminPinHash).not.toBeNull();

    const isPinMatch = await verifyPin(testPin, user.adminPinHash!);
    expect(isPinMatch).toBe(true);

    const isPinWrong = await verifyPin('0000', user.adminPinHash!);
    expect(isPinWrong).toBe(false);
  });

  it('creates, validates, and elevates database sessions', async () => {
    const token = await createSession(testUserId, '127.0.0.1', 'Vitest-Agent');
    expect(token).toBeDefined();
    expect(token.length).toBe(64); // 32 hex bytes

    // Validate active session
    const sessionData = await validateSessionToken(token);
    expect(sessionData).not.toBeNull();
    expect(sessionData?.user.id).toBe(testUserId);
    expect(sessionData?.user.username).toBe(testUsername);
    expect(sessionData?.isElevated).toBe(false);

    // Elevate session
    await elevateSession(token, 15);
    const elevatedData = await validateSessionToken(token);
    expect(elevatedData?.isElevated).toBe(true);

    // Invalidate session (logout)
    await invalidateSession(token);
    const deadSession = await validateSessionToken(token);
    expect(deadSession).toBeNull();
  });

  it('enforces rate limiting after 5 failed attempts', async () => {
    const rateLimitKey = `rate_test_${Date.now()}`;

    // Record 4 failed attempts
    for (let i = 0; i < 4; i++) {
      await recordAuthAttempt(rateLimitKey, 'password', false);
      const status = await checkRateLimit(rateLimitKey, 'password');
      expect(status.allowed).toBe(true);
      expect(status.remainingAttempts).toBe(5 - (i + 1));
    }

    // 5th failed attempt -> locks out
    await recordAuthAttempt(rateLimitKey, 'password', false);
    const lockedStatus = await checkRateLimit(rateLimitKey, 'password');
    expect(lockedStatus.allowed).toBe(false);
    expect(lockedStatus.remainingAttempts).toBe(0);
    expect(lockedStatus.retryAfterSeconds).toBeGreaterThan(0);
  });
});
