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
    identity: ReturnType<WorldDeps['identity']['exportUsers']>;
    listings: ReturnType<WorldDeps['listings']['store']['exportState']>;
    exchanges: ReturnType<WorldDeps['exchanges']['store']['exportState']>;
    reputation: ReturnType<WorldDeps['reputation']['store']['exportState']>;
    moderation: ReturnType<WorldDeps['moderation']['store']['exportState']>;
    notifications: ReturnType<WorldDeps['notify']['exportState']>;
  };
}

/**
 * Backup: full-fidelity snapshot of the in-memory pilot stores (NFR-A-1).
 * SENSITIVE: includes salted password hashes — handle exactly like a
 * database dump (encrypted at rest, never committed, minimal retention).
 * Sessions are intentionally excluded (users re-login after restore).
 */
export function createSnapshot(deps: WorldDeps, nowMs = Date.now()): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    takenAtMs: nowMs,
    state: {
      identity: deps.identity.exportUsers(),
      listings: deps.listings.store.exportState(),
      exchanges: deps.exchanges.store.exportState(),
      reputation: deps.reputation.store.exportState(),
      moderation: deps.moderation.store.exportState(),
      notifications: deps.notify.exportState(),
    },
  };
}

/** Restore: replaces all store contents with the snapshot (demonstrated by test). */
export function restoreSnapshot(deps: WorldDeps, snap: Snapshot): void {
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
  const previous = createSnapshot(deps);
  try {
    deps.identity.importUsers(snap.state.identity);
    deps.listings.store.importState(snap.state.listings);
    deps.exchanges.store.importState(snap.state.exchanges);
    deps.reputation.store.importState(snap.state.reputation);
    deps.moderation.store.importState(snap.state.moderation);
    deps.notify.importState(snap.state.notifications);
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
