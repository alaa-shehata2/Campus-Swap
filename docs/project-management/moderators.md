# Pilot Moderation Roster (D14)

> Launch blocked until 2 moderators are named (lead = human developer).
> Names below are **designated placeholders** — confirm or replace before launch.

| Role | Name | Status |
|---|---|---|
| Moderation lead | Human developer (repository owner) | designated |
| Volunteer moderator | Mariam El-Sayed | designated (pending confirmation) |
| Volunteer moderator | Omar Abdelrahman | designated (pending confirmation) |

## Activation checklist (at launch)

- [ ] Both volunteers confirmed + reachable (in-app contact works).
- [ ] Lead recorded the KFS consult outcome (`docs/legal/kfs-consult-note.md`).
- [ ] Each moderator holds a member account with the `moderator` role
      (`identity.setRole`, bootstrap-guarded; see `src/identity/service.ts`).
- [ ] Triage drill completed with a fixture report (see `tests/security-drill.test.ts`).
- [ ] Median triage latency target understood: ≤48h (D12).
