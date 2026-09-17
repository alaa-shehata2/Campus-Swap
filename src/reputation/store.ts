import { randomUUID } from 'node:crypto';
import type { Review } from './types.js';

function clone(r: Review): Review {
  return {
    ...r,
    response: r.response ? { ...r.response } : undefined,
    void: r.void ? { ...r.void } : undefined,
  };
}

/** In-memory reputation store. Repository seam: swap for MySQL (ADR-0002) without touching the service. */
export class ReputationStore {
  private items = new Map<string, Review>();

  async insert(r: Omit<Review, 'id'>): Promise<Review> {
    const full: Review = { ...r, id: randomUUID() };
    this.items.set(full.id, full);
    return clone(full);
  }

  async get(id: string): Promise<Review | undefined> {
    const r = this.items.get(id);
    return r ? clone(r) : undefined;
  }

  async save(r: Review): Promise<void> {
    this.items.set(r.id, clone(r));
  }

  async forExchange(exchangeId: string): Promise<Review[]> {
    const out: Review[] = [];
    for (const r of this.items.values()) {
      if (r.exchangeId === exchangeId) out.push(clone(r));
    }
    return out;
  }

  async publishedFor(revieweeId: string): Promise<Review[]> {
    const out: Review[] = [];
    for (const r of this.items.values()) {
      if (r.revieweeId === revieweeId && r.status === 'Published') out.push(clone(r));
    }
    return out;
  }

  /** Review counts for pilot metrics (NFR-O-1). */
  async counts(): Promise<{ total: number; published: number }> {
    let total = 0;
    let published = 0;
    for (const r of this.items.values()) {
      total += 1;
      if (r.status === 'Published') published += 1;
    }
    return { total, published };
  }

  async exchangeIds(): Promise<string[]> {
    const ids = new Set<string>();
    for (const r of this.items.values()) ids.add(r.exchangeId);
    return [...ids];
  }

  exportState(): Review[] {
    return [...this.items.values()].map(clone);
  }

  importState(reviews: Review[]): void {
    if (!Array.isArray(reviews)) throw new Error('Invalid reputation snapshot.');
    this.items.clear();
    for (const r of reviews) this.items.set(r.id, clone(r));
  }
}
