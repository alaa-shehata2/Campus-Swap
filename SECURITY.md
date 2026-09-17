# Security Policy

> Contact: **[to be filled — security contact email]**. Replace this placeholder
> before launch (launch-gate item §10.5); reports to an unwatched address are
> the same as no contact.

## Scope

CampusSwap pilot (KFS University): member accounts, listings, proposals and
exchanges, reviews, reports and moderation, and the in-app notification inbox.
Out of scope for this policy: the university's own infrastructure.

## How to report

Email the contact above with: what happened, where (listing/user/exchange),
steps to reproduce, and any screenshots (max 3 images, as in-app reports).
Do not probe other members' accounts or exfiltrate data — report and stop.

## Triage SLA

- Dangerous content (weapons, stolen goods, harassment, unsafe behavior):
  first response ≤24h (target).
- Pilot SLA: median report triage ≤48h (D12), tracked on the metrics dashboard.
- Stolen-item reports hide the listing first; law-enforcement handover only
  with platform-owner approval and preserved evidence (see `TERMS.md` §7).

## What happens next

Valid reports enter the moderation queue (`Received → Under review →
Resolved`) with reporter status updates in-app. Sanctions (hide / warn /
suspend / ban) are audit-logged with actor, reason, and timestamp. The
reported party is notified only if action is taken.

## Ground rules

- No bounty program in the pilot; credit in the changelog on request.
- The triage path is exercised before launch with a fixture report —
  see `tests/security-drill.test.ts`.
