import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPrivacyService, MESSAGE_RETENTION_MS, LOG_RETENTION_MS } from '../src/privacy/service.js';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';
import { createReputationService } from '../src/reputation/service.js';
import { createModerationService } from '../src/moderation/service.js';
import { searchListings } from '../src/listings/search.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('privacy retention', () => {
  it('messages due after 12 months, logs after 24', async () => {
    const privacy = createPrivacyService();
    const now = Date.now();
    assert.equal(await privacy.dueForAnonymization('message', now - MESSAGE_RETENTION_MS - DAY_MS, now), true);
    assert.equal(await privacy.dueForAnonymization('message', now - MESSAGE_RETENTION_MS + DAY_MS, now), false);
    assert.equal(await privacy.dueForAnonymization('log', now - LOG_RETENTION_MS - DAY_MS, now), true);
    assert.equal(await privacy.dueForAnonymization('log', now - LOG_RETENTION_MS + DAY_MS, now), false);
    assert.equal(await privacy.anonymizeText('hello'), '[anonymized]');
  });

  it('deactivation hides listings from discovery immediately', async () => {
    const identity = createIdentityService();
    const listings = createListingsService();
    const r = await identity.register({
      email: 'gone@gmail.com', password: 'password1', displayName: 'Gone',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal((await listings.publish(r.value.id, {
      side: 'offer', kind: 'skill', title: 'Python tutoring',
      description: 'I teach Python basics.', category: 'tutoring',
      zone: 'North campus', images: [],
    })).ok, true);
    assert.equal((await searchListings(listings.store, {}, { anonymous: true })).total, 1);
    await identity.deactivate(r.value.id);
    await listings.deactivateOwner(r.value.id);
    assert.equal((await searchListings(listings.store, {}, { anonymous: true })).total, 0);
  });
});

describe('privacy case access', () => {
  async function setup() {
    const identity = createIdentityService();
    const listings = createListingsService();
    const privacy = createPrivacyService();
    const a = await identity.register({
      email: 'alice@gmail.com', password: 'password1', displayName: 'Alice',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    const b = await identity.register({
      email: 'bob@gmail.com', password: 'password1', displayName: 'Bob',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    const m = await identity.register({
      email: 'mod@gmail.com', password: 'password1', displayName: 'Mod',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    assert.equal(a.ok && b.ok && m.ok, true);
    if (!a.ok || !b.ok || !m.ok) throw new Error('setup failed');
    await identity.setRole('bootstrap', m.value.id, 'moderator');
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
    const exchanges = createExchangesService({ listings, identity });
    const reputation = createReputationService({ exchanges });
    const moderation = createModerationService({ listings, identity, reputation, exchanges, privacy });
    const p = await exchanges.propose(a.value.id, {
      sideAListingIds: [offer.value.id], sideBListingIds: [request.value.id], terms: 'Deal.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) throw new Error('setup failed');
    const acc = await exchanges.respond(b.value.id, p.value.id, 'accept');
    assert.equal(acc.ok && 'exchange' in acc.value, true);
    if (!acc.ok || !('exchange' in acc.value)) throw new Error('setup failed');
    assert.equal((await exchanges.postMessage(a.value.id, acc.value.exchange.id, 'Hi!')).ok, true);
    return { moderation, privacy, aid: a.value.id, exchangeId: acc.value.exchange.id, listing: offer.value, mod: m.value.id };
  }

  it('thread evidence denied + logged without open case; allowed on open case', async () => {
    const { moderation, privacy, aid, exchangeId, listing, mod } = await setup();
    const report = await moderation.report(aid, {
      targetType: 'listing', targetId: listing.id,
      reasonCode: 'harassment', description: 'Threatening language in messages, see evidence.',
      images: [],
    });
    assert.equal(report.ok, true);
    if (!report.ok) return;
    const denied = await moderation.viewThread(mod, exchangeId);
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.ok(denied.errors.some((e) => e.code === 'case-required'));
    assert.equal((await moderation.triage(report.value.id, mod, 'acknowledge')).ok, true);
    const allowed = await moderation.viewThread(mod, exchangeId);
    assert.equal(allowed.ok, true);
    if (allowed.ok) assert.equal(allowed.value.length, 1);
    const log = await privacy.getAccessLog();
    assert.equal(log.length, 2);
    assert.ok(log.every((l) => l.moderatorId === mod));
    assert.ok(log.every((l) => l.context === `thread:${exchangeId}`));
  });
});
