# Phase 1 — Identity + Listings + Public Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Phase 1 vertical slice (roadmap J0–J2: visitor browses/searches KFS listings; member signs up and publishes Offer/Request) covering FR-ID-1..5, FR-L-1..6, FR-D-1..3 (backlog BL-01..BL-06).

**Architecture:** Single-deployable TypeScript modular monolith (ADR-0001) with in-process seams: `identity` → `policy` ← `listings`; repository interfaces with in-memory adapters now, MySQL (ADR-0002) later without seam changes. One error shape, validation at the edge, Cairo-time labeling on datetimes.

**Tech Stack:** TypeScript 5.x, Node 24 built-in test runner (`node:test` + `assert/strict`), `node:crypto` scrypt for passwords, `tsc --noEmit` for typecheck. No web framework in Phase 1 (domain seams only; HTTP deferred).

**Spec:** `docs/requirements/{product,functional,non-functional}-requirements.md` (v2), `docs/architecture/architecture.md` §§2–5, `docs/project-management/{roadmap.md (Phase 1), backlog.md (BL-01..BL-06)}`.

## Global Constraints

- All mutations require a member session; visitors are read-only (FR-ID-2, S-1).
- Any email allowed; campus required (default `KFS University`), self-declared not verified; 18+ checkbox + rules acceptance required (FR-ID-1, D1).
- One account per email; duplicate rejected (FR-ID-5).
- Bio ≤500 chars; email never displayed (FR-ID-3/4).
- Listing: side offer/request × kind skill/item; title ≤80, description ≤2000; category from fixed taxonomy; images items 0–5 / skills 0–2; lifecycle Draft→Active⇄Paused→Archived, only Active discoverable; 20 active cap per member (FR-L-1..4).
- Item modality required: lend (return term required) | give | swap (counterpart description required) (FR-L-5).
- Prohibited classes blocked: haram, medical, legal, weapons, drugs/alcohol, stolen, sexual, commercial (FR-L-6).
- Discovery public incl. logged-out; filters side/kind/category/zone/availability additive; compatible = opposite side + same/related category + both Active; recency + category-match ranking; detail shows login CTA for visitors (FR-D-1..3).
- One error shape: `{ code, field?, message }`; field errors name the field + fix (NFR-U-3).
- Every behavior change has tests; no validation/security control disabled to pass (AGENTS.md).

---

### Task 1: Scaffold + common error/result types

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`
- Create: `src/common/errors.ts`
- Test: `tests/common-errors.test.ts` (shape assertion only)

**Interfaces:**
- Consumes: nothing.
- Produces: `FieldError { code: string; field?: string; message: string }`, `Result<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] }`, `ok(value)`, `fail(errors)`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ok, fail } from '../src/common/errors.js';

describe('errors', () => {
  it('ok wraps a value', () => {
    const r = ok(1);
    assert.equal(r.ok, true);
  });
  it('fail carries field errors', () => {
    const r = fail([{ code: 'required', field: 'email', message: 'Email is required.' }]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.errors[0].field, 'email');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/common-errors.test.ts`
Expected: FAIL (`src/common/errors.ts` missing).

- [ ] **Step 3: Write minimal implementation**

```typescript
export interface FieldError { code: string; field?: string; message: string }
export type Result<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T>(errors: FieldError[]): Result<T> => ({ ok: false, errors });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/common-errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json .gitignore src/common/errors.ts tests/common-errors.test.ts
git commit -m "feat(common): add Result/FieldError shape"
```

### Task 2: policy module (taxonomy + prohibited screening + disclaimers)

**Files:**
- Create: `src/policy/taxonomy.ts`, `src/policy/prohibited.ts`, `src/policy/disclaimers.ts`
- Test: `tests/policy.test.ts`

**Interfaces:**
- Consumes: `Result`, `FieldError` from Task 1.
- Produces: `CATEGORIES: string[]`, `RELATED: Record<string, string[]>`, `isProhibited(title, description): { blocked: boolean; reason?: string }`, `disclaimerFor(flow): string` for flows `signup | listing-create | proposal-accept | schedule-confirm | item-lend`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isProhibited } from '../src/policy/prohibited.js';
import { CATEGORIES } from '../src/policy/taxonomy.js';
import { disclaimerFor } from '../src/policy/disclaimers.js';

