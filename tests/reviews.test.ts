import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createReputationService } from '../src/reputation/service.js';
import { setupCompletedExchange, setupScheduledExchange, DAY_MS } from './helpers.js';

describe('reviews', () => {
  it('requires a Completed exchange; validates score and text', async () => {
    const ctx = await setupScheduledExchange();
    const rep = createReputationService({ exchanges: ctx.exchanges }, { now: ctx.now });
    const early = await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 5, text: 'Great!' });
    assert.equal(early.ok, false);
    if (!early.ok) assert.ok(early.errors.some((e) => e.code === 'exchange-not-completed'));

    const done = await setupCompletedExchange();
    const rep2 = createReputationService({ exchanges: done.exchanges }, { now: done.now });
    const badScore = await rep2.submitReview(done.aid, done.exchangeId, { score: 6 });
    assert.equal(badScore.ok, false);
    if (!badScore.ok) assert.ok(badScore.errors.some((e) => e.field === 'score'));
    const longText = await rep2.submitReview(done.aid, done.exchangeId, { score: 5, text: 'x'.repeat(1001) });
    assert.equal(longText.ok, false);
    if (!longText.ok) assert.ok(longText.errors.some((e) => e.field === 'text'));
  });

  it('one review per participant; second rejected', async () => {
    const ctx = await setupCompletedExchange();
    const rep = createReputationService({ exchanges: ctx.exchanges }, { now: ctx.now });
    assert.equal((await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 5 })).ok, true);
    const dup = await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 4 });
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.ok(dup.errors.some((e) => e.code === 'duplicate-review'));
  });

  it('blind: counterparty cannot see my review pre-reveal; I can', async () => {
    const ctx = await setupCompletedExchange();
    const rep = createReputationService({ exchanges: ctx.exchanges }, { now: ctx.now });
    const r = await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 5, text: 'Reliable partner.' });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(await rep.getReview(ctx.bid, r.value.id), undefined);
    assert.ok(await rep.getReview(ctx.aid, r.value.id));
  });

  it('reveals when both submit', async () => {
    const ctx = await setupCompletedExchange();
    const rep = createReputationService({ exchanges: ctx.exchanges }, { now: ctx.now });
    const a = await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 5 });
    const b = await rep.submitReview(ctx.bid, ctx.exchangeId, { score: 4 });
    assert.equal(a.ok && b.ok, true);
    if (!a.ok || !b.ok) return;
    const visible = await rep.getReview(ctx.bid, a.value.id);
    assert.ok(visible && visible.status === 'Published');
  });

  it('reveals after 14 days via revealDue even if one side silent', async () => {
    const ctx = await setupCompletedExchange();
    const rep = createReputationService({ exchanges: ctx.exchanges }, { now: ctx.now });
    const r = await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 5 });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    ctx.setNow(ctx.now() + 15 * DAY_MS);
    const revealed = await rep.revealDue(ctx.now());
    assert.equal(revealed.length, 1);
    assert.ok(await rep.getReview(ctx.bid, r.value.id));
  });

  it('48h edit window, then immutable', async () => {
    const ctx = await setupCompletedExchange();
    const rep = createReputationService({ exchanges: ctx.exchanges }, { now: ctx.now });
    const r = await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 3 });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal((await rep.editReview(ctx.aid, r.value.id, { score: 5 })).ok, true);
    ctx.setNow(ctx.now() + 3 * DAY_MS);
    assert.equal((await rep.editReview(ctx.aid, r.value.id, { score: 1 })).ok, false);
  });
});

describe('reputation aggregate/response/void', () => {
  it('no reviews on Cancelled exchanges', async () => {
    const ctx = await setupScheduledExchange();
    assert.equal(
      (await ctx.exchanges.cancel(ctx.aid, ctx.exchangeId, { reason: 'conflict' })).ok,
      true,
    );
    const rep = createReputationService({ exchanges: ctx.exchanges }, { now: ctx.now });
    const r = await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 5 });
    assert.equal(r.ok, false);
  });

  it('aggregate is consistent: average + count + distribution + history', async () => {
    const ctx = await setupCompletedExchange();
    const rep = createReputationService({ exchanges: ctx.exchanges }, { now: ctx.now });
    // hidden before reveal: aggregate empty
    assert.equal((await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 5 })).ok, true);
    assert.equal((await rep.aggregate(ctx.bid)).count, 0);
    assert.equal((await rep.submitReview(ctx.bid, ctx.exchangeId, { score: 3 })).ok, true);
    const agg = await rep.aggregate(ctx.bid);
    assert.equal(agg.count, 1);
    assert.equal(agg.average, 5);
    assert.equal(agg.distribution[5], 1);
    assert.equal(agg.history.length, 1);
  });

  it('one response per review by the reviewee, 48h edit', async () => {
    const ctx = await setupCompletedExchange();
    const rep = createReputationService({ exchanges: ctx.exchanges }, { now: ctx.now });
    assert.equal((await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 4, text: 'Good.' })).ok, true);
    assert.equal((await rep.submitReview(ctx.bid, ctx.exchangeId, { score: 5 })).ok, true);
    const target = (await rep.aggregate(ctx.bid)).history[0]!;
    // reviewer cannot respond to own review
    assert.equal((await rep.respondToReview(ctx.aid, target.id, { text: 'Thanks!' })).ok, false);
    assert.equal((await rep.respondToReview(ctx.bid, target.id, { text: 'Thanks!' })).ok, true);
    assert.equal(
      (await rep.respondToReview(ctx.bid, target.id, { text: 'Again.' })).ok,
      false,
    );
    assert.equal((await rep.editResponse(ctx.bid, target.id, { text: 'Thanks a lot!' })).ok, true);
    ctx.setNow(ctx.now() + 3 * DAY_MS);
    assert.equal((await rep.editResponse(ctx.bid, target.id, { text: 'Too late.' })).ok, false);
  });

  it('void removes from aggregate and is logged; voided reviews immutable', async () => {
    const ctx = await setupCompletedExchange();
    const rep = createReputationService({ exchanges: ctx.exchanges }, { now: ctx.now });
    assert.equal((await rep.submitReview(ctx.aid, ctx.exchangeId, { score: 1, text: 'Abuse.' })).ok, true);
    assert.equal((await rep.submitReview(ctx.bid, ctx.exchangeId, { score: 5 })).ok, true);
    const target = (await rep.aggregate(ctx.bid)).history[0]!;
    const v = await rep.voidReview('moderator-1', target.id, 'Abusive content.');
    assert.equal(v.ok, true);
    assert.equal((await rep.aggregate(ctx.bid)).count, 0);
    assert.equal((await rep.editReview(ctx.aid, target.id, { score: 5 })).ok, false);
    if (v.ok) {
      assert.equal(v.value.status, 'Voided');
      assert.equal(v.value.void?.by, 'moderator-1');
    }
  });
});
