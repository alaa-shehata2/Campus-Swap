# Full-Screen Marketplace UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Phase 5 web UI as a fluid, full-screen e-commerce-like marketplace with a collapsible left filter rail, responsive listing grid, and shared visual/accessibility primitives.

**Architecture:** Keep the existing Next.js App Router, server actions, domain services, and MySQL seams unchanged. Introduce a presentation-only shell and token/component layer under `web/`, then migrate browse, detail, auth, publish, profile, and legal routes to compose those primitives. Browse uses a fluid 12-column layout; forms and prose use readable measures inside the same full-width shell.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, TypeScript, Node test runner, existing domain/service seams.

**Spec:** `docs/superpowers/specs/2026-09-18-full-screen-marketplace-design.md`; standards: `docs/web-ui-standards.md`

## Global Constraints

- Use the shared full-viewport shell and fluid 12-column grid.
- Do not add a site-wide `max-w-4xl`/`max-w-5xl` wrapper.
- Browse uses a left filter rail that becomes an accessible drawer on smaller screens.
- Constrain only prose and form content when readability requires it.
- Use named visual tokens instead of arbitrary one-off colors, spacing, shadows, or radii.
- Color is never the only indication of meaning; statuses also have text or an accessible name.
- Target WCAG 2.2 AA, visible focus, keyboard access, touch-safe controls, and reduced-motion support.
- Preserve domain behavior, authorization, Terms/privacy links, public email privacy, and explicit `Cairo time (Africa/Cairo)` labels.
- Every route must cover default, loading, empty, validation-error, server-error, auth, permission, mobile, tablet, and wide-desktop states where applicable.
- Do not add a component library or change the domain, persistence, or routing architecture.

---

## File map

| File or directory | Responsibility |
|---|---|
| `web/app/globals.css` | CSS variables, typography, surfaces, focus, motion, and layout utility foundations |
| `web/app/layout.tsx` | Full-viewport application shell, navigation, and footer composition |
| `web/components/ui/*` | Reusable visual primitives with stable props |
| `web/components/navigation/*` | Desktop navigation, mobile navigation, filter rail, and filter drawer |
| `web/components/ListingGrid.tsx` | Responsive listing results layout |
| `web/components/ListingCard.tsx` | Listing summary anatomy and states |
| `web/components/SearchForm.tsx` | Search/filter controls, including availability |
| `web/app/page.tsx` | Browse page layout and results state composition |
| `web/app/listings/[id]/page.tsx` | Commerce-style detail layout and owner/action rail |
| `web/app/{login,signup,publish,me,terms,privacy}/*` | Route migration to shared shell/primitives |
| `web/components/*.test.tsx` or existing web test location | Component and route behavior coverage, following the repository’s available test setup |
| `web/e2e/*` or existing browser-test location | Responsive and keyboard walkthrough evidence if browser tooling is available |

## Task 1: Establish visual tokens and shell geometry

**Files:**
- Modify: `web/app/globals.css`
- Modify: `web/app/layout.tsx`
- Create: `web/components/ui/Container.tsx`
- Create: `web/components/ui/Panel.tsx`
- Create: `web/components/ui/PageHeader.tsx`
- Test: web component/layout test location established by the repository

**Interfaces:**
- `Container({ children, className?, as? })` renders a full-width outer wrapper with responsive gutters and optional readable measure.
- `Panel({ children, className?, tone? })` renders an elevated or bordered surface using tokens.
- `PageHeader({ eyebrow?, title, description?, actions? })` renders consistent page hierarchy.

- [ ] **Step 1: Add failing layout assertions** for a full-width shell, readable container variant, and page header semantics. Assert that the document has one main landmark, a skip link, and no required route-level `max-w-4xl` wrapper.
- [ ] **Step 2: Run the focused test** and confirm it fails because the primitives and new geometry do not exist.
- [ ] **Step 3: Add CSS tokens** for page/elevated surfaces, text hierarchy, border/focus colors, brand/action colors, offer/request/status semantics, spacing, radii, shadows, and typography. Add `prefers-reduced-motion` behavior and preserve the existing high-contrast focus ring.
- [ ] **Step 4: Implement `Container`, `Panel`, and `PageHeader`** with typed props and token-backed classes. The default container must be fluid; `measure="readable"` is the explicit exception for prose/forms.
- [ ] **Step 5: Refactor `layout.tsx`** to use a viewport-spanning header/footer and a full-width main region with responsive gutters. Keep existing auth links, Terms, Privacy, and Cairo footer copy.
- [ ] **Step 6: Run the focused test and typecheck.** Expected: PASS with no type errors.
- [ ] **Step 7: Commit** `feat(web): establish full-screen marketplace shell`.

