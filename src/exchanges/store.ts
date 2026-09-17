import { randomUUID } from 'node:crypto';
import type { Exchange, ExchangeStatus, Message, Proposal, ProposalStatus } from './types.js';

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

  async insertProposal(p: Omit<Proposal, 'id'>): Promise<Proposal> {
    const full: Proposal = { ...p, id: randomUUID() };
    this.proposals.set(full.id, full);
    return cloneProposal(full);
  }

  async getProposal(id: string): Promise<Proposal | undefined> {
    const p = this.proposals.get(id);
    return p ? cloneProposal(p) : undefined;
  }

  async saveProposal(p: Proposal): Promise<void> {
    this.proposals.set(p.id, cloneProposal(p));
  }

  async openProposalsForListing(listingId: string): Promise<Proposal[]> {
    const out: Proposal[] = [];
    for (const p of this.proposals.values()) {
      if (p.status !== 'Proposed') continue;
      if (p.sideAListingIds.includes(listingId) || p.sideBListingIds.includes(listingId)) {
        out.push(cloneProposal(p));
      }
    }
    return out;
  }

  async proposedOlderThan(nowMs: number, windowMs: number): Promise<Proposal[]> {    const out: Proposal[] = [];
    for (const p of this.proposals.values()) {
      if (p.status === 'Proposed' && nowMs - p.createdAtMs > windowMs) out.push(cloneProposal(p));
    }
    return out;
  }

  async doneMarkedOlderThan(nowMs: number, windowMs: number): Promise<Exchange[]> {
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

  async insertExchange(e: Omit<Exchange, 'id'>): Promise<Exchange> {
    const full: Exchange = { ...e, id: randomUUID() };
    this.exchanges.set(full.id, full);
    return cloneExchange(full);
  }

  async getExchange(id: string): Promise<Exchange | undefined> {
    const e = this.exchanges.get(id);
    return e ? cloneExchange(e) : undefined;
  }

  async saveExchange(e: Exchange): Promise<void> {
    this.exchanges.set(e.id, cloneExchange(e));
  }

  async hold(listingId: string, exchangeId: string): Promise<void> {
    this.holds.set(listingId, exchangeId);
  }

  async heldBy(listingId: string): Promise<string | undefined> {
    return this.holds.get(listingId);
  }

  async release(listingId: string): Promise<void> {
    this.holds.delete(listingId);
  }

  async insertMessage(m: Omit<Message, 'id'>): Promise<Message> {
    const full: Message = { ...m, id: randomUUID() };
    const list = this.messages.get(full.exchangeId) ?? [];
    list.push(full);
    this.messages.set(full.exchangeId, list);
    return { ...full };
  }

  async messagesFor(exchangeId: string): Promise<Message[]> {
    return (this.messages.get(exchangeId) ?? []).map((m) => ({ ...m }));
  }

  async exportState(): Promise<{
    proposals: Proposal[];
    exchanges: Exchange[];
    messages: Record<string, Message[]>;
    holds: Array<[string, string]>;
  }> {
    const messages: Record<string, Message[]> = {};
    for (const [id, list] of this.messages) messages[id] = list.map((m) => ({ ...m }));
    return {
      proposals: [...this.proposals.values()].map(cloneProposal),
      exchanges: [...this.exchanges.values()].map(cloneExchange),
      messages,
      holds: [...this.holds.entries()],
    };
  }

  async importState(state: {
    proposals: Proposal[];
    exchanges: Exchange[];
    messages: Record<string, Message[]>;
    holds: Array<[string, string]>;
  }): Promise<void> {
    if (!state || !Array.isArray(state.proposals) || !Array.isArray(state.exchanges)) {
      throw new Error('Invalid exchanges snapshot.');
    }
    this.proposals.clear();
    this.exchanges.clear();
    this.messages.clear();
    this.holds.clear();
    for (const p of state.proposals) this.proposals.set(p.id, cloneProposal(p));
    for (const e of state.exchanges) this.exchanges.set(e.id, cloneExchange(e));
    for (const [id, list] of Object.entries(state.messages ?? {})) {
      this.messages.set(id, list.map((m) => ({ ...m })));
    }
    for (const [k, v] of state.holds ?? []) this.holds.set(k, v);
  }

  /** Exchange/proposal counts per state for pilot metrics (NFR-O-1). */
  async exchangeStats(): Promise<Record<ExchangeStatus, number>> {
    const counts: Record<ExchangeStatus, number> = {
      Scheduled: 0, Completed: 0, Cancelled: 0, Disputed: 0,
    };
    for (const e of this.exchanges.values()) counts[e.status] = (counts[e.status] ?? 0) + 1;
    return counts;
  }

  async proposalStats(): Promise<Record<ProposalStatus, number>> {
    const counts: Record<ProposalStatus, number> = {
      Proposed: 0, Accepted: 0, Declined: 0, Expired: 0, Withdrawn: 0,
    };
    for (const p of this.proposals.values()) counts[p.status] = (counts[p.status] ?? 0) + 1;
    return counts;
  }
}
