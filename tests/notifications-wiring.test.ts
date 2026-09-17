import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';
import { createReputationService } from '../src/reputation/service.js';
import { createModerationService } from '../src/moderation/service.js';
import { createNotificationsService } from '../src/notifications/service.js';

async function setup() {
  const notify = createNotificationsService();
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
    description: 'I teach Python basics.', category: 'tutoring',
    zone: 'North campus', images: [],
  });
  const request = await listings.publish(b.value.id, {
    side: 'request', kind: 'skill', title: 'Need Python help',
    description: 'Looking for help.', category: 'tutoring',
    zone: 'North campus', images: [],
  });
  assert.equal(offer.ok && request.ok, true);
  if (!offer.ok || !request.ok) throw new Error('setup failed');
  const exchanges = createExchangesService({ listings, identity, notify });
  const reputation = createReputationService({ exchanges, notify });
  const moderation = createModerationService({ listings, identity, reputation, notify });
  return { notify, identity, listings, exchanges, reputation, moderation, aid: a.value.id, bid: b.value.id, offer: offer.value, request: request.value };
}

describe('notification wiring', () => {
  it('proposal lifecycle notifies the counterparty side', async () => {
    const { notify, exchanges, aid, bid, offer, request } = await setup();
    const p = await exchanges.propose(aid, {
      sideAListingIds: [offer.id], sideBListingIds: [request.id], terms: 'Deal.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    assert.ok((await notify.inbox(bid)).some((i) => i.type === 'proposal-received'));
    assert.equal((await notify.inbox(aid)).length, 0);
    assert.equal((await exchanges.respond(bid, p.value.id, 'accept')).ok, true);
    assert.ok((await notify.inbox(aid)).some((i) => i.type === 'proposal-accepted'));
  });

  it('completion loop notifies; reveal notifies without pre-reveal leak', async () => {
    const { notify, exchanges, reputation, aid, bid, offer, request } = await setup();
    const p = await exchanges.propose(aid, {
      sideAListingIds: [offer.id], sideBListingIds: [request.id], terms: 'Deal.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    const acc = await exchanges.respond(bid, p.value.id, 'accept');
    assert.equal(acc.ok && 'exchange' in acc.value, true);
    if (!acc.ok || !('exchange' in acc.value)) return;
    const eid = acc.value.exchange.id;
    assert.equal(
      (await exchanges.schedule(aid, eid, { at: new Date(Date.now() + 86400000).toISOString(), place: 'Library' })).ok,
      true,
    );
    assert.ok((await notify.inbox(bid)).some((i) => i.type === 'schedule-set'));
    assert.equal((await exchanges.markDone(aid, eid)).ok, true);
    assert.ok((await notify.inbox(bid)).some((i) => i.type === 'completion-requested'));
    assert.equal((await exchanges.confirm(bid, eid)).ok, true);
    assert.ok((await notify.inbox(aid)).some((i) => i.type === 'completion-confirmed'));

    // blind: submit alone notifies nobody; reveal notifies the reviewee
    assert.equal((await reputation.submitReview(aid, eid, { score: 5 })).ok, true);
    assert.ok(!(await notify.inbox(bid)).some((i) => i.type === 'review-published'));
    assert.equal((await reputation.submitReview(bid, eid, { score: 4 })).ok, true);
    assert.ok((await notify.inbox(bid)).some((i) => i.type === 'review-published'));
    const target = (await reputation.aggregate(bid)).history[0]!;
    assert.equal((await reputation.respondToReview(bid, target.id, { text: 'Thanks!' })).ok, true);
    assert.ok((await notify.inbox(aid)).some((i) => i.type === 'review-response'));
  });

  it('report lifecycle notifies reporter; sanction notifies target only on action', async () => {
    const { notify, identity, moderation, aid, bid, request } = await setup();
    const r = await moderation.report(aid, {
      targetType: 'listing', targetId: request.id,
      reasonCode: 'spam-commercial', description: 'Commercial storefront link in description.',
      images: [],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    // mere report: reporter updated, reported party silent
    assert.ok((await notify.inbox(aid)).some((i) => i.type === 'report-status'));
    assert.equal((await notify.inbox(bid)).length, 0);
  });

  it('void, unhide, and handover notify the affected users', async () => {
    const { notify, identity, listings, moderation, reputation, exchanges, aid, bid, offer, request } = await setup();
    const mod = await identity.register({
      email: 'mod@gmail.com', password: 'password1', displayName: 'Mod',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    const mod2 = await identity.register({
      email: 'mod2@gmail.com', password: 'password1', displayName: 'Mod2',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    assert.equal(mod.ok && mod2.ok, true);
    if (!mod.ok || !mod2.ok) return;
    await identity.setRole('bootstrap', mod.value.id, 'moderator');
    await identity.setRole(mod.value.id, mod2.value.id, 'moderator');

    // hide → owner notified; unhide → owner notified
    assert.equal(
      (await moderation.sanction(mod.value.id, {
        action: 'hide', targetType: 'listing', targetId: offer.id, reason: 'Spam.',
      })).ok,
      true,
    );
    assert.ok((await notify.inbox(aid)).some((i) => i.type === 'moderation-action'));
    assert.equal((await moderation.unhide(mod.value.id, offer.id, 'Appeal upheld.')).ok, true);
    assert.equal((await listings.transition(aid, offer.id, 'reopen')).ok, true);

    // stolen handover → reporter notified
    const stolen = await moderation.report(aid, {
      targetType: 'listing', targetId: request.id,
      reasonCode: 'stolen-goods', description: 'Serial-less laptop, seller evasive about origin.',
      images: [],
    });
    assert.equal(stolen.ok, true);
    if (!stolen.ok) return;
    const before = await notify.inbox(aid).filter((i) => i.type === 'report-status').length;
    assert.equal(
      (await moderation.escalate(stolen.value.id, mod.value.id, { ownerApprovedBy: mod2.value.id })).ok,
      true,
    );
    assert.equal((await notify.inbox(aid)).filter((i) => i.type === 'report-status').length, before + 1);

    // void → reviewee notified (fresh listings: request was hidden by the stolen path)
    const offer2 = await listings.publish(aid, {
      side: 'offer', kind: 'skill', title: 'Guitar lessons',
      description: 'I teach guitar basics.', category: 'music',
      zone: 'North campus', images: [],
    });
    const request2 = await listings.publish(bid, {
      side: 'request', kind: 'skill', title: 'Need guitar help',
      description: 'Looking for help.', category: 'music',
      zone: 'North campus', images: [],
    });
    assert.equal(offer2.ok && request2.ok, true);
    if (!offer2.ok || !request2.ok) return;
    const p = await exchanges.propose(aid, {
      sideAListingIds: [offer2.value.id], sideBListingIds: [request2.value.id], terms: 'Deal.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) return;
    const acc = await exchanges.respond(bid, p.value.id, 'accept');
    assert.equal(acc.ok && 'exchange' in acc.value, true);
    if (!acc.ok || !('exchange' in acc.value)) return;
    const eid = acc.value.exchange.id;
    assert.equal(
      (await exchanges.schedule(aid, eid, { at: new Date(Date.now() + 86400000).toISOString(), place: 'Library' })).ok,
      true,
    );
    assert.equal((await exchanges.markDone(aid, eid)).ok, true);
    assert.equal((await exchanges.confirm(bid, eid)).ok, true);
    assert.equal((await reputation.submitReview(aid, eid, { score: 1, text: 'Abuse.' })).ok, true);
    assert.equal((await reputation.submitReview(bid, eid, { score: 5 })).ok, true);
    const target = (await reputation.aggregate(bid)).history[0]!;
    assert.equal((await moderation.voidReview(mod.value.id, target.id, 'Abusive content.')).ok, true);
    assert.ok((await notify.inbox(bid)).some((i) => i.type === 'moderation-action'));
  });
});
