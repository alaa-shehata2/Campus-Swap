import type { Result } from '../common/errors.js';
import type { Listing } from '../listings/types.js';
import type { UserPublic } from '../identity/types.js';

export type ProposalStatus = 'Proposed' | 'Accepted' | 'Declined' | 'Expired' | 'Withdrawn';

export interface ProposeInput {
  sideAListingIds: string[];
  sideBListingIds: string[];
  terms: string;
}

export interface Proposal {
  id: string;
  proposerId: string;
  counterpartyId: string;
  sideAListingIds: string[];
  sideBListingIds: string[];
  terms: string;
  status: ProposalStatus;
  createdAtMs: number;
  decidedAtMs?: number;
  exchangeId?: string;
}

export type ExchangeStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'Disputed';

export type CancelReason = 'no-show' | 'conflict' | 'item-unavailable' | 'safety-concern' | 'other';

export interface Exchange {
  id: string;
  proposalId: string;
  participantA: string;
  participantB: string;
  listingIds: string[];
  /** Frozen copy of proposal terms at accept time (FR-E-3). */
  terms: string;
  status: ExchangeStatus;
  schedule?: { at: string; place: string };
  doneMarkedBy?: string;
  doneMarkedAtMs?: number;
  cancelReason?: CancelReason;
  cancelDetail?: string;
  log: string[];
  createdAtMs: number;
}

export interface Message {
  id: string;
  exchangeId: string;
  senderId: string;
  text: string;
  createdAtMs: number;
}

/** Minimal seams the exchanges module consumes (owned by listings/identity). */
export interface ListingsPort {
  get(id: string): Listing | undefined;
  systemPause(id: string): Result<Listing>;
}

export interface IdentityPort {
  getProfile(id: string): UserPublic | undefined;
  isBlockedOrMuted(a: string, b: string): boolean;
}

export interface LockStatus {
  openCount: number;
  /** Derived (not stored): true when the listing holds 5 open proposals. */
  locked: boolean;
}
