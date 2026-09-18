import { redirect } from 'next/navigation';
import { formatCairoTime } from '../../../src/common/cairoTime.js';
import { services, sweepReveals } from '../../lib/services';
import { sessionUserId } from '../../lib/auth';
import { ProfileForm } from '../../components/ProfileForm';
import { Panel } from '../../components/ui/Panel';
import { Badge } from '../../components/ui/Badge';

export default async function MePage() {
  const userId = await sessionUserId();
  if (!userId) redirect('/login?returnTo=/me');
  const svc = services();
  await sweepReveals(svc);
  const { identity, listings } = svc;
  const user = await identity.getProfile(userId);
  if (!user) redirect('/login?returnTo=/me');
  const activeCount = await listings.store.countActiveByOwner(userId);
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{user.displayName}</h1>
        <p className="mt-1 text-sm text-stone-600">
          {user.campus} <span className="italic">self-declared (not verified)</span> · joined{' '}
          <time>{formatCairoTime(user.joinDate)}</time>
        </p>
        {user.restriction !== 'none' && (
          <p role="status" className="mt-2 inline-block rounded bg-red-100 px-2 py-0.5 text-sm font-medium text-red-800">
            Account status: {user.restriction}
          </p>
        )}
        <p className="mt-1 text-sm text-stone-600">{activeCount} active listings (max 20)</p>
      </div>
      <ProfileForm user={user} />
      <ReputationPanel userId={userId} />
    </div>
  );
}

async function ReputationPanel({ userId }: { userId: string }) {
  const { reputation, identity } = services();
  const agg = await reputation.aggregate(userId);
  return (
    <Panel tone="bordered">
      <h2 className="mb-3 text-lg font-bold">Reputation</h2>
      {agg.count === 0 ? (
        <p className="text-sm text-text-muted">
          No published reviews yet. Reviews appear here after completed exchanges.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-medium">{agg.average.toFixed(1)} / 5</span> from {agg.count}{' '}
            review{agg.count === 1 ? '' : 's'} · distribution{' '}
            {([5, 4, 3, 2, 1] as const).map((s) => `${s}★×${agg.distribution[s]}`).join(' ')}
          </p>
          <ul className="space-y-2">
            {agg.history.map((r) => (
              <ReviewRow key={r.id} review={r} identity={identity} />
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

async function ReviewRow({
  review,
  identity,
}: {
  review: {
    reviewerId: string;
    score: number;
    text?: string;
    submittedAtMs: number;
    response?: { text: string };
  };
  identity: ReturnType<typeof services>['identity'];
}) {
  const reviewer = await identity.getProfile(review.reviewerId);
  return (
    <li className="rounded-md bg-surface-sunken p-3 text-sm">
      <p className="flex items-center gap-2">
        <Badge tone="info">{review.score} / 5</Badge>
        <span className="text-text-muted">
          from {reviewer?.displayName ?? 'A member'} ·{' '}
          <time>{formatCairoTime(new Date(review.submittedAtMs).toISOString())}</time>
        </span>
      </p>
      {review.text && <p className="mt-1 whitespace-pre-wrap">{review.text}</p>}
      {review.response && (
        <p className="mt-1 text-text-muted">
          <span className="font-medium">Your response:</span> {review.response.text}
        </p>
      )}
    </li>
  );
}
