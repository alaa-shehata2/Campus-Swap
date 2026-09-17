# Changelog

## 2026-09-17 — Phase 3: Reviews + Reports + Moderation + Notifications (BL-11..BL-14)

- Reputation seam: blind bilateral reviews (one 1–5 + ≤1000 text per
  participant, Completed-only), both-in/14-day reveal, 48h edit, aggregate
  (average + count + distribution + history), one reviewee response, logged
  moderation voids.
- Moderation seam: reports with reason codes + triage states, sanctions
  (hide/warn/suspend/ban/unhide) with actor+reason+timestamp audit, stolen
  hide-first with instant case, owner-approved handover with preserved
  evidence; no delete APIs.
- Seams: listings `Hidden` state + systemHide/systemUnhide + owner
  deactivate cascade; identity restrict (suspend/ban enforced at login) +
  deactivate (profile hidden, login blocked); exchanges internal
  readExchange/readThread for case-gated modules.
- Notifications sink: in-app inbox for all 16 FR-N-1 event types, zero
  emails; lend-reminder helper. Domain events wired: proposals, schedule,
  completion, reveal/response, report lifecycle, sanctions, voids, handovers.
- Privacy: 12-mo message / 24-mo log retention clocks, purpose-scoped
  moderator reads (open report on the exchange's listings/participants;
  denied + logged otherwise).
- Moderator-role guards on all triage/sanction/handover powers; sessions
  revoked on restrict/deactivate; handover needs a second-moderator approver.
- 101 tests green (`npm test`), `tsc --noEmit` clean.

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
