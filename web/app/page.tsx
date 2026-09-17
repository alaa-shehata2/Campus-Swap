import { Suspense } from 'react';
import Link from 'next/link';
import { searchListings } from '../../src/listings/search.js';
import { services } from '../lib/services.js';
import { sessionUser } from '../lib/auth.js';
import { SearchForm } from '../components/SearchForm';
import { ListingCard } from '../components/ListingCard';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const { listings } = services();
  const res = await searchListings(
    listings.store,
    {
      text: one(q['text']),
      side: one(q['side']) as 'offer' | 'request' | undefined,
      kind: one(q['kind']) as 'skill' | 'item' | undefined,
      category: one(q['category']),
      zone: one(q['zone']),
    },
    { anonymous: true },
  );
  const user = await sessionUser();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">KFS listings</h1>
        {!user && (
          <Link
            href="/login?returnTo=/publish"
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
          >
            Log in to publish
          </Link>
        )}
      </div>
      <Suspense>
        <SearchForm />
      </Suspense>
      {res.total === 0 ? (
        <p className="rounded border border-stone-200 bg-white p-6 text-stone-600">
          No listings match. Try widening the search — or be the first to publish the complementary
          listing.
        </p>
      ) : (
        <>
          <p aria-live="polite" className="text-sm text-stone-600">
            {res.total} active listing{res.total === 1 ? '' : 's'}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {res.items.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
