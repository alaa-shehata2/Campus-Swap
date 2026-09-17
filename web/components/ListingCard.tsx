import Link from 'next/link';
import { formatCairoTime } from '../../src/common/cairoTime.js';
import type { Listing } from '../../src/listings/types.js';

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <article aria-label={`${listing.side}: ${listing.title}`} className="rounded border border-stone-200 bg-white p-4">
      <div className="flex gap-2 text-xs font-semibold uppercase tracking-wide">
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-900">{listing.side}</span>
        <span className="rounded bg-stone-200 px-2 py-0.5 text-stone-800">{listing.kind}</span>
        <span className="rounded bg-stone-100 px-2 py-0.5 text-stone-700">{listing.category}</span>
      </div>
      <h3 className="mt-2 text-lg font-bold">
        <Link href={`/listings/${listing.id}`} className="underline decoration-emerald-700 underline-offset-2">
          {listing.title}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-stone-600">{listing.description}</p>
      <p className="mt-2 text-sm text-stone-500">
        {listing.zone} · <time>{formatCairoTime(listing.createdAt)}</time>
      </p>
    </article>
  );
}
