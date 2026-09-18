import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { formatCairoTime } from '../../../../../src/common/cairoTime.js';
import { services, sweepExchanges, sweepReveals } from '../../../../lib/services';
import { sessionUserId } from '../../../../lib/auth';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { Panel } from '../../../../components/ui/Panel';
import { Badge } from '../../../../components/ui/Badge';
import { SubmitReviewForm, EditReviewForm, RespondReviewForm } from '../../../../components/ReviewForm';

export default async function ExchangeReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewerId = await sessionUserId();
  if (!viewerId) redirect(`/login?returnTo=/exchanges/${encodeURIComponent(id)}/review`);
  const svc = services();
  await sweepExchanges(svc);
  await sweepReveals(svc);
  const e = await svc.exchanges.getExchange(viewerId, id);
  if (!e) notFound();
  if (e.status !== 'Completed') {
    return (
      <div className="space-y-4">
        <Link href={`/exchanges/${e.id}`} className="text-sm underline">
          ← Back to exchange
        </Link>
        <PageHeader title="Reviews" description="Reviews open after the exchange completes." />
        <Panel tone="bordered">
          <p className="text-sm text-text-muted">
            This exchange is {e.status}. Each participant may leave one review once it completes.
          </p>
        </Panel>
      </div>
    );
  }
  const otherId = e.participantA === viewerId ? e.participantB : e.participantA;
  const other = await svc.identity.getProfile(otherId);
  // forExchange is unfiltered; each review is re-gated through getReview so
  // blind (Hidden) counterpart reviews never reach the render.
  const candidates = await svc.reputation.store.forExchange(e.id);
  const mineId = candidates.find((r) => r.reviewerId === viewerId)?.id;
  const theirsId = candidates.find((r) => r.reviewerId === otherId)?.id;
  const mine = mineId ? await svc.reputation.getReview(viewerId, mineId) : undefined;
  const theirs = theirsId ? await svc.reputation.getReview(viewerId, theirsId) : undefined;
  return (
    <div className="space-y-6">
      <Link href={`/exchanges/${e.id}`} className="text-sm underline">
        ← Back to exchange
      </Link>
      <PageHeader
        title="Reviews"
        description={`Blind bilateral reviews with ${other?.displayName ?? 'the other participant'}. Reviews stay hidden until both sides submit or 14 days pass.`}
      />
      <Panel tone="bordered">
        <h2 className="mb-3 text-lg font-bold">Your review</h2>
        {!mine ? (
          <SubmitReviewForm exchangeId={e.id} />
        ) : (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm">
              <Badge tone="info">{mine.status}</Badge>
              <span className="font-medium">{mine.score} / 5</span>
              {mine.submittedAtMs && (
                <time className="text-text-muted">
                  {formatCairoTime(new Date(mine.submittedAtMs).toISOString())}
                </time>
              )}
            </p>
            {mine.text && <p className="whitespace-pre-wrap text-sm">{mine.text}</p>}
            {mine.status !== 'Voided' && (
              <details>
                <summary className="cursor-pointer text-sm underline">Edit (48-hour window)</summary>
                <div className="mt-3">
                  <EditReviewForm
                    exchangeId={e.id}
                    reviewId={mine.id}
                    defaultScore={mine.score}
                    defaultText={mine.text}
                  />
                </div>
              </details>
            )}
          </div>
        )}
      </Panel>
      <Panel tone="bordered">
        <h2 className="mb-3 text-lg font-bold">Their review</h2>
        {!theirs ? (
          <p className="text-sm text-text-muted">
            {other?.displayName ?? 'The other participant'} has not submitted a visible review yet.
            Reviews publish when both sides submit or after 14 days.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm">
              <Badge tone="info">{theirs.status}</Badge>
              <span className="font-medium">{theirs.score} / 5</span>
            </p>
            {theirs.text && <p className="whitespace-pre-wrap text-sm">{theirs.text}</p>}
            {theirs.response ? (
              <div className="rounded-md bg-surface-sunken p-3 text-sm">
                <p className="font-medium">Your response</p>
                <p className="mt-1 whitespace-pre-wrap">{theirs.response.text}</p>
              </div>
            ) : theirs.status === 'Published' ? (
              <RespondReviewForm exchangeId={e.id} reviewId={theirs.id} />
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
