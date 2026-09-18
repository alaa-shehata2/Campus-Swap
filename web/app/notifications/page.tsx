import { redirect } from 'next/navigation';
import { formatCairoTime } from '../../../src/common/cairoTime.js';
import { services } from '../../lib/services';
import { sessionUserId } from '../../lib/auth';
import { MarkAllReadButton, MarkReadButton } from '../../components/InboxActions';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { Badge } from '../../components/ui/Badge';

const TYPE_LABELS: Record<string, string> = {
  'proposal-received': 'New proposal received',
  'proposal-accepted': 'Proposal accepted',
  'proposal-declined': 'Proposal declined',
  'proposal-expired': 'Proposal expired',
  'schedule-set': 'Schedule set',
  'schedule-changed': 'Schedule changed',
  'completion-requested': 'Completion requested',
  'completion-confirmed': 'Completion confirmed',
  cancellation: 'Exchange cancelled',
  'review-available': 'Review available',
  'review-published': 'Review published',
  'review-response': 'Review response',
  'report-status': 'Report status update',
  'lend-reminder': 'Lend reminder',
  overdue: 'Overdue notice',
  'moderation-action': 'Moderation action',
};

export default async function NotificationsInbox() {
  const viewerId = await sessionUserId();
  if (!viewerId) redirect('/login?returnTo=/notifications');
  const svc = services();
  const items = (await svc.notify.inbox(viewerId)).sort((a, b) => b.createdAtMs - a.createdAtMs);
  const unread = items.filter((n) => n.readAtMs === undefined).length;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={
          unread === 0
            ? 'All caught up. CampusSwap notifies in-app only — no emails.'
            : `${unread} unread. CampusSwap notifies in-app only — no emails.`
        }
        actions={unread > 0 ? <MarkAllReadButton /> : undefined}
      />
      {items.length === 0 ? (
        <Panel tone="bordered">
          <p className="text-sm text-text-muted">
            Nothing yet. Proposals, schedules, completions, reviews, reports, and moderation
            actions will appear here.
          </p>
        </Panel>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Panel tone={n.readAtMs === undefined ? 'elevated' : 'bordered'}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {n.readAtMs === undefined && <Badge tone="info">unread</Badge>}
                  <span className="font-medium">{TYPE_LABELS[n.type] ?? n.type}</span>
                  <span className="text-text-muted">
                    <time>{formatCairoTime(new Date(n.createdAtMs).toISOString())}</time>
                  </span>
                  <span className="flex-1" />
                  {n.readAtMs === undefined && <MarkReadButton notificationId={n.id} />}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}