# U3 Web — Reviews/Reports/Moderation/Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 3 vertical slice in the browser new-style from day one: blind bilateral reviews + response on Completed exchanges → aggregate on profiles; report flow with reason codes + reporter status; moderator queue with triage/sanctions/audit (hide/warn/suspend/ban, stolen handover needs owner approval); in-app notification inbox. Served by the existing Next.js app against MySQL, reusing `reputation`/`moderation`/`notifications` domain seams. Phase 5 U3 of `docs/project-management/plan-to-launch.md`.

**Architecture:** `web/lib/db/repositories.ts` gains `MySqlReputationStore`, `MySqlModerationStore`, `MySqlNotificationStore` with full API parity; new `ReputationStorePort`/`ModerationStorePort` interfaces (mirror `ExchangesStorePort` — services stay behavior-identical). Domain `notify?.emit` call sites become awaited so the async MySQL sink is properly persisted (in-memory behavior unchanged). `web/lib/services.ts` gains `reputation()`, `moderation()`, `notifications()` wired with adapters; the sink is passed as `notify` to exchanges/reputation/moderation services so U3 (and retroactively U2 events) persist. Moderator bootstrap: `setRole('bootstrap', …)` while no moderator exists; seed promotes a dev moderator; handover `ownerId` from `MODERATION_OWNER_ID` env (unset → handover approval unavailable, documented). New-style UI only: `PageHeader`/`Panel`/`Badge`/`FormField`/`InlineAlert`/`EmptyState`, tokens, no `max-w-4xl`, route-state checklist per `docs/web-ui-standards.md`.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, mysql2. No new dependencies.

**Spec:** FR-R-1..5, FR-M-1..5, FR-N-1; NFR-U-2/3, NFR-L-1; arch §§2–4; backlog BL-11..BL-14; roadmap Phase 2-exit analogue (bilateral invisibility, report transitions, no handover without approval).

## Global Constraints

- Same `Result`/`FieldError` shape; field errors render next to fields (NFR-U-3).
- Reviews: Completed exchanges only; one 1–5 + ≤1000 text per participant; Hidden until both-in or 14 days (lazy `revealDue` sweep on review reads, same pattern as U2 expiry sweep); 48h edit; one ≤1000 response; no self/Cancelled/Disputed reviews.
- Reports: target + reason code + ≥20-char description for `other` + ≤3 images (image *count* enforced; uploads stay out of scope — paths/URLs as text); `Received → Under review → Resolved` visible to reporter; reported party notified only on action.
- Moderation: moderator-only triage/sanction; every action audit-logged; stolen hide-first + handover requires owner approval; no silent review edits.
- Inbox: one item per event, unread counts, mark-read; zero emails.
- `.env.local` never committed; migration additive.

---

### Task 1: migration + MySQL stores + notify sink (BL-11..14 seam)

**Files:** Modify `db/schema.sql` (new tables in `-- U3-TABLES-BEGIN/END` marker section); Modify `web/lib/db/repositories.ts`; Modify `src/reputation/store.ts` (+Port), `src/reputation/service.ts` (opts type), `src/moderation/store.ts` (+Port + export type), `src/moderation/service.ts` (opts type), await `notify?.emit` call sites; Test `tests/mysql-u3.test.ts` (skeleton first → FAIL).

- [ ] Failing test (register → publish → propose → accept → schedule → Done → confirm → submitReview ×2 (Hidden) → revealDue (Published) → aggregate; report → triage → sanction warn → audit; sink emit → inbox + markRead; skips only if `MYSQL_URL` unreachable — else FAIL).
- [ ] Tables `reviews`, `reports`, `sanctions`, `voids`, `handovers`, `open_cases`, `notifications`; stores with full parity incl. export/import/stats; sink never breaks core flows (awaited; errors propagate as Result, never throw into callers).
- [ ] Tests PASS; commit `feat(db): mysql reputation/moderation/notification seams (U3)`.

### Task 2: services wiring + reviews routes (BL-11)

**Files:** Modify `web/lib/services.ts` (add `reputation()` + lazy `revealDue` sweep; pass sink as notify to all three domain services); Create `web/app/exchanges/[id]/review/page.tsx` (submit/edit), `web/components/ReviewForm.tsx`; Modify `web/app/me/page.tsx` + listing detail owner rail (aggregate via `OwnerSummary`).

- [ ] Submit/edit/response forms with blind-status notice ("hidden until both submit or 14 days"); aggregate (average + count + distribution + history) on profiles; no review UI on non-Completed exchanges (link absent, direct URL → not-found).
- [ ] Commit `feat(web): U3 blind reviews + aggregate`.

### Task 3: reports + moderation queue (BL-12/13)

**Files:** Create `web/app/reports/new/page.tsx`, `web/app/reports/page.tsx` (own reports + status), `web/app/moderation/page.tsx` (queue + triage + sanction forms + audit log), `web/components/ReportForm.tsx`, moderation action components; Modify `web/app/actions.ts` (append `reportAction/triageAction/sanctionAction/...`).

- [ ] Report form (target prefilled from `ReportEntryPoint`, reason codes, conditional description rule, image-count); reporter status timeline; moderator-only queue (non-moderator → denied, no leak); sanction forms with reason; audit log; stolen escalate/handover gated on owner approval.
- [ ] Commit `feat(web): U3 reports + moderation queue + audit`.

### Task 4: notification inbox (BL-14)

**Files:** Create `web/app/notifications/page.tsx`; Modify nav (unread badge), seed (moderator + demo review/report/notification).

- [ ] Inbox (unread item per event, Cairo labels, mark-read/all-read); header unread count; seed demo: completed exchange with published reviews, one Resolved report, unread items.
- [ ] Commit `feat(web): U3 notification inbox + demo seed`.

### Task 5: verify + PR

- [ ] `npm test` + `tsc` (root+web) + `next build` + `git diff --check` (evidence); live walkthrough (review invisibility pre-reveal, report transitions, handover-without-approval impossible, inbox zero-email); subagent review; fix Critical/Important; push; PR vs `main` (stacked on shell; note rebase after routes lands). Merges skipped per standing instruction.
