# Architecture & Implementation Decisions — order-plat (XPRSO)

This document tracks all non-trivial technical choices, schema adaptations, library selections, and design decisions made during implementation.

| # | Date | Decision | Rationale |
|---|---|---|---|
| D-001 | 2026-10-12 | Symlink `inspo -> inspos` | The project files were provided in directory `inspos/`; symlinked to satisfy both `/inspo` references in the spec and the existing folder. |
| D-002 | 2026-10-12 | Design Brief established from `/inspo` (`docs/design-brief.md`) | Follows inspo images: calm monochrome base, obsidian pills for active selections, electric blue (#0066FF) for primary CTA/settle, inset wells for inputs/PIN, dark frosted glass for bottom sheet. |
| D-003 | 2026-10-12 | Next.js 15+ App Router with React 19 and Tailwind CSS v3/v4 | Standard modern production-ready stack for SSR performance, edge compatibility, and rapid design token styling. |
| D-004 | 2026-10-12 | PostgreSQL with Drizzle ORM and `pg` / `postgres-js` | Type-safe SQL close to metal; ideal for complex deterministic analytics queries and transactional locking (`SELECT ... FOR UPDATE`). |
| D-005 | 2026-10-12 | Integer paise for all money + Basis points for rates | Avoids IEEE 754 floating-point inaccuracies; guarantees exact rounding under Indian GST rules. |
| D-006 | 2026-10-12 | Pure domain module in `src/domain/tax` shared between client & server | Enables zero-latency (<100ms) client-side calculations while enforcing server-side recomputation as source of truth. |
| D-007 | 2026-10-12 | Argon2id for password and PIN hashing via `@node-rs/argon2` | Industry standard memory-hard key derivation resistant to GPU/ASIC attacks. |
| D-008 | 2026-10-12 | WebAuthn via `@simplewebauthn/server` and `@simplewebauthn/browser` | Robust, spec-compliant FIDO2/WebAuthn library supporting discoverable passkeys and platform authenticators. |
| D-009 | 2026-10-12 | Server-side PDF generation with `@react-pdf/renderer` & Excel with `exceljs` | Ensures pixel-perfect A4 / 80mm receipts with embedded ₹ font and native numeric cells in Excel. |
| D-010 | 2026-10-12 | `pnpm-workspace.yaml` `onlyBuiltDependencies` for esbuild and @node-rs/argon2 | Required by pnpm v12 for native binary compilation security. |
| D-011 | 2026-10-12 | Milestone 1 completed: Session tokens SHA-256 hashed in DB, 15m rate limits | Protects session tokens from exposure on DB dumps, stops brute force on passwords/PINs. |
| D-012 | 2026-10-12 | Milestone 2 completed: Admin PIN elevation, price history audit, bulk edit | Guarantees price changes affect new order lines only, maintains immutable audit log. |
| D-013 | 2026-10-12 | Milestone 3 completed: Touch-first /order taking screen with live sub-100ms tax totals | Provides instant waiter feedback with optimistic UI and debounced auto-save. |
| D-014 | 2026-10-12 | Milestone 4 completed: Atomic gapless invoice settlement, DB immutability trigger, A4 & 80mm PDF, Excel exports | Enforces Indian GST numbering requirements and prevents retro-active modifications to settled bills. |
| D-015 | 2026-10-12 | FIDO2 WebAuthn Passkeys (`@simplewebauthn`) with discoverable credentials | Enables one-tap Touch ID/Face ID login and admin step-up with clear shared-device tablet caveat. |
| D-016 | 2026-10-12 | Deterministic SQL Analytics with `LEFT JOIN` for zero-sale items | Guarantees transparent sales insights without AI/LLM hallucinations; flags items missing cost prices. |
| D-017 | 2026-10-12 | Auto-save debouncing race guard (`isSettledRef`) and on-demand settlement flush | Prevents database immutability trigger rejections when staff quickly settles an order. |
| D-018 | 2026-10-12 | Conditional `output: standalone` via `DOCKER_BUILD` environment variable | Produces lean minimal Docker containers while providing standard native Node.js runtime for local testing. |
| D-019 | 2026-10-12 | Full Playwright E2E suite, PWA manifest, and rolling 14-day database backup scripts | Delivers deployment-ready production hardening for touch tablets and café operations. |
| D-020 | 2026-10-12 | Serverless database architecture supporting Neon (recommended) & Supabase | Added automatic SSL detection, warm lambda connection pool caching (`globalThis.__pgPool`), and dual `DATABASE_URL`/`POSTGRES_URL` detection for zero-friction Vercel/Netlify deployment. |
| D-021 | 2026-10-12 | Serverless-safe WebAuthn challenge persistence & self-provisioning DB migrations | Stored WebAuthn challenges in Postgres `auth_challenges` with atomic `DELETE ... RETURNING` consumption to work across stateless lambda instances; added `ensureDatabaseReady()` to automatically provision tables on first load without CLI steps. |
| D-022 | 2026-10-12 | Dynamic root page & CI/CD prerender safeguard (`force-dynamic`) | Enforced `force-dynamic` on `app/page.tsx` with resilient error handling around database status checks. Prevents SSG prerender crashes (exit code 2) on Netlify/Vercel when deploying against fresh or uninitialized remote databases. |

