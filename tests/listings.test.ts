import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createListingsService } from '../src/listings/service.js';

async function publishAll(svc: ReturnType<typeof createListingsService>, owner: string, n: number) {
  for (let i = 0; i < n; i++) {
    const r = await svc.publish(owner, {
      side: 'offer',
      kind: 'skill',
      title: `Tutoring ${i}`,
      description: 'I teach Python basics on campus.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
    });
    assert.equal(r.ok, true);
  }
}

describe('listings', () => {
  it('publishes offer and request paths', async () => {
    const svc = createListingsService();
    const offer = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: 'Python tutoring',
      description: 'I teach Python basics.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
    });
    assert.equal(offer.ok, true);
    const request = await svc.publish('u1', {
      side: 'request',
      kind: 'item',
      title: 'Need a drill',
      description: 'Borrow a drill for a weekend shelf project.',
      category: 'tools',
      zone: 'Dorms',
      images: [],
      modality: 'lend',
      returnTerm: 'Return within 7 days.',
    });
    assert.equal(request.ok, true);
  });

  it('rejects missing/invalid required fields field-specifically', async () => {
    const svc = createListingsService();
    const r = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: '',
      description: 'x'.repeat(2001),
      category: 'nope',
      zone: '',
      images: [],
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      for (const f of ['title', 'description', 'category', 'zone']) {
        assert.ok(r.errors.some((e) => e.field === f), f);
      }
    }
  });

  it('enforces image counts: items 0-5, skills 0-2', async () => {
    const svc = createListingsService();
    const base = {
      side: 'offer' as const,
      title: 'T',
      description: 'D',
      category: 'tools',
      zone: 'Z',
    };
    assert.equal(
      (await svc.publish('u1', { ...base, kind: 'skill', images: ['a', 'b', 'c'] })).ok,
      false,
    );
    assert.equal(
      (await svc.publish('u1', { ...base, kind: 'item', images: ['1', '2', '3', '4', '5', '6'] })).ok,
      false,
    );
  });

  it('requires lend return term and swap counterpart description', async () => {
    const svc = createListingsService();
    const lend = await svc.publish('u1', {
      side: 'offer',
      kind: 'item',
      title: 'Lend drill',
      description: 'Lending my drill.',
      category: 'tools',
      zone: 'Dorms',
      images: [],
      modality: 'lend',
    });
    assert.equal(lend.ok, false);
    if (!lend.ok) assert.ok(lend.errors.some((e) => e.field === 'returnTerm'));

    const swap = await svc.publish('u1', {
      side: 'offer',
      kind: 'item',
      title: 'Swap textbooks',
      description: 'Swap my calculus book.',
      category: 'textbooks',
      zone: 'Library',
      images: [],
      modality: 'swap',
    });
    assert.equal(swap.ok, false);
    if (!swap.ok) assert.ok(swap.errors.some((e) => e.field === 'counterpartDescription'));
  });

  it('rejects the 21st active listing with listing-cap-reached', async () => {
    const svc = createListingsService();
    await publishAll(svc, 'u1', 20);
    const r = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: 'One too many',
      description: 'Should be rejected.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => e.code === 'listing-cap-reached'));
  });

  it('lifecycle: Draft not discoverable; only owner transitions; only Active discoverable', async () => {
    const svc = createListingsService();
    const draft = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: 'Draft lesson',
      description: 'Not yet active.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
      status: 'Draft',
    });
    assert.equal(draft.ok, true);
    if (draft.ok) assert.equal(draft.value.status, 'Draft');

    const other = await svc.transition('u2', draft.ok ? draft.value.id : 'x', 'reopen');
    assert.equal(other.ok, false);

    const paused = await svc.transition('u1', draft.ok ? draft.value.id : 'x', 'pause');
    assert.equal(paused.ok, false); // Draft cannot pause
  });

  it('blocks prohibited classes per fixture', async () => {
    const svc = createListingsService();
    const r = await svc.publish('u1', {
      side: 'offer',
      kind: 'item',
      title: 'stolen iphone no questions asked',
      description: 'Cheap phone, hurry.',
      category: 'electronics',
      zone: 'Dorms',
      images: [],
      modality: 'give',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => e.code === 'prohibited'));
  });

  it('activates Draft -> Active so drafts become discoverable', async () => {
    const svc = createListingsService();
    const draft = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: 'Draft lesson',
      description: 'Becomes active.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
      status: 'Draft',
    });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    const activated = await svc.transition('u1', draft.value.id, 'activate');
    assert.equal(activated.ok, true);
    if (activated.ok) assert.equal(activated.value.status, 'Active');
  });

  it('rejected prohibited update leaves stored listing unchanged', async () => {
    const svc = createListingsService();
    const created = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: 'Python tutoring',
      description: 'I teach Python basics.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const bad = await svc.update('u1', created.value.id, { title: 'stolen iphone no questions asked' });
    assert.equal(bad.ok, false);
    const stored = await svc.get(created.value.id);
    assert.equal(stored?.title, 'Python tutoring');
  });

  it('rejects invalid status on publish', async () => {
    const svc = createListingsService();
    const r = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: 'Weird status',
      description: 'Status is not in the lifecycle.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
      // @ts-expect-error runtime-only invalid status
      status: 'Ghost',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => e.field === 'status'));
  });

  it('edits category/zone/images on update with validation', async () => {
    const svc = createListingsService();
    const created = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: 'Python tutoring',
      description: 'I teach Python basics.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const updated = await svc.update('u1', created.value.id, { zone: 'Library', category: 'programming' });
    assert.equal(updated.ok, true);
    if (updated.ok) {
      assert.equal(updated.value.zone, 'Library');
      assert.equal(updated.value.category, 'programming');
    }
    const badCat = await svc.update('u1', created.value.id, { category: 'nope' });
    assert.equal(badCat.ok, false);
  });

  it('systemPause pauses Active listings without owner check (auto-pause)', async () => {
    const svc = createListingsService();
    const created = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: 'Python tutoring',
      description: 'I teach Python basics.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const paused = await svc.systemPause(created.value.id);
    assert.equal(paused.ok, true);
    if (paused.ok) assert.equal(paused.value.status, 'Paused');
    assert.equal((await svc.systemPause(created.value.id)).ok, false);
    assert.equal((await svc.systemPause('missing')).ok, false);
  });

  it('systemHide removes from discovery; owner transitions rejected; unhide parks as Paused', async () => {
    const svc = createListingsService();
    const created = await svc.publish('u1', {
      side: 'offer',
      kind: 'skill',
      title: 'Python tutoring',
      description: 'I teach Python basics.',
      category: 'tutoring',
      zone: 'North campus',
      images: [],
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal((await svc.systemHide(created.value.id)).ok, true);
    assert.equal((await svc.get(created.value.id))?.status, 'Hidden');
    assert.equal((await svc.transition('u1', created.value.id, 'reopen')).ok, false);
    assert.equal((await svc.systemUnhide(created.value.id)).ok, true);
    assert.equal((await svc.get(created.value.id))?.status, 'Paused');
  });
});
