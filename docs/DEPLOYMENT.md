# Cloud Deployment Guide — XPRSO (Order Platform)

XPRSO is structured for effortless zero-maintenance deployment to modern serverless cloud platforms (**Vercel** or **Netlify**) paired with a serverless PostgreSQL database (**Neon** or **Supabase**).

---

## 1. Database Recommendation: Neon vs Supabase

Both platforms provide managed PostgreSQL, but **Neon is the top recommendation for Vercel & Netlify**:

| Feature | **Neon** (Recommended 🏆) | **Supabase** |
|---|---|---|
| **Vercel Integration** | **1-Click Native Marketplace Integration** (auto-injects `POSTGRES_URL`) | Manual copy-paste of URI |
| **Serverless Pooling** | Built-in PgBouncer pooler (`-pooler` endpoint) | Connection pooler port (6543) |
| **Free Tier Sleep** | Scales to zero seamlessly; wakes instantly on queries | Projects pause after 7 days of inactivity |
| **Branching** | Instantaneous copy-on-write database branches | Branching available on Pro tiers |

> **Verdict:** Choose **Neon** for the easiest zero-friction deployment. Supabase is also 100% compatible if you already use it.

---

## 2. Option A: 1-Click / 3-Step Deployment on Vercel (Recommended)

### Step 1: Push code to your GitHub repo
Ensure your latest code is pushed to your GitHub repository (e.g., `https://github.com/VasavDotJS/XPRSO-beta`).

### Step 2: Import into Vercel
1. Go to [vercel.com/new](https://vercel.com/new) and select your GitHub repository.
2. Vercel automatically detects Next.js framework settings.

### Step 3: Connect Database (Neon)
**Method 1 (Instant 1-Click via Vercel Marketplace):**
- In the Vercel Project setup or under the **Storage** tab, click **Connect Store** → **Neon**.
- Vercel provisions the Neon database and automatically injects `POSTGRES_URL` and `DATABASE_URL`.

**Method 2 (Manual Connection String):**
- Create a free project at [neon.tech](https://neon.tech).
- Under **Connection Details**, select **Pooled connection** and copy the URI.
- Add an Environment Variable in Vercel:
  ```env
  DATABASE_URL=postgres://neondb_owner:npg_xxxx@ep-cool-fog-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
  ```

Click **Deploy**!

---

## 3. Option B: Deployment on Netlify

### Step 1: Create a Database on Neon or Supabase
- **Neon:** Create a project at [neon.tech](https://neon.tech), copy the pooled connection string.
- **Supabase:** Create a project at [supabase.com](https://supabase.com). Go to **Settings** → **Database** → **Connection String** → **URI (Transaction Pooler - Port 6543)** and copy the string.

### Step 2: Import into Netlify
1. Go to [app.netlify.com](https://app.netlify.com) and click **Add new site** → **Import an existing project**.
2. Select your GitHub repository (`XPRSO-beta`).
3. Netlify will detect `netlify.toml` automatically:
   - Build command: `pnpm run build`
   - Publish directory: `.next`

### Step 3: Add Environment Variables
In the Netlify site settings under **Environment variables**, add:
```env
DATABASE_URL=your-neon-or-supabase-connection-string?sslmode=require
```
Click **Deploy site**!

---

## 4. First-Time Setup: Zero CLI Commands Needed!

When you deploy for the first time with an empty database:
1. Open your new deployment URL (e.g. `https://xprso-beta.vercel.app`).
2. The platform automatically detects that the database is uninitialized and runs all table creation migrations and immutability triggers on the fly via `ensureDatabaseReady()`.
3. The browser automatically presents the **"Enroll Business / Setup"** screen:
   - Enter your **Café Name** and optional GSTIN/address.
   - Create your first **Owner / Administrator** username, password, and 4-6 digit Admin PIN.
4. You're immediately logged in and ready to take orders or configure products!

---

## 5. Security & Data Guarantees in Serverless

- **Encrypted in Transit:** Automatic SSL (`sslmode=require` / `rejectUnauthorized: false`) is enforced for all cloud database connections (`neon.tech`, `supabase.co`).
- **Stateless WebAuthn Biometrics:** Challenges are persisted to PostgreSQL (`auth_challenges`) and consumed with atomic single-use deletes (`DELETE ... RETURNING`), ensuring biometric Touch ID / Face ID sign-ins work reliably even when requests bounce between different serverless lambdas.
- **Immutable Financial Records:** PostgreSQL triggers (`trg_order_immutability` & `trg_order_lines_immutability`) block any updates or deletes to settled invoices at the database engine level.
- **Connection Pool Hygiene:** Warm lambda connection pools are cached across invocations (`globalThis.__pgPool`) with strict connection timeouts and limits to prevent exhausting Postgres connection slots.
