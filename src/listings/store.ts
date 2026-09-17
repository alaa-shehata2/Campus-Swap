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
}
