import { RELATED } from '../policy/taxonomy.js';
import type { ListingsStore } from './store.js';
import type { Listing } from './types.js';

export interface SearchQuery {
  text?: string;
  side?: 'offer' | 'request';
  kind?: 'skill' | 'item';
  category?: string;
  zone?: string;
}

export type Viewer = { userId: string } | { anonymous: true };

export interface OwnerRating {
  average: number;
  count: number;
}

export interface DetailResult {
  listing: Listing;
  /** Phase 1: caller may attach an owner reputation summary; undefined until reputation module (Phase 3). */
  ownerRating?: OwnerRating;
  /** Visitors see a login CTA instead of action buttons (FR-D-2, SC-2). */
  loginCTA: boolean;
  compatible: Listing[];
}

function isAnon(viewer: Viewer): viewer is { anonymous: true } {
  return 'anonymous' in viewer;
}

/**
 * Public browse/search (FR-D-1..3). Only Active listings are discoverable.
 * Filters are additive; ranking is recency + category match only (no recommender).
 */
export function searchListings(
  store: ListingsStore,
  query: SearchQuery,
  _viewer: Viewer,
): { items: Listing[]; total: number } {
  const text = query.text?.trim().toLowerCase();
  const zone = query.zone?.trim().toLowerCase();

  const items = store
    .all()
    .filter((l) => l.status === 'Active')
    .filter((l) => (!query.side ? true : l.side === query.side))
    .filter((l) => (!query.kind ? true : l.kind === query.kind))
    .filter((l) => (!query.category ? true : l.category === query.category))
    .filter((l) => (!zone ? true : l.zone.toLowerCase().includes(zone)))
    .filter((l) =>
      !text
        ? true
        : `${l.title} ${l.description}`.toLowerCase().includes(text),
    )
    .sort((a, b) => {
      let score = 0;
      if (query.category) {
        if (a.category === query.category) score += 1;
        if (b.category === query.category) score -= 1;
      }
      if (score !== 0) return -score;
      return b.createdAt.localeCompare(a.createdAt);
    });

  return { items, total: items.length };
}

/** Detail view (FR-D-2): full terms + compatible hints + login CTA for visitors. */
export function getDetail(
  store: ListingsStore,
  id: string,
  viewer: Viewer,
  ownerRating?: OwnerRating,
): DetailResult | undefined {
  const listing = store.get(id);
  if (!listing) return undefined;
  // Only Active listings are publicly discoverable; owners may preview their own.
  if (listing.status !== 'Active' && (isAnon(viewer) || viewer.userId !== listing.ownerId)) {
    return undefined;
  }

  const related = new Set<string>([listing.category, ...(RELATED[listing.category] ?? [])]);
  const compatible = store
    .all()
    .filter(
      (l) =>
        l.id !== listing.id &&
        l.status === 'Active' &&
        l.side !== listing.side &&
        related.has(l.category),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return { listing, ownerRating, loginCTA: isAnon(viewer), compatible };
}
