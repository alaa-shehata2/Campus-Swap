import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';
import { createReputationService } from '../src/reputation/service.js';
import { createModerationService } from '../src/moderation/service.js';
import { computePilotMetrics, pilotProgress } from '../src/metrics/service.js';
import { healthCheck } from '../src/launch/health.js';
import { disclaimerFor } from '../src/policy/disclaimers.js';
import { createPrivacyService } from '../src/privacy/service.js';
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

describe('mysql metrics/health over live seams (U4)', () => {
  before(async () => {
    const pool = createMysqlPool(MYSQL_URL);
    try {
      await truncateWorld(pool);
    } finally {
      await pool.end();
    }
  });

  it('computes coherent pilot metrics, progress, and all-ok health', async () => {
    const pool = createMysqlPool(MYSQL_URL);
    try {
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
        { exchanges: { readExchange: (id) => exchanges.readExchange(id) }, notify },
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
          reputation: { voidReview: (by, id, reason) => reputation.voidReview(by, id, reason) },
          notify,
        },
        { store: new MySqlModerationStore(pool) },
      );

      const a = await users.register({
        email: 'u4-a@gmail.com', password: 'password1', displayName: 'U4A',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      const b = await users.register({
        email: 'u4-b@gmail.com', password: 'password1', displayName: 'U4B',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      assert.equal(a.ok && b.ok, true);
      if (!a.ok || !b.ok) return;
      const offer = await items.publish(a.value.id, {
        side: 'offer', kind: 'skill', title: 'U4 guitar lessons',
        description: 'Metrics-fixture guitar lessons on campus.',
        category: 'music', zone: 'North campus', images: [],
      });
      const request = await items.publish(b.value.id, {
        side: 'request', kind: 'skill', title: 'U4 needs guitar lessons',
        description: 'Metrics-fixture request for guitar lessons.',
        category: 'music', zone: 'North campus', images: [],
      });
      assert.equal(offer.ok && request.ok, true);
      if (!offer.ok || !request.ok) return;
      const prop = await exchanges.propose(a.value.id, {
        sideAListingIds: [offer.value.id], sideBListingIds: [request.value.id],
        terms: 'U4 terms.',
      });
      assert.equal(prop.ok, true);
      if (!prop.ok) return;
      const acc = await exchanges.respond(b.value.id, prop.value.id, 'accept');
      assert.equal(acc.ok, true);
      if (!acc.ok || !('exchange' in acc.value)) return;
      const exId = acc.value.exchange.id;
      assert.equal((await exchanges.schedule(a.value.id, exId, {
        at: new Date(Date.now() + 86400000).toISOString(), place: 'Library hall',
      })).ok, true);
      assert.equal((await exchanges.markDone(a.value.id, exId)).ok, true);
      assert.equal((await exchanges.confirm(b.value.id, exId)).ok, true);
      assert.equal((await reputation.submitReview(a.value.id, exId, { score: 5 })).ok, true);
      assert.equal((await reputation.submitReview(b.value.id, exId, { score: 4 })).ok, true);
      await users.setRole('bootstrap', b.value.id, 'moderator');
      const rep = await moderation.report(a.value.id, {
        targetType: 'user', targetId: b.value.id, reasonCode: 'spam-commercial',
        description: 'Metrics-fixture commercial report for the dashboard.', images: [],
      });
      assert.equal(rep.ok, true);
      if (!rep.ok) return;
      const before = await computePilotMetrics({
        identity: users, listings: items, exchanges, moderation, reputation,
      });
      assert.equal(before.reportsReceived, 1);
      assert.equal(before.reportsUnderReview, 0);
      assert.equal((await moderation.triage(rep.value.id, b.value.id, 'acknowledge')).ok, true);

      const m = await computePilotMetrics({
        identity: users, listings: items, exchanges, moderation, reputation,
      });
      assert.ok(m.members >= 2);
      assert.ok(m.publishedListings >= 2);
      assert.equal(m.completedExchanges, 1);
      assert.equal(m.reportsReceived, 0);
      assert.equal(m.reportsUnderReview, 1);
      assert.equal(m.reviewsPublished, 2);
      assert.equal(typeof m.medianTriageMs, 'object');

      const p = pilotProgress({
        ...m,
        members: 200,
        activeMembers: 200,
        publishedListings: 150,
        completedExchanges: 30,
        reportsResolved: 1,
        medianTriageMs: 3600000,
      });
      assert.equal(p.members.met, true);
      assert.equal(p.completions.met, true);
      assert.equal(p.triage.met, true);

      const privacy = createPrivacyService();
      const health = await healthCheck({
        policy: { disclaimerFor: (flow) => disclaimerFor(flow) },
        privacy: { anonymizeText: (t) => privacy.anonymizeText(t) },
        identity: users,
        listings: items,
        exchanges,
        reputation,
        moderation,
        notifications: notify,
      });
      assert.equal(health.status, 'ok');
      assert.ok(Object.values(health.checks).every((c) => c === 'ok'));
    } finally {
      await pool.end();
    }
  });
});
