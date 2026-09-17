# Changelog

## 2026-09-17 — Phase 2: Proposals + Exchange + Scheduling + Completion (BL-07..BL-10)

- Exchanges seam: reciprocal proposals (≥1 listing/side, terms required),
  5-open cap with `proposal-cap-reached` + derived lock, decline/withdraw/
  7-day expiry, counterparty-only accept creating a Scheduled exchange.
- Accept auto-pauses referenced listings (`listings.systemPause`); second
  accept `listing-paused` until owner reopens; terms frozen at accept.
- Scheduling with Cairo-labeled time + place, public-spot nudge, private-place
  safety acknowledgement gate.
- Two-step completion (Done → Confirm/Dispute ≤7 days, auto-complete on
  silence with log), schedule-less completion only with override + reason,
  cancellation with reason codes.
- Participant-only plain-text thread; identity block/mute enforced on
  proposals and messages.
- 60 tests green (`npm test`), `tsc --noEmit` clean.

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
