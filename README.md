<div align="center">

# ☕ XPRSO
### Touch-First Modern POS & Deterministic Sales Intelligence Platform

**Engineered for specialty cafés, roasteries, and boutique bistros.**  
*Sub-100ms touch speed • FIDO2 Device Biometrics • Statutory Indian GST Compliance • Tamper-Proof Audit Trails • Deterministic SQL Analytics*

[![Next.js 15](https://img.shields.io/badge/Next.js-15.1-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![WebAuthn Passkeys](https://img.shields.io/badge/FIDO2-WebAuthn-2496ed?style=for-the-badge&logo=fido)](https://webauthn.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-41%2F41%20Passing-10b981?style=for-the-badge&logo=vitest)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-gray?style=for-the-badge)](LICENSE)

[**Explore Cloud Deployment**](docs/DEPLOYMENT.md) • [**Design Brief**](docs/design-brief.md) • [**Architectural Decisions**](DECISIONS.md)

---

</div>

## 🌟 Executive Summary

**XPRSO** is a modern, high-performance web point-of-sale (POS) and analytics engine created to replace slow, cluttered, and overpriced legacy restaurant systems. Built from the ground up for tablets, mobile handsets, and counter terminals, XPRSO combines a sculptural tactile interface with mathematical financial precision.

Whether taking orders one-handed during the morning rush, printing statutory GST tax invoices, or uncovering true product profit margins through deterministic SQL analytics, XPRSO gives café owners absolute clarity and total operational sovereignty.

---

## ⚡ Why XPRSO Outperforms Traditional POS Systems

| Capability | Legacy POS Platforms | ☕ **XPRSO Experience** |
|---|---|---|
| **Touch Responsiveness** | Laggy spinners, bloated electron wrappers, 400ms+ tap latency | **Sub-100ms optimistic touch updates** with smooth spring micro-interactions |
| **Financial Accuracy** | Vulnerable to IEEE-754 floating-point pennies/paise rounding bugs | **100% integer arithmetic in paise** (`₹1 = 100 paise`) & basis points (`500 = 5%`) |
| **Sales Intelligence** | Opaque AI summaries prone to hallucination, or basic revenue totals | **Pure deterministic PostgreSQL SQL**: exact gross profit, true margins, zero-sales discovery |
| **Audit & Record Safety** | Settled bills can be quietly altered or deleted by staff | **Database engine immutability triggers**: settled orders and lines are permanently frozen |
| **Staff Authentication** | Easily shared or observed 4-digit PINs written on paper | **FIDO2 WebAuthn Passkeys**: 1-tap sign-in via Touch ID, Face ID, or Android Biometrics |
| **Statutory Compliance** | Generic receipt numbering that fails Indian GST audits | **Gapless Indian Fiscal Year sequential numbering** (`ORD/26-27/000001`) with concurrency locks |
| **Vendor Lock-in** | Monthly recurring software subscriptions + locked hardware | **Zero lock-in**: 1-Click cloud deployment on Vercel/Neon or 100% self-hosted on Docker |

---

## 🎨 Design Philosophy: Sculptural & Tactile

Derived directly from modern architectural and hardware aesthetics ([`docs/design-brief.md`](docs/design-brief.md)):

* **Sculptured Monochrome Canvas:** Soft warm-neutral backgrounds (`#F2F3F5` light / `#0A0A0C` dark) free from visual clutter.
* **Obsidian Pills:** Active category tabs and controls switch from pale resting grey to deep obsidian (`#121214`) with subtle rim highlights.
* **Singular Electric Blue Action:** Electric Cobalt (`#0066FF`) is reserved strictly for primary transactional actions (Pay / Settle), giving waiters immediate confidence with zero hesitation.
* **Frosted Smoked Glass Sheets:** Modals, live running bill panels, and action sheets float above content with high-contrast blurred glass (`backdrop-blur-xl`).
* **Tactile Inset Wells:** Recessed, debossed inputs for search fields and numerical PIN keypads that feel physically pressed into the surface.

---

## 🚀 Key Features Tour

### 1. High-Speed Order Taking (`/order`)
- **One-Handed Flow:** Built for waiters moving between tables. Tap any card to increment quantity, or use tactile stepper controls.
- **Dine-In & Takeaway Context:** Table label assignment, order notes, and special instructions per line item (e.g., *"oat milk, extra hot"*).
- **Instant Tax Calculation:** Real-time client-side preview in `<100ms` with exact server-side transaction recalculation as the ultimate source of truth.
- **Quick Staff Switch:** Shared tablet mode lets servers log in, punch tickets, and hand off with a single tap.

### 2. Device Biometrics & Passwordless Auth (`/login` & `/account/security`)
- **WebAuthn / FIDO2 Passkeys:** Staff can authenticate in under one second using platform biometric hardware:
  - Apple Touch ID & Face ID (iOS, iPadOS, macOS)
  - Android Fingerprint & Face Unlock
  - Windows Hello
- **Shared-Tablet Safety:** Clear in-app guidance on device enrollment policies; passkeys can be listed, renamed, or revoked instantly by administrators.
- **Argon2id Memory-Hard Security:** Robust fallback password and admin PIN protection with automated rate limiting (5 attempts per 15 minutes).

### 3. Fortified Admin Command Center (`/admin`)
- **Elevated Step-Up Gate:** Access to administrative settings requires a secondary factor (Admin PIN or biometric challenge), activating a sliding 10-minute elevated privilege window.
- **Menu & Price Management:** Add, edit, archive, and categorize items. Price adjustments apply strictly to *new* orders—historical and open orders maintain their immutable snapshots.
- **Bulk Price Editor:** Rapidly adjust prices across dozens of menu items with a single batch confirmation dialog.
- **Café Profile & Tax Engine:** Configure GSTIN, FSSAI registration, invoice prefixes, tax mode (Intra-state CGST+SGST vs. Inter-state IGST), tax-inclusive/exclusive pricing, and optional service charge basis points.

### 4. Deterministic Sales Analytics (Zero AI / Pure SQL) (`/admin/analytics`)
- **Accurate Gross Profit:** Calculates true profit on every sale line (`selling_price - cost_price`), clearly surfacing items missing cost prices without skewing margins.
- **Volume & Revenue Champions:** Identifies top-selling volume leaders and high-margin stars.
- **Zero-Sales Product Discovery:** Outer `LEFT JOIN` queries surface menu items with 0 sales so you can prune dead inventory.
- **Plain-English Operational Highlights:** Automated business insights generated dynamically from mathematical rules without unpredictable LLMs or external API calls.

### 5. Statutory Invoicing & Document Export Engine
- **A4 Statutory Tax Invoices:** Pixel-perfect PDF generation with formatted GST tables, café branding, and embedded Rupee (`₹`) typography.
- **80mm Thermal Receipts:** Compact receipt format optimized for POS thermal printers.
- **Native Excel Workbooks (`.xlsx`):** Formatted spreadsheets with authentic numeric types (not text strings) for accountant-ready book-keeping.

---

## 👥 Roles & Permissions Matrix

| Feature / Action | ☕ Waiter | 👑 Admin / Owner |
|---|:---:|:---:|
| Take & Edit Open Orders | ✅ | ✅ |
| Settle Orders (Cash, UPI, Card) | ✅ | ✅ |
| Export Receipt (PDF / Excel) | ✅ | ✅ |
| Register Personal Biometrics / Passkeys | ✅ | ✅ |
| Access Admin Panel (`/admin`) | ❌ | ✅ *(PIN / Biometric Step-Up)* |
| Menu, Price & Cost Price Engineering | ❌ | ✅ |
| Tax & Service Charge Configuration | ❌ | ✅ |
| Café Profile & GSTIN Settings | ❌ | ✅ |
| Sales Analytics & Gross Profit Reports | ❌ | ✅ |
| Void Settled Invoices with Audit Trail | ❌ | ✅ |
| Staff Account & Role Management | ❌ | ✅ |

---

## ☁️ Effortless Cloud Deployment (Vercel & Netlify)

Deploy your own production café POS to the cloud with **zero server management**:

### Option A: Vercel + Neon (Recommended 🏆)
1. **Push to GitHub:** Push your code to your GitHub account.
2. **Import to Vercel:** Open [vercel.com/new](https://vercel.com/new) and select your repository.
3. **Connect Neon Database:** Under **Storage**, add the 1-click **Neon** integration (or supply a `DATABASE_URL` with a pooled connection string from [neon.tech](https://neon.tech)).
4. **Deploy:** Click **Deploy**. Tables, immutability triggers, and fiscal counters self-provision on first load!

### Option B: Netlify + Supabase / Neon
1. Import your repository at [app.netlify.com](https://app.netlify.com).
2. Set the environment variable:
   ```env
   DATABASE_URL=postgres://user:password@host:port/database?sslmode=require
   ```
3. Click **Deploy**.

> 📖 **Full Cloud Deployment Guide:** Read [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for step-by-step instructions.

---

## 🐳 Self-Hosted Appliance Deployment (Docker Compose)

For cafés requiring 100% on-premise data sovereignty or local server appliances:

```bash
# Clone the repository
git clone https://github.com/VasavDotJS/XPRSO-beta.git
cd XPRSO-beta

# Start the complete production stack
docker compose up -d --build
```

### Self-Hosted Architecture
* **`app`:** Production Next.js server running in an unprivileged, hardened container.
* **`db`:** PostgreSQL 17 Alpine on persistent Docker volume storage (`postgres_data`).
* **`caddy`:** Reverse proxy managing automated HTTPS TLS certificates via Let's Encrypt.
* **`backup`:** Daily automated PostgreSQL database dumps compressed at 03:00 AM with rolling 14-day retention.

Verify system health:
```bash
curl http://localhost/health
# {"status":"healthy","database":"connected","version":"1.0.0"}
```

---

## 💻 Local Developer Quickstart

### Prerequisites
- Node.js 20+ & pnpm v10+
- Docker (for local PostgreSQL container)

### 1. Setup Environment
```bash
cp .env.example .env
pnpm install
```

### 2. Start Database & Run Migrations
```bash
# Start local postgres container
docker compose up -d db

# Run schema migrations and create database immutability triggers
pnpm db:migrate
```

### 3. Enroll Your Business
Open `http://localhost:3000` in your browser. The first-run onboarding screen will guide you through creating your café profile and initial Administrator account.

Alternatively, create an administrator via the CLI:
```bash
pnpm cli create-admin --username admin --name "Cafe Owner" --password "Admin@123" --pin "1234"
```

### 4. Start Development Server
```bash
pnpm dev
```
Visit `http://localhost:3000` to start taking orders.

---

## 🧪 Comprehensive Verification & Test Suite

XPRSO features an automated test battery with 100% passing tests covering pure domain tax mathematics, Argon2id encryption, SQL aggregation queries, invoice settlement, and browser E2E flows:

```bash
# Run unit & integration test suite (Vitest)
pnpm test

# Run browser E2E tests (Playwright)
pnpm test:e2e

# Run type checking and production build
pnpm build
```

---

## 🛡️ Security & Privacy Engineering

- **Argon2id Hashing:** Password and PIN hashes use `@node-rs/argon2` with tuned memory-cost parameters.
- **Serverless-Safe Challenges:** WebAuthn challenges are persisted with atomic single-use deletes (`DELETE ... WHERE expires_at > now() RETURNING ...`) so biometrics work seamlessly across stateless serverless lambdas.
- **Strict CSRF Enforcement:** Verifies W3C `Sec-Fetch-Site` headers and origin validation across state-changing HTTP requests.
- **Connection Pool Hygiene:** Global pool reuse (`globalThis.__pgPool`) prevents exhaustion of cloud PostgreSQL database slots.
- **Database Immutability Engine:** Triggers reject any `UPDATE` or `DELETE` statements on settled order tickets and invoice lines.

---

## 📂 Project Structure

```
├── app/                        # Next.js 15 App Router (Pages, API routes)
│   ├── (auth)/login/           # Staff login & passkey authentication
│   ├── account/security/       # Staff biometric passkey enrollment
│   ├── admin/                  # Elevated admin panel (menu, tax, reports)
│   ├── api/                    # REST endpoints with session & CSRF guards
│   ├── order/                  # High-speed touch order screen
│   ├── orders/                 # Order history, settlement, receipts
│   └── setup/                  # First-run café enrollment wizard
├── docs/
│   ├── design-brief.md         # Visual design tokens & palette specification
│   └── DEPLOYMENT.md           # Step-by-step cloud deployment guide
├── public/                     # Icons, PWA manifest, font assets
├── src/
│   ├── domain/                 # Pure domain business logic (tax, invoice)
│   └── server/                 # Server modules (auth, db, export, analytics)
├── tests/
│   ├── integration/            # Analytics, admin, auth, and settlement tests
│   └── unit/                   # Tax engine, CSRF, and WebAuthn tests
├── DECISIONS.md                # Architectural decision log (ADR)
├── docker-compose.yml          # Production self-hosted appliance compose
├── netlify.toml                # Netlify deployment configuration
└── vercel.json                 # Vercel deployment configuration
```

---

## 📄 License & Credits

Built with precision for café owners and hospitality teams.  
Released under the **MIT License**.

All technical design trade-offs and rationale are tracked in [`DECISIONS.md`](DECISIONS.md). For inquiries, support, or custom integrations, open an issue in the GitHub repository.
