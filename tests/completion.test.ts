import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function setup(withSchedule = true) {
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
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) throw new Error('setup failed');
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
  if (withSchedule) {
    const s = exchanges.schedule(a.value.id, acc.value.exchange.id, {
      at: new Date(now + 2 * DAY_MS).toISOString(), place: 'KFS Library main hall',
    });
    assert.equal(s.ok, true);
  }
  return {
    exchanges, aid: a.value.id, bid: b.value.id,
    exchangeId: acc.value.exchange.id,
    setNow: (t: number) => { now = t; }, now: () => now,
  };
}

describe('completion', () => {
  it('full loop: A marks Done, B confirms → Completed', () => {
    const { exchanges, aid, bid, exchangeId } = setup();
    const done = exchanges.markDone(aid, exchangeId);
    assert.equal(done.ok, true);
    // A cannot confirm their own Done-mark
    assert.equal(exchanges.confirm(aid, exchangeId).ok, false);
    const confirmed = exchanges.confirm(bid, exchangeId);
    assert.equal(confirmed.ok, true);
    if (confirmed.ok) assert.equal(confirmed.value.status, 'Completed');
  });

  it('schedule-less completion rejected without override + reason', () => {
    const ctx = setup(false);
    const bare = ctx.exchanges.markDone(ctx.aid, ctx.exchangeId);
    assert.equal(bare.ok, false);
    if (!bare.ok) assert.ok(bare.errors.some((e) => e.code === 'schedule-required'));
    const over = ctx.exchanges.markDone(ctx.aid, ctx.exchangeId, {
      overrideReason: 'Met on campus spontaneously, exchanged on the spot.',
    });
    assert.equal(over.ok, true);
  });

  it('B disputes within 7 days → Disputed; late confirm rejected', () => {
    const ctx = setup();
    assert.equal(ctx.exchanges.markDone(ctx.aid, ctx.exchangeId).ok, true);
    const disputed = ctx.exchanges.dispute(ctx.bid, ctx.exchangeId);
    assert.equal(disputed.ok, true);
    if (disputed.ok) assert.equal(disputed.value.status, 'Disputed');

    const ctx2 = setup();
    assert.equal(ctx2.exchanges.markDone(ctx2.aid, ctx2.exchangeId).ok, true);
    ctx2.setNow(ctx2.now() + 8 * DAY_MS);
    const late = ctx2.exchanges.confirm(ctx2.bid, ctx2.exchangeId);
    assert.equal(late.ok, false);
    if (!late.ok) assert.ok(late.errors.some((e) => e.code === 'confirmation-window-passed'));
  });

  it('7-day silence triggers auto-complete with log', () => {
    const ctx = setup();
    assert.equal(ctx.exchanges.markDone(ctx.aid, ctx.exchangeId).ok, true);
    ctx.setNow(ctx.now() + 8 * DAY_MS);
    const done = ctx.exchanges.runAutoComplete(ctx.now());
    assert.equal(done.length, 1);
    assert.equal(done[0]?.status, 'Completed');
    assert.ok(done[0]?.log.some((l) => /auto-complete/i.test(l)));
  });

  it('cancellation requires a reason; either participant may cancel', () => {
    const ctx = setup();
    const noReason = ctx.exchanges.cancel(ctx.bid, ctx.exchangeId, { reason: '' as never });
    assert.equal(noReason.ok, false);
    const cancelled = ctx.exchanges.cancel(ctx.bid, ctx.exchangeId, {
      reason: 'no-show', detail: 'Nobody came to the library.',
    });
    assert.equal(cancelled.ok, true);
    if (cancelled.ok) {
      assert.equal(cancelled.value.status, 'Cancelled');
      assert.equal(cancelled.value.cancelReason, 'no-show');
    }
    // terminal: no further completion
    assert.equal(ctx.exchanges.markDone(ctx.aid, ctx.exchangeId).ok, false);
  });

  it('non-participant cannot complete or cancel', () => {
    const { exchanges, exchangeId } = setup();
    assert.equal(exchanges.markDone('stranger', exchangeId).ok, false);
    assert.equal(exchanges.cancel('stranger', exchangeId, { reason: 'conflict' }).ok, false);
  });

  it('double Done-mark and cancel-after-Completed are rejected', () => {
    const { exchanges, aid, bid, exchangeId } = setup();
    assert.equal(exchanges.markDone(aid, exchangeId).ok, true);
    assert.equal(exchanges.markDone(bid, exchangeId).ok, false);
    assert.equal(exchanges.confirm(bid, exchangeId).ok, true);
    assert.equal(
      exchanges.cancel(aid, exchangeId, { reason: 'conflict' }).ok,
      false,
    );
  });
});
