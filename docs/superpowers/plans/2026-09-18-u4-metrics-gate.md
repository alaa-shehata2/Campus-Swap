# U4 Web — Metrics Dashboard + Launch-Gate View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the Phase 4 pilot instrumentation in the browser: D12 progress dashboard (members/listings/completions/triage vs targets + full metrics), launch-gate view (checklist with live pass/fail + human attestations), health report. Moderator-gated (ops-sensitive + launch-internal). Served by the existing Next.js app against MySQL, reusing `metrics`/`launch` domain seams. Phase 5 U4 of `docs/project-management/plan-to-launch.md`. Last agent-buildable slice.

**Architecture:** No migration (every consumed store method already has MySQL parity from U1–U3). `web/lib/services.ts` gains `metrics()` (computePilotMetrics + pilotProgress over the MySQL services) and `launchStatus()` (healthCheck over MySQL adapters + moderator count + evaluateLaunchGate with human-supplied attestations). Attestations are entered per-view (checkboxes) and evaluated live client-side via the pure `evaluateLaunchGate` (client-safe: no node deps) — nothing persisted (Phase 0 owns the sign-offs). Moderator-only routes (same denied-panel pattern as `/moderation`).

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, mysql2. No new dependencies.

**Spec:** BL-18, D12/D14, NFR-O-1/A-1, NFR §10; arch §2 (metrics/launch); `docs/web-ui-standards.md`.

## Global Constraints

- Same `Result`/`FieldError` shape; moderator gates with denied panel (no data leak).
- Counts only — no PII on either page (no emails, no user lists).
- Cairo labels on timestamps (`generatedAtMs`, health `atMs`).
- New-style UI only (PageHeader/Panel/Badge, tokens).
- `.env.local` never committed; no migration.

---

### Task 1: metrics/health integration seam test (BL-18)

**Files:** Test `tests/mysql-metrics.test.ts` (skeleton first → FAIL). No domain changes expected; add only if a gap surfaces.

- [ ] Failing test (register ×2 → publish ×2 → propose → accept → schedule → Done → confirm → review ×2 → report → triage ack → computePilotMetrics asserts members ≥ 2, publishedListings ≥ 2, completedExchanges = 1, reportsReceived = 1, reviewsPublished = 2; pilotProgress math on fixture metrics; healthCheck all-ok over MySQL adapters; skips only if `MYSQL_URL` unreachable — else FAIL).
- [ ] Tests PASS; commit `test(db): metrics/health integration over MySQL (U4)`.

### Task 2: dashboard + gate routes (BL-18)

**Files:** Modify `web/lib/services.ts` (`metrics()`, `launchStatus()`); Create `web/app/metrics/page.tsx`, `web/app/launch/page.tsx`, `web/components/GateChecker.tsx` (client, attestation checkboxes + live evaluate); Modify nav (moderator-only Metrics/Launch links).

- [ ] `/metrics`: D12 progress (4 targets with met/actual/remaining + progress bars) + full metrics table + median triage; moderator-gated; empty-state copy when pilot data is zero.
- [ ] `/launch`: gate failures list (or all-green), health checks table, disclaimer/Cairo audit findings, attestation checkboxes driving live pass/fail, moderator count vs D14.
- [ ] Commit `feat(web): U4 metrics dashboard + launch-gate view`.

### Task 3: verify + PR

- [ ] `npm test` + `tsc` (root+web) + `next build` + `git diff --check` (evidence); live walkthrough (member denied, moderator sees coherent numbers vs seed state, gate red without attestations); subagent review; fix Critical/Important; push; PR vs `main` (stacked; note rebase chain). Merges skipped per standing instruction.
