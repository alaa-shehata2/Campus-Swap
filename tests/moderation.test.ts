import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';
import { createReputationService } from '../src/reputation/service.js';
import { createModerationService } from '../src/moderation/service.js';

function setup() {
  const identity = createIdentityService();
  const listings = createListingsService();
  const rep = identity.register({
    email: 'reporter@gmail.com', password: 'password1', displayName: 'Reporter',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  const own = identity.register({
    email: 'owner@gmail.com', password: 'password1', displayName: 'Owner',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  const mod = identity.register({
    email: 'mod@gmail.com', password: 'password1', displayName: 'Mod',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  const mod2 = identity.register({
    email: 'mod2@gmail.com', password: 'password1', displayName: 'Mod2',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  assert.equal(rep.ok && own.ok && mod.ok && mod2.ok, true);
  if (!rep.ok || !own.ok || !mod.ok || !mod2.ok) throw new Error('setup failed');
  identity.setRole('bootstrap', mod.value.id, 'moderator');
  identity.setRole(mod.value.id, mod2.value.id, 'moderator');
  const listing = listings.publish(own.value.id, {
    side: 'offer', kind: 'item', title: 'Cheap phone, hurry',
    description: 'Selling a phone below market price.', category: 'electronics',
    zone: 'Dorms', images: [], modality: 'give',
  });
  assert.equal(listing.ok, true);
  if (!listing.ok) throw new Error('setup failed');
  const exchanges = createExchangesService({ listings, identity });
  const reputation = createReputationService({ exchanges });
  const moderation = createModerationService({ listings, identity, reputation });
  return {
    identity, listings, moderation,
    reporter: rep.value.id, owner: own.value.id, listing: listing.value,
    mod: mod.value.id, mod2: mod2.value.id,
  };
}

describe('moderation reports', () => {
  it('any member reports any listing with reason code; images capped at 3', () => {
    const { moderation, reporter, listing, mod } = setup();
    const r = moderation.report(reporter, {
      targetType: 'listing', targetId: listing.id,
      reasonCode: 'spam-commercial', description: 'Commercial storefront link in description.',
      images: [],
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value.status, 'Received');
    const tooMany = moderation.report(reporter, {
      targetType: 'listing', targetId: listing.id,
      reasonCode: 'spam-commercial', description: 'Too many images attached here.',
      images: ['a', 'b', 'c', 'd'],
    });
    assert.equal(tooMany.ok, false);
  });

  it('other requires >=20-char description', () => {
    const { moderation, reporter, listing } = setup();
    const short = moderation.report(reporter, {
      targetType: 'listing', targetId: listing.id,
      reasonCode: 'other', description: 'Short.',
      images: [],
    });
    assert.equal(short.ok, false);
    if (!short.ok) assert.ok(short.errors.some((e) => e.field === 'description'));
  });

  it('report transitions Received -> Under review -> Resolved', () => {
    const { moderation, reporter, listing, mod } = setup();
    const r = moderation.report(reporter, {
      targetType: 'listing', targetId: listing.id,
      reasonCode: 'harassment', description: 'Threatening language in the description text here.',
      images: [],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(moderation.triage(r.value.id, mod, 'acknowledge').ok, true);
    assert.equal(moderation.getReport(r.value.id)?.status, 'Under review');
    const resolved = moderation.triage(r.value.id, mod, 'resolve');
    assert.equal(resolved.ok, true);
    if (resolved.ok) assert.equal(resolved.value.status, 'Resolved');
  });
});

describe('moderation sanctions', () => {
  it('hide removes listing from discovery; unhide restores via Paused', () => {
    const { listings, moderation, reporter, listing, mod } = setup();
    const s = moderation.sanction(mod, {
      action: 'hide', targetType: 'listing', targetId: listing.id, reason: 'Confirmed commercial spam.',
    });
    assert.equal(s.ok, true);
    assert.equal(listings.get(listing.id)?.status, 'Hidden');
    const audit = moderation.auditLog();
    const entry = audit.find((a) => a.kind === 'sanction' && a.action === 'hide');
    assert.ok(entry && entry.kind === 'sanction');
    if (entry && entry.kind === 'sanction') {
      assert.equal(entry.actor, mod);
      assert.ok(entry.reason && entry.atMs);
    }
    const u = moderation.unhide(mod, listing.id, 'Appeal upheld.');
    assert.equal(u.ok, true);
    assert.equal(listings.get(listing.id)?.status, 'Paused');
  });

  it('suspend blocks login; warn only records', () => {
    const { identity, moderation, reporter, owner, mod } = setup();
    assert.equal(
      moderation.sanction(mod, {
        action: 'suspend', targetType: 'user', targetId: owner, reason: 'Harassment pattern.',
      }).ok,
      true,
    );
    const login = identity.authenticate('owner@gmail.com', 'password1');
    assert.equal(login.ok, false);
    if (!login.ok) assert.ok(login.errors.some((e) => e.code === 'account-suspended'));
    const w = moderation.sanction(mod, {
      action: 'warn', targetType: 'user', targetId: reporter, reason: 'Borderline report wording.',
    });
    assert.equal(w.ok, true);
    assert.equal(identity.authenticate('reporter@gmail.com', 'password1').ok, true);
  });
});

describe('moderation stolen path', () => {
  it('stolen reports hide-first and open a case immediately', () => {
    const { listings, moderation, reporter, listing, mod } = setup();
    const r = moderation.report(reporter, {
      targetType: 'listing', targetId: listing.id,
      reasonCode: 'stolen-goods', description: 'Serial-less laptop, seller evasive about origin.',
      images: [],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.escalated, true);
    assert.equal(r.value.status, 'Under review');
    assert.equal(listings.get(listing.id)?.status, 'Hidden');
  });

  it('handover needs a second moderator approver; evidence preserved', () => {
    const { moderation, reporter, owner, listing, mod, mod2 } = setup();
    const r = moderation.report(reporter, {
      targetType: 'listing', targetId: listing.id,
      reasonCode: 'stolen-goods', description: 'Serial-less laptop, seller evasive about origin.',
      images: [],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    // self-approval and non-moderator approval rejected
    assert.equal(moderation.escalate(r.value.id, mod, { ownerApprovedBy: mod }).ok, false);
    assert.equal(moderation.escalate(r.value.id, mod, { ownerApprovedBy: owner }).ok, false);
    const denied = moderation.escalate(r.value.id, mod, { ownerApprovedBy: reporter });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.ok(denied.errors.some((e) => e.code === 'handover-approval-required'));
    const handover = moderation.escalate(r.value.id, mod, { ownerApprovedBy: mod2 });
    assert.equal(handover.ok, true);
    if (!handover.ok) return;
    assert.equal(handover.value.evidence.targetId, listing.id);
    assert.equal(handover.value.evidence.reasonCode, 'stolen-goods');
    assert.ok(handover.value.evidence.history.length >= 2);
    assert.equal(moderation.getReport(r.value.id)?.status, 'Resolved');
  });

  it('non-moderators cannot triage, sanction, or void', () => {
    const { moderation, reporter, owner, listing } = setup();
    const r = moderation.report(reporter, {
      targetType: 'listing', targetId: listing.id,
      reasonCode: 'spam-commercial', description: 'Commercial storefront link in description.',
      images: [],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(moderation.triage(r.value.id, reporter, 'acknowledge').ok, false);
    assert.equal(
      moderation.sanction(owner, {
        action: 'hide', targetType: 'listing', targetId: listing.id, reason: 'Rogue hide.',
      }).ok,
      false,
    );
  });

  it('stolen case opens even when hiding fails (already archived)', () => {
    const { identity, listings, moderation, reporter, owner, listing } = setup();
    assert.equal(listings.transition(owner, listing.id, 'archive').ok, true);
    const r = moderation.report(reporter, {
      targetType: 'listing', targetId: listing.id,
      reasonCode: 'stolen-goods', description: 'Serial-less laptop, seller evasive about origin.',
      images: [],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.escalated, true);
    assert.equal(r.value.status, 'Under review');
    void identity;
  });

  it('clearRestriction lifts suspension with an audit entry', () => {
    const { identity, moderation, owner, mod } = setup();
    assert.equal(
      moderation.sanction(mod, {
        action: 'suspend', targetType: 'user', targetId: owner, reason: 'Harassment pattern.',
      }).ok,
      true,
    );
    assert.equal(identity.authenticate('owner@gmail.com', 'password1').ok, false);
    const cleared = moderation.clearRestriction(mod, owner, 'Appeal upheld.');
    assert.equal(cleared.ok, true);
    assert.equal(identity.authenticate('owner@gmail.com', 'password1').ok, true);
    assert.ok(
      moderation.auditLog().some((a) => a.kind === 'sanction' && a.action === 'clear-restriction'),
    );
  });
});
