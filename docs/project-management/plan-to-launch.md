# Plan to Launch (and Beyond)

> Status: living plan. Phases 1–4 are implemented and in open PRs; Phase 0
> is human-owned; the web UI is new scope (Phase 5); Post-MVP is unordered.
> Source of truth for requirements: `docs/requirements/` (v2 baseline).

## A. Land the stack (owner, 1 session)

Four open PRs, each stacked on the previous. Merge in order, rebasing each
onto the new `main` as you go:

1. **#26** Phase 1 (closes #20–25) → 2. **#27** Phase 2 → 3. **#32** Phase 3
   (closes #28–31) → 4. **#37** Phase 4 (closes #33–36).

Merging needs repository write access (the agent token is READ-only, and
`AGENTS.md` reserves merges to the human developer). If a rebase conflicts,
hand the PR number back for resolution.

## B. Resolve `wip/incoming-uncommitted-changes` (owner decision, before UI work)

Contents (tested, 112 tests green at preservation time): haram-content
screening, listing `availability`, session expiry, `systemResume`,
`authorizeMemberSession`, Cairo datetime parsing, lazy 7-day expiry.
Options: adopt whole (rebase onto `main` + full review), cherry-pick parts
(haram screening + availability recommended), or drop. Decide before
Phase 5 so the UI builds on a stable base.

## C. Phase 0 — Terms & Readiness (owner, blocks launch)

Per `roadmap.md` Phase 0, all human: Terms v1 + privacy notice authorship
and sign-off, KFS student-affairs consult note, 2 named moderators (human
developer as lead), `SECURITY.md` contact verification + triage drill.
Completion flips the six launch-gate attestations in
`src/launch/gate.ts` to true.

## D. Phase 5 — Web UI (new scope, 3 decisions needed)

The v2 requirements and architecture never included a UI build: the
architecture names a "browser-facing web tier" but defers framework, CSS,
file layout, session specifics, job runner, and deployment target. All
Phase 1–4 work is headless domain seams ready to be served.

Recommended slice order (each independently shippable):

- **U1:** public browse/search/detail + signup/login + publish (Phase 1 seams)
- **U2:** proposals → accept → schedule → complete + thread (Phase 2 seams)
- **U3:** reviews + reports + moderation queue + notification inbox (Phase 3 seams)
- **U4:** metrics dashboard + launch-gate view (Phase 4 seams)

Decisions owed before spec work starts:

1. **Framework** — recommended: Next.js (App Router, server-side sessions
   per the architecture default, one deployable, easy PaaS). Alternatives:
   SvelteKit (simpler) or framework-less SSR (most minimal, least a11y tooling).
2. **CSS** — Tailwind vs. plain CSS (affects the contrast/focus-bar velocity).
3. **Deployment target** — VPS vs. PaaS, plus managed-vs-self-hosted MySQL
   (ADR-0002 left hosting open). Also settles the job runner: in-process
   scheduler (simplest, no new infra) vs. OS cron.

Phase 5 also closes three documented code gaps: retention-sweep runner,
deactivation-cascade wiring, structured lend return-dates for reminders.

## E. Launch execution (owner + agent)

Run the automated gate (green in code), keyboard-only pass + disclaimer
contrast audit on the real UI, backup/restore + SECURITY drills against the
real database, confirm metrics live → start the 8-week D12 clock
(≥200 activated members, ≥150 published listings, ≥30 completed exchanges,
median triage ≤48h).

## F. Post-MVP (decide after pilot data, suggested grouping)

Per `roadmap.md` (unordered, not committed). Suggested order: trust &
safety first (appeals/community jury, verified-enrollment badge,
lend-tracking), then growth (Arabic UI, second campus, endorsements,
email/push opt-in, calendar export, map safe-spots), then nice-to-haves
(loan caps, sustainability metrics, anonymized research with consent).

## Suggested order

**A → B → D (spec first) → C anytime before E → E → F.**
Critical path to pilot: A → D(U1–U3) → C → E. B and U4 can ride in parallel.
