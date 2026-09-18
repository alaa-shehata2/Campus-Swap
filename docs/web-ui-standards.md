# CampusSwap Web UI Standards

These standards apply to every current and future route under `web/`. Agents
must read this file before changing web UI code. The goal is a full-screen,
e-commerce-like marketplace without sacrificing readability, accessibility, or
the product's safety rules.

## 1. Page geometry

- Use the shared full-viewport shell and fluid 12-column grid.
- Do not add a site-wide `max-w-4xl`/`max-w-5xl` wrapper.
- Full-width desktop sections should use the available viewport with responsive
  gutters.
- Constrain only prose and form content when readability requires it.
- Browse uses a left filter rail plus a wider results region.
- The rail collapses into an accessible drawer on smaller screens.
- Use CSS grid/flex responsive behavior; do not hard-code card widths or rely on
  horizontal scrolling for primary content.

## 2. Shared components

Prefer shared primitives over route-specific markup:

- `AppShell` and responsive navigation
- `PageHeader`
- `FilterRail` and `FilterDrawer`
- `ListingGrid` and `ListingCard`
- `Panel`, `Badge`, and status indicators
- `FormField`, `FieldErrors`, `InlineAlert`, and `SubmitButton`
- `EmptyState`, loading state, and not-found/error state

If a pattern appears on two routes, extract or reuse a component instead of
copying Tailwind classes. Route files compose these primitives and own only
route-specific data and hierarchy.

## 3. Visual tokens

Use named tokens for:

- page and elevated surfaces;
- primary, muted, and inverse text;
- borders and focus rings;
- brand/action color;
- offer/request and lifecycle status colors;
- spacing, radius, shadow, and typography scales.

Do not introduce arbitrary one-off colors, spacing values, shadows, or radii
when a token exists. A color must never be the only indication of meaning;
include a text label or accessible name for every status.

## 4. Responsive behavior

Every route must be reviewed at:

- wide desktop, where the shell uses the viewport;
- tablet, where secondary rails may collapse;
- mobile, where controls stack and filters become a drawer.

Controls must remain usable with touch. No primary action may depend on hover.
Preserve logical reading and tab order when columns stack.

## 5. Accessibility and safety

- Target WCAG 2.2 AA for every journey.
- Provide visible `:focus-visible` treatment with sufficient contrast.
- Associate labels, descriptions, and field errors programmatically.
- Announce form errors and important async outcomes to assistive technology.
- Maintain keyboard access to navigation, filters, drawers, dialogs, and forms.
- Respect `prefers-reduced-motion`; never autoplay media.
- Keep disclaimers readable, announced, and linked to Terms.
- Display all dates/times with an explicit `Cairo time (Africa/Cairo)` label.
- Never expose email addresses in public UI.
- Keep anonymous users read-only and show a clear login return path for gated
  actions.

## 6. Route state checklist

Before considering a route complete, verify its:

- default and loading state;
- empty state;
- validation-error state;
- server-error state;
- logged-out state;
- logged-in state;
- restricted/permission-denied state where applicable;
- mobile, tablet, and wide-desktop layout.

## 7. Review and evidence

Every UI change must include:

- relevant component/route tests for changed behavior;
- typecheck and the smallest relevant build/test command;
- keyboard-only review;
- contrast and focus review;
- wide desktop and mobile visual review;
- confirmation that the page does not regress to a cramped centered layout.

Do not claim visual completion from a successful typecheck alone. If browser
validation is unavailable, record that limitation explicitly.
