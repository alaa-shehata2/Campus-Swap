import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface FlowCtx {
  identity: ReturnType<typeof createIdentityService>;
  listings: ReturnType<typeof createListingsService>;
  exchanges: ReturnType<typeof createExchangesService>;
  aid: string;
  bid: string;
  exchangeId: string;
  setNow: (t: number) => void;
  now: () => number;
}

/** Two users, one offer + one request, proposed + accepted. Optionally scheduled. */
export async function setupScheduledExchange(withSchedule = true): Promise<FlowCtx> {
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
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) throw new Error('setup failed');
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

  let now = Date.parse('2026-03-10T10:00:00.000Z');
  const exchanges = createExchangesService({ listings, identity }, { now: () => now });
  const p = await exchanges.propose(a.value.id, {
    sideAListingIds: [offer.value.id], sideBListingIds: [request.value.id],
    terms: 'Two sessions.',
  });
  assert.equal(p.ok, true);
  if (!p.ok) throw new Error('setup failed');
  const acc = await exchanges.respond(b.value.id, p.value.id, 'accept');
  assert.equal(acc.ok && 'exchange' in acc.value, true);
  if (!acc.ok || !('exchange' in acc.value)) throw new Error('setup failed');
  if (withSchedule) {
    const s = await exchanges.schedule(a.value.id, acc.value.exchange.id, {
      at: new Date(now + 2 * DAY_MS).toISOString(), place: 'KFS Library main hall',
    });
    assert.equal(s.ok, true);
  }
  return {
    identity, listings, exchanges,
    aid: a.value.id, bid: b.value.id, exchangeId: acc.value.exchange.id,
    setNow: (t: number) => { now = t; }, now: () => now,
  };
}

/** setupScheduledExchange driven through Done → Confirm. */
export async function setupCompletedExchange(): Promise<FlowCtx> {
  const ctx = await setupScheduledExchange(true);
  assert.equal((await ctx.exchanges.markDone(ctx.aid, ctx.exchangeId)).ok, true);
  assert.equal((await ctx.exchanges.confirm(ctx.bid, ctx.exchangeId)).ok, true);
  return ctx;
}
