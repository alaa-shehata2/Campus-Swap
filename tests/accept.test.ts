import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';

async function setup() {
  const identity = createIdentityService();
  const listings = createListingsService();
  const ids: Record<string, string> = {};
  for (const [key, email] of [['a', 'alice@gmail.com'], ['b', 'bob@gmail.com'], ['c', 'carol@gmail.com']] as const) {
    const r = await identity.register({
      email, password: 'password1', displayName: key.toUpperCase(),
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    assert.equal(r.ok, true);
    if (r.ok) ids[key] = r.value.id;
  }
  const offer = await listings.publish(ids['a'], {
    side: 'offer', kind: 'skill', title: 'Python tutoring',
    description: 'I teach Python basics on campus.', category: 'tutoring',
    zone: 'North campus', images: [],
  });
  const reqB = await listings.publish(ids['b'], {
    side: 'request', kind: 'skill', title: 'Need Python help',
    description: 'Looking for Python tutoring.', category: 'tutoring',
    zone: 'North campus', images: [],
  });
  const reqC = await listings.publish(ids['c'], {
    side: 'request', kind: 'skill', title: 'Python for exams',
    description: 'Exam prep help wanted.', category: 'tutoring',
    zone: 'Library', images: [],
  });
  assert.equal(offer.ok && reqB.ok && reqC.ok, true);
  if (!offer.ok || !reqB.ok || !reqC.ok) throw new Error('setup failed');
  const exchanges = createExchangesService({ listings, identity });
  return { identity, listings, exchanges, ids, offer: offer.value, reqB: reqB.value, reqC: reqC.value };
}

describe('accept', () => {
  it('accept creates a Scheduled exchange and auto-pauses referenced listings', async () => {
    const { exchanges, listings, ids, offer, reqB } = await setup();
    const p = await exchanges.propose(ids['a'], {
      sideAListingIds: [offer.id], sideBListingIds: [reqB.id], terms: 'Two sessions.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    const acc = await exchanges.respond(ids['b'], p.value.id, 'accept');
    assert.equal(acc.ok, true);
    if (!acc.ok || !('exchange' in acc.value)) return;
    assert.equal(acc.value.proposal.status, 'Accepted');
    assert.equal(acc.value.exchange.status, 'Scheduled');
    assert.equal((await listings.get(offer.id))?.status, 'Paused');
    assert.equal((await listings.get(reqB.id))?.status, 'Paused');
  });

  it('only the counterparty can accept', async () => {
    const { exchanges, ids, offer, reqB } = await setup();
    const p = await exchanges.propose(ids['a'], {
      sideAListingIds: [offer.id], sideBListingIds: [reqB.id], terms: 'Two sessions.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    assert.equal((await exchanges.respond(ids['a'], p.value.id, 'accept')).ok, false);
    assert.equal((await exchanges.respond(ids['c'], p.value.id, 'accept')).ok, false);
  });

  it('second accept blocked while listing paused; owner reopen releases', async () => {
    const { exchanges, listings, ids, offer, reqB, reqC } = await setup();
    const p1 = await exchanges.propose(ids['a'], {
      sideAListingIds: [offer.id], sideBListingIds: [reqB.id], terms: 'Deal one.',
    });
    const p2 = await exchanges.propose(ids['a'], {
      sideAListingIds: [offer.id], sideBListingIds: [reqC.id], terms: 'Deal two.',
    });
    assert.equal(p1.ok && p2.ok, true);
    if (!p1.ok || !p2.ok) return;
    assert.equal((await exchanges.respond(ids['b'], p1.value.id, 'accept')).ok, true);

    const blocked = await exchanges.respond(ids['c'], p2.value.id, 'accept');
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.ok(blocked.errors.some((e) => e.code === 'listing-paused'));
    // failed accept is side-effect free: proposal stays Proposed, no exchange
    assert.equal((await exchanges.getProposal(ids['a'], p2.value.id))?.status, 'Proposed');

    const reopened = await listings.transition(ids['a'], offer.id, 'reopen');
    assert.equal(reopened.ok, true);
    const second = await exchanges.respond(ids['c'], p2.value.id, 'accept');
    assert.equal(second.ok, true);
  });

  it('terms freeze on accept: proposal and exchange carry original terms', async () => {
    const { exchanges, ids, offer, reqB } = await setup();
    const p = await exchanges.propose(ids['a'], {
      sideAListingIds: [offer.id], sideBListingIds: [reqB.id], terms: 'Original terms.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    const acc = await exchanges.respond(ids['b'], p.value.id, 'accept');
    assert.equal(acc.ok, true);
    if (!acc.ok || !('exchange' in acc.value)) return;
    assert.equal(acc.value.proposal.terms, 'Original terms.');
    assert.equal(acc.value.exchange.terms, 'Original terms.');
    assert.equal((await exchanges.getProposal(ids['b'], p.value.id))?.terms, 'Original terms.');
    // strangers cannot read the private negotiation
    assert.equal(await exchanges.getProposal('stranger', p.value.id), undefined);
    assert.equal(await exchanges.getExchange('stranger', acc.value.exchange.id), undefined);
  });
});
