import { fail, ok, type Result } from '../common/errors.js';
import { formatCairoTime } from '../common/cairoTime.js';
import { ExchangesStore } from './store.js';
import type {
  CancelReason,
  Exchange,
  IdentityPort,
  ListingsPort,
  LockStatus,
  Message,
  Proposal,
  ProposeInput,
} from './types.js';

export const MAX_OPEN_PROPOSALS = 5;
export const PROPOSAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const COMPLETION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_MESSAGE_LENGTH = 2000;

export interface ExchangesDeps {
  listings: ListingsPort;
  identity: IdentityPort;
}

export function createExchangesService(
  deps: ExchangesDeps,
  opts: { now?: () => number; store?: ExchangesStore } = {},
) {
  const store = opts.store ?? new ExchangesStore();
  const now = opts.now ?? Date.now;

  function isParticipant(p: Proposal, userId: string): boolean {
    return p.proposerId === userId || p.counterpartyId === userId;
  }

  /** Max open (Proposed) proposals per listing — the ProposalCap (D7 rev.1). */
  function openCount(listingId: string): number {
    return store.openProposalsForListing(listingId).length;
  }

  function lockStatus(listingId: string): LockStatus {
    const count = openCount(listingId);
    return { openCount: count, locked: count >= MAX_OPEN_PROPOSALS };
  }

  function propose(proposerId: string, input: ProposeInput): Result<Proposal> {
    const sideA = [...new Set(input.sideAListingIds)];
    const sideB = [...new Set(input.sideBListingIds)];

    // Reciprocity: every exchange defines give-and-take on both sides (BR-2, FR-E-1).
    if (sideA.length === 0 || sideB.length === 0) {
      return fail([
        {
          code: 'one-sided',
          message: 'A proposal must reference at least one listing from each side.',
        },
      ]);
    }
    if (!input.terms?.trim()) {
      return fail([{ code: 'required', field: 'terms', message: 'Free-text terms are required.' }]);
    }
    if (!deps.identity.getProfile(proposerId)) {
      return fail([{ code: 'not-found', message: 'Proposer not found.' }]);
    }

    for (const id of sideA) {
      const l = deps.listings.get(id);
      if (!l) return fail([{ code: 'not-found', message: `Listing not found: ${id}.` }]);
      if (l.status !== 'Active') {
        return fail([
          { code: 'listing-not-active', message: `Listing is not Active: ${l.title}.` },
        ]);
      }
      if (l.ownerId !== proposerId) {
        return fail([
          { code: 'ownership', message: 'Your side must only reference your own listings.' },
        ]);
      }
    }

    let counterparty: string | undefined;
    for (const id of sideB) {
      const l = deps.listings.get(id);
      if (!l) return fail([{ code: 'not-found', message: `Listing not found: ${id}.` }]);
      if (l.status !== 'Active') {
        return fail([
          { code: 'listing-not-active', message: `Listing is not Active: ${l.title}.` },
        ]);
      }
      if (l.ownerId === proposerId) {
        return fail([
          { code: 'ownership', message: 'The other side must belong to someone else.' },
        ]);
      }
      if (counterparty === undefined) counterparty = l.ownerId;
      else if (counterparty !== l.ownerId) {
        return fail([
          {
            code: 'ownership',
            message: 'The other side must reference listings of a single counterparty.',
          },
        ]);
      }
    }
    const counterpartyId = counterparty!;

    if (deps.identity.isBlockedOrMuted(proposerId, counterpartyId)) {
      return fail([
        { code: 'blocked', message: 'You cannot propose to this user (block/mute in effect).' },
      ]);
    }

    for (const id of [...sideA, ...sideB]) {
      if (openCount(id) >= MAX_OPEN_PROPOSALS) {
        return fail([
          {
            code: 'proposal-cap-reached',
            message:
              'This listing already has 5 open proposals and is not accepting new ones ' +
              '(proposal-cap-reached). Try another listing or check back later.',
          },
        ]);
      }
    }

    return ok(
      store.insertProposal({
        proposerId,
        counterpartyId,
        sideAListingIds: sideA,
        sideBListingIds: sideB,
        terms: input.terms.trim(),
        status: 'Proposed',
        createdAtMs: now(),
      }),
    );
  }

  /** Participant-gated proposal read: negotiation terms stay between the two sides. */
  function getProposal(viewerId: string, id: string): Proposal | undefined {
    const p = store.getProposal(id);
    if (!p || !isParticipant(p, viewerId)) return undefined;
    return p;
  }

  /** Counterparty responds. Decline ends the proposal; accept creates the exchange (auto-pause + holds). */
  function respond(
    userId: string,
    id: string,
    decision: 'accept' | 'decline',
  ): Result<Proposal | { proposal: Proposal; exchange: Exchange }> {
    const p = store.getProposal(id);
    if (!p) return fail([{ code: 'not-found', message: 'Proposal not found.' }]);
    if (p.status !== 'Proposed') {
      return fail([
        { code: 'invalid-transition', message: `Proposal is already ${p.status}.` },
      ]);
    }
    if (userId !== p.counterpartyId) {
      return fail([
        { code: 'not-permitted', message: 'Only the counterparty can respond to this proposal.' },
      ]);
    }
    if (decision === 'decline') {
      p.status = 'Declined';
      p.decidedAtMs = now();
      store.saveProposal(p);
      return ok(p);
    }
    return accept(p);
  }

  /**
   * Accept: first acceptance auto-pauses referenced listings (D7 rev.1) and
   * freezes terms. Remaining pendings go read-only until reopen/decline.
   */
  function accept(p: Proposal): Result<{ proposal: Proposal; exchange: Exchange }> {
    const listingIds = [...p.sideAListingIds, ...p.sideBListingIds];
    for (const lid of listingIds) {
      if (isHeld(lid)) {
        return fail([
          {
            code: 'listing-paused',
            message:
              'This listing was auto-paused by an accepted exchange and is not accepting ' +
              'new commitments until the owner reopens it.',
          },
        ]);
      }
      const l = deps.listings.get(lid);
      if (!l || l.status !== 'Active') {
        return fail([
          { code: 'listing-not-active', message: 'All referenced listings must be Active to accept.' },
        ]);
      }
    }

    const exchange = store.insertExchange({
      proposalId: p.id,
      participantA: p.proposerId,
      participantB: p.counterpartyId,
      listingIds,
      terms: p.terms,
      status: 'Scheduled',
      log: [`accepted at ${new Date(now()).toISOString()}`],
      createdAtMs: now(),
    });
    for (const lid of listingIds) {
      deps.listings.systemPause(lid);
      store.hold(lid, exchange.id);
    }
    p.status = 'Accepted';
    p.decidedAtMs = now();
    p.exchangeId = exchange.id;
    store.saveProposal(p);
    return ok({ proposal: p, exchange });
  }

  /**
   * True while a listing is held by an unresolved accepted exchange.
   * Lazy release: owner reopen (Active) or exchange resolution clears the hold.
   */
  function isHeld(listingId: string): boolean {
    const exchangeId = store.heldBy(listingId);
    if (!exchangeId) return false;
    const exchange = store.getExchange(exchangeId);
    const listing = deps.listings.get(listingId);
    if (!exchange || exchange.status !== 'Scheduled' || !listing || listing.status !== 'Paused') {
      store.release(listingId);
      return false;
    }
    return true;
  }

  /** Withdrawal allowed any time before acceptance, by either side (FR-E-2). */
  function withdraw(userId: string, id: string): Result<Proposal> {
    const p = store.getProposal(id);
    if (!p) return fail([{ code: 'not-found', message: 'Proposal not found.' }]);
    if (p.status !== 'Proposed') {
      return fail([
        { code: 'invalid-transition', message: `Proposal is already ${p.status}.` },
      ]);
    }
    if (!isParticipant(p, userId)) {
      return fail([
        { code: 'not-permitted', message: 'Only a participant can withdraw this proposal.' },
      ]);
    }
    p.status = 'Withdrawn';
    p.decidedAtMs = now();
    store.saveProposal(p);
    return ok(p);
  }

  /** 7-day expiry job (FR-E-2). Returns expired proposals for the notification sink. */
  function runExpiry(nowMs: number): Proposal[] {
    const expired = store.proposedOlderThan(nowMs, PROPOSAL_WINDOW_MS);
    for (const p of expired) {
      p.status = 'Expired';
      p.decidedAtMs = nowMs;
      store.saveProposal(p);
    }
    return expired;
  }

  /** Schedule the meetup (FR-E-5): Cairo-labeled time + place + safety nudge. */
  function schedule(
    userId: string,
    exchangeId: string,
    input: ScheduleInput,
  ): Result<{ exchange: Exchange; safetyNudge: string }> {
    const e = store.getExchange(exchangeId);
    if (!e) return fail([{ code: 'not-found', message: 'Exchange not found.' }]);
    if (e.status !== 'Scheduled') {
      return fail([
        { code: 'invalid-transition', message: `Exchange is ${e.status}; only Scheduled exchanges can be scheduled.` },
      ]);
    }
    if (userId !== e.participantA && userId !== e.participantB) {
      return fail([
        { code: 'not-participant', message: 'Only exchange participants can set the schedule.' },
      ]);
    }
    if (e.doneMarkedBy !== undefined) {
      return fail([
        {
          code: 'invalid-transition',
          message: 'The schedule cannot change after Done was marked.',
        },
      ]);
    }
    const atMs = Date.parse(input.at);
    if (Number.isNaN(atMs)) {
      return fail([
        { code: 'schedule-invalid', field: 'at', message: 'Provide a valid date and time.' },
      ]);
    }
    if (atMs <= now()) {
      return fail([
        { code: 'schedule-past', field: 'at', message: 'The meeting time must be in the future.' },
      ]);
    }
    const place = input.place?.trim() ?? '';
    if (!place) {
      return fail([{ code: 'required', field: 'place', message: 'Meeting place is required.' }]);
    }
    if (PRIVATE_PLACE_RE.test(place) && input.acknowledgedSafetyReminder !== true) {
      return fail([
        {
          code: 'safety-ack-required',
          field: 'place',
          message:
            'Private residences need an explicit safety acknowledgement. ' +
            'Prefer a public on-campus spot, or acknowledge the safety reminder.',
        },
      ]);
    }
    e.schedule = { at: formatCairoTime(new Date(atMs).toISOString()), place };
    e.log.push(`scheduled for ${e.schedule.at} at ${place}`);
    store.saveExchange(e);
    return ok({ exchange: e, safetyNudge: SAFETY_NUDGE });
  }

  /** Two-step completion, step 1 (FR-E-6). Schedule-less Done needs override + reason. */
  function markDone(
    userId: string,
    exchangeId: string,
    opts: { overrideReason?: string } = {},
  ): Result<Exchange> {
    const e = store.getExchange(exchangeId);
    if (!e) return fail([{ code: 'not-found', message: 'Exchange not found.' }]);
    if (e.status !== 'Scheduled') {
      return fail([
        { code: 'invalid-transition', message: `Exchange is ${e.status}; only Scheduled exchanges can complete.` },
      ]);
    }
    if (!isParticipantOf(e, userId)) {
      return fail([
        { code: 'not-participant', message: 'Only exchange participants can mark Done.' },
      ]);
    }
    if (e.doneMarkedBy !== undefined) {
      return fail([
        { code: 'invalid-transition', message: 'Done already marked; awaiting confirmation.' },
      ]);
    }
    if (!e.schedule && !opts.overrideReason?.trim()) {
      return fail([
        {
          code: 'schedule-required',
          message:
            'Completion requires a schedule. Set one first, or record an explicit override reason.',
        },
      ]);
    }
    e.doneMarkedBy = userId;
    e.doneMarkedAtMs = now();
    e.log.push(
      opts.overrideReason?.trim()
        ? `done marked by ${userId} with schedule override: ${opts.overrideReason.trim()}`
        : `done marked by ${userId}`,
    );
    store.saveExchange(e);
    return ok(e);
  }

  /** Step 2a: the OTHER participant confirms within 7 days. */
  function confirm(userId: string, exchangeId: string): Result<Exchange> {
    const e = store.getExchange(exchangeId);
    if (!e) return fail([{ code: 'not-found', message: 'Exchange not found.' }]);
    if (e.status !== 'Scheduled' || e.doneMarkedBy === undefined || e.doneMarkedAtMs === undefined) {
      return fail([
        { code: 'invalid-transition', message: 'Nothing is awaiting confirmation on this exchange.' },
      ]);
    }
    if (!isParticipantOf(e, userId)) {
      return fail([
        { code: 'not-participant', message: 'Only exchange participants can confirm.' },
      ]);
    }
    if (userId === e.doneMarkedBy) {
      return fail([
        { code: 'not-permitted', message: 'You cannot confirm your own Done-mark.' },
      ]);
    }
    if (now() - e.doneMarkedAtMs > COMPLETION_WINDOW_MS) {
      return fail([
        { code: 'confirmation-window-passed', message: 'The 7-day confirmation window has passed.' },
      ]);
    }
    e.status = 'Completed';
    e.log.push(`confirmed by ${userId}`);
    store.saveExchange(e);
    return ok(e);
  }

  /** Step 2b: the OTHER participant disputes within 7 days → Disputed. */
  function dispute(userId: string, exchangeId: string): Result<Exchange> {
    const e = store.getExchange(exchangeId);
    if (!e) return fail([{ code: 'not-found', message: 'Exchange not found.' }]);
    if (e.status !== 'Scheduled' || e.doneMarkedBy === undefined || e.doneMarkedAtMs === undefined) {
      return fail([
        { code: 'invalid-transition', message: 'Nothing is awaiting confirmation on this exchange.' },
      ]);
    }
    if (!isParticipantOf(e, userId)) {
      return fail([
        { code: 'not-participant', message: 'Only exchange participants can dispute.' },
      ]);
    }
    if (userId === e.doneMarkedBy) {
      return fail([
        { code: 'not-permitted', message: 'You cannot dispute your own Done-mark.' },
      ]);
    }
    if (now() - e.doneMarkedAtMs > COMPLETION_WINDOW_MS) {
      return fail([
        { code: 'confirmation-window-passed', message: 'The 7-day confirmation window has passed.' },
      ]);
    }
    e.status = 'Disputed';
    e.log.push(`disputed by ${userId}`);
    store.saveExchange(e);
    return ok(e);
  }

  /** Silence job: Done-marked exchanges auto-complete after 7 days (FR-E-6). */
  function runAutoComplete(nowMs: number): Exchange[] {
    const due = store.doneMarkedOlderThan(nowMs, COMPLETION_WINDOW_MS);
    for (const e of due) {
      e.status = 'Completed';
      e.log.push('auto-completed after 7-day silence');
      store.saveExchange(e);
    }
    return due;
  }

  /** Cancellation with reason (FR-E-4). Either participant, Scheduled only. */
  function cancel(
    userId: string,
    exchangeId: string,
    input: { reason: CancelReason; detail?: string },
  ): Result<Exchange> {
    const e = store.getExchange(exchangeId);
    if (!e) return fail([{ code: 'not-found', message: 'Exchange not found.' }]);
    if (e.status !== 'Scheduled') {
      return fail([
        { code: 'invalid-transition', message: `Exchange is ${e.status}; only Scheduled exchanges can be cancelled.` },
      ]);
    }
    if (!isParticipantOf(e, userId)) {
      return fail([
        { code: 'not-participant', message: 'Only exchange participants can cancel.' },
      ]);
    }
    if (!CANCEL_REASONS.includes(input.reason)) {
      return fail([
        {
          code: 'invalid',
          field: 'reason',
          message: 'Cancellation requires a reason: no-show, conflict, item-unavailable, safety-concern, or other.',
        },
      ]);
    }
    e.status = 'Cancelled';
    e.cancelReason = input.reason;
    if (input.detail?.trim()) e.cancelDetail = input.detail.trim();
    e.log.push(`cancelled by ${userId}: ${input.reason}`);
    store.saveExchange(e);
    return ok(e);
  }

  /** Participant-gated exchange read: schedule and participants stay between the two sides. */
  function getExchange(viewerId: string, id: string): Exchange | undefined {
    const e = store.getExchange(id);
    if (!e || !isParticipantOf(e, viewerId)) return undefined;
    return e;
  }

  /** Participant-only plain-text thread (FR-E-7). No files in MVP. */
  function postMessage(senderId: string, exchangeId: string, text: string): Result<Message> {
    const e = store.getExchange(exchangeId);
    if (!e) return fail([{ code: 'not-found', message: 'Exchange not found.' }]);
    if (!isParticipantOf(e, senderId)) {
      return fail([
        { code: 'not-participant', message: 'Only exchange participants can post messages.' },
      ]);
    }
    const other = senderId === e.participantA ? e.participantB : e.participantA;
    if (deps.identity.isBlockedOrMuted(senderId, other)) {
      return fail([
        { code: 'blocked', message: 'You cannot message this user (block/mute in effect).' },
      ]);
    }
    const clean = text?.trim() ?? '';
    if (!clean) {
      return fail([{ code: 'required', field: 'text', message: 'Message text is required.' }]);
    }
    if (clean.length > MAX_MESSAGE_LENGTH) {
      return fail([
        {
          code: 'too-long',
          field: 'text',
          message: `Messages must be at most ${MAX_MESSAGE_LENGTH} characters (plain text, no files).`,
        },
      ]);
    }
    return ok(store.insertMessage({ exchangeId, senderId, text: clean, createdAtMs: now() }));
  }

  /** Participant-only read in the shared Result shape (no silent leaks, no throws). */
  function getMessages(viewerId: string, exchangeId: string): Result<Message[]> {
    const e = store.getExchange(exchangeId);
    if (!e) return fail([{ code: 'not-found', message: 'Exchange not found.' }]);
    if (!isParticipantOf(e, viewerId)) {
      return fail([
        { code: 'not-participant', message: 'Only exchange participants can read messages.' },
      ]);
    }
    return ok(store.messagesFor(exchangeId));
  }

  return { propose, getProposal, respond, withdraw, runExpiry, lockStatus, openCount, schedule, markDone, confirm, dispute, runAutoComplete, cancel, getExchange, postMessage, getMessages, store };
}

const CANCEL_REASONS: CancelReason[] = ['no-show', 'conflict', 'item-unavailable', 'safety-concern', 'other'];

function isParticipantOf(e: Exchange, userId: string): boolean {
  return userId === e.participantA || userId === e.participantB;
}

export interface ScheduleInput {
  at: string;
  place: string;
  acknowledgedSafetyReminder?: boolean;
}

const PRIVATE_PLACE_RE = /\b(apartment|flat|house|home|room|dorm|hostel|residence|my place)\b/i;

export const SAFETY_NUDGE =
  'Safety: prefer a public on-campus spot (library hall, campus café) and tell a friend ' +
  'where you are going. Private residences are allowed only by mutual agreement — ' +
  'you accepted the safety reminder for a private place. See the full Terms.';

export type ExchangesService = ReturnType<typeof createExchangesService>;
