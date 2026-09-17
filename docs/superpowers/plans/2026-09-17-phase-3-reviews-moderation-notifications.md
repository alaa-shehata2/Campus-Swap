# Phase 3 — Reviews + Reports + Moderation + Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Phase 3 vertical slice (roadmap J5–J6: blind bilateral reviews + response + aggregate; report flow with reason codes + triage states; moderation actions audit-logged; stolen-item hide-first + approved handover; in-app notification inbox) covering FR-R-1..5, FR-M-1..5, FR-N-1, P-3/P-4 (backlog BL-11..BL-14). Closes #28, #29, #30, #31.

**Architecture:** Four new modules behind arch §2 verbs. `reputation` reads exchanges via internal `readExchange` (Completed + participants). `moderation` drives `listings.systemHide` (new `Hidden` state, auto-excluded from Active-only search, owner transitions rejected), `identity.restrict` (suspend/ban enforced at authenticate), `reputation.voidReview`, and privacy case-gating for thread evidence (`exchanges.readThread` internal). `notifications` is a standalone sink. Jobs are pure clock functions. Stacked on Phase 2 branch (PR #27).

**Tech Stack:** TypeScript 5.x, `node:test` via tsx, `tsc --noEmit`. No new dependencies.

**Spec:** functional-requirements §§5–6, NFR P-3/P-4 + S-5, arch §§2/4/6, backlog BL-11..BL-14, roadmap Phase 3 exit (SC-4).

## Global Constraints

- Same `Result`/`FieldError` shape; SC-4: pre-reveal invisibility, every report transitions states, handover without owner approval impossible.
- Reviews: one 1–5 + ≤1000 text per participant, only on Completed, no self-review; blind until both-in or 14d; 48h edit; one ≤1000 response w/ 48h edit; aggregate average+count+distribution+history; voids logged, no silent edits.
- Reports: reason codes, ≥20 chars for `other`, ≤3 images; `Received → Under review → Resolved`; reported party notified only on action (i.e. sanction/void emit, mere report does not).
- Sanctions hide/warn/suspend/ban with actor+reason+timestamp; stolen hide-first + owner-approved handover with preserved evidence; no delete APIs anywhere (post-escalation deletion blocked by construction).
- Notifications in-app only; one unread item per emit; zero emails (asserted by absence of any mail transport).
- Retention: 12-mo messages/proposals, 24-mo logs, then anonymize; moderator reads only on open case + logged; deactivation hides immediately.
- Every behavior has tests (AGENTS.md).

---

### Task 1: reputation submit/edit/blind reveal (BL-11, #28)

**Files:** Create `src/reputation/{types,store,service}.ts`; Test `tests/reviews.test.ts`.

Produces: `submitReview(reviewerId, exchangeId, {score, text?})`, `editReview`, `getReview(viewerId, id)` (visible if Published or viewer is reviewer), `revealDue(nowMs)` (both-in or 14d after earliest submit → Published).

- [ ] Failing tests (Completed-only, one-per-participant, score/text validation, pre-reveal invisibility to counterparty, both-in reveal, 14d reveal) → FAIL → implement → PASS → commit `feat(reputation): blind bilateral reviews (BL-11 part)`.

### Task 2: aggregate + response + void (BL-11, #28)

Produces: `aggregate(userId)` (average+count+distribution+history over Published non-voided), `respondToReview(revieweeId, id, {text})` + edit (48h, one only), `voidReview(by, id, reason)` (status Voided + void record; no silent path — no other mutation API).

- [ ] Tests (no review on Cancelled/Disputed, no self-review structurally, aggregate consistency, one response, void excludes from aggregate) → FAIL → implement → PASS → commit `feat(reputation): aggregate, response, void (BL-11)`.

### Task 3: reports + triage + sanctions + audit (BL-12/13, #29/#30)

**Files:** Create `src/moderation/{types,store,service}.ts`; Modify `src/listings` (+`Hidden` state, `systemHide`/`systemUnhide→Paused`, owner transitions rejected from Hidden), `src/identity` (+`restrict`, `deactivate`; authenticate enforces; profile exposes restriction badge + hides deactivated); Tests `tests/moderation.test.ts`.

Produces: `report`, `triage(id, modId, 'acknowledge'|'resolve')`, `sanction` (hide/warn/suspend/ban + audit), `unhide`, `auditLog()`.

- [ ] Tests (reason codes, other-needs-20, ≤3 images, state transitions, hide removes from search, suspend blocks login, audit fields) → FAIL → implement → PASS → commit `feat(moderation): reports, triage, sanctions + audit (BL-12/13 part)`.

### Task 4: stolen hide-first + approved handover (BL-13, #30)

Produces: stolen-good reports auto-`systemHide` + instant Under review + open case; `escalate(reportId, modId, {ownerApproved})` → `handover-approval-required` unless true; handover log entry preserves report snapshot; resolve closes case.

- [ ] Tests (hide-first, handover impossible without approval, evidence preserved) → FAIL → implement → PASS → commit `feat(moderation): stolen hide-first + approved handover (BL-13)`.

### Task 5: notifications inbox (BL-14, #31)

**Files:** Create `src/notifications/{types,service}.ts`; Test `tests/notifications.test.ts`.

Produces: `emit(userId, type, ref)`, `inbox(userId)`, `unreadCount`, `markRead`/`markAllRead`, `lendReminderKind(returnDateMs, nowMs)` pure helper; no mail transport (test asserts `sendEmail` absent and every emit lands in inbox).

- [ ] Tests → FAIL → implement → PASS → commit `feat(notifications): in-app inbox (BL-14)`.

### Task 6: privacy retention + case-gated reads (P-3/P-4)

**Files:** Create `src/privacy/service.ts`; Modify `src/exchanges` (+`readExchange`, `readThread` internals), `src/moderation` (+`viewThread` via privacy gate); Tests `tests/privacy.test.ts`.

Produces: `dueForAnonymization('message'|'log', refMs, nowMs)`, `anonymizeText()`, `checkCaseAccess(modId, hasOpenCase)` (+access log), `viewThread` denied+logged without open case.

- [ ] Tests (12/24-mo boundaries, deny+log, allow+log, deactivation hides profile/listings/auth) → FAIL → implement → PASS → commit `feat(privacy): retention + case-gated reads (P-3/P-4)`.

### Task 7: docs + verification + PR

- [ ] README, test-strategy, CHANGELOG; `npm test` green + `tsc` clean (evidence); subagent review, fix Critical/Important; push; PR vs `main` stacked on #27 with `Closes #28-31`. Merge needs human.
