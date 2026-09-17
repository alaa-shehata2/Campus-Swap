import type { Exchange } from '../exchanges/types.js';

export type ReviewStatus = 'Hidden' | 'Published' | 'Voided';

export interface SubmitReviewInput {
  score: number;
  text?: string;
}

export interface Review {
  id: string;
  exchangeId: string;
  reviewerId: string;
  revieweeId: string;
  score: number;
  text?: string;
  status: ReviewStatus;
  submittedAtMs: number;
  editedAtMs?: number;
  publishedAtMs?: number;
  response?: { text: string; submittedAtMs: number; editedAtMs?: number };
  void?: { by: string; reason: string; atMs: number };
}

export interface Aggregate {
  average: number;
  count: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  history: Review[];
}

/** Minimal seam the reputation module consumes (owned by exchanges). */
export interface ExchangesPort {
  readExchange(id: string): Promise<Exchange | undefined>;
}