## Task 2: Build responsive navigation and filter rail primitives

**Files:**
- Create: `web/components/navigation/DesktopNav.tsx`
- Create: `web/components/navigation/MobileNav.tsx`
- Create: `web/components/navigation/FilterRail.tsx`
- Create: `web/components/navigation/FilterDrawer.tsx`
- Modify: `web/app/layout.tsx`
- Modify: `web/components/SearchForm.tsx`
- Test: navigation/filter component tests

**Interfaces:**
- `FilterRail({ children, open, onToggle })` provides a desktop filter column with a labeled collapse control.
- `FilterDrawer({ open, onClose, children })` provides the same filters in a keyboard-accessible mobile dialog/drawer.
- `SearchForm` preserves URL query behavior and accepts an `availability` field.

- [ ] **Step 1: Add failing tests** for keyboard-open/close behavior, Escape dismissal, focus return, accessible labels, and preservation of all filter query keys: `text`, `side`, `kind`, `category`, `zone`, and `availability`.
- [ ] **Step 2: Run the focused tests** and verify failure.
- [ ] **Step 3: Implement desktop and mobile navigation primitives** without hover-only actions. Ensure collapsed filters remain reachable through the drawer.
- [ ] **Step 4: Move search controls into the shared filter composition** and add an availability input/select. Preserve current query values when reopening or submitting.
- [ ] **Step 5: Run focused tests and typecheck.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(web): add responsive navigation and filters`.

## Task 3: Redesign listing cards and browse results

**Files:**
- Create: `web/components/ListingGrid.tsx`
- Modify: `web/components/ListingCard.tsx`
- Modify: `web/app/page.tsx`
- Modify: `src/listings/search.ts` only if a pagination/read-seam change is required by the existing architecture
- Test: browse/search/component tests

**Interfaces:**
- `ListingGrid({ listings, empty?, ariaLabel? })` renders a responsive grid with a stable minimum card width.
- `ListingCard({ listing })` renders side/kind/category labels, title, description, zone, availability, and Cairo-labeled created time.

- [ ] **Step 1: Add failing browse tests** for availability filtering in the page query, filter rail presence, wide-screen grid classes/structure, empty results, and logged-out publish CTA.
- [ ] **Step 2: Run the focused tests** and verify failure.
- [ ] **Step 3: Implement `ListingGrid`** with CSS grid columns that expand from compact two-column layouts to three/four-column wide layouts without fixed widths or horizontal scrolling.
- [ ] **Step 4: Rework `ListingCard`** into a consistent commerce card with semantic labels, readable metadata, visible action affordance, and non-color-only side/status indicators.
- [ ] **Step 5: Recompose `web/app/page.tsx`** with `PageHeader`, filter rail/drawer, result count, `ListingGrid`, and empty/error states. Pass `availability` into `searchListings`.
- [ ] **Step 6: Run browse tests, domain discovery tests, typecheck, and the web build.** Expected: all pass.
- [ ] **Step 7: Commit** `feat(web): redesign full-screen browse results`.

## Task 4: Redesign listing detail and owner/action rail

**Files:**
- Modify: `web/app/listings/[id]/page.tsx`
- Create: `web/components/OwnerSummary.tsx`
- Create: `web/components/ListingActionPanel.tsx`
- Create: `web/components/ReportEntryPoint.tsx`
- Test: listing detail tests

**Interfaces:**
- `OwnerSummary({ displayName, campus, rating, completedExchangeCount })` never renders email and labels campus as self-declared.
- `ListingActionPanel({ loginCTA, listing })` renders login return-to context or the current U1 action state.
- `ReportEntryPoint({ targetType, targetId, authenticated })` renders the appropriate authenticated action or login prompt without inventing a write path outside the existing domain seam.

- [ ] **Step 1: Add failing detail tests** for two-column desktop structure, single-column responsive order, owner reputation summary, report entry point, full terms/availability, compatible listings, and anonymous login CTA.
- [ ] **Step 2: Run the focused tests** and verify failure.
- [ ] **Step 3: Wire owner profile/reputation data** through the existing service seam or an explicitly typed web read helper; do not expose email or alter domain authorization.
- [ ] **Step 4: Implement the primary detail column and secondary owner/action rail** using shared `Panel`, `Badge`, and `PageHeader` primitives.
- [ ] **Step 5: Add responsive ordering** so action/report context remains reachable before compatible content on mobile.
- [ ] **Step 6: Run detail tests, typecheck, and build.** Expected: PASS.
- [ ] **Step 7: Commit** `feat(web): redesign listing detail experience`.

## Task 5: Migrate auth, publish, and profile forms

**Files:**
- Modify: `web/components/LoginForm.tsx`
- Modify: `web/components/SignupForm.tsx`
- Modify: `web/components/PublishForm.tsx`
- Modify: `web/components/ProfileForm.tsx`
- Modify: `web/components/FieldErrors.tsx`
- Create: `web/components/ui/FormField.tsx`
- Create: `web/components/ui/InlineAlert.tsx`
- Modify: `web/app/login/page.tsx`
- Modify: `web/app/signup/page.tsx`
- Modify: `web/app/publish/page.tsx`
- Modify: `web/app/me/page.tsx`
- Test: form and server-action tests

**Interfaces:**
- `FormField({ id, label, hint?, error?, children })` associates label, hint, and error IDs with the control.
- `InlineAlert({ tone, title, children })` announces important action outcomes.
- Existing server-action return shapes remain unchanged.

- [ ] **Step 1: Add failing tests** for programmatic field/error association, announced action outcomes, focus-visible controls, disclaimer/Terms presence, and responsive readable form measure.
- [ ] **Step 2: Run focused tests** and verify failure.
- [ ] **Step 3: Extract shared form field and alert primitives** while preserving existing field names, action payloads, error codes, and disclaimers.
- [ ] **Step 4: Migrate each form page** to `PageHeader`, readable `Container`, `Panel`, `FormField`, and `InlineAlert`. Keep email private and retain auth return-to behavior.
- [ ] **Step 5: Add profile summary slots** for moderation badges and future completed-exchange/reputation data without displaying unavailable or fabricated values.
- [ ] **Step 6: Run form tests, typecheck, and build.** Expected: PASS.
- [ ] **Step 7: Commit** `feat(web): standardize marketplace forms`.

## Task 6: Migrate legal and shared route states

**Files:**
- Modify: `web/app/terms/page.tsx`
- Modify: `web/app/privacy/page.tsx`
- Create: `web/app/loading.tsx`
- Create: `web/app/error.tsx`
- Create: `web/app/not-found.tsx`
- Modify: `web/components/Disclaimer.tsx`
- Test: route-state and accessibility tests

**Interfaces:**
- Shared loading/error/not-found surfaces use the same shell and token system.
- `Disclaimer` keeps readable safety copy and a visible Terms link.

- [ ] **Step 1: Add failing tests** for legal readable measure, Terms link visibility, loading/error/not-found landmarks, and reduced-motion-safe loading behavior.
- [ ] **Step 2: Run focused tests** and verify failure.
- [ ] **Step 3: Implement shared route states** with explicit recovery actions and no silent failures.
- [ ] **Step 4: Migrate legal pages** to readable containers inside the full-screen shell; preserve exact legal content and privacy requirements.
- [ ] **Step 5: Run focused tests, typecheck, and build.** Expected: PASS.
- [ ] **Step 6: Commit** `feat(web): standardize legal and route states`.

## Task 7: Run responsive and accessibility acceptance checks

**Files:**
- Modify: relevant web components/routes only for defects found by checks
- Test: existing web/browser test location; add `web/e2e/ui-redesign.spec.ts` only if browser tooling is already configured
- Docs: update `README.md` with the UI validation command/evidence if the command is stable

- [ ] **Step 1: Run root domain tests and web typecheck/build.**
- [ ] **Step 2: Run the browser walkthrough** at wide desktop, tablet, and mobile sizes for logged-out browse, filter drawer, detail, signup, publish, profile, Terms, and Privacy.
- [ ] **Step 3: Perform a keyboard-only pass** covering skip link, navigation, filter collapse/drawer, form errors, dialogs, and primary actions.
- [ ] **Step 4: Check contrast and non-color status communication** for offer/request, lifecycle, validation, restricted, and empty states.
- [ ] **Step 5: Verify explicit Cairo labels, no public email leak, login return-to paths, and disclaimer/Terms links.**
- [ ] **Step 6: Fix only defects found by these acceptance checks and rerun the smallest affected tests.**
- [ ] **Step 7: Commit** `test(web): verify responsive marketplace UI`.

## Final verification

Run:

```bash
npm test
npm run typecheck
npm run build --prefix web
git diff --check
```

Confirm manually that:

- browse uses the desktop viewport rather than a narrow centered column;
- the left filter rail collapses and reopens accessibly;
- cards remain readable across widths;
- detail, forms, legal pages, loading, error, and empty states use the shared
  shell;
- no domain or authorization behavior changed.
