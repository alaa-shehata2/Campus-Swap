import { randomUUID } from 'node:crypto';
import type { Listing } from './types.js';

function clone(l: Listing): Listing {
  return { ...l, images: [...l.images] };
}

export class ListingsStore {
  private items = new Map<string, Listing>();
  private order: string[] = [];

  insert(listing: Omit<Listing, 'id' | 'createdAt'>): Listing {
    const full: Listing = {
      ...listing,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.items.set(full.id, full);
    this.order.push(full.id);
    return full;
  }

  get(id: string): Listing | undefined {
    const item = this.items.get(id);
    return item ? clone(item) : undefined;
  }

  save(listing: Listing): void {
    this.items.set(listing.id, clone(listing));
  }

  all(): Listing[] {
    return this.order.map((id) => this.items.get(id)!).filter(Boolean).map(clone);
  }

  countActiveByOwner(ownerId: string): number {
    return this.all().filter((l) => l.ownerId === ownerId && l.status === 'Active').length;
  }

  /** Listings per lifecycle state for pilot metrics (NFR-O-1). */
  countByStatus(): Record<Listing['status'], number> {
    const counts: Record<Listing['status'], number> = {
      Draft: 0, Active: 0, Paused: 0, Archived: 0, Hidden: 0,
    };
    for (const l of this.all()) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return counts;
  }

  exportState(): { items: Listing[]; order: string[] } {
    return { items: this.all(), order: [...this.order] };
  }

  importState(state: { items: Listing[]; order: string[] }): void {
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
