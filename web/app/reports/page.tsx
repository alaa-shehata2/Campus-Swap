import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatCairoTime } from '../../../src/common/cairoTime.js';
import { services } from '../../lib/services';
import { sessionUserId } from '../../lib/auth';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { Badge } from '../../components/ui/Badge';
import type { ReportStatus } from '../../../src/moderation/types.js';

const statusTone: Record<ReportStatus, 'info' | 'warning' | 'active'> = {
  Received: 'info',
  'Under review': 'warning',
  Resolved: 'active',
};

export default async function MyReports() {
  const viewerId = await sessionUserId();
  if (!viewerId) redirect('/login?returnTo=/reports');
  const svc = services();
  const mine = (await svc.moderation.store.allReports())
    .filter((r) => r.reporterId === viewerId)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  return (
    <div className="space-y-6">
      <PageHeader
        title="My reports"
        description="Status updates on everything you reported: Received → Under review → Resolved."
      />
      {mine.length === 0 ? (
        <Panel tone="bordered">
          <p className="text-sm text-text-muted">
            You have not reported anything. If you see a problematic listing or user, use the
            report entry on its page.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {mine.map((r) => (
            <li key={r.id}>
              <Panel tone="bordered">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={statusTone[r.status]}>{r.status}</Badge>
                  <span className="font-medium">{r.reasonCode}</span>
                  <span className="text-text-muted">
                    {r.targetType} ·{' '}
                    <time>{formatCairoTime(new Date(r.createdAtMs).toISOString())}</time>
                  </span>
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm">{r.description}</p>
                <ol className="mt-2 space-y-0.5 text-xs text-text-muted">
                  {r.history.map((h, i) => (
                    <li key={i}>
                      {h.status} · <time>{formatCairoTime(new Date(h.atMs).toISOString())}</time>
                    </li>
                  ))}
                </ol>
              </Panel>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm">
        <Link href="/" className="underline">
          ← Back to listings
        </Link>
      </p>
    </div>
  );
}
