# XPRSO (order-plat)

**Touch-first, deployment-ready café ordering, live tax calculation, and deterministic sales analytics.**

---

## 1. Overview & Architecture

**XPRSO** is built for small cafés that need a fast, reliable POS and order-taking screen without the bloat, slow touch feedback, or opaque metrics of generic POS systems.

### Core Architectural Principles

1. **Money is Never a Float:**
   - All monetary figures are strictly stored, transmitted, and computed as integer **paise** (`₹1 = 100 paise`).
   - Tax and service charge rates are stored as **basis points** (`500 = 5.00%`, `1800 = 18.00%`).
   - Avoids IEEE-754 floating point inaccuracies and guarantees exact Indian GST rounding.
2. **Server is Source of Truth:**
   - The pure domain module in [`src/domain/tax`](file:///home/vasavpramesh06/XPRSO-app/src/domain/tax) is shared between the browser and server.
   - The browser calculates instant totals in `<100ms` for seamless touch feedback.
   - The server recomputes and commits the final values inside an atomic database transaction.
3. **Database-Enforced Immutability:**
   - Settled orders and their order lines are frozen permanently by PostgreSQL database triggers (`check_order_immutability`).
   - Edits and deletions on settled bills are rejected at the database engine level.
   - Prices take effect on **new lines only**; existing open lines and past settled lines retain their snapshots.
4. **Gapless Indian FY Invoicing:**
   - Invoices follow Indian statutory fiscal year conventions (`ORD/26-27/000001`).
   - Gapless sequence numbers are guaranteed under high concurrency using `SELECT ... FOR UPDATE` row locks on fiscal year counters.
5. **Deterministic SQL Analytics (No AI):**
   - All metrics, KPIs, margins, heatmaps, and plain-English highlights are computed purely with deterministic PostgreSQL SQL queries and fixed string templates.
   - Zero-sale products are guaranteed to appear in bottom-selling reports via outer joins (`LEFT JOIN`).
   - Items with missing cost prices are clearly flagged without inflating profit margins.
6. **Hyper-Modern Design System:**
   - Faithful execution of `/inspo` visual reference: obsidian pills, generous 24–32px corner radiuses, tactile inset well inputs/keypads, and electric blue (`#0066FF`) reserved strictly for final CTA/settlement actions.

---

## 2. Security & Authentication

- **Argon2id Hashing:** Memory-hard hashing for staff passwords and admin step-up PINs via `@node-rs/argon2`.
- **FIDO2 / WebAuthn Passkeys:** Native platform authenticator support (Touch ID, Face ID, Android Biometrics, Windows Hello) via `@simplewebauthn` with resident discoverable credentials.
- **Admin Step-Up Gate:** Accessing `/admin` requires a secondary factor (PIN or biometric assertion), granting an elevated 10-minute sliding session window.
- **Rate Limiting:** Prevents brute force with 5 failed attempts per 15-minute window per IP and username (`auth_attempts` table).
- **Session Tokens:** 256-bit cryptographically random tokens stored as SHA-256 hashes in PostgreSQL; 12-hour idle timeout and 7-day absolute lifetime.
- **Audit Logging:** Every price adjustment, user modification, tax setting change, and void action is permanently recorded in `audit_log`.

> **⚠️ Shared-Device Caveat:** On shared tablets, platform biometrics verify any fingerprint or face enrolled in the tablet OS. We recommend biometric login on personal staff devices and password/PIN login on shared café tablets.

---

## 3. Tech Stack

- **Framework:** Next.js 15 App Router (React 19, TypeScript)
- **Database & ORM:** PostgreSQL 16+ with Drizzle ORM
- **Styling:** Tailwind CSS with custom design tokens (`tailwind.config.ts`)
- **Document Generation:** `@react-pdf/renderer` (A4 Tax Invoices & 80mm Thermal Receipts) & `exceljs` (native numeric Excel exports)
- **Testing:** Vitest (Unit & Integration) + Playwright (Browser E2E)
- **Deployment:** Docker, Docker Compose, Caddy Reverse Proxy (automated TLS)

---

## 4. Quickstart & Local Development

### Prerequisites
- Node.js 22+ & pnpm v12+
- Docker & Docker Compose (for PostgreSQL and production deployment)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/vasavpramesh06/XPRSO-app.git
cd XPRSO-app
pnpm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Default local variables:
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/orderplat
APP_DOMAIN=localhost
PORT=3000
SESSION_SECRET=supersecret-session-key-minimum-32-chars-long
TZ_DEFAULT=Asia/Kolkata
```

### 3. Start Database
```bash
docker compose up -d db
```

### 4. Run Migrations & Seed Demo Data
```bash
# Push database schema & immutability triggers
pnpm db:migrate

# Seed realistic 30-item menu and 60 days of simulated cafe sales
pnpm db:seed
```

### 5. Create First Admin
If starting on a clean database without seeding, use the CLI or setup wizard:
```bash
pnpm cli create-admin --username admin --name "Cafe Owner" --password "Admin@123" --pin "1234"
```
Or navigate to `http://localhost:3000/setup` in your browser.

### 6. Start Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000).

Default Seed Credentials:
- **Waiter:** `waiter` / `Waiter@123`
- **Admin:** `admin` / `Admin@123` (Admin PIN: `1234`)

---

## 5. Running Tests

### Unit & Integration Tests (Vitest)
Executes tax engine property tests, Argon2id security tests, order settlement, PDF/Excel generation, and SQL analytics:
```bash
pnpm test
```

### End-to-End Browser Tests (Playwright)
Spins up headless Chromium to verify complete waiter order flow, live totals, cash settlement, and admin PIN step-up:
```bash
pnpm test:e2e
```

### Typecheck & Production Build
```bash
pnpm build
```

---

## 6. One-Click Cloud Deployment (Vercel / Netlify + Neon / Supabase)

XPRSO is structured for serverless cloud deployment with zero infrastructure overhead.

### Option 1: Vercel + Neon (Recommended 🏆)
1. **Push to GitHub:** Push your repository to GitHub.
2. **Import to Vercel:** Go to [vercel.com/new](https://vercel.com/new) and select the repository.
3. **Connect Neon Database:** In the Vercel Project settings under **Storage**, click **Connect Store** → **Neon** (or paste your Neon pooled connection string as `DATABASE_URL`).
4. **Deploy:** Click **Deploy**. Your database tables and immutability triggers will be auto-provisioned upon first visit!

### Option 2: Netlify + Supabase / Neon
1. Import the repository at [app.netlify.com](https://app.netlify.com).
2. Set the `DATABASE_URL` environment variable with your Neon or Supabase connection string (`?sslmode=require`).
3. Click **Deploy**.

For detailed setup, see the complete [Cloud Deployment Guide](docs/DEPLOYMENT.md).

---

## 7. Self-Hosted Production Deployment (Docker Compose)

Deploy with a single command:
```bash
docker compose up -d --build
```

### Architecture in Docker
- **`caddy`:** Automatically provisions Let's Encrypt TLS certificates and proxies traffic to the app.
- **`app`:** Production Next.js server running in an unprivileged container.
- **`db`:** PostgreSQL 17 Alpine with persistent storage in Docker volume `postgres_data`.
- **`backup`:** Scheduled cron container that takes daily compressed PostgreSQL dumps at 03:00 AM.

### Healthcheck
```bash
curl http://localhost/health
# Returns: {"status":"healthy","database":"connected","version":"1.0.0"}
```

---

## 7. Backups & Disaster Recovery

### Manual Backup
```bash
./scripts/backup.sh
# Creates gzip dump in ./backups/orderplat_YYYYMMDD_HHMMSS.sql.gz
```

### Restoring a Backup
```bash
./scripts/restore.sh ./backups/orderplat_20261012_120000.sql.gz
```

---

## 8. License & Credits

Built with care for café owners. All non-trivial architectural decisions are documented in [`DECISIONS.md`](file:///home/vasavpramesh06/XPRSO-app/DECISIONS.md).
