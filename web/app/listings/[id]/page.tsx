import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDetail } from '../../../../src/listings/search.js';
import { formatCairoTime } from '../../../../src/common/cairoTime.js';
import { services, sweepExchanges } from '../../../lib/services.js';
import { sessionUserId } from '../../../lib/auth.js';
import { ListingCard } from '../../../components/ListingCard';

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svc = services();
  await sweepExchanges(svc);
  const { listings } = svc;
  const viewerId = await sessionUserId();
  const detail = await getDetail(
    listings.store,
    id,
    viewerId ? { userId: viewerId } : { anonymous: true },
  );
  if (!detail) notFound();
  const l = detail.listing;
  const isOwner = viewerId !== undefined && viewerId === l.ownerId;
  const lock = await svc.exchanges.lockStatus(l.id);
  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm underline">
        ← Back to listings
      </Link>
      <article className="rounded border border-stone-200 bg-white p-6">
        <div className="flex gap-2 text-xs font-semibold uppercase tracking-wide">
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900">{l.side}</span>
          <span className="rounded bg-stone-200 px-2 py-0.5 text-stone-800">{l.kind}</span>
          <span className="rounded bg-stone-100 px-2 py-0.5 text-stone-700">{l.category}</span>
          <span className="rounded bg-stone-100 px-2 py-0.5 text-stone-700">Status: {l.status}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold">{l.title}</h1>
        <p className="mt-3 whitespace-pre-wrap">{l.description}</p>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium">Meetup area:</dt>
            <dd>{l.zone}</dd>
          </div>
          {l.availability && (
            <div className="flex gap-2">
              <dt className="font-medium">Availability:</dt>
              <dd>{l.availability}</dd>
            </div>
          )}
          {l.modality && (
            <div className="flex gap-2">
              <dt className="font-medium">Terms:</dt>
              <dd>
                {l.modality}
                {l.modality === 'lend' && l.returnTerm ? ` — ${l.returnTerm}` : ''}
                {l.modality === 'swap' && l.counterpartDescription
                  ? ` — looking for: ${l.counterpartDescription}`
                  : ''}
              </dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="font-medium">Published:</dt>
            <dd>
              <time>{formatCairoTime(l.createdAt)}</time>
            </dd>
          </div>
        </dl>
        <div className="mt-6 space-y-3">
          {lock.locked && (
            <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-stone-800">
              Not accepting new proposals — {lock.openCount} pending.
            </p>
          )}
          {detail.loginCTA ? (
            <Link
              href={`/login?returnTo=/listings/${l.id}`}
              className="inline-block rounded bg-emerald-700 px-4 py-2 font-medium text-white"
            >
              Log in to propose
            </Link>
          ) : isOwner ? (
            <p className="rounded border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
              Your listing · {lock.openCount} open proposal{lock.openCount === 1 ? '' : 's'} ·{' '}
              <Link href="/proposals" className="underline">
                View proposals
              </Link>
            </p>
          ) : (
            <Link
              href={`/proposals/new?listing=${l.id}`}
              className="inline-block rounded bg-emerald-700 px-4 py-2 font-medium text-white"
            >
              Propose an exchange
            </Link>
          )}
          {!isOwner && (
            <p className="text-sm">
              <Link
                href={
                  detail.loginCTA
                    ? `/login?returnTo=/reports/new?targetType=listing&targetId=${l.id}`
                    : `/reports/new?targetType=listing&targetId=${l.id}`
                }
                className="underline"
              >
                Report this listing
              </Link>
            </p>
          )}
        </div>
      </article>
      {detail.compatible.length > 0 && (
        <section aria-label="Compatible listings">
          <h2 className="mb-3 text-lg font-bold">Compatible listings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {detail.compatible.map((c) => (
              <ListingCard key={c.id} listing={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
