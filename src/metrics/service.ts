import type { ExchangesService } from '../exchanges/service.js';
import type { IdentityService } from '../identity/service.js';
import type { ListingsService } from '../listings/service.js';
import type { ModerationService } from '../moderation/service.js';
import type { ReputationService } from '../reputation/service.js';
import type { PilotMetrics, PilotProgress, TargetProgress } from './types.js';

/** Pilot success targets, 8 weeks post-launch at KFS (D12). */
export const D12_TARGETS = {
  members: 200,
  listings: 150,
  completions: 30,
  triageMs: 48 * 60 * 60 * 1000,
} as const;

export interface MetricsDeps {
  identity: Pick<IdentityService, 'userStats'>;
  listings: Pick<ListingsService, 'store'>;
  exchanges: Pick<ExchangesService, 'store'>;
  moderation: Pick<ModerationService, 'store'>;
  reputation: Pick<ReputationService, 'store'>;
}

/** Product metrics dashboard input (NFR-O-1): members, listings, completions, triage, incidents. */
export function computePilotMetrics(deps: MetricsDeps, nowMs = Date.now()): PilotMetrics {
  const users = deps.identity.userStats();
  const listings = deps.listings.store.countByStatus();
  const exchanges = deps.exchanges.store.exchangeStats();
  const reports = deps.moderation.store.allReports();
  const sanctions = deps.moderation.store.getSanctions().length;
  const handovers = deps.moderation.store.getHandovers().length;
  const reviews = deps.reputation.store.counts();
  const safetyIncidents = reports.filter((r) =>
    r.reasonCode === 'stolen-goods' || r.reasonCode === 'unsafe-behavior',
  ).length;

  let received = 0;
  let underReview = 0;
  let resolved = 0;
  const latencies: number[] = [];
  for (const r of reports) {
    if (r.status === 'Received') received += 1;
    else if (r.status === 'Under review') underReview += 1;
    else {
      resolved += 1;
      const opened = r.history.find((h) => h.status === 'Received')?.atMs;
      const closed = [...r.history].reverse().find((h) => h.status === 'Resolved')?.atMs;
      if (opened !== undefined && closed !== undefined) latencies.push(closed - opened);
    }
  }
  latencies.sort((a, b) => a - b);
  const medianTriageMs =
    latencies.length === 0
      ? null
      : latencies.length % 2 === 1
        ? latencies[(latencies.length - 1) / 2]!
        : (latencies[latencies.length / 2 - 1]! + latencies[latencies.length / 2]!) / 2;

  return {
    members: users.total,
    activeMembers: users.active,
    moderators: users.moderators,
    listings: listings.Draft + listings.Active + listings.Paused + listings.Archived + listings.Hidden,
    activeListings: listings.Active,
    publishedListings: listings.Active + listings.Paused,
    completedExchanges: exchanges.Completed,
    reportsReceived: received,
    reportsUnderReview: underReview,
    reportsResolved: resolved,
    medianTriageMs,
    sanctions,
    handovers,
    safetyIncidents,
    reviewsPublished: reviews.published,
    generatedAtMs: nowMs,
  };
}

function progress(actual: number, target: number): TargetProgress {
  return { met: actual >= target, actual, target, remaining: Math.max(0, target - actual) };
}

/** D12 progress check. Triage passes only with resolved reports inside the SLA. */
export function pilotProgress(m: PilotMetrics): PilotProgress {
  const triageMet =
    m.medianTriageMs !== null &&
    m.reportsResolved > 0 &&
    m.medianTriageMs <= D12_TARGETS.triageMs;
  return {
    members: progress(m.activeMembers, D12_TARGETS.members),
    listings: progress(m.publishedListings, D12_TARGETS.listings),
    completions: progress(m.completedExchanges, D12_TARGETS.completions),
    triage: {
      met: triageMet,
      actual: m.medianTriageMs ?? Number.POSITIVE_INFINITY,
      target: D12_TARGETS.triageMs,
      remaining: triageMet
        ? 0
        : m.medianTriageMs === null
          ? D12_TARGETS.triageMs
          : Math.max(0, m.medianTriageMs - D12_TARGETS.triageMs),
    },
  };
}
