import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { formatCairoTime } from '../../../../src/common/cairoTime.js';
import { services, sweepExchanges } from '../../../lib/services';
import { sessionUserId } from '../../../lib/auth';
import { ProposalActions } from '../../../components/ProposalActions';

export default async function ProposalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewerId = await sessionUserId();
  if (!viewerId) redirect(`/login?returnTo=/proposals/${encodeURIComponent(id)}`);
  const svc = services();
  await sweepExchanges(svc);
  const p = await svc.exchanges.getProposal(viewerId, id);
  if (!p) notFound();
  const isCounterparty = viewerId === p.counterpartyId;
  const otherId = p.proposerId === viewerId ? p.counterpartyId : p.proposerId;
  const other = await svc.identity.getProfile(otherId);
  const sideA = await Promise.all(p.sideAListingIds.map((lid) => svc.listings.get(lid)));
  const sideB = await Promise.all(p.sideBListingIds.map((lid) => svc.listings.get(lid)));
  const list = (label: string, items: typeof sideA) => (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{label}</h3>
      <ul className="mt-1 space-y-1">
        {items.map((l) =>
          l ? (
            <li key={l.id} className="text-sm">
              <Link href={`/listings/${l.id}`} className="underline">
                {l.title}
              </Link>{' '}
              <span className="text-stone-500">
                ({l.side} · {l.kind} · {l.status})
              </span>
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
  return (
    <div className="space-y-6">
      <Link href="/proposals" className="text-sm underline">
        ← Back to proposals
      </Link>
      <article className="rounded border border-stone-200 bg-white p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          <span className="rounded bg-stone-200 px-2 py-0.5 text-stone-800">{p.status}</span>
          <span className="font-normal normal-case tracking-normal text-stone-500">
            {p.proposerId === viewerId ? 'to' : 'from'} {other?.displayName ?? 'A member'} ·{' '}
            <time>{formatCairoTime(new Date(p.createdAtMs).toISOString())}</time>
          </span>
        </div>
        <h1 className="mt-2 text-xl font-bold">Proposal terms</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm">{p.terms}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {list('Your side gives / their side gives', p.proposerId === viewerId ? sideA : sideB)}
          {list('The other side', p.proposerId === viewerId ? sideB : sideA)}
        </div>
        {p.status === 'Accepted' && p.exchangeId && (
          <p className="mt-4">
            <Link
              href={`/exchanges/${p.exchangeId}`}
              className="inline-block rounded bg-emerald-700 px-4 py-2 font-medium text-white"
            >
              Open exchange →
            </Link>
          </p>
        )}
      </article>
      {p.status === 'Proposed' && (
        <ProposalActions proposalId={p.id} isCounterparty={isCounterparty} />
      )}
    </div>
  );
}
