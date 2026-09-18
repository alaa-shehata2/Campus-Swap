# CampusSwap Full-Screen Marketplace UI/UX Design

**Status:** Approved design direction; implementation not started  
**Scope:** Phase 5 web UI redesign  
**Date:** 2026-09-18

## Goal

Replace the current narrow, centered `max-w-4xl` presentation with a full-screen
marketplace experience. The site should use the available desktop width without
making prose unreadable, feel familiar to e-commerce users, and preserve
CampusSwap's safety, accessibility, Cairo-time, and money-free exchange rules.

## Design direction

Use a hybrid marketplace shell:

- editorial framing for landing and browse sections;
- commerce-style filters, cards, grids, and detail pages;
- focused, readable layouts for forms, profiles, Terms, and Privacy;
- one shared token and component system across every route.

This is a visual and interaction redesign only. It does not change domain
lifecycles, authorization, persistence, or the approved modular-monolith
architecture.

## Layout architecture

### Shared shell

- `AppShell` owns the viewport background, header, main region, and footer.
- The header spans the viewport and contains brand, primary navigation, account
  actions, and a mobile navigation control.
- The main region uses a fluid 12-column grid with responsive gutters.
- Full-width sections may use the complete grid; prose-heavy content uses a
  readable measure inside that grid rather than shrinking the entire site.
- No route may apply a global narrow wrapper that leaves large unused side
  areas on desktop.

### Browse and search

- Desktop: a 2–3 column left filter rail and a 9–10 column results region.
- The filter rail can collapse without losing access to filters.
- Tablet/mobile: filters become an accessible drawer; results remain the
  primary surface.
- Results use a responsive CSS grid: 2 columns at compact widths, 3–4 or more
  when the viewport supports it, with cards retaining a readable minimum width.
- Search, filter, sort, result count, empty state, and pagination belong to the
  results region and remain visible in the same hierarchy.

### Listing detail

- Use a two-column commerce layout on wide screens.
- Primary content contains title, media, terms, availability, and compatible
  listings.
- A secondary rail contains owner identity, reputation, action/authentication
  state, safety context, and report entry.
- Collapse to a single ordered column on smaller screens.

### Forms and account pages

- Signup, login, publish, and profile use a focused form measure inside the
  full-screen shell.
- Forms may be narrower for scanability, but must not inherit a narrow layout
  for the entire application.
- Long forms are divided into clear sections with persistent context and
  field-level errors.

## Implementation sequence

1. Add named design tokens and base typography/surface/focus styles.
2. Replace the global centered shell with `AppShell` and responsive navigation.
3. Build shared layout primitives: `PageHeader`, `Panel`, `Badge`, `EmptyState`,
   `InlineAlert`, and responsive grid utilities.
4. Build `FilterRail` and `FilterDrawer`; migrate browse/search to the
   marketplace grid and expose all required filters.
5. Redesign `ListingCard`, listing detail, compatible results, and owner/action
   rail.
6. Migrate auth, publish, and profile forms to shared form primitives.
7. Migrate Terms, Privacy, loading, not-found, and error surfaces.
8. Run responsive, keyboard, contrast, screen-reader, and visual regression
   checks at wide desktop, tablet, and mobile widths.

## Acceptance criteria

- At desktop widths, browse visibly uses the viewport; no large unused side
  margins are caused by a global `max-w-4xl` wrapper.
- Browse has a left filter rail that collapses to a usable drawer.
- Listing cards form a responsive grid without becoming cramped or excessively
  stretched.
- Listing detail has a commerce-style primary/secondary column structure.
- Forms remain readable and usable without reintroducing a narrow global shell.
- All existing functional behavior and authorization boundaries remain intact.
- WCAG 2.2 AA checks pass for keyboard focus, contrast, labels, errors, and
  non-color status communication.
- All displayed datetimes retain an explicit `Cairo time (Africa/Cairo)` label.
- Visual checks cover logged-out, logged-in, empty, validation-error, and
  restricted states.

## Out of scope

- New domain features or lifecycle changes.
- Payment, messaging files, recommendation algorithms, or multi-university
  product changes.
- Replacing Next.js, Tailwind, or the existing domain/service seams.
- Adding a component library solely for visual styling.
