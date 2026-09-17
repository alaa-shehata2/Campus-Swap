# U1 Web — Browse/Auth/Publish (Next.js + Tailwind, local MySQL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run CampusSwap in the browser locally: visitor browses/searches KFS listings; member signs up/logs in/publishes Offer/Request — served by Next.js + Tailwind on a local server against self-hosted MySQL (docker compose), reusing the existing domain seams unchanged. Closes #40.

**Architecture:** `web/` Next.js App Router app imports domain from `../src` (relative imports, verified by `next build`). MySQL repos (`web/lib/db/*`) implement the same store APIs as the in-memory stores, so services run unmodified. Server-side sessions in a `sessions` table + httpOnly cookie. Server Actions mutate via services; no client-side secrets.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, mysql2, docker compose (mysql:8.4). Node 24.

**Spec:** FR-ID-1..5, FR-L-1..6, FR-D-1..3; NFR-U-2/3, NFR-L-1; arch §2 (identity/listings/policy) + §4 lifecycles; ADR-0002 (MySQL).

## Global Constraints

- Same `Result`/`FieldError` shape; field errors render next to fields (NFR-U-3).
- Any email; campus default KFS; 18+ + rules gates; scrypt passwords (shared crypto, no new dep).
- Listing validation identical to domain (caps, modalities, prohibited, 20-cap).
- Disclaimers on signup + listing create (BL-15); Cairo labels on datetimes (NFR-U-2); login CTA for visitors (SC-2).
- `.env.local` never committed (gitignored); compose volume persists data.

---

### Task 1: compose + schema + crypto extract

**Files:** Create `docker-compose.yml`, `db/schema.sql`, `web/.env.example`; Modify `src/identity/crypto.ts` (new), `src/identity/store.ts` (use it); Test `tests/mysql-repos.test.ts` (skeleton first → FAIL).

- [ ] Write failing integration test (register→publish→search through MySQL stores; skips only if `MYSQL_URL` unreachable — else FAIL).
- [ ] `docker compose up -d mysql`; create schema; extract crypto; implement `web/lib/db/mysql.ts` (pool), `repositories.ts` (MySqlIdentityStore, MySqlListingsStore with full API parity).
- [ ] Tests PASS; commit `feat(db): mysql schema + repos behind domain seams`.

### Task 2: Next scaffold + auth shell

**Files:** `web/` (`package.json`, `next.config.ts`, `tailwind`, `app/layout.tsx`, `app/page.tsx` placeholder, `lib/auth.ts`, `lib/services.ts`, `lib/actions.ts` signup/login/logout).

- [ ] `npx create-next-app` equivalent minimal by hand (avoid interactive); `next build` proves `../src` imports compile.
- [ ] Cookie session helpers + header with session state; login/logout round-trip test via Playwright (or route test).
- [ ] Commit `feat(web): next.js scaffold + session auth shell`.

### Task 3: U1 routes (browse/detail/signup/login/publish/profile)

**Files:** `web/app/**`, `web/components/**` (SearchForm, ListingCard, Disclaimer, FieldError, LoginCTA).

- [ ] Browse + filters + detail + compatible + visitor CTA; signup/login forms with field errors + disclaimers; publish form with modality rules + disclaimer; profile view/edit (bio cap, self-declared label, never email).
- [ ] Playwright walkthrough: SC-1 (signup → first listing) + SC-2 (logged-out browse, action prompts login).
- [ ] Commit `feat(web): U1 browse/auth/publish routes`.

### Task 4: seed + run + show

**Files:** `web/db/seed.ts`, `web/package.json` script, README quickstart section.

- [ ] Seed demo members + listings (idempotent); `docker compose up -d`; `npm run dev --prefix web`.
- [ ] Playwright screenshots (home, detail, signup, publish) saved to `/tmp/opencode`; self-review UI for contrast/labels/focus.
- [ ] Commit `chore(web): seed + local run docs`.

### Task 5: verify + PR

- [ ] `npm test` (root, 119+) + repo integration tests + `tsc` + `next build` + `next lint` (evidence); subagent review; fix Critical/Important; push; PR vs `main` with `Closes #40`. Merges skipped per standing instruction.
