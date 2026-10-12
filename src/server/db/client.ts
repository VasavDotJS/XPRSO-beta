import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

// Determine if running in a cloud deployment environment (Netlify, Vercel, AWS Lambda)
const isCloudEnv = Boolean(
  process.env.NETLIFY ||
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.URL ||
  process.env.DEPLOY_URL ||
  process.env.CONTEXT ||
  (process.env.NODE_ENV === 'production' && !process.env.LOCAL_DEV)
);

const configuredUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NETLIFY_DATABASE_URL;

export const hasConfiguredDb = Boolean(configuredUrl);

const connectionString =
  configuredUrl ||
  (isCloudEnv
    ? ''
    : 'postgres://postgres:postgres@localhost:5432/orderplat');

const isRemoteDb =
  Boolean(connectionString) &&
  (connectionString.includes('neon.tech') ||
    connectionString.includes('supabase.co') ||
    connectionString.includes('pooler.supabase.com') ||
    connectionString.includes('sslmode=require') ||
    isCloudEnv);

const poolConfig: PoolConfig = {
  connectionString: connectionString || undefined,
  max: isRemoteDb ? 10 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ...(isRemoteDb && connectionString && !connectionString.includes('localhost')
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
};

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export const pool = globalThis.__pgPool || new Pool(poolConfig);
globalThis.__pgPool = pool;

pool.on('error', (err) => {
  console.error('Unexpected idle client error in pg pool:', err.message);
});

export const db = drizzle(pool, { schema });

/**
 * Health check helper to verify database connectivity.
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    if (!connectionString) {
      return false;
    }
    const res = await pool.query('SELECT 1 as ok');
    return res.rows.length > 0 && res.rows[0].ok === 1;
  } catch (err: any) {
    console.error('Database health check failed:', err.message);
    return false;
  }
}
