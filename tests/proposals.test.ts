import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

async function setup() {
  const identity = createIdentityService();
  const listings = createListingsService();
  const alice = await identity.register({
    email: 'alice@gmail.com',
    password: 'password1',
    displayName: 'Alice',
    campus: 'KFS University',
    ageConfirmed18: true,
    rulesAccepted: true,
  });
  const bob = await identity.register({
    email: 'bob@gmail.com',
    password: 'password1',
    displayName: 'Bob',
    campus: 'KFS University',
    ageConfirmed18: true,
    rulesAccepted: true,
  });
  assert.equal(alice.ok && bob.ok, true);
  if (!alice.ok || !bob.ok) throw new Error('setup failed');
  const aid = alice.value.id;
  const bid = bob.value.id;

  const offer = await listings.publish(aid, {
    side: 'offer',
    kind: 'skill',
    title: 'Python tutoring',
    description: 'I teach Python basics on campus.',
    category: 'tutoring',
    zone: 'North campus',
    images: [],
  });
  const request = await listings.publish(bid, {
    side: 'request',
    kind: 'skill',
    title: 'Need Python help',
    description: 'Looking for Python tutoring this week.',
    category: 'tutoring',
    zone: 'North campus',
    images: [],
  });
  assert.equal(offer.ok && request.ok, true);
  if (!offer.ok || !request.ok) throw new Error('setup failed');

  let now = Date.now();
  const exchanges = createExchangesService(
    { listings, identity },
    { now: () => now },
  );
  return { identity, listings, exchanges, aid, bid, offer: offer.value, request: request.value, setNow: (t: number) => { now = t; }, now: () => now };
}

