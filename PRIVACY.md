# CampusSwap — Privacy Notice (DRAFT)

> **Status: DRAFT — not signed off.** Human-developer sign-off required before
> pilot launch (launch-gate item §10.1). Data controller: [to be filled —
> human developer / entity]. Contact: [to be filled].

## 1. Data we collect (and why) — data minimization (P-1)

| Data | Purpose |
|---|---|
| Signup/profile (display name, email, password hash, self-declared campus, bio ≤500, skill tags, availability) | accounts, discovery, reputation |
| Listings, proposals, exchanges, schedules | the exchange itself |
| Exchange text messages | coordination between participants |
| Reviews + responses | reputation |
| Reports, sanctions, audit log, handover log | safety + moderation (S-5) |
| Notification inbox items | in-app updates (D9: no email/SMS/push in MVP) |

We collect no location tracking, no real-face-photo requirement, no payment data.

## 2. Visibility (P-2, P-5)

- **Email is never displayed**, sold, or shared. Login/ownership only.
- Listings + reputation are public (logged-out included). Precise meeting
  places are visible only to exchange participants.
- Campus is self-declared and labeled `self-declared (not verified)`.
- Uploaded images are stripped of location metadata before others can see them (P-6).

## 3. Moderator access (P-4)

Message contents are visible to moderators **only on an opened report case**,
and **every access is logged** with moderator, context, and timestamp. No
bulk export in MVP.

## 4. Retention, then anonymize (P-3)

| Data | Retained | Then |
|---|---|---|
| Exchange messages + proposal history | 12 months after exchange closure | anonymized (counts preserved, text dropped) |
| Reports + moderation logs | 24 months | anonymized |
| Notification inbox | with the account | deleted with the account |

## 5. Your rights

- **Deactivate anytime:** profile and listings hidden immediately.
- **Delete/anonymize on request within 30 days**, except legal or moderation
  holds disclosed here (open cases, handovers, bans under appeal).
- Request via [contact — to be filled]. Under-age accounts are suspended (BR-9).

## 6. Security

Scrypt-hashed passwords, server-side sessions, owner-only writes, audited
moderator actions. Report vulnerabilities per `SECURITY.md`. No system is
perfect — minimize what you share in messages.

---
*Draft prepared 2026-09-17. Owner sign-off: ______________________ Date: ______*
