# Phase 4 — Pilot Hardening & Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the automatable part of Phase 4 (roadmap pilot hardening): D12 metrics instrumentation, launch-gate evaluator (NFR §10), disclaimer-presence gate (BL-15), Cairo-label audit (BL-17/BL-18), health check, and backup/restore snapshot round-trip (BL-18). Closes #33, #34, #35, #36.

**Architecture:** Two new shallow modules: `metrics` (pure composition over store stats) and `launch` (gate evaluator + audits + health + snapshot). Stores gain enumeration/stats methods and export/import for snapshots. No UI exists, so keyboard/contrast/screen-reader/Terms items are human attestations in the gate input — the gate cannot pass without them. Stacked on Phase 3 branch (PR #32). Pre-existing uncommitted work was preserved verbatim on `wip/incoming-uncommitted-changes` per owner choice; Phase 4 builds on the clean tree.

**Tech Stack:** TypeScript 5.x, `node:test` via tsx, `tsc --noEmit`. No new dependencies.

**Spec:** roadmap Phase 4, backlog BL-15..BL-18, NFR §§8–10 (NFR-L-1, NFR-O-1, §10), D12/D14, P-3.

## Global Constraints

- Same `Result`/`FieldError` shape for fallible ops; pure functions elsewhere.
- Gate encodes NFR §10 items 1–6; Terms/consult/moderators/keyboard items are human attestations (Phase 0 deferred by owner — gate stays red without them, by design).
- Snapshot files are sensitive (salted scrypt hashes included, like a DB dump) — documented, never committed; tests use memory only.
- Every behavior has tests (AGENTS.md).

---

### Task 1: store stats + metrics + D12 progress (BL-18, #36)

**Files:** Modify stores (`identity`: `stats()`; `listings`: `countByStatus()`; `exchanges`: `exchangeStats()` + `proposalStats()`; `moderation`: `allReports()`; `reputation`: `counts()`; `notifications`: `count()`); Create `src/metrics/{types,service}.ts`; Test `tests/metrics.test.ts`.

Produces: `computePilotMetrics(deps)` → `{ members, activeMembers, moderators, listings, activeListings, completedExchanges, reportsReceived, reportsUnderReview, reportsResolved, medianTriageMs, sanctions, handovers, reviewsPublished, generatedAtMs }`; `D12_TARGETS = { members: 200, listings: 150, completions: 30, triageMs: 48h }`; `pilotProgress(m)` → per-target `{ met, actual, target }`.

Median triage = median over Resolved reports of (Resolved.atMs − Received.atMs) from history; null when none.

- [ ] Failing tests (empty world zeros; populated world counts; median math; progress met/unmet) → FAIL → implement → PASS → commit `feat(metrics): pilot metrics + D12 progress (BL-18)`.

### Task 2: launch gate — disclaimers, Cairo audit, health (BL-15/17/18, #33/#35/#36)

**Files:** Create `src/launch/{audits,gate,health}.ts`; Test `tests/launch.test.ts`.

Produces: `disclaimerAudit()` → per-flow `{ flow, ok, issues[] }` (non-empty, mentions Terms, length ≥ 80, avg sentence words ≤ 30); `cairoLabelAudit()` → `formatCairoTime` output matches label contract on winter + summer samples; `healthCheck(deps)` → `{ status: 'ok'|'degraded', checks, atMs }`; `evaluateLaunchGate({ metrics, moderatorCount, attestations })` → `{ pass, failures[] }` where attestations = `{ termsSignedOff, consultRecorded, backupDemonstrated, securityDrill, keyboardPass, disclaimerManualPass }` (all required true; moderatorCount ≥ 2; metrics present).

- [ ] Tests → FAIL → implement → PASS → commit `feat(launch): gate, disclaimer/Cairo audits, health (BL-15/17/18)`.

### Task 3: backup/restore snapshot round-trip (BL-18, #36)

**Files:** Add `exportState`/`importState` to the 5 stores (+ notifications items); Create `src/launch/snapshot.ts` (`createSnapshot`, `restoreSnapshot`); Test `tests/snapshot.test.ts` (populated world → snapshot → fresh services → restore → metrics equal + login works + audit intact).

- [ ] Tests → FAIL → implement → PASS → commit `feat(launch): backup/restore snapshot round-trip (BL-18)`.

### Task 4: docs + verification + PR

- [ ] README, test-strategy, CHANGELOG; `npm test` green + `tsc` clean (evidence); subagent review, fix Critical/Important; push; PR vs `main` stacked on #32 with `Closes #33-36`. Merge needs human. BL-16 (Terms authorship) stays human-owned: gate attestation, documented.
