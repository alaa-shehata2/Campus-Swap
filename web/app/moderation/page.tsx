import { redirect } from 'next/navigation';
import { formatCairoTime } from '../../../src/common/cairoTime.js';
import { services } from '../../lib/services';
import { sessionUserId } from '../../lib/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { Badge } from '../../components/ui/Badge';
import { TriageButtons, SanctionForm, EscalateButton } from '../../components/ModerationForms';

export default async function ModerationQueue() {
  const viewerId = await sessionUserId();
  if (!viewerId) redirect('/login?returnTo=/moderation');
  const svc = services();
  const profile = await svc.identity.getProfile(viewerId);
  if (!profile || profile.role !== 'moderator') {
    return (
      <div className="space-y-4">
        <PageHeader title="Moderation" description="Review reported content and take action." />
        <Panel tone="bordered">
          <p className="text-sm text-text-muted">
            Only moderators can access the moderation queue. If you need help, report the listing
            or user instead.
          </p>
        </Panel>
      </div>
    );
  }
  const all = (await svc.moderation.store.allReports()).sort((a, b) => b.createdAtMs - a.createdAtMs);
  const open = all.filter((r) => r.status !== 'Resolved');
  const resolved = all.filter((r) => r.status === 'Resolved');
  const audit = await svc.moderation.auditLog();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderation queue"
        description={`${open.length} open report${open.length === 1 ? '' : 's'}. Every action is audit-logged with actor, reason, and timestamp.`}
      />
      {open.length === 0 ? (
        <Panel tone="bordered">
          <p className="text-sm text-text-muted">Queue clear — no open reports.</p>
        </Panel>
      ) : (
        <ul className="space-y-4">
          {open.map((r) => (
            <li key={r.id}>
              <Panel tone="bordered">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={r.status === 'Received' ? 'info' : 'warning'}>{r.status}</Badge>
                  <span className="font-medium">{r.reasonCode}</span>
                  {r.escalated && <Badge tone="danger">stolen-item escalation</Badge>}
                  <span className="text-text-muted">
                    {r.targetType} {r.targetId} · reporter {r.reporterId} ·{' '}
                    <time>{formatCairoTime(new Date(r.createdAtMs).toISOString())}</time>
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{r.description}</p>
                {r.images.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
                    {r.images.map((img, i) => (
                      <li key={i}>{img}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 grid gap-4 border-t border-border pt-3 lg:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Triage</h3>
                    <TriageButtons reportId={r.id} status={r.status} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Sanction</h3>
                    <SanctionForm targetType={r.targetType} targetId={r.targetId} />
                  </div>
                </div>
                {r.escalated && r.status === 'Under review' && (
                  <div className="mt-3 border-t border-border pt-3">
                    <EscalateButton reportId={r.id} />
                  </div>
                )}
              </Panel>
            </li>
          ))}
        </ul>
      )}
      <Panel tone="bordered">
        <h2 className="mb-3 text-lg font-bold">Resolved ({resolved.length})</h2>
        {resolved.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing resolved yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {resolved.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-2">
                <Badge tone="active">{r.status}</Badge>
                <span className="font-medium">{r.reasonCode}</span>
                <span className="text-text-muted">
                  {r.targetType} {r.targetId}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel tone="bordered">
        <h2 className="mb-3 text-lg font-bold">Audit log ({audit.length})</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-text-muted">No actions logged yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {audit.map((e) => (
              <li key={`${e.kind}-${e.id}`}>
                {e.kind === 'sanction' && (
                  <span>
                    <span className="font-medium">sanction</span> · {e.action} {e.targetType}{' '}
                    {e.targetId} · by {e.actor} · {e.reason} ·{' '}
                    <time>{formatCairoTime(new Date(e.atMs).toISOString())}</time>
                  </span>
                )}
                {e.kind === 'void' && (
                  <span>
                    <span className="font-medium">void</span> · review {e.reviewId} · by {e.by} ·{' '}
                    {e.reason} · <time>{formatCairoTime(new Date(e.atMs).toISOString())}</time>
                  </span>
                )}
                {e.kind === 'handover' && (
                  <span>
                    <span className="font-medium">handover</span> · report {e.reportId} · by {e.by} ·{' '}
                    <time>{formatCairoTime(new Date(e.atMs).toISOString())}</time>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
