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

async function world() {
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
  const p = await exchanges.propose(a.value.id, {
    sideAListingIds: [offer.value.id], sideBListingIds: [request.value.id], terms: 'Deal.',
  });
  assert.equal(p.ok, true);
  if (!p.ok) throw new Error('setup failed');
  return { notify, identity, listings, exchanges, reputation, moderation, aid: a.value.id, bid: b.value.id };
}

async function fresh() {
  const notify = createNotificationsService();
  const identity = createIdentityService();
  const listings = createListingsService();
  const exchanges = createExchangesService({ listings, identity, notify });
  const reputation = createReputationService({ exchanges, notify });
  const moderation = createModerationService({ listings, identity, reputation, notify });
  return { notify, identity, listings, exchanges, reputation, moderation };
}

describe('snapshot', () => {
  it('backup/restore round-trip preserves metrics, login, audit, and inbox', async () => {
    const src = await world();
    const before = await computePilotMetrics(src);
    const snap = await createSnapshot(src);
    assert.equal(snap.version, 1);

    const dst = await fresh();
    await restoreSnapshot(dst, snap);
    const after = await computePilotMetrics(dst);
    assert.deepEqual({ ...after, generatedAtMs: 0 }, { ...before, generatedAtMs: 0 });

    // login still works (credentials preserved)
    assert.equal((await dst.identity.authenticate('alice@gmail.com', 'password1')).ok, true);
    // audit intact
    assert.deepEqual(
      (await dst.moderation.auditLog()).map((a) => a.kind),
      (await src.moderation.auditLog()).map((a) => a.kind),
    );
    // inbox intact
    assert.equal((await dst.notify.inbox(src.aid)).length, (await src.notify.inbox(src.aid)).length);
    assert.ok((await dst.notify.inbox(src.bid)).some((i) => i.type === 'proposal-received'));
  });

  it('rejects snapshots with unknown versions', async () => {
    const dst = await fresh();
    await assert.rejects(
      restoreSnapshot(dst, { version: 999, state: {} } as never),
      /unsupported snapshot version/i,
    );
  });

  it('rejects truncated snapshots with a snapshot error', async () => {
    const dst = await fresh();
    await assert.rejects(
      restoreSnapshot(dst, { version: 1, takenAtMs: 0, state: {} } as never),
      /invalid snapshot state/i,
    );
  });

  it('rolls back all stores when a later restore import fails', async () => {
    const src = await world();
    const dst = await fresh();
    const original = await computePilotMetrics(dst);
    const snap = await createSnapshot(src);
    const originalImport = dst.moderation.store.importState.bind(dst.moderation.store);
    let failOnce = true;
    dst.moderation.store.importState = async (state) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('restore failure');
      }
      originalImport(state);
    };
    await assert.rejects(restoreSnapshot(dst, snap), /restore failure/);
    dst.moderation.store.importState = originalImport;
    assert.deepEqual(
      { ...(await computePilotMetrics(dst)), generatedAtMs: 0 },
      { ...original, generatedAtMs: 0 },
    );
  });

  it('block/mute pairs survive restore (sessions do not)', async () => {
    const src = await world();
    await src.identity.block(src.aid, src.bid);
    const snap = await createSnapshot(src);
    const dst = await fresh();
    await restoreSnapshot(dst, snap);
    assert.equal(await dst.identity.isBlockedOrMuted(src.aid, src.bid), true);
  });
});
