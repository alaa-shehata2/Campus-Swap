# UI Redesign + U3 Coordination Contract

> Shared contract for parallel agents (Muse Spark + Copilot) and the human
> owner. Read this file before starting any web UI task. The human relays
> branch state between agents; agents never edit each other's files.

## Objective

Rebuild `web/` on the full-screen marketplace system (`docs/web-ui-standards.md`,
brief `docs/superpowers/specs/2026-09-18-full-screen-marketplace-design.md`,
plan `docs/superpowers/plans/2026-09-18-full-screen-marketplace-ui.md`),
then build U3 (reviews / reports / moderation / notification inbox) new-style
from day one. No domain, authz, or persistence changes in this track.

## Branch stack (land bottom-up, human merges)

1. `feat/u1-web-browse-auth-publish` (base; U1 web + UI docs) — human merges / already in review
2. `feat/u2-proposals-exchanges` (U2 web; open as PR #1 on origin) — human merges
3. `feat/marketplace-shell` ← shell foundation (tokens, shell, nav, filters)
4. `feat/marketplace-routes` ← route migrations, stacked on shell
5. `feat/u3-reviews-moderation` ← U3 seam + routes, stacked on shell (needs Phase 3 domain merged to base first)

## Owners and file map

| Owner | Tasks | Files (exclusive) |
|---|---|---|
| Spark | R-T1: tokens + `Container`/`Panel`/`PageHeader` + `layout.tsx` shell | `web/app/globals.css`, `web/app/layout.tsx`, `web/components/ui/*` |
| Spark | R-T2: `DesktopNav`/`MobileNav`/`FilterRail`/`FilterDrawer`, `SearchForm` availability | `web/components/navigation/*`, `web/components/SearchForm.tsx` |
| Copilot | R-T3: `ListingGrid` + `ListingCard` + `web/app/page.tsx` | `web/components/ListingGrid.tsx`, `web/components/ListingCard.tsx`, `web/app/page.tsx` |
| Copilot | R-T4: detail two-column + `OwnerSummary` + `ListingActionPanel` + `ReportEntryPoint` | `web/app/listings/[id]/page.tsx`, `web/components/OwnerSummary.tsx`, `web/components/ListingActionPanel.tsx`, `web/components/ReportEntryPoint.tsx` |
| Copilot | R-T5: form primitives + migrate login/signup/publish/me | `web/components/ui/FormField.tsx`, `web/components/ui/InlineAlert.tsx`, `web/components/{Login,Signup,Publish,Profile}Form.tsx`, `web/components/FieldErrors.tsx`, `web/app/{login,signup,publish,me}/page.tsx` |
| Copilot | R-T6: legal + shared route states; R+ U2-route migration; R-T7 acceptance | `web/app/{terms,privacy}/page.tsx`, `web/app/{loading,error,not-found}.tsx`, `web/components/Disclaimer.tsx`, U2 routes/forms (see R+), acceptance fixes |
| Spark | U3: MySQL seam + reviews/reports/moderation/inbox routes | `tests/mysql-reputation-moderation.test.ts`, `web/lib/db/repositories.ts` (U3 stores only), `web/app/{reviews,reports,moderation,notifications}/**`, `web/app/actions.ts` (append only) |

If a pattern is needed on two routes and no primitive exists, the route owner
adds the primitive under `web/components/ui/` and notes it here. Never copy
Tailwind classes across routes.

## Primitive API contract (v1, owned by Spark)

```tsx
Container({ children, className?, measure?: 'fluid' | 'readable' })
// fluid (default): full-width outer wrapper, responsive gutters. readable: max-w-prose centered for prose/forms.

FilterRail({ children, open, onToggle })
// controlled desktop filter column; collapsed state keeps a slim reopen rail.
// Parent owns `open` and widens results when collapsed.

FilterDrawer({ open, onClose, children })
// mobile drawer: role=dialog aria-modal, Escape dismissal, initial focus,
// focus returned to the opener on close. `lg:hidden`.
```

Panel({ children, className?, tone?: 'elevated' | 'bordered' })
// token-backed surface. No ad-hoc bg-white/border-stone-200/rounded/shadow classes on routes.

PageHeader({ eyebrow?, title, description?, actions? })
// consistent page hierarchy. eyebrow is plain (no ALL-CAPS tracking).
```

Tokens (`web/app/globals.css`, Tailwind v4 `@theme`; semantic names, current
palette carried over — no rebrand in this track):

- surfaces: `--color-surface-page`, `--color-surface-elevated`, `--color-surface-sunken`
- text: `--color-text-primary`, `--color-text-muted`, `--color-text-inverse`
- chrome: `--color-border`, `--color-focus`
- brand/action: `--color-brand`, `--color-brand-ink`, `--color-brand-contrast`
- semantics: `--color-offer`, `--color-request`, `--color-status-active`, `--color-status-paused`, `--color-status-warning`, `--color-status-danger`, `--color-status-info`
- radii/shadows: `--radius-sm/md/lg`, `--shadow-raised`; type/spacing use Tailwind defaults.

Rules: no `max-w-4xl/5xl` route wrappers; no one-off colors/spacing/shadows;
status always has a text label (never color-only); explicit `Cairo time
(Africa/Cairo)` labels; no public emails; login `returnTo` on gated actions.

## R+ gap (recorded): U2 routes are not in the redesign plan's file map

`web/app/proposals/**`, `web/app/exchanges/**`, `ProposeForm`,
`ProposalActions`, `ExchangeForms`, `ThreadForm` must be migrated to the new
primitives (Copilot, after shell lands, on the routes branch).

## Test convention (no new deps)

Web structural tests live in root `tests/web-*.test.ts` and run in the existing
`npm test` suite (node:test via tsx): string/file assertions on `web/` source
(no `max-w-4xl`, tokens present, exports exist). Rendering is verified by
`next build` + live-server walkthrough. Do not add a component-test framework
without human approval.

## Evidence per task (both agents)

`npm test`, root `tsc --noEmit`, web `tsc --noEmit`, `next build`, `git diff
--check`, live walkthrough notes (or explicit "browser validation unavailable"
record). Keyboard-only + contrast/focus notes for touched routes.

## Status

- [x] R-T1 implemented (Spark, shell branch)
- [x] R-T2 implemented on the shell branch (nav/filter/SearchForm by Copilot as
  `3d5eec7`/`e8657a8`; FilterRail controlled-interface fix + drawer
  focus-return by Spark). Routes branch must rebase onto shell to pick up the
  FilterRail fix before R-T3 uses it.
- [ ] R-T3–T6, R+, R-T7 (Copilot, routes branch)
- [x] U3 Tasks 1–4 (Spark, `feat/u3-reviews-moderation` stacked on shell +
  merged U2 line): MySQL seams, blind reviews, reports/moderation queue,
  inbox. Remaining: Task 5 verify + PR.
