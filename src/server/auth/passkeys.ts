import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { db } from '../db/client';
import { passkeys, users } from '../db/schema';
import { eq } from 'drizzle-orm';

// In-memory challenge store (TTL 5 minutes)
interface StoredChallenge {
  challenge: string;
  userId?: string;
  expiresAt: number;
}
const challengeStore = new Map<string, StoredChallenge>();

// Prune expired challenges every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of challengeStore.entries()) {
      if (val.expiresAt < now) {
        challengeStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export function saveChallenge(key: string, challenge: string, userId?: string): void {
  challengeStore.set(key, {
    challenge,
    userId,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
}

export function getAndConsumeChallenge(key: string): StoredChallenge | null {
  const item = challengeStore.get(key);
  if (!item) return null;
  challengeStore.delete(key);
  if (item.expiresAt < Date.now()) return null;
  return item;
}

export function getRpConfig() {
  const appDomain = process.env.APP_DOMAIN || 'localhost:3000';
  // Strip port from rpID (e.g., localhost:3000 -> localhost)
  const rpID = appDomain.split(':')[0];
  const isHttps = process.env.NODE_ENV === 'production' || (!appDomain.startsWith('localhost') && !appDomain.startsWith('127.0.0.1'));
  const origin = `${isHttps ? 'https' : 'http'}://${appDomain}`;

  return { rpID, origin, rpName: 'XPRSO Order Platform' };
}

/**
 * Generate WebAuthn registration options for a logged-in user.
 */
export async function getPasskeyRegistrationOptions(user: {
  id: string;
  username: string;
  displayName: string;
}) {
  const { rpID, rpName } = getRpConfig();

  // Find user's existing credentials to exclude
  const existing = await db
    .select({ credentialId: passkeys.credentialId, transports: passkeys.transports })
    .from(passkeys)
    .where(eq(passkeys.userId, user.id));

  const excludeCredentials = existing.map((c) => ({
    id: c.credentialId,
    transports: (c.transports as any) || undefined,
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.id),
    userName: user.username,
    userDisplayName: user.displayName,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  saveChallenge(`reg_${user.id}`, options.challenge, user.id);
  return options;
}

/**
 * Verify WebAuthn registration response and save credential in DB.
 */
export async function verifyPasskeyRegistration(
  userId: string,
  response: any,
  deviceLabel: string = 'Device Biometrics'
) {
  const { rpID, origin } = getRpConfig();
  const challengeData = getAndConsumeChallenge(`reg_${userId}`);

  if (!challengeData) {
    throw new Error('WebAuthn challenge expired or not found. Please try again.');
  }

  const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeData.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Passkey registration could not be verified.');
  }

  const { credential, credentialDeviceType } = verification.registrationInfo;

  // SimpleWebAuthn v13 represents credential.publicKey as a Uint8Array,
  // and credential.id as a string (base64url).
  const publicKeyBase64 = Buffer.from(credential.publicKey).toString('base64url');

  const [saved] = await db
    .insert(passkeys)
    .values({
      userId,
      credentialId: credential.id,
      publicKey: publicKeyBase64,
      signCount: credential.counter,
      transports: response.response.transports || ['internal'],
      deviceLabel: `${deviceLabel} (${credentialDeviceType})`,
      lastUsedAt: new Date(),
    })
    .returning();

  return saved;
}

/**
 * Generate discoverable passkey authentication options (no username required).
 */
export async function getPasskeyLoginOptions() {
  const { rpID } = getRpConfig();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    // Empty allowCredentials forces discoverable resident key lookup on device
    allowCredentials: [],
  });

  const challengeKey = `auth_${options.challenge}`;
  saveChallenge(challengeKey, options.challenge);

  return { options, challengeKey };
}

/**
 * Verify passkey assertion response and return associated user.
 */
export async function verifyPasskeyLogin(response: any) {
  const { rpID, origin } = getRpConfig();
  const credentialId = response.id;

  // Lookup passkey in DB
  const [passkey] = await db
    .select({
      id: passkeys.id,
      userId: passkeys.userId,
      credentialId: passkeys.credentialId,
      publicKey: passkeys.publicKey,
      signCount: passkeys.signCount,
    })
    .from(passkeys)
    .where(eq(passkeys.credentialId, credentialId))
    .limit(1);

  if (!passkey) {
    throw new Error('Unrecognized passkey credential. Please sign in with password.');
  }

  const challengeKey = `auth_${response.response.clientDataJSON ? JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString()).challenge : ''}`;
  const challengeData = getAndConsumeChallenge(challengeKey);

  if (!challengeData) {
    throw new Error('Biometric authentication challenge expired. Please retry.');
  }

  const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeData.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, 'base64url'),
      counter: passkey.signCount,
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new Error('Biometric verification assertion failed.');
  }

  // Update signCount and lastUsedAt
  await db
    .update(passkeys)
    .set({
      signCount: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(passkeys.id, passkey.id));

  // Load user
  const [user] = await db.select().from(users).where(eq(users.id, passkey.userId)).limit(1);
  if (!user || !user.isActive) {
    throw new Error('Staff account is deactivated or missing.');
  }

  return user;
}
