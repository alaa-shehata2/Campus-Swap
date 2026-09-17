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

  insert(r: Omit<Review, 'id'>): Review {
    const full: Review = { ...r, id: randomUUID() };
    this.items.set(full.id, full);
    return clone(full);
  }

  get(id: string): Review | undefined {
    const r = this.items.get(id);
    return r ? clone(r) : undefined;
  }

  save(r: Review): void {
    this.items.set(r.id, clone(r));
  }

  forExchange(exchangeId: string): Review[] {
    const out: Review[] = [];
    for (const r of this.items.values()) {
      if (r.exchangeId === exchangeId) out.push(clone(r));
    }
    return out;
  }

  publishedFor(revieweeId: string): Review[] {
    const out: Review[] = [];
    for (const r of this.items.values()) {
      if (r.revieweeId === revieweeId && r.status === 'Published') out.push(clone(r));
    }
    return out;
  }

  exchangeIds(): string[] {
    const ids = new Set<string>();
    for (const r of this.items.values()) ids.add(r.exchangeId);
    return [...ids];
  }
}
