# Campus-Swap
A web platform where university students exchange skills and items without money — "I'll teach you Python if you fix my bike." Users list offers ("I can: edit videos") and requests ("I need: math tutoring"), and a matching engine pairs compatible people, then handles scheduling and reputation.

## Status

**Phase 1 implemented** (Identity + Listings + Public Discovery — roadmap J0–J2,
backlog BL-01..BL-06). Single-deployable TypeScript modular monolith
([ADR-0001](docs/architecture/adr/0001-typescript-fullstack-monolith.md)),
MySQL/MariaDB as primary datastore ([ADR-0002](docs/architecture/adr/0002-mysql-primary-datastore.md))
— domain seams are in-process; repositories are interfaces with in-memory
adapters so MySQL can back them later without seam changes.

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

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) before changing code.
