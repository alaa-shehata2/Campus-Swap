import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';
import {
  createMysqlPool,
  MySqlIdentityStore,
  MySqlListingsStore,
  MySqlExchangesStore,
  truncateWorld,
} from '../web/lib/db/repositories.js';

const MYSQL_URL =
  process.env['MYSQL_URL'] ?? 'mysql://campuswap:campuswap@127.0.0.1:3306/campuswap';

describe('mysql exchanges (U2 seam)', () => {
  before(async () => {
    const pool = createMysqlPool(MYSQL_URL);
    try {
      await truncateWorld(pool);
    } finally {
      await pool.end();
    }
  });

  async function world() {
    const pool = createMysqlPool(MYSQL_URL);
    const users = createIdentityService(new MySqlIdentityStore(pool));
    const listingsStore = new MySqlListingsStore(pool);
    const items = createListingsService(listingsStore);
    const exchanges = createExchangesService(
      {
        listings: {
          get: (id) => listingsStore.get(id),
          systemPause: (id) => items.systemPause(id),
        },
        identity: {
          getProfile: (id) => users.getProfile(id),
          isBlockedOrMuted: (a, b) => users.isBlockedOrMuted(a, b),
        },
      },
      { store: new MySqlExchangesStore(pool) },
    );
    return { pool, users, items, exchanges };
  }

  it('proposes, accepts (auto-pause), schedules, completes, and threads through MySQL', async () => {
    const { pool, users, items, exchanges } = await world();
    try {
      const a = await users.register({
        email: 'u2-ana@gmail.com', password: 'password1', displayName: 'Ana',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      const b = await users.register({
        email: 'u2-bo@gmail.com', password: 'password1', displayName: 'Bo',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      assert.equal(a.ok && b.ok, true);
      if (!a.ok || !b.ok) return;

      const offer = await items.publish(a.value.id, {
        side: 'offer', kind: 'skill', title: 'U2 guitar lessons',
        description: 'I teach beginner guitar on campus twice a week.',
        category: 'music', zone: 'North campus', images: [],
      });
      const request = await items.publish(b.value.id, {
        side: 'request', kind: 'skill', title: 'Need guitar lessons',
        description: 'Looking for beginner guitar help before the concert.',
        category: 'music', zone: 'North campus', images: [],
      });
      assert.equal(offer.ok && request.ok, true);
      if (!offer.ok || !request.ok) return;

      const prop = await exchanges.propose(a.value.id, {
        sideAListingIds: [offer.value.id],
        sideBListingIds: [request.value.id],
        terms: 'Two sessions per week, my guitar provided.',
      });
      assert.equal(prop.ok, true);
      if (!prop.ok) return;

      const accepted = await exchanges.respond(b.value.id, prop.value.id, 'accept');
      assert.equal(accepted.ok, true);
      if (!accepted.ok || !('exchange' in accepted.value)) return;
      assert.equal(accepted.value.exchange.status, 'Scheduled');

      // Accept auto-pauses both listings.
      assert.equal((await items.get(offer.value.id))?.status, 'Paused');
      assert.equal((await items.get(request.value.id))?.status, 'Paused');

      const scheduled = await exchanges.schedule(a.value.id, accepted.value.exchange.id, {
        at: new Date(Date.now() + 86400000).toISOString(),
        place: 'Library hall, North campus',
      });
      assert.equal(scheduled.ok, true);

      const done = await exchanges.markDone(a.value.id, accepted.value.exchange.id);
      assert.equal(done.ok, true);
      const confirmed = await exchanges.confirm(b.value.id, accepted.value.exchange.id);
      assert.equal(confirmed.ok, true);
      if (!confirmed.ok) return;
      assert.equal(confirmed.value.status, 'Completed');

      const msg = await exchanges.postMessage(a.value.id, accepted.value.exchange.id, 'See you there!');
      assert.equal(msg.ok, true);
      const thread = await exchanges.getMessages(b.value.id, accepted.value.exchange.id);
      assert.equal(thread.ok && thread.value.length === 1, true);
    } finally {
      await pool.end();
    }
  });

  it('enforces the 5-open cap through MySQL', async () => {
    const { pool, users, items, exchanges } = await world();
    try {
      const owners: string[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await users.register({
          email: `u2-cap${i}@gmail.com`, password: 'password1', displayName: `Cap${i}`,
          campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
        });
        assert.equal(r.ok, true);
        if (r.ok) owners.push(r.value.id);
      }
      const target = await items.publish(owners[0]!, {
        side: 'request', kind: 'skill', title: 'U2 cap target',
        description: 'A popular request that draws many proposals from others.',
        category: 'music', zone: 'North campus', images: [],
      });
      assert.equal(target.ok, true);
      if (!target.ok) return;
      for (let i = 1; i <= 5; i++) {
        const mine = await items.publish(owners[i]!, {
          side: 'offer', kind: 'skill', title: `U2 cap offer ${i}`,
          description: 'An offer referencing the popular request listing.',
          category: 'music', zone: 'North campus', images: [],
        });
        assert.equal(mine.ok, true);
        if (!mine.ok) return;
        const p = await exchanges.propose(owners[i]!, {
          sideAListingIds: [mine.value.id],
          sideBListingIds: [target.value.id],
          terms: `Proposal ${i} terms text here.`,
        });
        assert.equal(p.ok, true);
      }
      const extra = await items.publish(owners[5]!, {
        side: 'offer', kind: 'skill', title: 'U2 cap offer extra',
        description: 'One more offer that should hit the proposal cap.',
        category: 'music', zone: 'North campus', images: [],
      });
      assert.equal(extra.ok, true);
      if (!extra.ok) return;
      const sixth = await exchanges.propose(owners[5]!, {
        sideAListingIds: [extra.value.id],
        sideBListingIds: [target.value.id],
        terms: 'This sixth proposal must be rejected by the cap.',
      });
      assert.equal(sixth.ok, false);
      if (sixth.ok) return;
      assert.ok(sixth.errors.some((e) => e.code === 'proposal-cap-reached'));
      assert.equal((await exchanges.lockStatus(target.value.id)).locked, true);
    } finally {
      await pool.end();
    }
  });

  it('rejects schedule-less Done without override, accepts it with override', async () => {
    const { pool, users, items, exchanges } = await world();
    try {
      const a = await users.register({
        email: 'u2-ovr-a@gmail.com', password: 'password1', displayName: 'OvrA',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      const b = await users.register({
        email: 'u2-ovr-b@gmail.com', password: 'password1', displayName: 'OvrB',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      assert.equal(a.ok && b.ok, true);
      if (!a.ok || !b.ok) return;
      const offer = await items.publish(a.value.id, {
        side: 'offer', kind: 'skill', title: 'U2 override offer',
        description: 'An offer used to test schedule-less completion rules.',
        category: 'music', zone: 'North campus', images: [],
      });
      const request = await items.publish(b.value.id, {
        side: 'request', kind: 'skill', title: 'U2 override request',
        description: 'A request used to test schedule-less completion rules.',
        category: 'music', zone: 'North campus', images: [],
      });
      assert.equal(offer.ok && request.ok, true);
      if (!offer.ok || !request.ok) return;
      const prop = await exchanges.propose(a.value.id, {
        sideAListingIds: [offer.value.id],
        sideBListingIds: [request.value.id],
        terms: 'Override-path proposal terms.',
      });
      assert.equal(prop.ok, true);
      if (!prop.ok) return;
      const acc = await exchanges.respond(b.value.id, prop.value.id, 'accept');
      assert.equal(acc.ok, true);
      if (!acc.ok || !('exchange' in acc.value)) return;
      const bare = await exchanges.markDone(a.value.id, acc.value.exchange.id);
      assert.equal(bare.ok, false);
      if (bare.ok) return;
      assert.ok(bare.errors.some((e) => e.code === 'schedule-required'));
      const overridden = await exchanges.markDone(a.value.id, acc.value.exchange.id, {
        overrideReason: 'Met on campus spontaneously, forgot to schedule.',
      });
      assert.equal(overridden.ok, true);
    } finally {
      await pool.end();
    }
  });

  it('denies non-participant proposal/exchange/thread reads and writes', async () => {
    const { pool, users, items, exchanges } = await world();
    try {
      const emails = ['u2-np-a@gmail.com', 'u2-np-b@gmail.com', 'u2-np-c@gmail.com'];
      const ids: string[] = [];
      for (let i = 0; i < emails.length; i++) {
        const r = await users.register({
          email: emails[i]!, password: 'password1', displayName: `Np${i}`,
          campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
        });
        assert.equal(r.ok, true);
        if (r.ok) ids.push(r.value.id);
      }
      const [a, b, c] = ids as [string, string, string];
      const offer = await items.publish(a, {
        side: 'offer', kind: 'skill', title: 'U2 private offer',
        description: 'An offer whose negotiation stays between two sides.',
        category: 'music', zone: 'North campus', images: [],
      });
      const request = await items.publish(b, {
        side: 'request', kind: 'skill', title: 'U2 private request',
        description: 'A request whose negotiation stays between two sides.',
        category: 'music', zone: 'North campus', images: [],
      });
      assert.equal(offer.ok && request.ok, true);
      if (!offer.ok || !request.ok) return;
      const prop = await exchanges.propose(a, {
        sideAListingIds: [offer.value.id],
        sideBListingIds: [request.value.id],
        terms: 'Private terms a third party must never see.',
      });
      assert.equal(prop.ok, true);
      if (!prop.ok) return;
      assert.equal(await exchanges.getProposal(c, prop.value.id), undefined);
      const acc = await exchanges.respond(b, prop.value.id, 'accept');
      assert.equal(acc.ok, true);
      if (!acc.ok || !('exchange' in acc.value)) return;
      const exId = acc.value.exchange.id;
      assert.equal(await exchanges.getExchange(c, exId), undefined);
      const read = await exchanges.getMessages(c, exId);
      assert.equal(read.ok, false);
      const post = await exchanges.postMessage(c, exId, 'I should not be here.');
      assert.equal(post.ok, false);
      if (post.ok) return;
      assert.ok(post.errors.some((e) => e.code === 'not-participant'));
    } finally {
      await pool.end();
    }
  });

  it('expires stale proposals and auto-completes silent Done-marks through MySQL', async () => {
    const { pool, users, items, exchanges } = await world();
    try {
      const a = await users.register({
        email: 'u2-sw-a@gmail.com', password: 'password1', displayName: 'SwA',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      const b = await users.register({
        email: 'u2-sw-b@gmail.com', password: 'password1', displayName: 'SwB',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      assert.equal(a.ok && b.ok, true);
      if (!a.ok || !b.ok) return;
      const mkPair = async (tag: string) => {
        const offer = await items.publish(a.value.id, {
          side: 'offer', kind: 'skill', title: `U2 sweep offer ${tag}`,
          description: 'An offer used to test the lazy expiry sweep.',
          category: 'music', zone: 'North campus', images: [],
        });
        const request = await items.publish(b.value.id, {
          side: 'request', kind: 'skill', title: `U2 sweep request ${tag}`,
          description: 'A request used to test the lazy expiry sweep.',
          category: 'music', zone: 'North campus', images: [],
        });
        assert.equal(offer.ok && request.ok, true);
        if (!offer.ok || !request.ok) throw new Error('seed pair failed');
        return { offer: offer.value.id, request: request.value.id };
      };
      // Stale proposal: insert backdated, sweep expires it.
      const stale = await mkPair('stale');
      const store = exchanges.store;
      const old = await store.insertProposal({
        proposerId: a.value.id, counterpartyId: b.value.id,
        sideAListingIds: [stale.offer], sideBListingIds: [stale.request],
        terms: 'A proposal left unanswered for over seven days.',
        status: 'Proposed', createdAtMs: Date.now() - 8 * 86400000,
      });
      const expired = await exchanges.runExpiry(Date.now());
      assert.ok(expired.some((p) => p.id === old.id));
      assert.equal((await store.getProposal(old.id))?.status, 'Expired');
      // Silent Done: accept → schedule → Done, backdate the mark, sweep completes.
      const live = await mkPair('live');
      const prop = await exchanges.propose(a.value.id, {
        sideAListingIds: [live.offer], sideBListingIds: [live.request],
        terms: 'A proposal whose Done-mark will go silent.',
      });
      assert.equal(prop.ok, true);
      if (!prop.ok) return;
      const acc = await exchanges.respond(b.value.id, prop.value.id, 'accept');
      assert.equal(acc.ok, true);
      if (!acc.ok || !('exchange' in acc.value)) return;
      const exId = acc.value.exchange.id;
      const sched = await exchanges.schedule(a.value.id, exId, {
        at: new Date(Date.now() + 86400000).toISOString(), place: 'Library hall',
      });
      assert.equal(sched.ok, true);
      const done = await exchanges.markDone(a.value.id, exId);
      assert.equal(done.ok, true);
      const persisted = await store.getExchange(exId);
      assert.ok(persisted?.doneMarkedAtMs !== undefined);
      await store.saveExchange({ ...persisted!, doneMarkedAtMs: Date.now() - 8 * 86400000 });
      const completed = await exchanges.runAutoComplete(Date.now());
      assert.ok(completed.some((e) => e.id === exId));
      assert.equal((await store.getExchange(exId))?.status, 'Completed');
    } finally {
      await pool.end();
    }
  });
});
