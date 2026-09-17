# CampusSwap — Test Strategy

> Product rule (per `AGENTS.md`): every behavioral change carries tests; no
> validation or security control may be disabled to make work pass.

## Seam tests (Phase 1, implemented)

One suite per module seam, run with `npm test` (`tsx --test`), typechecked
with `npm run typecheck`:

| Suite | Seam | Covers |
|---|---|---|
| `tests/common-errors.test.ts` | `common` error shape | `ok`/`fail` contract |
| `tests/policy.test.ts` | `policy` | fixed taxonomy, one fixture per prohibited class blocked (FR-L-6), benign offer allowed, disclaimers on all 5 flows (NFR-L-1) |
| `tests/identity.test.ts` | `identity.register/authenticate/profile` | any-email signup (gmail/yahoo/KFS), campus default, field-specific 18+/rules/campus errors, duplicate-email reject, email never in profile, scrypt auth, bio ≤500 (FR-ID-1..5, BL-01/02) |
| `tests/listings.test.ts` | `listings.publish/update/transition` | offer+request paths, required-field errors, image caps (items 0–5/skills 0–2), lend-return-term + swap-counterpart rules, 20-active cap (`listing-cap-reached`), owner-only transitions, prohibited fixture blocked (FR-L-1..6, BL-03/04/05) |
| `tests/discovery.test.ts` | `listings.search/detail` | logged-out search, additive filters, keyword match, Active-only, visitor `loginCTA`, compatible = opposite side + same/related category, incompatible-side never suggested (FR-D-1..3, BL-06) |

TDD red-green: each suite was written first and observed failing before its
module was implemented.

## Seam tests (Phase 2, implemented)

| Suite | Seam | Covers |
|---|---|---|
| `tests/cairo-time.test.ts` | `common.formatCairoTime` | `12 Mar 2026, 15:30 Cairo time` label; RangeError on invalid (NFR-U-2) |
| `tests/proposals.test.ts` | `exchanges.propose/respond/withdraw/runExpiry` | reciprocity (one-sided rejected), single-counterparty ownership, 5-open cap + 6th `proposal-cap-reached` + lock status, withdraw by either side, counterparty-only decline, 7-day expiry job, blocked-pair reject (FR-E-1..3, BL-07) |
| `tests/accept.test.ts` | `exchanges.respond(accept)` + `listings.systemPause` | Scheduled exchange created, auto-pause on all referenced listings, counterparty-only accept, second accept `listing-paused` while paused, owner reopen releases, terms frozen (FR-E-2/3, D7 rev.1) |
| `tests/schedule.test.ts` | `exchanges.schedule` | future Cairo time + place, participant-only, invalid/past/missing rejected, public-spot nudge always returned, private place needs safety ack (FR-E-5, BL-08) |
| `tests/completion.test.ts` | `exchanges.markDone/confirm/dispute/runAutoComplete/cancel` | full Done→Confirm loop, self-confirm rejected, schedule-less needs override + reason, dispute → Disputed, 7-day window enforced, auto-complete with log, cancel needs reason code, terminal states final (FR-E-4/6, BL-09) |
| `tests/thread.test.ts` | `exchanges.postMessage/getMessages` + `identity.block/mute` | participant-only post/read, blocked-pair reject, empty/over-long rejected (FR-E-7, FR-M-6, BL-10) |

## Seam tests (Phase 3, implemented)

| Suite | Seam | Covers |
|---|---|---|
| `tests/reviews.test.ts` | `reputation.submitReview/editReview/revealDue` | Completed-only, one-per-participant, score/text validation, pre-reveal invisibility, both-in + 14-day reveal, 48h edit (FR-R-1/2, BL-11) |
| `tests/reviews.test.ts` (aggregate/response/void) | `reputation.aggregate/respondToReview/voidReview` | no reviews on Cancelled, aggregate consistency, one reviewee response, void excludes + logged + immutable (FR-R-3..5, BL-11) |
| `tests/moderation.test.ts` | `moderation.report/triage/sanction/unhide/voidReview` | reason codes, other-needs-20, ≤3 images, Received→Under review→Resolved, hide/unhide lifecycle, suspend blocks login, audit fields (FR-M-1..4, BL-12/13) |
| `tests/moderation.test.ts` (stolen) | `moderation.report/escalate` | hide-first + instant case, handover gated on owner approval, evidence preserved (FR-M-5, BL-13) |
| `tests/notifications.test.ts` | `notifications.emit/inbox` + `lendReminderKind` | one unread item per emit, all 16 FR-N-1 types, zero emails (no transport), T-3d/T+0/T+3d/overdue (FR-N-1, BL-14) |
| `tests/notifications-wiring.test.ts` | cross-module emits | proposal/schedule/completion notifications, no pre-reveal leak, reporter-only updates, void/unhide/handover notices |
| `tests/privacy.test.ts` | `privacy` + `moderation.viewThread` | 12/24-mo retention boundaries, deactivation hides discovery, purpose-scoped thread reads denied+logged/allowed+logged (P-3/P-4) |

## Seam tests (Phase 4, implemented)

| Suite | Seam | Covers |
|---|---|---|
| `tests/metrics.test.ts` | `metrics.computePilotMetrics/pilotProgress` | member/listing/completion/report/sanction/review counts, median triage math, D12 progress met/unmet (BL-18) |
| `tests/launch.test.ts` | `launch.disclaimerAudit/cairoLabelAudit/healthCheck/evaluateLaunchGate` | 5-flow disclaimer presence + Terms + plain language, winter/summer Cairo labels, ok/degraded health, gate fails closed on attestations/moderators (BL-15/17/18) |
| `tests/snapshot.test.ts` | `launch.createSnapshot/restoreSnapshot` | round-trip preserves metrics/login/audit/inbox; unknown versions rejected (BL-18) |

## Manual audits (human-owned, attested in the launch gate)

- Keyboard-only J0–J6 + report pass; disclaimer contrast/readability + screen-reader bar (no UI in repo yet).
- Terms v1 + privacy notice authorship + sign-off; KFS student-affairs consult note (Phase 0, human developer).

## Planned (later phases)

- Phase 3: blind-reveal/response/aggregate, report/triage/sanction/
  handover-gate, inbox emission asserting zero emails (J5–J6).
- Launch gate: keyboard-only run, disclaimer presence on all 5 flows,
  Cairo labeling audit, triage drill with fixture report.
