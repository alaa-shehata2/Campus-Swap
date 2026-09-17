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
  it('messages due after 12 months, logs after 24', () => {
    const privacy = createPrivacyService();
    const now = Date.now();
    assert.equal(privacy.dueForAnonymization('message', now - MESSAGE_RETENTION_MS - DAY_MS, now), true);
    assert.equal(privacy.dueForAnonymization('message', now - MESSAGE_RETENTION_MS + DAY_MS, now), false);
    assert.equal(privacy.dueForAnonymization('log', now - LOG_RETENTION_MS - DAY_MS, now), true);
    assert.equal(privacy.dueForAnonymization('log', now - LOG_RETENTION_MS + DAY_MS, now), false);
    assert.equal(privacy.anonymizeText('hello'), '[anonymized]');
  });

  it('deactivation hides listings from discovery immediately', () => {
    const identity = createIdentityService();
    const listings = createListingsService();
    const r = identity.register({
      email: 'gone@gmail.com', password: 'password1', displayName: 'Gone',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(listings.publish(r.value.id, {
      side: 'offer', kind: 'skill', title: 'Python tutoring',
      description: 'I teach Python basics.', category: 'tutoring',
      zone: 'North campus', images: [],
    }).ok, true);
    assert.equal(searchListings(listings.store, {}, { anonymous: true }).total, 1);
    identity.deactivate(r.value.id);
    listings.deactivateOwner(r.value.id);
    assert.equal(searchListings(listings.store, {}, { anonymous: true }).total, 0);
  });
});

describe('privacy case access', () => {
  function setup() {
    const identity = createIdentityService();
    const listings = createListingsService();
    const privacy = createPrivacyService();
    const a = identity.register({
      email: 'alice@gmail.com', password: 'password1', displayName: 'Alice',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    const b = identity.register({
      email: 'bob@gmail.com', password: 'password1', displayName: 'Bob',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    const m = identity.register({
      email: 'mod@gmail.com', password: 'password1', displayName: 'Mod',
      campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
    });
    assert.equal(a.ok && b.ok && m.ok, true);
    if (!a.ok || !b.ok || !m.ok) throw new Error('setup failed');
    identity.setRole('bootstrap', m.value.id, 'moderator');
    const offer = listings.publish(a.value.id, {
      side: 'offer', kind: 'skill', title: 'Python tutoring',
      description: 'I teach Python basics.', category: 'tutoring',
      zone: 'North campus', images: [],
    });
    const request = listings.publish(b.value.id, {
      side: 'request', kind: 'skill', title: 'Need Python help',
      description: 'Looking for help.', category: 'tutoring',
      zone: 'North campus', images: [],
    });
    assert.equal(offer.ok && request.ok, true);
    if (!offer.ok || !request.ok) throw new Error('setup failed');
    const exchanges = createExchangesService({ listings, identity });
    const reputation = createReputationService({ exchanges });
    const moderation = createModerationService({ listings, identity, reputation, exchanges, privacy });
    const p = exchanges.propose(a.value.id, {
      sideAListingIds: [offer.value.id], sideBListingIds: [request.value.id], terms: 'Deal.',
    });
    assert.equal(p.ok, true);
    if (!p.ok) throw new Error('setup failed');
    const acc = exchanges.respond(b.value.id, p.value.id, 'accept');
    assert.equal(acc.ok && 'exchange' in acc.value, true);
    if (!acc.ok || !('exchange' in acc.value)) throw new Error('setup failed');
    assert.equal(exchanges.postMessage(a.value.id, acc.value.exchange.id, 'Hi!').ok, true);
    return { moderation, privacy, aid: a.value.id, exchangeId: acc.value.exchange.id, listing: offer.value, mod: m.value.id };
  }

  it('thread evidence denied + logged without open case; allowed on open case', () => {
    const { moderation, privacy, aid, exchangeId, listing, mod } = setup();
    const report = moderation.report(aid, {
      targetType: 'listing', targetId: listing.id,
      reasonCode: 'harassment', description: 'Threatening language in messages, see evidence.',
      images: [],
    });
    assert.equal(report.ok, true);
    if (!report.ok) return;
    const denied = moderation.viewThread(mod, exchangeId);
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.ok(denied.errors.some((e) => e.code === 'case-required'));
    assert.equal(moderation.triage(report.value.id, mod, 'acknowledge').ok, true);
    const allowed = moderation.viewThread(mod, exchangeId);
    assert.equal(allowed.ok, true);
    if (allowed.ok) assert.equal(allowed.value.length, 1);
    const log = privacy.getAccessLog();
    assert.equal(log.length, 2);
    assert.ok(log.every((l) => l.moderatorId === mod));
    assert.ok(log.every((l) => l.context === `thread:${exchangeId}`));
  });
});
