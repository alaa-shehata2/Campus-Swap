import type { ExchangesService } from '../exchanges/service.js';
import type { IdentityService } from '../identity/service.js';
import type { ListingsService } from '../listings/service.js';
import type { ModerationService } from '../moderation/service.js';
import type { NotificationsService } from '../notifications/service.js';
import type { ReputationService } from '../reputation/service.js';

export const SNAPSHOT_VERSION = 1;

export interface WorldDeps {
  identity: Pick<IdentityService, 'exportUsers' | 'importUsers'>;
  listings: Pick<ListingsService, 'store'>;
  exchanges: Pick<ExchangesService, 'store'>;
  reputation: Pick<ReputationService, 'store'>;
  moderation: Pick<ModerationService, 'store'>;
  notify: Pick<NotificationsService, 'exportState' | 'importState'>;
}

export interface Snapshot {
  version: number;
  takenAtMs: number;
  state: {
    identity: Awaited<ReturnType<WorldDeps['identity']['exportUsers']>>;
    listings: Awaited<ReturnType<WorldDeps['listings']['store']['exportState']>>;
    exchanges: Awaited<ReturnType<WorldDeps['exchanges']['store']['exportState']>>;
    reputation: Awaited<ReturnType<WorldDeps['reputation']['store']['exportState']>>;
    moderation: Awaited<ReturnType<WorldDeps['moderation']['store']['exportState']>>;
    notifications: Awaited<ReturnType<WorldDeps['notify']['exportState']>>;
  };
}

/**
 * Backup: full-fidelity snapshot of the in-memory pilot stores (NFR-A-1).
 * SENSITIVE: includes salted password hashes — handle exactly like a
 * database dump (encrypted at rest, never committed, minimal retention).
 * Sessions are intentionally excluded (users re-login after restore).
 */
export async function createSnapshot(deps: WorldDeps, nowMs = Date.now()): Promise<Snapshot> {
  return {
    version: SNAPSHOT_VERSION,
    takenAtMs: nowMs,
    state: {
      identity: await deps.identity.exportUsers(),
      listings: await deps.listings.store.exportState(),
      exchanges: await deps.exchanges.store.exportState(),
      reputation: await deps.reputation.store.exportState(),
      moderation: await deps.moderation.store.exportState(),
      notifications: await deps.notify.exportState(),
    },
  };
}

/** Restore: replaces all store contents with the snapshot (demonstrated by test). */
export async function restoreSnapshot(deps: WorldDeps, snap: Snapshot): Promise<void> {
  if (!snap || snap.version !== SNAPSHOT_VERSION) {
    throw new Error(`Unsupported snapshot version: ${snap?.version}.`);
  }
  const s = snap.state;
  const problems: string[] = [];
  if (!s || !Array.isArray(s.identity?.users)) problems.push('identity.users');
  if (!Array.isArray(s?.listings?.items) || !Array.isArray(s?.listings?.order)) {
    problems.push('listings.items/order');
  }
  if (!Array.isArray(s?.exchanges?.proposals) || !Array.isArray(s?.exchanges?.exchanges)) {
    problems.push('exchanges.proposals/exchanges');
  }
  if (!Array.isArray(s?.reputation)) problems.push('reputation');
  if (!Array.isArray(s?.moderation?.reports)) problems.push('moderation.reports');
  if (!Array.isArray(s?.notifications)) problems.push('notifications');
  if (problems.length > 0) {
    throw new Error(`Invalid snapshot state: missing ${problems.join(', ')}.`);
  }
  const previous = await createSnapshot(deps);
  try {
    await deps.identity.importUsers(snap.state.identity);
    await deps.listings.store.importState(snap.state.listings);
    await deps.exchanges.store.importState(snap.state.exchanges);
    await deps.reputation.store.importState(snap.state.reputation);
    await deps.moderation.store.importState(snap.state.moderation);
    await deps.notify.importState(snap.state.notifications);
  } catch (error) {
    try {
      deps.identity.importUsers(previous.state.identity);
      deps.listings.store.importState(previous.state.listings);
      deps.exchanges.store.importState(previous.state.exchanges);
      deps.reputation.store.importState(previous.state.reputation);
      deps.moderation.store.importState(previous.state.moderation);
      deps.notify.importState(previous.state.notifications);
    } catch (rollbackError) {
      throw new Error('Snapshot restore failed and rollback could not be completed.', { cause: rollbackError });
    }
    throw error;
  }
}
