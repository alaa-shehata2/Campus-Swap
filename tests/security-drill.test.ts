import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';
import { createReputationService } from '../src/reputation/service.js';
import { createModerationService } from '../src/moderation/service.js';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Phase 0 triage drill (roadmap §10.5, SECURITY.md): a fixture report walks
 * the full Received → Under review → Resolved path inside the 48h pilot SLA.
 */
describe('security triage drill', () => {
  it('fixture report is triaged end-to-end within SLA', async () => {
    const identity = createIdentityService();
    const listings = createListingsService();
    const reporter = await identity.register({
      email: 'drill-reporter@gmail.com', password: 'password1', displayName: 'Drill Reporter',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    const owner = await identity.register({
      email: 'drill-owner@gmail.com', password: 'password1', displayName: 'Drill Owner',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    const mod = await identity.register({
      email: 'drill-mod@gmail.com', password: 'password1', displayName: 'Drill Mod',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    assert.equal(reporter.ok && owner.ok && mod.ok, true);
    if (!reporter.ok || !owner.ok || !mod.ok) return;
    await identity.setRole('bootstrap', mod.value.id, 'moderator');

    const listing = await listings.publish(owner.value.id, {
      side: 'offer', kind: 'item', title: 'Fixture phone for drill',
      description: 'Seeded fixture for the triage drill; handled as a policy case.',
      category: 'electronics', zone: 'Dorms', images: [], modality: 'give',
    });
    assert.equal(listing.ok, true);
    if (!listing.ok) return;

    let now = Date.now();
    const exchanges = createExchangesService({ listings, identity });
    const reputation = createReputationService({ exchanges });
    const moderation = createModerationService(
      { listings, identity, reputation },
      { now: () => now },
    );

    const report = await moderation.report(reporter.value.id, {
      targetType: 'listing', targetId: listing.value.id,
      reasonCode: 'spam-commercial', description: 'Drill fixture: commercial storefront link.',
      images: [],
    });
    assert.equal(report.ok, true);
    if (!report.ok) return;
    assert.equal(report.value.status, 'Received');

    now += 5 * HOUR_MS;
    assert.equal((await moderation.triage(report.value.id, mod.value.id, 'acknowledge')).ok, true);
    now += 20 * HOUR_MS;
    const resolved = await moderation.triage(report.value.id, mod.value.id, 'resolve');
    assert.equal(resolved.ok, true);
    if (!resolved.ok) return;
    assert.equal(resolved.value.status, 'Resolved');
    assert.deepEqual(
      resolved.value.history.map((h) => h.status),
      ['Received', 'Under review', 'Resolved'],
    );

    const receivedAt = resolved.value.history[0]!.atMs;
    const resolvedAt = resolved.value.history[2]!.atMs;
    assert.ok(resolvedAt - receivedAt <= 48 * HOUR_MS, 'triage exceeded 48h pilot SLA');
  });
});
