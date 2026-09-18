import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';
import { createReputationService } from '../src/reputation/service.js';
import { createModerationService } from '../src/moderation/service.js';
import {
  createMysqlPool,
  MySqlIdentityStore,
  MySqlListingsStore,
  MySqlExchangesStore,
  MySqlReputationStore,
  MySqlModerationStore,
  MySqlNotificationSink,
  truncateWorld,
} from '../web/lib/db/repositories.js';

const MYSQL_URL =
  process.env['MYSQL_URL'] ?? 'mysql://campuswap:campuswap@127.0.0.1:3306/campuswap';

describe('mysql U3 seams (reputation/moderation/notifications)', () => {
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
    const notify = new MySqlNotificationSink(pool);
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
        notify,
      },
      { store: new MySqlExchangesStore(pool) },
    );
    const reputation = createReputationService(
      {
        exchanges: { readExchange: (id) => exchanges.readExchange(id) },
        notify,
      },
      { store: new MySqlReputationStore(pool) },
    );
    const moderation = createModerationService(
      {
        listings: {
          get: (id) => listingsStore.get(id),
          systemHide: (id) => items.systemHide(id),
          systemUnhide: (id) => items.systemUnhide(id),
        },
        identity: {
          getProfile: (id) => users.getProfile(id),
          restrict: (id, r) => users.restrict(id, r),
        },
        reputation: {
          voidReview: (by, id, reason) => reputation.voidReview(by, id, reason),
        },
        exchanges: {
          readExchange: (id) => exchanges.readExchange(id),
          readThread: (id) => exchanges.readThread(id),
        },
        notify,
      },
      { store: new MySqlModerationStore(pool) },
    );
    return { pool, users, items, exchanges, reputation, moderation, notify };
  }

  async function completedExchange(
    w: {
      users: ReturnType<typeof createIdentityService>;
      items: ReturnType<typeof createListingsService>;
      exchanges: ReturnType<typeof createExchangesService>;
    },
    tag: string,
  ): Promise<{ a: string; b: string; exchangeId: string }> {
    const { users, items, exchanges } = w;
    const a = await users.register({
      email: `u3-${tag}-a@gmail.com`, password: 'password1', displayName: `U3${tag}A`,
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    const b = await users.register({
      email: `u3-${tag}-b@gmail.com`, password: 'password1', displayName: `U3${tag}B`,
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    assert.equal(a.ok && b.ok, true);
    if (!a.ok || !b.ok) throw new Error('register failed');
    const offer = await items.publish(a.value.id, {
      side: 'offer', kind: 'skill', title: `U3 ${tag} offer`,
      description: 'An offer used to test the U3 review and report loop.',
      category: 'music', zone: 'North campus', images: [],
    });
    const request = await items.publish(b.value.id, {
      side: 'request', kind: 'skill', title: `U3 ${tag} request`,
      description: 'A request used to test the U3 review and report loop.',
      category: 'music', zone: 'North campus', images: [],
    });
    assert.equal(offer.ok && request.ok, true);
    if (!offer.ok || !request.ok) throw new Error('publish failed');
    const prop = await exchanges.propose(a.value.id, {
      sideAListingIds: [offer.value.id],
      sideBListingIds: [request.value.id],
      terms: `U3 ${tag} terms.`,
    });
    assert.equal(prop.ok, true);
    if (!prop.ok) throw new Error('propose failed');
    const acc = await exchanges.respond(b.value.id, prop.value.id, 'accept');
    assert.equal(acc.ok, true);
    if (!acc.ok || !('exchange' in acc.value)) throw new Error('accept failed');
    const exId = acc.value.exchange.id;
    const sched = await exchanges.schedule(a.value.id, exId, {
      at: new Date(Date.now() + 86400000).toISOString(), place: 'Library hall',
    });
    assert.equal(sched.ok, true);
    assert.equal((await exchanges.markDone(a.value.id, exId)).ok, true);
    const confirmed = await exchanges.confirm(b.value.id, exId);
    assert.equal(confirmed.ok, true);
    return { a: a.value.id, b: b.value.id, exchangeId: exId };
  }

  it('keeps reviews blind until both submit, then publishes with aggregate', async () => {
    const w = await world();
    try {
      const { a, b, exchangeId } = await completedExchange(w, 'rev');
      const ra = await w.reputation.submitReview(a, exchangeId, { score: 5, text: 'Great swap!' });
      assert.equal(ra.ok, true);
      if (!ra.ok) return;
      assert.equal(ra.value.status, 'Hidden');
      // Counterparty aggregate sees nothing pre-reveal.
      assert.equal((await w.reputation.aggregate(b)).count, 0);
      const rb = await w.reputation.submitReview(b, exchangeId, { score: 4, text: 'Thanks!' });
      assert.equal(rb.ok, true);
      const agg = await w.reputation.aggregate(b);
      assert.equal(agg.count, 1);
      assert.equal(agg.average, 5);
      assert.equal(agg.distribution[5], 1);
      // Edit + response + void round-trip through MySQL column mappings.
      const edited = await w.reputation.editReview(a, ra.value.id, { text: 'Great swap, updated!' });
      assert.equal(edited.ok, true);
      const resp = await w.reputation.respondToReview(b, ra.value.id, { text: 'Glad to hear it!' });
      assert.equal(resp.ok, true);
      if (!resp.ok) return;
      assert.equal(resp.value.response?.text, 'Glad to hear it!');
      const fresh = await w.reputation.getReview(a, ra.value.id);
      assert.equal(fresh?.text, 'Great swap, updated!');
      assert.equal(fresh?.response?.text, 'Glad to hear it!');
    } finally {
      await w.pool.end();
    }
  });

  it('runs report → triage → sanction with audit, notifying the reporter', async () => {
    const w = await world();
    try {
      const { a, b } = await completedExchange(w, 'mod');
      await w.users.setRole('bootstrap', b, 'moderator');
      const rep = await w.moderation.report(a, {
        targetType: 'user', targetId: b, reasonCode: 'harassment',
        description: 'Rude messages during the exchange meeting.', images: [],
      });
      assert.equal(rep.ok, true);
      if (!rep.ok) return;
      assert.equal(rep.value.status, 'Received');
      assert.equal((await w.moderation.triage(rep.value.id, b, 'acknowledge')).ok, true);
      assert.equal((await w.moderation.getReport(rep.value.id))?.status, 'Under review');
      const sanc = await w.moderation.sanction(b, {
        action: 'warn', targetType: 'user', targetId: b, reason: 'First warning.',
      });
      assert.equal(sanc.ok, true);
      const log = await w.moderation.auditLog();
      assert.ok(log.some((e) => e.kind === 'sanction'));
      const inbox = await w.notify.inbox(a);
      assert.ok(inbox.some((n) => n.type === 'report-status'));
      // Void path through MySQL columns + voids table + audit.
      const mv = await completedExchange(w, 'modv');
      const vr = await w.reputation.submitReview(mv.a, mv.exchangeId, { score: 1, text: 'Abusive review.' });
      assert.equal(vr.ok, true);
      if (!vr.ok) return;
      const voided = await w.moderation.voidReview(b, vr.value.id, 'Abusive content.');
      assert.equal(voided.ok, true);
      assert.equal((await w.reputation.getReview(mv.a, vr.value.id))?.status, 'Voided');
      const log2 = await w.moderation.auditLog();
      assert.ok(log2.some((e) => e.kind === 'void'));
    } finally {
      await w.pool.end();
    }
  });

  it('persists proposal events to the inbox with read tracking', async () => {
    const w = await world();
    try {
      const { b } = await completedExchange(w, 'note');
      const inbox = await w.notify.inbox(b);
      assert.ok(inbox.some((n) => n.type === 'proposal-received'));
      assert.ok((await w.notify.unreadCount(b)) >= 1);
      await w.notify.markRead(b, inbox[0]!.id);
      assert.equal((await w.notify.unreadCount(b)), inbox.length - 1);
    } finally {
      await w.pool.end();
    }
  });

  it('returns zero (not null) review counts on an empty table', async () => {
    const w = await world();
    try {
      await w.pool.execute('DELETE FROM reviews');
      assert.deepEqual(await w.reputation.store.counts(), { total: 0, published: 0 });
    } finally {
      await w.pool.end();
    }
  });
});
