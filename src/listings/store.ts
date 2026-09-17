import { randomUUID } from 'node:crypto';
import type { Listing } from './types.js';

function clone(l: Listing): Listing {
  return { ...l, images: [...l.images] };
}

/** Store port — satisfied by the in-memory store and the MySQL store. */
export interface ListingsStorePort {
  insert(listing: Omit<Listing, 'id' | 'createdAt'>): Promise<Listing>;
  get(id: string): Promise<Listing | undefined>;
  save(listing: Listing): Promise<void>;
  all(): Promise<Listing[]>;
  countActiveByOwner(ownerId: string): Promise<number>;
  countByStatus(): Promise<Record<Listing['status'], number>>;
  exportState(): Promise<{ items: Listing[]; order: string[] }>;
  importState(state: { items: Listing[]; order: string[] }): Promise<void>;
}

export class ListingsStore {
  private items = new Map<string, Listing>();
  private order: string[] = [];

  async insert(listing: Omit<Listing, 'id' | 'createdAt'>): Promise<Listing> {
    const full: Listing = {
      ...listing,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.items.set(full.id, full);
    this.order.push(full.id);
    return full;
  }

  async get(id: string): Promise<Listing | undefined> {
    const item = this.items.get(id);
    return item ? clone(item) : undefined;
  }

  async save(listing: Listing): Promise<void> {
    this.items.set(listing.id, clone(listing));
  }

  async all(): Promise<Listing[]> {
    return this.order.map((id) => this.items.get(id)!).filter(Boolean).map(clone);
  }

  async countActiveByOwner(ownerId: string): Promise<number> {
    return (await this.all()).filter((l) => l.ownerId === ownerId && l.status === 'Active').length;
  }

  /** Listings per lifecycle state for pilot metrics (NFR-O-1). */
  async countByStatus(): Promise<Record<Listing['status'], number>> {
    const counts: Record<Listing['status'], number> = {
      Draft: 0, Active: 0, Paused: 0, Archived: 0, Hidden: 0,
    };
    for (const l of await this.all()) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return counts;
  }

  async exportState(): Promise<{ items: Listing[]; order: string[] }> {
    return { items: await this.all(), order: [...this.order] };
  }

  async importState(state: { items: Listing[]; order: string[] }): Promise<void> {
    if (!state || !Array.isArray(state.items) || !Array.isArray(state.order)) {
      throw new Error('Invalid listings snapshot.');
    }
    this.items.clear();
    this.order = [];
    for (const l of state.items) this.items.set(l.id, clone(l));
    // Rebuild order from surviving ids only, then append any missing —
    // a stale order list must never silently drop listings.
    const known = new Set(state.items.map((l) => l.id));
    this.order = [...state.order.filter((id) => known.has(id))];
    for (const l of state.items) {
      if (!this.order.includes(l.id)) this.order.push(l.id);
    }
  }
}
