export interface HealthDeps {
  policy: { disclaimerFor(flow: 'signup'): string };
  privacy: { anonymizeText(text: string): string };
  identity: { userStats(): unknown };
  listings: { store: { countByStatus(): unknown } };
  exchanges: { store: { exchangeStats(): unknown } };
  reputation: { store: { counts(): unknown } };
  moderation: { store: { allReports(): unknown } };
  notifications: { inbox(userId: string): unknown };
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  checks: Record<string, 'ok' | 'fail'>;
  atMs: number;
}

/** Liveness probe over every module seam (NFR-A-1 health check). */
export async function healthCheck(deps: HealthDeps, nowMs = Date.now()): Promise<HealthReport> {
  const checks: Record<string, 'ok' | 'fail'> = {};
  const probes: Record<string, () => unknown> = {
    policy: () => deps.policy.disclaimerFor('signup'),
    privacy: () => deps.privacy.anonymizeText('health-check'),
    identity: () => deps.identity.userStats(),
    listings: () => deps.listings.store.countByStatus(),
    exchanges: () => deps.exchanges.store.exchangeStats(),
    reputation: () => deps.reputation.store.counts(),
    moderation: () => deps.moderation.store.allReports(),
    notifications: () => deps.notifications.inbox('__health__'),
  };
  for (const [name, probe] of Object.entries(probes)) {
    try {
      await probe();
      checks[name] = 'ok';
    } catch {
      checks[name] = 'fail';
    }
  }
  const status = Object.values(checks).every((c) => c === 'ok') ? 'ok' : 'degraded';
  return { status, checks, atMs: nowMs };
}
