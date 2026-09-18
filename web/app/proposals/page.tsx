import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatCairoTime } from '../../../src/common/cairoTime.js';
import { services, sweepExchanges } from '../../lib/services';
import { sessionUserId } from '../../lib/auth';

export default async function ProposalsInbox() {
  const viewerId = await sessionUserId();
  if (!viewerId) redirect('/login?returnTo=/proposals');
  const svc = services();
  await sweepExchanges(svc);
  const { proposals } = await svc.exchanges.store.exportState();
  const mine = proposals
    .filter((p) => p.proposerId === viewerId || p.counterpartyId === viewerId)
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
  const names = new Map<string, string>();
  for (const p of mine) {
    const other = p.proposerId === viewerId ? p.counterpartyId : p.proposerId;
    if (!names.has(other)) {
      names.set(other, (await svc.identity.getProfile(other))?.displayName ?? 'A member');
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Proposals</h1>
      {mine.length === 0 ? (
        <p className="rounded border border-stone-200 bg-white p-6 text-stone-600">
          No proposals yet. Browse{' '}
          <Link href="/" className="underline">
            listings
          </Link>{' '}
          and propose an exchange.
        </p>
      ) : (
        <ul className="space-y-3">
          {mine.map((p) => (
            <li key={p.id} className="rounded border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <span className="rounded bg-stone-200 px-2 py-0.5 text-stone-800">{p.status}</span>
                <span className="font-normal normal-case tracking-normal text-stone-500">
                  {p.proposerId === viewerId ? 'to' : 'from'} {names.get(p.proposerId === viewerId ? p.counterpartyId : p.proposerId)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-stone-700">{p.terms}</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <time className="text-stone-500">{formatCairoTime(new Date(p.createdAtMs).toISOString())}</time>
                <Link href={`/proposals/${p.id}`} className="font-medium text-emerald-800 underline">
                  {p.status === 'Accepted' && p.exchangeId ? 'View exchange →' : 'View proposal →'}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
