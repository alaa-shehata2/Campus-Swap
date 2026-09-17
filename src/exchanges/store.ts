import { randomUUID } from 'node:crypto';
import type { Exchange, Message, Proposal } from './types.js';

function cloneProposal(p: Proposal): Proposal {
  return { ...p, sideAListingIds: [...p.sideAListingIds], sideBListingIds: [...p.sideBListingIds] };
}

function cloneExchange(e: Exchange): Exchange {
  return {
    ...e,
    listingIds: [...e.listingIds],
    schedule: e.schedule ? { ...e.schedule } : undefined,
    log: [...e.log],
  };
}

/** In-memory exchanges store. Repository seam: swap for MySQL (ADR-0002) without touching the service. */
export class ExchangesStore {
  private proposals = new Map<string, Proposal>();
  private exchanges = new Map<string, Exchange>();
  private messages = new Map<string, Message[]>();
  /** listingId → exchangeId holding it via auto-pause. Lazy: counts only while listing still Paused. */
  private holds = new Map<string, string>();

  insertProposal(p: Omit<Proposal, 'id'>): Proposal {
    const full: Proposal = { ...p, id: randomUUID() };
    this.proposals.set(full.id, full);
    return cloneProposal(full);
  }

  getProposal(id: string): Proposal | undefined {
    const p = this.proposals.get(id);
    return p ? cloneProposal(p) : undefined;
  }

  saveProposal(p: Proposal): void {
    this.proposals.set(p.id, cloneProposal(p));
  }

  openProposalsForListing(listingId: string): Proposal[] {
    const out: Proposal[] = [];
    for (const p of this.proposals.values()) {
      if (p.status !== 'Proposed') continue;
      if (p.sideAListingIds.includes(listingId) || p.sideBListingIds.includes(listingId)) {
        out.push(cloneProposal(p));
      }
    }
    return out;
  }

  proposedOlderThan(nowMs: number, windowMs: number): Proposal[] {
    const out: Proposal[] = [];
    for (const p of this.proposals.values()) {
      if (p.status === 'Proposed' && nowMs - p.createdAtMs > windowMs) out.push(cloneProposal(p));
    }
    return out;
  }

  doneMarkedOlderThan(nowMs: number, windowMs: number): Exchange[] {
    const out: Exchange[] = [];
    for (const e of this.exchanges.values()) {
      if (
        e.status === 'Scheduled' &&
        e.doneMarkedBy !== undefined &&
        e.doneMarkedAtMs !== undefined &&
        nowMs - e.doneMarkedAtMs > windowMs
      ) {
        out.push(cloneExchange(e));
      }
    }
    return out;
  }

  insertExchange(e: Omit<Exchange, 'id'>): Exchange {
    const full: Exchange = { ...e, id: randomUUID() };
    this.exchanges.set(full.id, full);
    return cloneExchange(full);
  }

  getExchange(id: string): Exchange | undefined {
    const e = this.exchanges.get(id);
    return e ? cloneExchange(e) : undefined;
  }

  saveExchange(e: Exchange): void {
    this.exchanges.set(e.id, cloneExchange(e));
  }

  hold(listingId: string, exchangeId: string): void {
    this.holds.set(listingId, exchangeId);
  }

  heldBy(listingId: string): string | undefined {
    return this.holds.get(listingId);
  }

  release(listingId: string): void {
    this.holds.delete(listingId);
  }

  insertMessage(m: Omit<Message, 'id'>): Message {
    const full: Message = { ...m, id: randomUUID() };
    const list = this.messages.get(full.exchangeId) ?? [];
    list.push(full);
    this.messages.set(full.exchangeId, list);
    return { ...full };
  }

  messagesFor(exchangeId: string): Message[] {
    return (this.messages.get(exchangeId) ?? []).map((m) => ({ ...m }));
  }
}
