import type { Category } from '../policy/taxonomy.js';

export type ListingSide = 'offer' | 'request';
export type ListingKind = 'skill' | 'item';
export type ListingStatus = 'Draft' | 'Active' | 'Paused' | 'Archived';
export type ItemModality = 'lend' | 'give' | 'swap';

export interface PublishInput {
  side: ListingSide;
  kind: ListingKind;
  title: string;
  description: string;
  category: string;
  zone: string;
  images: string[];
  status?: ListingStatus;
  /** Required for kind=item. */
  modality?: ItemModality;
  /** Required when modality=lend (lender-defined return term, FR-L-5). */
  returnTerm?: string;
  /** Required when modality=swap (FR-L-5). */
  counterpartDescription?: string;
}

export interface Listing {
  id: string;
  ownerId: string;
  side: ListingSide;
  kind: ListingKind;
  title: string;
  description: string;
  category: Category;
  zone: string;
  images: string[];
  status: ListingStatus;
  modality?: ItemModality;
  returnTerm?: string;
  counterpartDescription?: string;
  createdAt: string;
}

export type ListingTransition = 'activate' | 'pause' | 'archive' | 'reopen';
