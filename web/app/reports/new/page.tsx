import Link from 'next/link';
import { redirect } from 'next/navigation';
import { services } from '../../../lib/services';
import { sessionUserId } from '../../../lib/auth';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Panel } from '../../../components/ui/Panel';
import { ReportForm } from '../../../components/ReportForm';

export default async function NewReport({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewerId = await sessionUserId();
  if (!viewerId) redirect('/login?returnTo=/reports/new');
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const targetType = one(q['targetType']);
  const targetId = one(q['targetId']);
  if ((targetType !== 'listing' && targetType !== 'user') || !targetId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Report" description="Choose what to report from a listing or profile." />
        <Panel tone="bordered">
          <p className="text-sm text-text-muted">
            No report target selected. Open a listing and choose “Report this listing”, or visit{' '}
            <Link href="/reports" className="underline">
              your reports
            </Link>
            .
          </p>
        </Panel>
      </div>
    );
  }
  const svc = services();
  const targetLabel =
    targetType === 'listing'
      ? (await svc.listings.get(targetId))?.title
      : (await svc.identity.getProfile(targetId))?.displayName;
  if (!targetLabel) {
    return (
      <div className="space-y-4">
        <PageHeader title="Report" />
        <Panel tone="bordered">
          <p className="text-sm text-text-muted">
            This {targetType} no longer exists.{' '}
            <Link href="/" className="underline">
              Back to listings
            </Link>
          </p>
        </Panel>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Link href={targetType === 'listing' ? `/listings/${targetId}` : '/'} className="text-sm underline">
        ← Back
      </Link>
      <PageHeader
        title="Report"
        description={`Reporting ${targetType}: ${targetLabel}. Reports are reviewed by moderators; the reported party is notified only if action is taken.`}
      />
      <ReportForm targetType={targetType} targetId={targetId} />
    </div>
  );
}
