import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';

async function setup() {
  const identity = createIdentityService();
  const listings = createListingsService();
  const a = await identity.register({
    email: 'alice@gmail.com', password: 'password1', displayName: 'Alice',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  const b = await identity.register({
    email: 'bob@gmail.com', password: 'password1', displayName: 'Bob',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  const c = await identity.register({
    email: 'carol@gmail.com', password: 'password1', displayName: 'Carol',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  assert.equal(a.ok && b.ok && c.ok, true);
  if (!a.ok || !b.ok || !c.ok) throw new Error('setup failed');
  const offer = await listings.publish(a.value.id, {
    side: 'offer', kind: 'skill', title: 'Python tutoring',
    description: 'I teach Python basics on campus.', category: 'tutoring',
    zone: 'North campus', images: [],
  });
  const request = await listings.publish(b.value.id, {
    side: 'request', kind: 'skill', title: 'Need Python help',
    description: 'Looking for Python tutoring.', category: 'tutoring',
    zone: 'North campus', images: [],
  });
  assert.equal(offer.ok && request.ok, true);
  if (!offer.ok || !request.ok) throw new Error('setup failed');

  const exchanges = createExchangesService({ listings, identity });
  const p = await exchanges.propose(a.value.id, {
    sideAListingIds: [offer.value.id], sideBListingIds: [request.value.id],
    terms: 'Two sessions.',
  });
  assert.equal(p.ok, true);
  if (!p.ok) throw new Error('setup failed');
  const acc = await exchanges.respond(b.value.id, p.value.id, 'accept');
  assert.equal(acc.ok && 'exchange' in acc.value, true);
  if (!acc.ok || !('exchange' in acc.value)) throw new Error('setup failed');
  return { identity, exchanges, aid: a.value.id, bid: b.value.id, cid: c.value.id, exchangeId: acc.value.exchange.id };
}

describe('thread', () => {
  it('participants exchange plain-text messages', async () => {
    const { exchanges, aid, bid, exchangeId } = await setup();
    assert.equal((await exchanges.postMessage(aid, exchangeId, 'See you at the library!')).ok, true);
    assert.equal((await exchanges.postMessage(bid, exchangeId, 'Bringing my laptop.')).ok, true);
    const inbox = await exchanges.getMessages(bid, exchangeId);
    assert.equal(inbox.ok, true);
    if (!inbox.ok) return;
    assert.equal(inbox.value.length, 2);
    assert.equal(inbox.value[0]?.text, 'See you at the library!');
  });

  it('non-participant cannot post or read', async () => {
    const { exchanges, cid, exchangeId } = await setup();
    const posted = await exchanges.postMessage(cid, exchangeId, 'Let me in.');
    assert.equal(posted.ok, false);
    if (!posted.ok) assert.ok(posted.errors.some((e) => e.code === 'not-participant'));
    const read = await exchanges.getMessages(cid, exchangeId);
    assert.equal(read.ok, false);
    if (!read.ok) assert.ok(read.errors.some((e) => e.code === 'not-participant'));
  });

  it('blocked pair cannot message', async () => {
    const { identity, exchanges, aid, bid, exchangeId } = await setup();
    await identity.block(aid, bid);
    const r = await exchanges.postMessage(bid, exchangeId, 'Are you there?');
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => e.code === 'blocked'));
  });

  it('empty and over-long messages rejected', async () => {
    const { exchanges, aid, exchangeId } = await setup();
    assert.equal((await exchanges.postMessage(aid, exchangeId, '   ')).ok, false);
    assert.equal((await exchanges.postMessage(aid, exchangeId, 'x'.repeat(2001))).ok, false);
  });
});