describe('policy', () => {
  it('exposes a fixed category taxonomy', () => {
    assert.ok(CATEGORIES.includes('tutoring') && CATEGORIES.includes('textbooks'));
  });
  it('blocks each prohibited class fixture', () => {
    for (const text of ['buy my viagra prescription medical diagnosis', 'lawyer legal representation for court', 'AK-47 rifle for sale', 'cocaine for sale', 'stolen iphone no questions asked', 'escort sexual services', 'promo: 50% off commercial store sale']) {
      assert.equal(isProhibited(text, '').blocked, true, text);
    }
  });
  it('allows a benign tutoring offer', () => {
    assert.equal(isProhibited('Python tutoring', 'I teach Python basics').blocked, false);
  });
  it('provides disclaimers for all 5 flows', () => {
    for (const f of ['signup', 'listing-create', 'proposal-accept', 'schedule-confirm', 'item-lend'] as const) {
      assert.match(disclaimerFor(f), /terms/i);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/policy.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Write minimal implementation**

```typescript
// taxonomy.ts
export const CATEGORIES = ['tutoring','programming','design','music','languages','textbooks','electronics','bikes','tools','furniture','other'] as const;
export type Category = (typeof CATEGORIES)[number];
export const RELATED: Record<string, string[]> = { tutoring: ['languages','programming'], programming: ['tutoring','design'], textbooks: ['other'], electronics: ['tools'], bikes: ['tools'], tools: ['electronics','bikes'], design: ['programming','music'], music: ['design'], languages: ['tutoring'], furniture: ['other'], other: [] };

// prohibited.ts — keyword screening per enumerated class (BR-5), returns reason code
const RULES: Array<[RegExp, string]> = [
  [/\b(viagra|diagnos(is|e)|prescription|medical (advice|treatment|clinic))\b/i, 'medical'],
  [/\b(lawyer|legal (advice|representation)|sue them|court defense)\b/i, 'legal'],
  [/\b(rifle|pistol|gun|ammo|ak-47|ammunition)\b/i, 'weapons'],
  [/\b(cocaine|heroin|weed for sale|alcohol delivery|vodka|whiskey sale)\b/i, 'drugs-alcohol'],
  [/\b(stolen|no questions asked)\b/i, 'stolen'],
  [/\b(escort|sexual services|onlyfans promo)\b/i, 'sexual'],
  [/\b(% off|sale now|commercial|promo code|buy now|discount store)\b/i, 'commercial'],
];
export function isProhibited(title: string, description: string): { blocked: boolean; reason?: string } {
  const text = `${title} ${description}`;
  for (const [re, reason] of RULES) if (re.test(text)) return { blocked: true, reason };
  return { blocked: false };
}

// disclaimers.ts
const FLOWS = ['signup','listing-create','proposal-accept','schedule-confirm','item-lend'] as const;
export type DisclaimerFlow = (typeof FLOWS)[number];
export function disclaimerFor(flow: DisclaimerFlow): string {
  return `Notice (${flow}): CampusSwap is a money-free student exchange. Use at your own judgment; platform has zero liability for damage, loss, or safety outcomes. See full Terms.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/policy tests/policy.test.ts
git commit -m "feat(policy): add taxonomy, prohibited screening, disclaimers"
```

### Task 3: identity module (signup/login/profile, BL-01/BL-02)

**Files:**
- Create: `src/identity/types.ts`, `src/identity/store.ts`, `src/identity/service.ts`
- Test: `tests/identity.test.ts`

**Interfaces:**
- Consumes: `Result`, `policy.disclaimerFor('signup')` text surfaced on signup.
- Produces: `register(input): Result<UserPublic>`, `authenticate(email, password): Result<Session>`, `getProfile(id): UserPublic | undefined`, `updateProfile(id, patch): Result<UserPublic>`; `UserPublic { id, displayName, campus, campusVerified: false, joinDate, bio?, skillTags?, availabilityNotes? }` (never email); session `{ token, userId }`.

Validation: email format any-domain; password ≥8; displayName required; campus required default `KFS University`; `ageConfirmed18` must be true; `rulesAccepted` must be true; duplicate email rejected; bio ≤500.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';

describe('identity', () => {
  it('accepts gmail/yahoo/KFS emails with campus default', () => {
    const svc = createIdentityService();
    for (const email of ['a@gmail.com', 'b@yahoo.com', 'c@kfs.edu.eg']) {
      const r = svc.register({ email, password: 'password1', displayName: 'Sam', campus: undefined, ageConfirmed18: true, rulesAccepted: true });
      assert.equal(r.ok, true);
    }
  });
  it('rejects missing campus / unchecked 18+ / unaccepted rules field-specifically', () => {
    const svc = createIdentityService();
    const r1 = svc.register({ email: 'x@gmail.com', password: 'password1', displayName: 'Sam', campus: '', ageConfirmed18: true, rulesAccepted: true });
    assert.equal(r1.ok, false); if (!r1.ok) assert.ok(r1.errors.some(e => e.field === 'campus'));
    const r2 = svc.register({ email: 'y@gmail.com', password: 'password1', displayName: 'Sam', campus: 'KFS University', ageConfirmed18: false, rulesAccepted: true });
    assert.equal(r2.ok, false); if (!r2.ok) assert.ok(r2.errors.some(e => e.field === 'ageConfirmed18'));
    const r3 = svc.register({ email: 'z@gmail.com', password: 'password1', displayName: 'Sam', campus: 'KFS University', ageConfirmed18: true, rulesAccepted: false });
    assert.equal(r3.ok, false); if (!r3.ok) assert.ok(r3.errors.some(e => e.field === 'rulesAccepted'));
  });
  it('rejects duplicate email and never exposes email in profile', () => {
    const svc = createIdentityService();
    const base = { password: 'password1', displayName: 'Sam', campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true };
    assert.equal(svc.register({ ...base, email: 'dup@gmail.com' }).ok, true);
    const dup = svc.register({ ...base, email: 'dup@gmail.com' });
    assert.equal(dup.ok, false);
    const me = svc.register({ ...base, email: 'me@gmail.com' });
    assert.equal(me.ok, true); if (me.ok) assert.ok(!('email' in me.value));
  });
  it('authenticates with password and rejects wrong password; bio cap enforced', () => {
    const svc = createIdentityService();
    svc.register({ email: 'l@gmail.com', password: 'password1', displayName: 'Sam', campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true });
    assert.equal(svc.authenticate('l@gmail.com', 'password1').ok, true);
    assert.equal(svc.authenticate('l@gmail.com', 'wrongpass1').ok, false);
    const me = svc.authenticate('l@gmail.com', 'password1');
    assert.equal(me.ok, true); if (me.ok) {
      const bad = svc.updateProfile(me.value.userId, { bio: 'x'.repeat(501) });
      assert.equal(bad.ok, false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/identity.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation** (scrypt password hash in store/service; ~120 lines; in-memory Map keyed by email/id; session tokens via `crypto.randomUUID()`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/identity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/identity tests/identity.test.ts
git commit -m "feat(identity): signup/login/profile with 18+ gate (BL-01, BL-02)"
```

### Task 4: listings module (CRUD/lifecycle/modalities/prohibited, BL-03/04/05)

**Files:**
- Create: `src/listings/types.ts`, `src/listings/store.ts`, `src/listings/service.ts`
- Test: `tests/listings.test.ts`

**Interfaces:**
- Consumes: `identity` userId (owner), `policy.isProhibited`, `policy.CATEGORIES`.
- Produces: `publish(ownerId, input): Result<Listing>`, `update(ownerId, id, patch)`, `transition(ownerId, id, to: 'pause'|'archive'|'reopen')`, `get(id)`; `Listing { id, ownerId, side: 'offer'|'request', kind: 'skill'|'item', title, description, category, zone, images: string[], status: 'Draft'|'Active'|'Paused'|'Archived', modality?: 'lend'|'give'|'swap', returnTerm?: string, counterpartDescription?: string, createdAt }`.

Rules: required-field validation (title ≤80, desc ≤2000, image counts items 0–5/skills 0–2); prohibited screened; modality required for items (`lend` needs returnTerm, `swap` needs counterpartDescription); 20-active cap (21st fails with `listing-cap-reached`); only owner transitions; `Locked` is derived later (Phase 2), not stored.

- [ ] **Step 1: Write the failing test** (publish offer+request paths; missing title rejected; lend-without-term rejected; swap-without-counterpart rejected; 21st publish rejected; paused absent from search — search tested in Task 5, here assert status).
- [ ] **Step 2: Run test to verify it fails** (`node --test tests/listings.test.ts`, expect FAIL).
- [ ] **Step 3: Write minimal implementation.**
- [ ] **Step 4: Run test to verify it passes** (expect PASS).
- [ ] **Step 5: Commit** (`git commit -m "feat(listings): Offer/Request CRUD, lifecycle, modalities (BL-03, BL-04, BL-05)"`).

### Task 5: discovery (public browse/search/filter/detail + compatible, BL-06)

**Files:**
- Create: `src/listings/search.ts`
- Test: `tests/discovery.test.ts`

**Interfaces:**
- Consumes: listings store + `RELATED` taxonomy + `reputation` stub (owner summary passed in by caller; Phase 1 shows `ownerRating?: { average, count } | undefined`).
- Produces: `searchListings(q: { text?, side?, kind?, category?, zone?, availability? }, viewer: { userId } | { anonymous: true }): { items: Listing[], total: number }` (Active only, additive filters, recency-first, category-match boost), `getDetail(id, viewer): { listing, ownerRating?, loginCTA: boolean, compatible: Listing[] }` (compatible = opposite side + same/related category + Active; visitors get `loginCTA: true` and no action affordances).

- [ ] **Step 1: Write the failing test** (logged-out search works; combined filters narrow; incompatible-side never suggested; visitor detail shows login CTA; paused/draft absent).
- [ ] **Step 2: Run test to verify it fails** (expect FAIL).
- [ ] **Step 3: Write minimal implementation.**
- [ ] **Step 4: Run test to verify it passes** (expect PASS) + full suite `node --test tests/` green + `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** (`git commit -m "feat(discovery): public browse/search/detail with compatible hints (BL-06)"`).

### Task 6: Docs + verification + PR

- [ ] Update `README.md` (Phase 1 scope + how to run tests), `docs/testing/test-strategy.md` (Phase 1 seam tests — file was empty), `CHANGELOG.md` (Phase 1 entry). Keep `architecture.md` unchanged (no seam changes).
- [ ] Run `node --test tests/` (expect all pass) + `npx tsc --noEmit` (expect clean). Record evidence.
- [ ] Request code review (requesting-code-review skill), fix Critical/Important.
- [ ] Push branch, open PR against `main`, report URL; merge only on human approval (human = final authority per AGENTS.md).
