# Changelog

## 2026-09-17 — Phase 1: Identity + Listings + Public Discovery (BL-01..BL-06)

- Identity seam: any-email signup with campus default (KFS), 18+ gate, rules
  accept, scrypt auth, self-declared campus profile, bio ≤500, email never exposed.
- Policy seam: fixed category taxonomy + related-category map, prohibited-class
  screening (haram/medical/legal/weapons/drugs-alcohol/stolen/sexual/commercial),
  disclaimers for all 5 flows.
- Listings seam: Offer/Request publish (skill/item), required-field validation,
  image caps, Draft/Active/Paused/Archived lifecycle, 20-active cap,
  lend/give/swap modality rules, owner-only transitions.
- Discovery: public logged-out browse/search/filter/detail, additive filters,
  opposite-side + same/related-category compatible hints, visitor login CTA.
- 23 tests green (`npm test`), `tsc --noEmit` clean.
