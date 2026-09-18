import { redirect } from 'next/navigation';
import { formatCairoTime } from '../../../src/common/cairoTime.js';
import { metrics, services } from '../../lib/services';
import { sessionUserId } from '../../lib/auth';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';

const TARGETS = [
  { key: 'members', label: 'Active members' },
  { key: 'listings', label: 'Published listings' },
  { key: 'completions', label: 'Completed exchanges' },
  { key: 'triage', label: 'Median triage time' },
] as const;

export default async function MetricsPage() {
  const viewerId = await sessionUserId();
  if (!viewerId) redirect('/login?returnTo=/metrics');
  const svc = services();
  const profile = await svc.identity.getProfile(viewerId);
  if (!profile || profile.role !== 'moderator') {
    return (
      <div className="space-y-4">
        <PageHeader title="Pilot metrics" description="Operational metrics are available to moderators." />
        <Panel tone="bordered">
          <p className="text-sm text-text-muted">Only moderators can access pilot metrics.</p>
        </Panel>
      </div>
    );
  }

  const { metrics: values, progress } = await metrics();
  const progressValues = {
    members: progress.members,
    listings: progress.listings,
    completions: progress.completions,
    triage: progress.triage,
  };
  const actuals = {
    members: values.activeMembers,
    listings: values.publishedListings,
    completions: values.completedExchanges,
    triage: values.medianTriageMs === null ? null : values.medianTriageMs,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="D12 pilot targets"
        title="Pilot metrics"
        description="Counts only; no member or report identities are shown."
      />
      {values.members === 0 && values.listings === 0 && values.completedExchanges === 0 ? (
        <Panel tone="bordered">
          <p className="text-sm text-text-muted">No pilot activity has been recorded yet.</p>
        </Panel>
      ) : null}
      <section aria-labelledby="progress-heading">
        <h2 id="progress-heading" className="mb-3 text-lg font-bold">Progress toward targets</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TARGETS.map(({ key, label }) => {
            const item = progressValues[key];
            const actual = actuals[key];
            const percent = actual === null ? 0 : Math.min(100, Math.round((item.actual / item.target) * 100));
            return (
              <Panel key={key} tone="bordered">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{label}</h3>
                  <Badge tone={item.met ? 'active' : 'warning'}>{item.met ? 'Met' : 'Open'}</Badge>
                </div>
                <p className="mt-3 text-2xl font-bold">
                  {actual === null ? 'No data' : key === 'triage' ? `${Math.round(actual / 3600000)}h` : item.actual}
                </p>
                <p className="text-sm text-text-muted">
                  Target: {key === 'triage' ? '≤ 48h' : item.target}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken" aria-label={`${percent}% of target`}>
                  <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
                </div>
                {!item.met && key !== 'triage' && (
                  <p className="mt-2 text-xs text-text-muted">{item.remaining} remaining</p>
                )}
              </Panel>
            );
          })}
        </div>
      </section>
      <Panel tone="bordered">
        <h2 className="mb-3 text-lg font-bold">Full metrics</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Total members', values.members],
            ['Active members', values.activeMembers],
            ['Moderators', values.moderators],
            ['All listings', values.listings],
            ['Active listings', values.activeListings],
            ['Reports received', values.reportsReceived],
            ['Reports under review', values.reportsUnderReview],
            ['Reports resolved', values.reportsResolved],
            ['Sanctions', values.sanctions],
            ['Handovers', values.handovers],
            ['Safety incidents', values.safetyIncidents],
            ['Published reviews', values.reviewsPublished],
          ].map(([label, value]) => (
            <div key={String(label)} className="border-b border-border pb-2">
              <dt className="text-text-muted">{label}</dt>
              <dd className="mt-1 text-lg font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-text-muted">
          Generated {formatCairoTime(new Date(values.generatedAtMs).toISOString())}.
        </p>
      </Panel>
    </div>
  );
}
