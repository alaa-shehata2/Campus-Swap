import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePilotMetrics, pilotProgress, D12_TARGETS } from '../src/metrics/service.js';
import { createReputationService } from '../src/reputation/service.js';
import { createModerationService } from '../src/moderation/service.js';
import { setupCompletedExchange, DAY_MS } from './helpers.js';

async function populatedWorld() {
  const ctx = await setupCompletedExchange();
  let now = ctx.now();
  const tick = (t: number) => { now = t; ctx.setNow(t); };
  const reputation = createReputationService({ exchanges: ctx.exchanges }, { now: () => now });
  const moderation = createModerationService(
    { listings: ctx.listings, identity: ctx.identity, reputation },
    { now: () => now },
  );
  const mod = await ctx.identity.register({
    email: 'mod@gmail.com', password: 'password1', displayName: 'Mod',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  assert.equal(mod.ok, true);
  if (!mod.ok) throw new Error('setup failed');
  await ctx.identity.setRole('bootstrap', mod.value.id, 'moderator');

  // one resolved report with a 50h triage latency
  const report = await moderation.report(ctx.aid, {
    targetType: 'user', targetId: ctx.bid,
    reasonCode: 'harassment', description: 'Threatening language in messages, see evidence.',
    images: [],
  });
  assert.equal(report.ok, true);
  if (!report.ok) throw new Error('setup failed');
  assert.equal((await moderation.triage(report.value.id, mod.value.id, 'acknowledge')).ok, true);
  tick(now + 50 * 60 * 60 * 1000);
  assert.equal((await moderation.triage(report.value.id, mod.value.id, 'resolve')).ok, true);
  assert.equal(
    (await moderation.sanction(mod.value.id, {
      action: 'warn', targetType: 'user', targetId: ctx.bid, reason: 'Confirmed harassment.',
    })).ok,
    true,
  );

  // both reviews submitted → published
  assert.equal((await reputation.submitReview(ctx.aid, ctx.exchangeId, { score: 5 })).ok, true);
  assert.equal((await reputation.submitReview(ctx.bid, ctx.exchangeId, { score: 4 })).ok, true);

  return { ctx, moderation, reputation, mod: mod.value.id };
}

describe('metrics', () => {
  it('counts members, listings, completions, reports, sanctions, reviews', async () => {
    const { ctx, moderation, reputation } = await populatedWorld();
    const m = await computePilotMetrics({
      identity: ctx.identity,
      listings: ctx.listings,
      exchanges: ctx.exchanges,
      moderation,
      reputation,
    });
    assert.equal(m.members, 3);
    assert.equal(m.moderators, 1);
    assert.equal(m.activeMembers, 3);
    assert.equal(m.listings, 2);
    assert.equal(m.activeListings, 0); // auto-paused on accept
    assert.equal(m.publishedListings, 2); // paused still counts as published
    assert.equal(m.completedExchanges, 1);
    assert.equal(m.reportsReceived, 0);
    assert.equal(m.reportsUnderReview, 0);
    assert.equal(m.reportsResolved, 1);
    assert.equal(m.medianTriageMs, 50 * 60 * 60 * 1000);
    assert.equal(m.sanctions, 1);
    assert.equal(m.handovers, 0);
    assert.equal(m.reviewsPublished, 2);
  });

  it('pilot progress reports unmet targets with remaining counts', async () => {
    const { ctx, moderation, reputation } = await populatedWorld();
    const m = await computePilotMetrics({
      identity: ctx.identity,
      listings: ctx.listings,
      exchanges: ctx.exchanges,
      moderation,
      reputation,
    });
    const p = pilotProgress(m);
    assert.equal(p.members.met, false);
    assert.equal(p.members.remaining, D12_TARGETS.members - m.activeMembers);
    assert.equal(p.completions.met, false);
    assert.equal(p.triage.met, false); // 50h > 48h
    assert.equal(p.triage.remaining, 2 * 60 * 60 * 1000);
  });

  it('pilot progress passes when D12 targets are met', async () => {
    const p = pilotProgress({
      members: 200, activeMembers: 200, moderators: 2,
      listings: 150, activeListings: 150, publishedListings: 150, completedExchanges: 30,
      reportsReceived: 0, reportsUnderReview: 0, reportsResolved: 5,
      medianTriageMs: 10 * 60 * 60 * 1000, sanctions: 1, handovers: 0,
      reviewsPublished: 60, generatedAtMs: Date.now(),
      safetyIncidents: 0,
    });
    assert.equal(p.members.met && p.listings.met && p.completions.met && p.triage.met, true);
  });

  it('D12 targets match the decided pilot goals', async () => {
    assert.equal(D12_TARGETS.members, 200);
    assert.equal(D12_TARGETS.listings, 150);
    assert.equal(D12_TARGETS.completions, 30);
    assert.equal(D12_TARGETS.triageMs, 48 * 60 * 60 * 1000);
  });
});
