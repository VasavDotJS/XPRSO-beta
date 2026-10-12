import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/orderplat';

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

export const pool =
  global.__pgPool ||
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool;
}

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
