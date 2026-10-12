import { pool } from './client';
import * as dotenv from 'dotenv';

dotenv.config();

export async function runMigrations() {
  console.log('Running database setup and table initialization...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create tables if not exist
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        roles TEXT[] NOT NULL DEFAULT '{"WAITER"}',
        admin_pin_hash TEXT,
        must_change_password BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS passkeys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        sign_count BIGINT NOT NULL DEFAULT 0,
        transports TEXT[],
        device_label TEXT NOT NULL DEFAULT 'My Authenticator',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        elevated_until TIMESTAMPTZ,
        ip TEXT,
        user_agent TEXT
      );

      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

      CREATE TABLE IF NOT EXISTS auth_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key TEXT NOT NULL,
        kind TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS auth_attempts_key_created_idx ON auth_attempts(key, created_at);

      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id UUID NOT NULL REFERENCES categories(id),
        name TEXT NOT NULL,
        description TEXT,
        diet_tag TEXT,
        price_paise BIGINT NOT NULL,
        cost_paise BIGINT,
        tax_rate_bps_override INTEGER,
        image_url TEXT,
        is_available BOOLEAN NOT NULL DEFAULT true,
        is_archived BOOLEAN NOT NULL DEFAULT false,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS products_category_sort_idx ON products(category_id, sort_order);

      CREATE TABLE IF NOT EXISTS price_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id),
        field TEXT NOT NULL,
        old_paise BIGINT,
        new_paise BIGINT,
        changed_by UUID NOT NULL REFERENCES users(id),
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        cafe_name TEXT NOT NULL DEFAULT 'XPRSO Cafe',
        address TEXT,
        phone TEXT,
        gstin TEXT,
        fssai TEXT,
        logo_url TEXT,
        receipt_footer TEXT DEFAULT 'Thank you for dining with us!',
        invoice_prefix TEXT NOT NULL DEFAULT 'ORD',
        timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
        tax_mode TEXT NOT NULL DEFAULT 'GST_INTRA',
        tax_rate_bps INTEGER NOT NULL DEFAULT 500,
        prices_include_tax BOOLEAN NOT NULL DEFAULT false,
        service_charge_enabled BOOLEAN NOT NULL DEFAULT false,
        service_charge_bps INTEGER NOT NULL DEFAULT 500,
        round_grand_total BOOLEAN NOT NULL DEFAULT true,
        elevation_minutes INTEGER NOT NULL DEFAULT 10,
        session_idle_hours INTEGER NOT NULL DEFAULT 12,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        status TEXT NOT NULL DEFAULT 'OPEN',
        order_type TEXT NOT NULL DEFAULT 'DINE_IN',
        table_label TEXT,
        note TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        settled_by UUID REFERENCES users(id),
        voided_by UUID REFERENCES users(id),
        void_reason TEXT,
        payment_mode TEXT,
        invoice_no TEXT UNIQUE,
        financial_year TEXT,
        subtotal_paise BIGINT NOT NULL DEFAULT 0,
        service_charge_paise BIGINT NOT NULL DEFAULT 0,
        taxable_paise BIGINT NOT NULL DEFAULT 0,
        cgst_paise BIGINT NOT NULL DEFAULT 0,
        sgst_paise BIGINT NOT NULL DEFAULT 0,
        igst_or_gst_paise BIGINT NOT NULL DEFAULT 0,
        round_off_paise BIGINT NOT NULL DEFAULT 0,
        grand_total_paise BIGINT NOT NULL DEFAULT 0,
        tax_mode TEXT NOT NULL DEFAULT 'GST_INTRA',
        tax_rate_bps INTEGER NOT NULL DEFAULT 500,
        prices_include_tax BOOLEAN NOT NULL DEFAULT false,
        service_charge_bps INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        settled_at TIMESTAMPTZ,
        voided_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS orders_status_settled_idx ON orders(status, settled_at);
      CREATE INDEX IF NOT EXISTS orders_created_by_idx ON orders(created_by);

      CREATE TABLE IF NOT EXISTS order_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL,
        product_name_snapshot TEXT NOT NULL,
        category_name_snapshot TEXT NOT NULL DEFAULT 'General',
        unit_price_paise BIGINT NOT NULL,
        unit_cost_paise BIGINT,
        tax_rate_bps INTEGER NOT NULL,
        qty INTEGER NOT NULL,
        note TEXT,
        line_amount_paise BIGINT NOT NULL,
        line_taxable_paise BIGINT NOT NULL,
        line_tax_paise BIGINT NOT NULL,
        line_cost_paise BIGINT,
        line_gross_profit_paise BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS order_lines_order_id_idx ON order_lines(order_id);
      CREATE INDEX IF NOT EXISTS order_lines_product_id_idx ON order_lines(product_id);

      CREATE TABLE IF NOT EXISTS invoice_counters (
        financial_year TEXT PRIMARY KEY,
        last_number BIGINT NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID REFERENCES users(id),
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        before JSONB,
        after JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Default settings row
      INSERT INTO settings (id, cafe_name)
      VALUES (1, 'XPRSO Cafe')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Immutability trigger for settled orders:
    // Reject updates on settled orders except transitioning to VOID
    await client.query(`
      CREATE OR REPLACE FUNCTION check_order_immutability()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.status = 'SETTLED' THEN
          -- Only allow voiding a settled order
          IF NEW.status = 'VOID' AND OLD.status = 'SETTLED' THEN
            -- Allow setting status='VOID', voided_by, void_reason, voided_at
            RETURN NEW;
          ELSE
            RAISE EXCEPTION 'Cannot modify a settled order. Settled orders are immutable.';
          END IF;
        END IF;

        IF OLD.status = 'VOID' THEN
          RAISE EXCEPTION 'Cannot modify a voided order. Voided orders are immutable.';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_order_immutability ON orders;
      CREATE TRIGGER trg_order_immutability
        BEFORE UPDATE ON orders
        FOR EACH ROW
        EXECUTE FUNCTION check_order_immutability();

      -- Immutability trigger for order_lines:
      CREATE OR REPLACE FUNCTION check_order_lines_immutability()
      RETURNS TRIGGER AS $$
      DECLARE
        order_st TEXT;
      BEGIN
        SELECT status INTO order_st FROM orders WHERE id = COALESCE(OLD.order_id, NEW.order_id);
        IF order_st = 'SETTLED' OR order_st = 'VOID' THEN
          RAISE EXCEPTION 'Cannot insert, update or delete lines on a settled or voided order.';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_order_lines_immutability ON order_lines;
      CREATE TRIGGER trg_order_lines_immutability
        BEFORE INSERT OR UPDATE OR DELETE ON order_lines
        FOR EACH ROW
        EXECUTE FUNCTION check_order_lines_immutability();
    `);

    await client.query('COMMIT');
    console.log('Database tables and triggers successfully initialized.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
