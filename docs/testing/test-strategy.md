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

## Planned (later phases)

- Phase 2: propose/respond/expiry/freeze/cap-reject/auto-pause, schedule/
  complete/dispute/auto-complete (journey J3–J4).
- Phase 3: blind-reveal/response/aggregate, report/triage/sanction/
  handover-gate, inbox emission asserting zero emails (J5–J6).
- Launch gate: keyboard-only run, disclaimer presence on all 5 flows,
  Cairo labeling audit, triage drill with fixture report.
