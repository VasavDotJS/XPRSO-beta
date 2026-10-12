import { describe, it, expect } from 'vitest';
import {
  getRpConfig,
  saveChallenge,
  getAndConsumeChallenge,
  getPasskeyLoginOptions,
} from '@/src/server/auth/passkeys';

describe('Unit: WebAuthn Passkeys & Biometric Configuration', () => {
  it('correctly configures rpID and allowed origins for localhost', () => {
    const config = getRpConfig();
    expect(config.rpID).toBe('localhost');
    expect(config.expectedRPID).toContain('localhost');
    expect(config.expectedOrigin).toContain('http://localhost:3000');
    expect(config.expectedOrigin).toContain('https://localhost:3000');
    expect(config.expectedOrigin).toContain('http://127.0.0.1:3000');
    expect(config.expectedOrigin).toContain('http://localhost');
  });

  it('incorporates custom request headers into allowed origins', () => {
    const mockReq = {
      headers: {
        get: (header: string) => {
          if (header === 'origin') return 'http://localhost:3000';
          if (header === 'host') return 'localhost:3000';
          return null;
        },
      },
    };

    const config = getRpConfig(mockReq);
    expect(config.expectedOrigin).toContain('http://localhost:3000');
    expect(config.expectedRPID).toContain('localhost');
  });

  it('handles challenges securely with single-use consumption', () => {
    const key = `test_challenge_${Date.now()}`;
    const secret = 'random_challenge_string';

    saveChallenge(key, secret, 'user-123');
    const firstGet = getAndConsumeChallenge(key);
    expect(firstGet).not.toBeNull();
    expect(firstGet?.challenge).toBe(secret);
    expect(firstGet?.userId).toBe('user-123');

    // Second consumption must return null (replay attack prevention)
    const secondGet = getAndConsumeChallenge(key);
    expect(secondGet).toBeNull();
  });

  it('generates discoverable passkey login options with required user verification', async () => {
    const { options, challengeKey } = await getPasskeyLoginOptions();
    expect(options.rpId).toBe('localhost');
    expect(options.userVerification).toBe('required');
    expect(options.allowCredentials).toEqual([]);
    expect(challengeKey).toContain(options.challenge);
  });
});
