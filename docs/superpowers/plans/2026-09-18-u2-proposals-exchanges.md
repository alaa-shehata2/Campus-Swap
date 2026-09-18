# U2 Web — Proposals/Exchanges/Schedule/Complete + Thread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the Phase 2 vertical slice in the browser locally: member proposes on a listing (≥1 listing/side + terms) → counterparty accepts/declines/withdraws (cap 5, Locked indicator, 7-day expiry) → accept auto-pauses → schedule (Cairo time + place + safety nudge) → two-step completion / cancellation with reason → participant text thread. Served by the existing Next.js + Tailwind app against self-hosted MySQL, reusing the `exchanges` domain seam unchanged. Phase 5 U2 of `docs/project-management/plan-to-launch.md`.

**Architecture:** `web/lib/db/repositories.ts` gains `MySqlExchangesStore` with full API parity to in-memory `ExchangesStore` (proposals, exchanges, messages, holds tables); `MySqlListingsStore` gains `systemPause` (same semantics as `src/listings/service.ts:329`); `web/lib/services.ts` gains `exchanges()` wired with ListingsPort/IdentityPort adapters over the MySQL stores. Server Actions mutate via services; no client-side secrets. Expiry/auto-complete run as a lazy sweep at the start of proposal/exchange reads (in-process, no new infra — settles plan-to-launch decision 3 for U2; a real scheduler is U4/post-MVP). No notify sink in U2 (notification inbox is U3; domain `notify?` stays unset).

**Tech Stack:** Next.js 15, React 19, Tailwind CSS, mysql2, docker compose (mysql:8.4). No new dependencies.

**Spec:** FR-E-1..7, FR-M-6; NFR-U-2/3, NFR-L-1; arch §§2–4 (exchanges verbs, lifecycles); backlog BL-07..BL-10; roadmap Phase 2 exit criteria.

## Global Constraints

- Same `Result`/`FieldError` shape; field errors render next to fields (NFR-U-3).
- Proposal rules identical to domain: ≥1 listing/side, terms required, single counterparty, Active-only, ownership sides, block/mute rejected, 5-open cap (`proposal-cap-reached` + guidance + Locked indicator), withdraw pre-accept by either side, decline by counterparty only, 7-day expiry.
- Accept auto-pauses all referenced listings; second accept on held listing rejected (`listing-paused`); terms freeze (no edit UI).
- Schedule: Cairo-labeled future time + place required; safety nudge always shown; private-residence pattern requires ack checkbox (`safety-ack-required`); schedule immutable after Done-marked.
- Completion: Done-mark → Confirm/Dispute ≤7 days → silence auto-completes (lazy sweep); cancel needs reason code; schedule-less Done needs explicit override + reason.
- Thread: participant-only plain text ≤2000; non-participant denied (redirect + notice, no leak).
- Disclaimers on proposal-accept + schedule-confirm + item-lend flows (BL-15); Cairo labels on all datetimes (NFR-U-2); login CTA for visitors (SC-2).
- `.env.local` never committed; migration is additive SQL (no data loss on existing U1 rows).

---

### Task 1: migration + MySqlExchangesStore + systemPause

**Files:** Modify `db/schema.sql` (new tables; also add to U1 `truncateWorld` order); Modify `web/lib/db/repositories.ts` (`MySqlExchangesStore` + `systemPause` on listings store); Test `tests/mysql-exchanges.test.ts` (skeleton first → FAIL).

- [ ] Write failing integration test (register → publish ×2 → propose → accept → schedule → markDone → confirm through MySQL stores; skips only if `MYSQL_URL` unreachable — else FAIL).
- [ ] `docker compose up -d mysql`; add `proposals` / `exchanges` / `messages` / `holds` tables; implement store with full API parity (`insertProposal/getProposal/saveProposal/openProposalsForListing/proposedOlderThan/doneMarkedOlderThan/insertExchange/getExchange/saveExchange/hold/heldBy/release/insertMessage/messagesFor`); `systemPause` sets `Paused` iff `Active` (mirrors domain error shape via service, store just persists).
- [ ] Tests PASS; commit `feat(db): mysql exchanges repos behind domain seam (U2)`.

