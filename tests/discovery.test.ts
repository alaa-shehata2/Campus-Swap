import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createListingsService } from '../src/listings/service.js';
import { searchListings, getDetail } from '../src/listings/search.js';

async function seed() {
  const svc = createListingsService();
  const a = await svc.publish('u1', {
    side: 'offer',
    kind: 'skill',
    title: 'Python tutoring',
    description: 'I teach Python basics on campus.',
    category: 'tutoring',
    zone: 'North campus',
    images: [],
  });
  const b = await svc.publish('u2', {
    side: 'request',
    kind: 'skill',
    title: 'Need Python help',
    description: 'Looking for Python tutoring this week.',
    category: 'tutoring',
    zone: 'North campus',
    images: [],
  });
  const c = await svc.publish('u3', {
    side: 'offer',
    kind: 'item',
    title: 'Lend my drill',
    description: 'Lending a drill for weekend projects.',
    category: 'tools',
    zone: 'Dorms',
    images: [],
    modality: 'lend',
    returnTerm: 'Return within 7 days.',
  });
  const d = await svc.publish('u4', {
    side: 'offer',
    kind: 'skill',
    title: 'Draft lesson',
    description: 'Not yet visible.',
    category: 'tutoring',
    zone: 'North campus',
    images: [],
    status: 'Draft',
  });
  assert.equal(a.ok && b.ok && c.ok && d.ok, true);
  return svc;
}

const ANON = { anonymous: true } as const;

describe('discovery', () => {
  it('logged-out search works; paused/draft absent', async () => {
    const svc = await seed();
    const res = await searchListings(svc.store, {}, ANON);
    assert.equal(res.total, 3);
    assert.ok(res.items.every((l) => l.status === 'Active'));
  });

  it('combined filters narrow results', async () => {
    const svc = await seed();
    const res = await searchListings(
      svc.store,
      { side: 'offer', kind: 'skill', category: 'tutoring', zone: 'North' },
      ANON,
    );
    assert.equal(res.total, 1);
    assert.equal(res.items[0]?.title, 'Python tutoring');
  });

  it('keyword search matches title/description', async () => {
    const svc = await seed();
    const res = await searchListings(svc.store, { text: 'drill' }, ANON);
    assert.equal(res.total, 1);
    assert.equal(res.items[0]?.title, 'Lend my drill');
  });

  it('detail for visitors shows login CTA; compatible = opposite side + related category', async () => {
    const svc = await seed();
    const target = (await searchListings(svc.store, { text: 'Python tutoring' }, ANON)).items[0]!;
    const detail = await getDetail(svc.store, target.id, ANON);
    assert.ok(detail);
    assert.equal(detail!.loginCTA, true);
    assert.ok(detail!.compatible.length >= 1);
    assert.ok(
      detail!.compatible.every(
        (l) => l.side !== target.side && l.status === 'Active' && l.id !== target.id,
      ),
    );
    // incompatible-side listings never suggested
    assert.ok(detail!.compatible.every((l) => l.side === 'request'));
  });

  it('member detail has no login CTA', async () => {
    const svc = await seed();
    const target = (await searchListings(svc.store, { text: 'drill' }, ANON)).items[0]!;
    const detail = await getDetail(svc.store, target.id, { userId: 'u9' });
    assert.ok(detail);
    assert.equal(detail!.loginCTA, false);
  });

  it('non-Active detail is hidden from visitors and non-owners', async () => {
    const svc = createListingsService();
    const draft = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: 'Hidden draft',
      description: 'Not yet visible.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
      status: 'Draft',
    });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal(await getDetail(svc.store, draft.value.id, ANON), undefined);
    assert.equal(await getDetail(svc.store, draft.value.id, { userId: 'u2' }), undefined);
    assert.ok(await getDetail(svc.store, draft.value.id, { userId: 'u1' }));
  });
});
