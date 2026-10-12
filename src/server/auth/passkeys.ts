import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { db } from '../db/client';
import { passkeys, users, authChallenges } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';

// In-memory challenge store fallback (TTL 5 minutes)
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

export async function saveChallenge(key: string, challenge: string, userId?: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  try {
    await db
      .insert(authChallenges)
      .values({
        id: key,
        challenge,
        userId: userId || null,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: authChallenges.id,
        set: {
          challenge,
          userId: userId || null,
          expiresAt,
        },
      });
  } catch (err) {
    console.warn('Failed to persist auth challenge to DB, using in-memory store fallback:', err);
  }

  challengeStore.set(key, {
    challenge,
    userId,
    expiresAt: expiresAt.getTime(),
  });
}

export async function getAndConsumeChallenge(key: string): Promise<StoredChallenge | null> {
  try {
    const now = new Date();
    const rows = await db
      .delete(authChallenges)
      .where(and(eq(authChallenges.id, key), gt(authChallenges.expiresAt, now)))
      .returning();

    if (rows.length > 0) {
      challengeStore.delete(key);
      return {
        challenge: rows[0].challenge,
        userId: rows[0].userId || undefined,
        expiresAt: rows[0].expiresAt.getTime(),
      };
    }
  } catch (err) {
    console.warn('DB challenge consumption failed, falling back to memory store:', err);
  }

  const item = challengeStore.get(key);
  if (!item) return null;
  challengeStore.delete(key);
  if (item.expiresAt < Date.now()) return null;
  return item;
}

export function getRpConfig(req?: { headers: { get(name: string): string | null } }) {
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const netlifyDomain = process.env.URL ? process.env.URL.replace(/^https?:\/\//, '') : undefined;
  const configuredDomain = process.env.APP_DOMAIN || vercelDomain || netlifyDomain || 'localhost:3000';
  const configuredHost = configuredDomain.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];

  let requestHost = configuredHost;
  let isHttps = false;

  if (req) {
    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (hostHeader) {
      requestHost = hostHeader.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
    }
    const protoHeader = req.headers.get('x-forwarded-proto');
    isHttps = protoHeader === 'https';
  } else {
    isHttps = !configuredDomain.startsWith('localhost') && !configuredDomain.startsWith('127.0.0.1');
  }

  // rpID: WebAuthn standard requires rpID to be a domain or 'localhost' (not an IP address)
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(requestHost);
  const rpID = requestHost === '127.0.0.1' || requestHost === 'localhost' || isIp
    ? 'localhost'
    : requestHost;

  const expectedRPID = Array.from(new Set([
    rpID,
    'localhost',
    configuredHost,
    vercelDomain?.split(':')[0],
    netlifyDomain?.split(':')[0],
  ].filter(Boolean) as string[]));

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
    `http://${configuredHost}`,
    `https://${configuredHost}`,
    `http://${requestHost}`,
    `https://${requestHost}`,
  ]);

  if (vercelDomain) {
    allowedOrigins.add(`https://${vercelDomain}`);
    allowedOrigins.add(`http://${vercelDomain}`);
  }
  if (netlifyDomain) {
    allowedOrigins.add(`https://${netlifyDomain}`);
    allowedOrigins.add(`http://${netlifyDomain}`);
  }

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
  const origin = isHttps ? `https://${requestHost}` : `http://${requestHost}`;

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

  await saveChallenge(`reg_${user.id}`, options.challenge, user.id);
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
  const challengeData = await getAndConsumeChallenge(`reg_${userId}`);

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
  await saveChallenge(challengeKey, options.challenge, targetUserId);

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
  const challengeData = await getAndConsumeChallenge(challengeKey);

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
