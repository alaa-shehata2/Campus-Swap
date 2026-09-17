import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function setup() {
  const identity = createIdentityService();
  const listings = createListingsService();
  const a = identity.register({
    email: 'alice@gmail.com', password: 'password1', displayName: 'Alice',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  const b = identity.register({
    email: 'bob@gmail.com', password: 'password1', displayName: 'Bob',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  const c = identity.register({
    email: 'carol@gmail.com', password: 'password1', displayName: 'Carol',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  assert.equal(a.ok && b.ok && c.ok, true);
  if (!a.ok || !b.ok || !c.ok) throw new Error('setup failed');
  const offer = listings.publish(a.value.id, {
    side: 'offer', kind: 'skill', title: 'Python tutoring',
    description: 'I teach Python basics on campus.', category: 'tutoring',
    zone: 'North campus', images: [],
  });
  const request = listings.publish(b.value.id, {
    side: 'request', kind: 'skill', title: 'Need Python help',
    description: 'Looking for Python tutoring.', category: 'tutoring',
    zone: 'North campus', images: [],
  });
  assert.equal(offer.ok && request.ok, true);
  if (!offer.ok || !request.ok) throw new Error('setup failed');

  let now = Date.parse('2026-03-10T10:00:00.000Z');
  const exchanges = createExchangesService({ listings, identity }, { now: () => now });
  const p = exchanges.propose(a.value.id, {
    sideAListingIds: [offer.value.id], sideBListingIds: [request.value.id],
    terms: 'Two sessions.',
  });
  assert.equal(p.ok, true);
  if (!p.ok) throw new Error('setup failed');
  const acc = exchanges.respond(b.value.id, p.value.id, 'accept');
  assert.equal(acc.ok && 'exchange' in acc.value, true);
  if (!acc.ok || !('exchange' in acc.value)) throw new Error('setup failed');
  return {
    exchanges, aid: a.value.id, bid: b.value.id, cid: c.value.id,
    exchangeId: acc.value.exchange.id,
    future: new Date(now + 2 * DAY_MS).toISOString(),
    past: new Date(now - DAY_MS).toISOString(),
  };
}

describe('schedule', () => {
  it('participant sets Cairo-labeled time + place with public-spot nudge', () => {
    const { exchanges, aid, exchangeId, future } = setup();
    const r = exchanges.schedule(aid, exchangeId, {
      at: future, place: 'KFS Library main hall',
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.match(r.value.safetyNudge, /public/i);
    assert.match(r.value.exchange.schedule?.at ?? '', /Cairo time/);
    assert.equal(r.value.exchange.schedule?.place, 'KFS Library main hall');
  });

  it('non-participant cannot schedule', () => {
    const { exchanges, cid, exchangeId, future } = setup();
    assert.equal(
      exchanges.schedule(cid, exchangeId, { at: future, place: 'Library' }).ok,
      false,
    );
  });

  it('rejects invalid or past times and missing place', () => {
    const { exchanges, aid, exchangeId, past } = setup();
    const bad = exchanges.schedule(aid, exchangeId, { at: 'soon-ish', place: 'Library' });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.ok(bad.errors.some((e) => e.code === 'schedule-invalid'));
    const old = exchanges.schedule(aid, exchangeId, { at: past, place: 'Library' });
    assert.equal(old.ok, false);
    if (!old.ok) assert.ok(old.errors.some((e) => e.code === 'schedule-past'));
    const noPlace = exchanges.schedule(aid, exchangeId, {
      at: new Date(Date.parse('2026-03-10T10:00:00.000Z') + 2 * DAY_MS).toISOString(), place: '  ',
    });
    assert.equal(noPlace.ok, false);
    if (!noPlace.ok) assert.ok(noPlace.errors.some((e) => e.field === 'place'));
  });

  it('private residence needs safety acknowledgement, then accepted', () => {    const { exchanges, aid, exchangeId, future } = setup();
    const unacked = exchanges.schedule(aid, exchangeId, {
      at: future, place: 'My apartment, Block C',
    });
    assert.equal(unacked.ok, false);
    if (!unacked.ok) assert.ok(unacked.errors.some((e) => e.code === 'safety-ack-required'));
    const acked = exchanges.schedule(aid, exchangeId, {
      at: future, place: 'My apartment, Block C', acknowledgedSafetyReminder: true,
    });
    assert.equal(acked.ok, true);
  });

  it('hostel counts as private; schedule frozen after Done-mark', () => {
    const { exchanges, aid, bid, exchangeId, future } = setup();
    const hostel = exchanges.schedule(aid, exchangeId, { at: future, place: 'Youth hostel downtown' });
    assert.equal(hostel.ok, false);
    if (!hostel.ok) assert.ok(hostel.errors.some((e) => e.code === 'safety-ack-required'));
    assert.equal(
      exchanges.schedule(aid, exchangeId, { at: future, place: 'KFS Library main hall' }).ok,
      true,
    );
    assert.equal(exchanges.markDone(aid, exchangeId).ok, true);
    const moved = exchanges.schedule(bid, exchangeId, { at: future, place: 'Campus café' });
    assert.equal(moved.ok, false);
  });
});