### Task 2: services wiring + proposal routes

**Files:** Modify `web/lib/services.ts` (add `exchanges()` + lazy `runExpiry` sweep helper); Create `web/app/proposals/page.tsx`, `web/app/proposals/new/page.tsx`, `web/app/proposals/[id]/page.tsx`; Modify `web/app/actions.ts` (`proposeAction/respondAction/withdrawAction`); Modify `web/app/listings/[id]/page.tsx` (replace U2 placeholder with propose CTA + lock status).

- [ ] Proposals inbox (sent/received via store scan scoped to viewer — participant-gated reads only); propose form (own-listing picker sideA + counterparty listing sideB + terms + disclaimer); detail with accept/decline/withdraw buttons + accept-side disclaimer; 6th-proposal + second-accept + one-sided failures render domain messages; lock indicator (`Not accepting new proposals — N pending`) on listing detail.
- [ ] Manual walkthrough: propose → decline path + propose → withdraw path + cap rejection visible.
- [ ] Commit `feat(web): U2 proposal routes (propose/respond/withdraw, cap + lock)`.

### Task 3: schedule + completion routes

**Files:** Create `web/app/exchanges/[id]/page.tsx`; Modify `web/app/actions.ts` (`scheduleAction/markDoneAction/confirmAction/disputeAction/cancelAction` + lazy `runAutoComplete` sweep).

- [ ] Schedule form (datetime-local + place + safety nudge + conditional ack checkbox + disclaimer); completion panel (Done-mark with override-reason field when unscheduled; Confirm/Dispute for the other party; Cancel with reason select + detail); Cairo labels on schedule/log times; schedule-less completion without override rejected with reason shown.
- [ ] Manual walkthrough: accept → schedule → Done → Confirm = Completed; second exchange Cancelled with reason.
- [ ] Commit `feat(web): U2 schedule + two-step completion + cancellation`.

### Task 4: thread + seed + polish

**Files:** Modify `web/app/exchanges/[id]/page.tsx` (thread section), `web/app/actions.ts` (`postMessageAction`); Modify `web/db/seed.ts` (demo proposal + scheduled exchange + thread messages, idempotent); Modify listing detail (compatible section unchanged).

- [ ] Participant-only thread (post + list, ≤2000, blocked-pair message rejected with notice); non-participant exchange URL → not-found (no leak); seed runnable via `npm run seed --prefix web`.
- [ ] Screenshots (proposals inbox, proposal detail, exchange detail with schedule + thread) saved to `/tmp/opencode`; self-review for contrast/labels/focus.
- [ ] Commit `feat(web): U2 participant thread + demo seed`.

### Task 5: verify + PR

- [ ] `npm test` (root) + `tsc` + `next build` + `next lint` (evidence); subagent review; fix Critical/Important; push; PR vs `main` with U2 summary. Merges skipped per standing instruction.

---

## Review deviations (recorded, all intentional)

- `systemPause` lives on the listings *service* (`web/lib/services.ts` adapter) rather than on `MySqlListingsStore` — keeps validation in the service layer; store stays persistence-only.
- New `tests/mysql-exchanges.test.ts` has no `MYSQL_URL`-unreachable skip (matches U1 `mysql-repos.test.ts` convention; CI/dev guarantee MySQL via compose).
- No Playwright screenshots: no browser tooling in this environment; verified via live-server walkthrough (anon gates, authenticated inbox/forms/detail/thread, 404s) with curl + session cookie, plus the MySQL integration suite through the same services the routes call.
- Follow-ups for U3+: scoped `proposalsForUser` query + indexes (inbox currently filters `exportState()` in memory — no leak, but O(table)); cancel-inside-confirm-window semantics (domain currently lets `cancel` win over pending Confirm/Dispute); post-to-resolved-thread semantics (form hidden when not Scheduled, domain `postMessage` has no status check).
