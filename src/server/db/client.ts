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

function cleanConnectionString(raw?: string): string {
  if (!raw) return '';
  let url = raw.trim();
  if (url.startsWith('DATABASE_URL=')) {
    url = url.slice('DATABASE_URL='.length).trim();
  } else if (url.startsWith('DATABASE_URL =')) {
    url = url.slice('DATABASE_URL ='.length).trim();
  }
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }
  // If connecting to Supabase pooler on transaction port 6543, route to session port 5432
  // to support Drizzle ORM prepared statements and prevent PgBouncer transaction freeze in Lambda
  if (url.includes('.pooler.supabase.com:6543')) {
    url = url.replace('.pooler.supabase.com:6543', '.pooler.supabase.com:5432');
  }
  return url;
}

const rawConfiguredUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NETLIFY_DATABASE_URL;

const configuredUrl = cleanConnectionString(rawConfiguredUrl);

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
  max: isCloudEnv ? 2 : (isRemoteDb ? 10 : 20),
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
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
