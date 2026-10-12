import { pool } from './client';
import * as dotenv from 'dotenv';

dotenv.config();

export async function resetDatabase() {
  console.log('Clearing all data from database (orders, menu, users, sessions, settings)...');
  const client = await pool.connect();
  try {
    await client.query(`
      TRUNCATE TABLE
        order_lines,
        orders,
        invoice_counters,
        price_history,
        audit_log,
        auth_attempts,
        sessions,
        passkeys,
        products,
        categories,
        settings,
        users
      RESTART IDENTITY CASCADE;

      -- Re-insert clean baseline default settings
      INSERT INTO settings (id, cafe_name, tax_mode, tax_rate_bps, prices_include_tax, round_grand_total)
      VALUES (1, 'XPRSO Cafe', 'GST_INTRA', 500, false, true)
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('Database cleared completely! Zero users, zero products, zero orders.');
    console.log('First-run setup wizard is now ready at /setup.');
  } finally {
    client.release();
  }
}

const isDirectCli =
  typeof process !== 'undefined' &&
  Boolean(process.argv?.[1]) &&
  (process.argv[1].endsWith('reset.ts') || process.argv[1].endsWith('reset.js'));

if (isDirectCli) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Reset failed:', err);
      process.exit(1);
    });
}

