import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

// Support DATABASE_URL (standard / Neon / Supabase) and POSTGRES_URL (Vercel Neon integration)
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'postgres://postgres:postgres@localhost:5432/orderplat';

// Detect remote serverless Postgres (Neon, Supabase, Vercel, Netlify)
const isRemoteDb =
  connectionString.includes('neon.tech') ||
  connectionString.includes('supabase.co') ||
  connectionString.includes('pooler.supabase.com') ||
  connectionString.includes('sslmode=require') ||
  process.env.VERCEL === '1' ||
  process.env.NETLIFY === 'true';

const poolConfig: PoolConfig = {
  connectionString,
  max: isRemoteDb ? 10 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(isRemoteDb ? { ssl: { rejectUnauthorized: false } } : {}),
};

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

// Global caching across both dev and production serverless lambdas
export const pool = globalThis.__pgPool || new Pool(poolConfig);
globalThis.__pgPool = pool;

export const db = drizzle(pool, { schema });

/**
 * Health check helper to verify database connectivity.
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 as ok');
    return res.rows.length > 0 && res.rows[0].ok === 1;
  } catch (err) {
    console.error('Database health check failed:', err);
    return false;
  }
}
