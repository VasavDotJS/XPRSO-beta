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

export function getRpConfig(req?: { headers: { get(name: string): string | null } }) {
  const appDomain = process.env.APP_DOMAIN || 'localhost:3000';
  const configuredHost = appDomain.split(':')[0];

  let requestHost = configuredHost;
  let isHttps = false;

  if (req) {
    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (hostHeader) {
      requestHost = hostHeader.split(':')[0];
    }
    const protoHeader = req.headers.get('x-forwarded-proto');
    isHttps = protoHeader === 'https';
  } else {
    isHttps = !appDomain.startsWith('localhost') && !appDomain.startsWith('127.0.0.1');
  }

  // rpID: WebAuthn standard requires rpID to be a domain or 'localhost' (not an IP address)
  const rpID = requestHost === '127.0.0.1' || requestHost === 'localhost'
    ? 'localhost'
    : (configuredHost === '127.0.0.1' ? 'localhost' : configuredHost);

  const expectedRPID = Array.from(new Set([rpID, 'localhost', configuredHost].filter(Boolean)));

  // Build comprehensive list of expected origins so registration/verification works seamlessly
  const allowedOrigins = new Set<string>([
    'http://localhost:3000',
    'https://localhost:3000',
    'http://localhost',
    'https://localhost',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000',
    'http://127.0.0.1',
    'https://127.0.0.1',
    `http://${appDomain}`,
    `https://${appDomain}`,
  ]);

  if (req) {
    const originHeader = req.headers.get('origin');
    if (originHeader) allowedOrigins.add(originHeader);

    const hostHeader = req.headers.get('host');
    if (hostHeader) {
      allowedOrigins.add(`http://${hostHeader}`);
      allowedOrigins.add(`https://${hostHeader}`);
    }
  }

  const expectedOrigin = Array.from(allowedOrigins);
  const origin = isHttps ? `https://${appDomain}` : `http://${appDomain}`;

  return {
    rpID,
    expectedRPID,
    origin,
    expectedOrigin,
    rpName: 'XPRSO Order Platform',
  };
}

/**
 * Generate WebAuthn registration options for a logged-in user.
 */
export async function getPasskeyRegistrationOptions(
  user: {
    id: string;
    username: string;
    displayName: string;
  },
  req?: { headers: { get(name: string): string | null } }
) {
  const { rpID, rpName } = getRpConfig(req);

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
  deviceLabel: string = 'Device Biometrics',
  req?: { headers: { get(name: string): string | null } }
) {
  const { expectedRPID, expectedOrigin } = getRpConfig(req);
  const challengeData = getAndConsumeChallenge(`reg_${userId}`);

  if (!challengeData) {
    throw new Error('WebAuthn challenge expired or not found. Please try again.');
  }

  const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeData.challenge,
    expectedOrigin,
    expectedRPID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Passkey registration could not be verified.');
  }

  const { credential, credentialDeviceType, userVerified } = verification.registrationInfo;

  // Confirm user verification was satisfied (biometric Face ID / Fingerprint on device)
  if (!userVerified) {
    throw new Error('Biometric user verification was not confirmed by the device.');
  }

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
      transports: response.response?.transports || ['internal'],
      deviceLabel: `${deviceLabel} (${credentialDeviceType})`,
      lastUsedAt: new Date(),
    })
    .returning();

  return saved;
}

/**
 * Generate discoverable passkey authentication options (or targeted to a specific user if provided).
 */
export async function getPasskeyLoginOptions(
  usernameOrUserId?: string,
  req?: { headers: { get(name: string): string | null } }
) {
  const { rpID } = getRpConfig(req);

  let allowCredentials: { id: string; transports?: any }[] | undefined = undefined;
  let targetUserId: string | undefined = undefined;

  if (usernameOrUserId && usernameOrUserId.trim()) {
    const trimmed = usernameOrUserId.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

    const [user] = await db
      .select({ id: users.id, username: users.username, isActive: users.isActive })
      .from(users)
      .where(isUuid ? eq(users.id, trimmed) : eq(users.username, trimmed.toLowerCase()))
      .limit(1);

    if (user) {
      if (!user.isActive) {
        throw new Error('This staff account is deactivated.');
      }
      targetUserId = user.id;
      const userPasskeys = await db
        .select({ credentialId: passkeys.credentialId, transports: passkeys.transports })
        .from(passkeys)
        .where(eq(passkeys.userId, user.id));

      if (userPasskeys.length > 0) {
        allowCredentials = userPasskeys.map((p) => ({
          id: p.credentialId,
          transports: (p.transports as any) || undefined,
        }));
      } else {
        throw new Error(
          `No biometric passkeys registered for "${user.username}". Please sign in with your password and register biometrics in Account Security.`
        );
      }
    } else {
      throw new Error(`Staff user "${trimmed}" not found.`);
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: allowCredentials && allowCredentials.length > 0 ? allowCredentials : [],
  });

  const challengeKey = `auth_${options.challenge}`;
  saveChallenge(challengeKey, options.challenge, targetUserId);

  return { options, challengeKey };
}

/**
 * Verify passkey assertion response and return associated user.
 */
export async function verifyPasskeyLogin(
  response: any,
  req?: { headers: { get(name: string): string | null } }
) {
  const { expectedRPID, expectedOrigin } = getRpConfig(req);
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

  let challengeFromClient = '';
  try {
    if (response.response?.clientDataJSON) {
      const parsed = JSON.parse(
        Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')
      );
      challengeFromClient = parsed.challenge || '';
    }
  } catch (err) {
    console.warn('Failed to parse clientDataJSON:', err);
  }

  const challengeKey = `auth_${challengeFromClient}`;
  const challengeData = getAndConsumeChallenge(challengeKey);

  if (!challengeData) {
    throw new Error('Biometric authentication challenge expired or invalid. Please retry.');
  }

  // If the challenge was bound to a specific user, verify it matches
  if (challengeData.userId && challengeData.userId !== passkey.userId) {
    throw new Error('Biometric passkey does not match the requested staff user.');
  }

  const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeData.challenge,
    expectedOrigin,
    expectedRPID,
    credential: {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, 'base64url'),
      counter: passkey.signCount,
    },
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.authenticationInfo.userVerified) {
    throw new Error('Biometric user verification (Face ID or Fingerprint) was not confirmed by the device.');
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