describe('proposals', () => {
  it('creates a reciprocal proposal linking one listing per side', async () => {
    const { exchanges, aid, offer, request } = await setup();
    const r = await exchanges.propose(aid, {
      sideAListingIds: [offer.id],
      sideBListingIds: [request.id],
      terms: 'Two one-hour sessions this week.',
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value.status, 'Proposed');
  });

  it('rejects one-sided proposals', async () => {
    const { exchanges, aid, offer } = await setup();
    const r = await exchanges.propose(aid, {
      sideAListingIds: [offer.id],
      sideBListingIds: [],
      terms: 'Free help, no return.',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => e.code === 'one-sided'));
  });

  it('rejects proposals where side B is not a single other owner', async () => {
    const { exchanges, aid, offer } = await setup();
    const r = await exchanges.propose(aid, {
      sideAListingIds: [offer.id],
      sideBListingIds: [offer.id],
      terms: 'Self-deal.',
    });
    assert.equal(r.ok, false);
  });

  it('holds 5 open proposals; the 6th is rejected with proposal-cap-reached', async () => {
    const { listings, exchanges, aid, request } = await setup();
    for (let i = 0; i < 5; i++) {
      const extra = await listings.publish(aid, {
        side: 'offer',
        kind: 'skill',
        title: `Lesson ${i}`,
        description: 'Extra offer for cap test.',
        category: 'tutoring',
        zone: 'North campus',
        images: [],
      });
      assert.equal(extra.ok, true);
      if (!extra.ok) return;
      const p = await exchanges.propose(aid, {
        sideAListingIds: [extra.value.id],
        sideBListingIds: [request.id],
        terms: `Deal ${i}.`,
      });
      assert.equal(p.ok, true);
    }
    const sixth = await exchanges.propose(aid, {
      sideAListingIds: [(await listings.publish(aid, {
        side: 'offer', kind: 'skill', title: 'Sixth lesson', description: 'Sixth offer.',
        category: 'tutoring', zone: 'North campus', images: [],
      }) as { ok: true; value: { id: string } }).value.id],
      sideBListingIds: [request.id],
      terms: 'One too many.',
    });
    assert.equal(sixth.ok, false);
    if (!sixth.ok) {
      assert.ok(sixth.errors.some((e) => e.code === 'proposal-cap-reached'));
      assert.match(sixth.errors[0]?.message ?? '', /another listing|check back/i);
    }
    const lock = await exchanges.lockStatus(request.id);
    assert.equal(lock.locked, true);
    assert.equal(lock.openCount, 5);
  });

  it('withdrawal allowed pre-accept by either side; frees a cap slot', async () => {
    const { exchanges, aid, bid, offer, request } = await setup();
    const p = await exchanges.propose(aid, {
      sideAListingIds: [offer.id],
      sideBListingIds: [request.id],
      terms: 'Two sessions.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    const w = await exchanges.withdraw(bid, p.value.id);
    assert.equal(w.ok, true);
    if (w.ok) assert.equal(w.value.status, 'Withdrawn');
    assert.equal((await exchanges.lockStatus(request.id)).openCount, 0);
  });

  it('counterparty declines; proposer cannot decline own proposal', async () => {
    const { exchanges, aid, bid, offer, request } = await setup();
    const p = await exchanges.propose(aid, {
      sideAListingIds: [offer.id],
      sideBListingIds: [request.id],
      terms: 'Two sessions.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    assert.equal((await exchanges.respond(aid, p.value.id, 'decline')).ok, false);
    const d = await exchanges.respond(bid, p.value.id, 'decline');
    assert.equal(d.ok, true);
    if (d.ok && 'status' in d.value) assert.equal(d.value.status, 'Declined');
  });

  it('proposals expire after 7 days via runExpiry', async () => {
    const ctx = await setup();
    const p = await ctx.exchanges.propose(ctx.aid, {
      sideAListingIds: [ctx.offer.id],
      sideBListingIds: [ctx.request.id],
      terms: 'Two sessions.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    ctx.setNow(ctx.now() + 8 * DAY_MS);
    const expired = await ctx.exchanges.runExpiry(ctx.now());
    assert.equal(expired.length, 1);
    assert.equal(expired[0]?.status, 'Expired');
    assert.equal((await ctx.exchanges.lockStatus(ctx.request.id)).openCount, 0);
  });

  it('blocked pairs cannot propose', async () => {
    const { identity, exchanges, aid, bid, offer, request } = await setup();
    await identity.block(aid, bid);
    const r = await exchanges.propose(bid, {
      sideAListingIds: [request.id],
      sideBListingIds: [offer.id],
      terms: 'Blocked deal.',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => e.code === 'blocked'));
  });

  it('decline frees a cap slot', async () => {
    const { exchanges, aid, bid, offer, request } = await setup();
    const p = await exchanges.propose(aid, {
      sideAListingIds: [offer.id],
      sideBListingIds: [request.id],
      terms: 'Deal.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    assert.equal((await exchanges.lockStatus(request.id)).openCount, 1);
    assert.equal((await exchanges.respond(bid, p.value.id, 'decline')).ok, true);
    assert.equal((await exchanges.lockStatus(request.id)).openCount, 0);
  });

  it('withdraw-after-accept and respond-after-expiry are rejected', async () => {
    const ctx = await setup();
    const p = await ctx.exchanges.propose(ctx.aid, {
      sideAListingIds: [ctx.offer.id],
      sideBListingIds: [ctx.request.id],
      terms: 'Deal.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    assert.equal((await ctx.exchanges.respond(ctx.bid, p.value.id, 'accept')).ok, true);
    assert.equal((await ctx.exchanges.withdraw(ctx.aid, p.value.id)).ok, false);

    const ctx2 = await setup();
    const q = await ctx2.exchanges.propose(ctx2.aid, {
      sideAListingIds: [ctx2.offer.id],
      sideBListingIds: [ctx2.request.id],
      terms: 'Deal.',
    });
    assert.equal(q.ok, true);
    if (!q.ok) return;
    ctx2.setNow(ctx2.now() + 8 * DAY_MS);
    await ctx2.exchanges.runExpiry(ctx2.now());
    assert.equal((await ctx2.exchanges.respond(ctx2.bid, q.value.id, 'decline')).ok, false);
  });
});
