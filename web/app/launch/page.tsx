import { redirect } from 'next/navigation';
import { formatCairoTime } from '../../../src/common/cairoTime.js';
import { metrics, launchStatus, services } from '../../lib/services';
import { sessionUserId } from '../../lib/auth';
import { GateChecker } from '../../components/GateChecker';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';

export default async function LaunchPage() {
  const viewerId = await sessionUserId();
  if (!viewerId) redirect('/login?returnTo=/launch');
  const svc = services();
  const profile = await svc.identity.getProfile(viewerId);
  if (!profile || profile.role !== 'moderator') {
    return (
      <div className="space-y-4">
        <PageHeader title="Launch gate" description="Pilot readiness is available to moderators." />
        <Panel tone="bordered">
          <p className="text-sm text-text-muted">Only moderators can access the launch gate.</p>
        </Panel>
      </div>
    );
  }

  const status = await launchStatus();
  const { metrics: values } = await metrics();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pilot readiness"
        title="Launch gate"
        description="Human attestations are evaluated in this view and are not persisted."
      />
      <Panel tone="bordered">
        <GateChecker metrics={values} health={status.health} moderatorCount={status.moderatorCount} />
      </Panel>
      <section className="grid gap-6 lg:grid-cols-2">
        <Panel tone="bordered">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Health checks</h2>
            <Badge tone={status.health.status === 'ok' ? 'active' : 'danger'}>{status.health.status}</Badge>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            {Object.entries(status.health.checks).map(([name, result]) => (
              <div key={name} className="flex justify-between gap-3 border-b border-border pb-2">
                <dt>{name}</dt>
                <dd><Badge tone={result === 'ok' ? 'active' : 'danger'}>{result}</Badge></dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-text-muted">
            Checked {formatCairoTime(new Date(status.health.atMs).toISOString())}.
          </p>
        </Panel>
        <Panel tone="bordered">
          <h2 className="text-lg font-bold">Automated audits</h2>
          <div className="mt-3 space-y-4 text-sm">
            <div>
              <h3 className="font-semibold">Disclaimers</h3>
              <ul className="mt-1 space-y-1">
                {status.disclaimers.map((finding) => (
                  <li key={finding.flow} className="flex flex-wrap items-center gap-2">
                    <Badge tone={finding.ok ? 'active' : 'danger'}>{finding.ok ? 'pass' : 'fail'}</Badge>
                    <span>{finding.flow}</span>
                    {finding.issues.length > 0 && <span className="text-text-muted">{finding.issues.join('; ')}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={status.cairo.ok ? 'active' : 'danger'}>{status.cairo.ok ? 'pass' : 'fail'}</Badge>
              <span>Cairo-time labels</span>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
