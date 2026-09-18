# Campus-Swap
A web platform where university students exchange skills and items without money — "I'll teach you Python if you fix my bike." Users list offers ("I can: edit videos") and requests ("I need: math tutoring"), and a matching engine pairs compatible people, then handles scheduling and reputation.

## Status

Single-deployable TypeScript modular monolith
([ADR-0001](docs/architecture/adr/0001-typescript-fullstack-monolith.md)),
MySQL/MariaDB as primary datastore ([ADR-0002](docs/architecture/adr/0002-mysql-primary-datastore.md))
— domain seams are in-process; repositories are interfaces with in-memory
adapters so MySQL can back them later without seam changes.

**Phase 1 implemented** (Identity + Listings + Public Discovery — roadmap J0–J2,
backlog BL-01..BL-06): visitor browses/searches KFS listings; member signs up
and publishes Offer/Request.

**Phase 2 implemented** (Proposals + Exchange + Scheduling + Completion —
roadmap J3–J4, backlog BL-07..BL-10): capped proposals (5 open max, lock at
cap) → accept/decline/withdraw/7-day expiry → auto-pause on accept →
Scheduled exchange (Cairo time + place, public-spot nudge) → two-step
completion / cancellation with reason → participant text thread → block/mute.

**Phase 3 implemented** (Reviews + Reports + Moderation + Notifications —
roadmap J5–J6, backlog BL-11..BL-14): blind bilateral reviews + response +
aggregate; report flow with reason codes + triage states; moderation sanctions
(hide/warn/suspend/ban) with audit log; stolen-item hide-first + approved
handover; in-app notification inbox (no email); retention clocks + case-gated
moderator reads.

**Phase 4 implemented** (Pilot Hardening & Launch — roadmap Phase 4, backlog
BL-15..BL-18): D12 metrics + progress tracking; launch-gate evaluator (NFR
§10, fails closed on human attestations); disclaimer-presence + Cairo-label
audits; per-seam health check; backup/restore snapshot round-trip. Manual
UI audits (keyboard, contrast, screen reader) and Terms authorship remain
human-owned attestations — no UI exists in this repo yet.

What works (vertical slice):

- Visitor browses/searches KFS listings without login; actions show a login CTA.
- Member signs up (any email + campus default `KFS University` + 18+ check +
  rules accept) and publishes Offer/Request (skill/item, lend/give/swap).
- Exit criteria: SC-1 (signup → first listing < 3 min) and SC-2 (logged-out
  browse with login-gated actions) verified by manual walkthrough.

## Quickstart

Requires Node 24+.

```bash
npm install
npm test        # domain seam + journey tests (node:test via tsx)
npm run typecheck
```

## Run the web app locally (U2: browse/auth/publish + proposals/exchanges)

Requires Docker (self-hosted MySQL for the pilot).

```bash
docker compose up -d mysql
# Fresh database: apply the schema once —
docker exec -i campuswap-mysql mysql -ucampuswap -pcampuswap campuswap < db/schema.sql
# Existing U1 database: apply only the additive U2 tables (proposals, exchanges, messages, holds) —
docker exec -i campuswap-mysql mysql -ucampuswap -pcampuswap campuswap < db/migrations/002-u2-tables.sql
# Existing U2 database: apply only the additive U3 tables (reviews, reports, sanctions, voids, handovers, open_cases, notifications) —
docker exec -i campuswap-mysql mysql -ucampuswap -pcampuswap campuswap < db/migrations/003-u3-tables.sql
npm run seed --prefix web   # demo members (maya@kfs.edu.eg, jonas@gmail.com / password1) + listings + a completed demo exchange with bilateral reviews + an open demo report; jonas becomes moderator (bootstrap, first run only)
npm run dev --prefix web    # http://localhost:3000
```

`web/.env.local` holds `MYSQL_URL` (gitignored; see `web/.env.example`).
Optional `MODERATION_OWNER_ID` (user id of the platform owner) enables
law-enforcement handover approval; unset → handover stays unavailable by
design (escalate reports `not-configured`). Test/moderator accounts are
dev-only fixtures, never production roles.
U1 verified end-to-end in headless Chromium: logged-out browse + search +
login-gated actions (SC-2), signup → first published listing (SC-1),
duplicate-email field error, profile without email leak. Disclaimer + Terms
link on signup and listing create; all datetimes labeled Cairo time.
U2 verified via live-server walkthrough: propose → accept (auto-pause) →
Cairo schedule + safety nudge → Done → Confirm → Completed, cancellation with
reason, participant thread, cap-5 rejection, Locked indicator, 404 on
non-participant reads; full loop also covered by `tests/mysql-exchanges.test.ts`.
Proposal expiry + Done auto-complete run as a lazy in-process sweep on
proposal/exchange reads (no scheduler yet — U4/post-MVP); the notification
inbox lands in U3, so domain events are not persisted.

## Layout

```text
src/
  common/      # Result<T> / FieldError — one error shape everywhere
  policy/      # category taxonomy, prohibited-class screen, disclaimers
  identity/    # register/authenticate/profile (repo seam: store.ts)
  listings/    # publish/update/lifecycle + public search/detail (repo seam: store.ts)
tests/         # one suite per seam, TDD red-green
docs/
  requirements/ project-management/ architecture/ security/ testing/
```

## Docs

- Requirements (v2 baseline): `docs/requirements/`
- Roadmap + backlog: `docs/project-management/`
- Architecture + ADRs: `docs/architecture/`
- Test strategy: `docs/testing/test-strategy.md`
- Phase 1 plan: `docs/superpowers/plans/2026-09-17-phase-1-identity-listings-discovery.md`
- Phase 2 plan: `docs/superpowers/plans/2026-09-17-phase-2-proposals-exchanges.md`
- Phase 3 plan: `docs/superpowers/plans/2026-09-17-phase-3-reviews-moderation-notifications.md`
- Phase 4 plan: `docs/superpowers/plans/2026-09-17-phase-4-pilot-hardening.md`

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before changing code.
