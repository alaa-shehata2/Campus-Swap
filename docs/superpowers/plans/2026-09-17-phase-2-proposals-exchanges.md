# Phase 2 — Proposals + Exchange + Scheduling + Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Phase 2 vertical slice (roadmap J3–J4: capped proposals → accept → schedule → two-step completion, plus text thread and block/mute) covering FR-E-1..7, FR-M-6 (backlog BL-07..BL-10).

**Architecture:** New deep module `exchanges` (proposals, exchanges, messages, holds) behind ~9 verbs, depending on `listings` + `identity` seams. `identity` gains block/mute store; `listings` gains `systemPause` for system auto-pause on accept (arch §4 allows owner transitions plus system auto-pause). Time duties (`runExpiry`, `runAutoComplete`) are pure functions of an injected clock. Stacked on Phase 1 branch (PR #26).

**Tech Stack:** TypeScript 5.x, `node:test` via tsx, `tsc --noEmit`. No new dependencies.

**Spec:** `docs/requirements/functional-requirements.md` §§4/6 (FR-E-1..7, FR-M-6, edge cases §10.4), `docs/architecture/architecture.md` §§2–4, backlog BL-07..BL-10, roadmap Phase 2 exit criteria.

## Global Constraints

- Same `Result`/`FieldError` shape; field-specific validation errors (NFR-U-3).
- Proposal: ≥1 listing per side, terms text required, one-sided rejected (FR-E-1, BR-2).
- Lifecycle `Proposed → Accepted|Declined|Expired|Withdrawn`; 7-day expiry; withdraw any time pre-accept by either side (FR-E-2).
- Max 5 open per listing; 6th rejected `proposal-cap-reached` + guidance; Locked is derived; accept auto-pauses referenced listings; other pendings read-only until reopen/decline; terms freeze on accept (FR-E-3, D7 rev.1).
- Exchange `Scheduled → Completed|Cancelled|Disputed`; cancel needs reason; schedule needs Cairo-labeled time + place + safety nudge; private place needs safety ack (FR-E-4/5).
- Completion: Done-mark → Confirm/Dispute ≤7 days → auto-complete on silence; schedule-less completion needs override + reason (FR-E-6).
- Participant-only plain-text thread; block/mute stops proposals/messages (FR-E-7, FR-M-6).
- Every behavior has tests; no validation/security control disabled (AGENTS.md).

---

### Task 1: common Cairo time + identity block/mute

**Files:** Create `src/common/cairoTime.ts`; Modify `src/identity/service.ts`, `src/identity/types.ts`; Test `tests/cairo-time.test.ts`, extend `tests/identity.test.ts`.

**Interfaces:** Produces `formatCairoTime(iso: string): string` (`12 Mar 2026, 15:30 Cairo time`, throws `RangeError` on invalid); `block(userId, blockedId)`, `mute(userId, mutedId)`, `unblock`, `unmute`, `isBlockedOrMuted(a, b): boolean` (symmetric; self-block rejected).

- [ ] Step 1: failing tests (format known instant; block/mute round-trip + enforcement hook presence).
- [ ] Step 2: run, expect FAIL. Step 3: minimal implementation. Step 4: run, expect PASS. Step 5: commit `feat(identity): block/mute + Cairo time helper`.

### Task 2: proposals — propose/respond/withdraw/expiry + cap + lock

**Files:** Create `src/exchanges/types.ts`, `src/exchanges/store.ts`, `src/exchanges/service.ts` (propose/respond/withdraw/runExpiry/lockStatus); Test `tests/proposals.test.ts`.

**Interfaces:** Consumes listings service (`get`), identity service (`isBlockedOrMuted`). Produces `propose(proposerId, { sideAListingIds, sideBListingIds, terms }, listings, identity): Result<Proposal>`; `respond(userId, proposalId, 'accept'|'decline')` (accept path stubbed to reject `not-implemented` until Task 3 — NO, implement accept in Task 3; this task: decline only? Simpler: implement respond-accept fully in Task 3; Task 2 respond handles decline, accept returns `not-ready`? Avoid dead code: Task 2 implements propose/withdraw/decline/expire/cap; Task 3 adds accept). `withdraw(userId, id)`, `runExpiry(now)`, `lockStatus(listingId): { openCount, locked }`.

Rules: ≥1 listing/side; all Active; sideA owned by proposer, sideB by single counterparty ≠ proposer; terms non-empty; blocked pair rejected (`blocked`); 5-open cap per referenced listing (`proposal-cap-reached` + guidance); withdraw pre-accept by either party; decline by counterparty only; expiry flips Proposed→Expired after 7d.

- [ ] Step 1: failing tests (one-sided rejected; 5 coexist + 6th rejected with code; withdraw by either side; decline; expiry job; lockStatus). Step 2: FAIL. Step 3: implement. Step 4: PASS. Step 5: commit `feat(exchanges): capped proposals with expiry (BL-07 part)`.

### Task 3: accept + auto-pause + holds + terms freeze

**Files:** Modify `src/exchanges/service.ts`, `src/listings/service.ts` (+`systemPause`); Test extend `tests/proposals.test.ts` (or `tests/accept.test.ts`).

Produces: `respond` accept path → creates `Exchange{status:'Scheduled'}` + `systemPause` on all referenced listings + holds recorded; second accept on held listing rejected (`listing-paused`); reopen (owner `reopen` transition) releases hold lazily; terms immutable (no update API; test asserts terms survive accept unchanged).

- [ ] Failing tests → FAIL → implement → PASS → commit `feat(exchanges): accept with auto-pause + proposal-cap lock (BL-07)`.

### Task 4: schedule + place + safety nudge (BL-08)

Produces: `schedule(userId, exchangeId, { at, place, acknowledgedSafetyReminder? })`: participants only; `at` valid ISO + future (`schedule-invalid`/`schedule-past`); place required; always returns `safetyNudge` text; private-residence pattern without ack → `safety-ack-required`; stored schedule labeled via `formatCairoTime`.

- [ ] Tests → FAIL → implement → PASS → commit `feat(exchanges): Cairo scheduling with safety nudge (BL-08)`.

### Task 5: completion + cancellation (BL-09)

Produces: `markDone`, `confirm` (other party only), `dispute` (other party, ≤7d), `runAutoComplete(now)` (7d silence → Completed + log entry), `cancel(userId, id, { reason, detail? })` (reason codes no-show/conflict/item-unavailable/safety-concern/other; participants only); schedule-less markDone needs `{ overrideReason }` else `schedule-required`.

- [ ] Tests → FAIL → implement → PASS → commit `feat(exchanges): two-step completion + cancellation (BL-09)`.

### Task 6: thread + block/mute enforcement (BL-10)

Produces: `postMessage(senderId, exchangeId, text)`: participants only (`not-participant`), plain text ≤2000, blocked-pair rejected (`blocked`); `getMessages(viewerId, exchangeId)` participant-only. Propose also re-checked (already in Task 2).

- [ ] Tests → FAIL → implement → PASS → commit `feat(exchanges): participant thread (BL-10)`.

### Task 7: docs + verification + PR

- [ ] README status, test-strategy append, CHANGELOG entry.
- [ ] `npm test` all green + `tsc --noEmit` clean (record evidence).
- [ ] Subagent code review; fix Critical/Important.
- [ ] Push, open PR against `main` (note: stacked on #26, merge #26 first), report URL. Merge needs human (READ-only token + AGENTS.md).
