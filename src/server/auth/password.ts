import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);

// Argon2id options suitable for modern server-side authentication
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

async function scryptHash(secret: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(secret, salt, 64)) as Buffer;
  return `$scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function scryptVerify(secret: string, hashStr: string): Promise<boolean> {
  try {
    const parts = hashStr.split('$');
    if (parts.length !== 4 || parts[1] !== 'scrypt') return false;
    const salt = parts[2];
    const originalKeyHex = parts[3];
    const derivedKey = (await scryptAsync(secret, salt, 64)) as Buffer;
    const derivedKeyHex = derivedKey.toString('hex');
    if (originalKeyHex.length !== derivedKeyHex.length) return false;
    return crypto.timingSafeEqual(Buffer.from(originalKeyHex), Buffer.from(derivedKeyHex));
  } catch {
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return await scryptHash(password);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (passwordHash.startsWith('$scrypt$')) {
    return await scryptVerify(password, passwordHash);
  }
  try {
    const argon2 = await import('@node-rs/argon2');
    return await argon2.verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

export async function hashPin(pin: string): Promise<string> {
  return await scryptHash(pin);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  if (pinHash.startsWith('$scrypt$')) {
    return await scryptVerify(pin, pinHash);
  }
  try {
    const argon2 = await import('@node-rs/argon2');
    return await argon2.verify(pinHash, pin, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
