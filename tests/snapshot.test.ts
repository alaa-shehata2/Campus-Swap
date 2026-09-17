import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshot, restoreSnapshot } from '../src/launch/snapshot.js';
import { computePilotMetrics } from '../src/metrics/service.js';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { createExchangesService } from '../src/exchanges/service.js';
import { createReputationService } from '../src/reputation/service.js';
import { createModerationService } from '../src/moderation/service.js';
import { createNotificationsService } from '../src/notifications/service.js';

function world() {
  const notify = createNotificationsService();
  const identity = createIdentityService();
  const listings = createListingsService();
  const a = identity.register({
    email: 'alice@gmail.com', password: 'password1', displayName: 'Alice',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  const b = identity.register({
    email: 'bob@gmail.com', password: 'password1', displayName: 'Bob',
    campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
  });
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) throw new Error('setup failed');
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
  const exchanges = createExchangesService({ listings, identity, notify });
  const reputation = createReputationService({ exchanges, notify });
  const moderation = createModerationService({ listings, identity, reputation, notify });
  const p = exchanges.propose(a.value.id, {
    sideAListingIds: [offer.value.id], sideBListingIds: [request.value.id], terms: 'Deal.',
  });
  assert.equal(p.ok, true);
  if (!p.ok) throw new Error('setup failed');
  return { notify, identity, listings, exchanges, reputation, moderation, aid: a.value.id, bid: b.value.id };
}

function fresh() {
  const notify = createNotificationsService();
  const identity = createIdentityService();
  const listings = createListingsService();
  const exchanges = createExchangesService({ listings, identity, notify });
  const reputation = createReputationService({ exchanges, notify });
  const moderation = createModerationService({ listings, identity, reputation, notify });
  return { notify, identity, listings, exchanges, reputation, moderation };
}

describe('snapshot', () => {
  it('backup/restore round-trip preserves metrics, login, audit, and inbox', () => {
    const src = world();
    const before = computePilotMetrics(src);
    const snap = createSnapshot(src);
    assert.equal(snap.version, 1);

    const dst = fresh();
    restoreSnapshot(dst, snap);
    const after = computePilotMetrics(dst);
    assert.deepEqual({ ...after, generatedAtMs: 0 }, { ...before, generatedAtMs: 0 });

    // login still works (credentials preserved)
    assert.equal(dst.identity.authenticate('alice@gmail.com', 'password1').ok, true);
    // audit intact
    assert.deepEqual(
      dst.moderation.auditLog().map((a) => a.kind),
      src.moderation.auditLog().map((a) => a.kind),
    );
    // inbox intact
    assert.equal(dst.notify.inbox(src.aid).length, src.notify.inbox(src.aid).length);
    assert.ok(dst.notify.inbox(src.bid).some((i) => i.type === 'proposal-received'));
  });

  it('rejects snapshots with unknown versions', () => {
    const dst = fresh();
    assert.throws(
      () => restoreSnapshot(dst, { version: 999, state: {} } as never),
      /unsupported snapshot version/i,
    );
  });

  it('rejects truncated snapshots with a snapshot error', () => {
    const dst = fresh();
    assert.throws(
      () => restoreSnapshot(dst, { version: 1, takenAtMs: 0, state: {} } as never),
      /invalid snapshot state/i,
    );
  });

  it('rolls back all stores when a later restore import fails', () => {
    const src = world();
    const dst = fresh();
    const original = computePilotMetrics(dst);
    const snap = createSnapshot(src);
    const originalImport = dst.moderation.store.importState.bind(dst.moderation.store);
    let failOnce = true;
    dst.moderation.store.importState = (state) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('restore failure');
      }
      originalImport(state);
    };
    assert.throws(() => restoreSnapshot(dst, snap), /restore failure/);
    dst.moderation.store.importState = originalImport;
    assert.deepEqual(
      { ...computePilotMetrics(dst), generatedAtMs: 0 },
      { ...original, generatedAtMs: 0 },
    );
  });

  it('block/mute pairs survive restore (sessions do not)', () => {
    const src = world();
    src.identity.block(src.aid, src.bid);
    const snap = createSnapshot(src);
    const dst = fresh();
    restoreSnapshot(dst, snap);
    assert.equal(dst.identity.isBlockedOrMuted(src.aid, src.bid), true);
  });
});
