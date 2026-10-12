import { hash, verify } from '@node-rs/argon2';

// Argon2id options suitable for modern server-side authentication
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

export async function hashPin(pin: string): Promise<string> {
  return hash(pin, ARGON2_OPTIONS);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  try {
    return await verify(pinHash, pin, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
