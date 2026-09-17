import { fail, ok, type Result } from '../common/errors.js';
import type { NotifyPort } from '../notifications/types.js';
import { ReputationStore } from './store.js';
import type { Aggregate, ExchangesPort, Review, SubmitReviewInput } from './types.js';

export const MAX_REVIEW_TEXT = 1000;
export const REVEAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const REVIEW_EDIT_MS = 48 * 60 * 60 * 1000;

export function createReputationService(
  deps: { exchanges: ExchangesPort; identity?: { authorizeMemberSession(token: unknown): Result<string> }; notify?: NotifyPort },
  opts: { now?: () => number; store?: ReputationStore } = {},
) {
  const store = opts.store ?? new ReputationStore();
  const now = opts.now ?? Date.now;
  function authorize(token: unknown): Result<string> {
    return deps.identity?.authorizeMemberSession(token) ??
      fail([{ code: 'not-configured', message: 'Authenticated reputation mutations are not configured.' }]);
  }

  function submitReview(
    reviewerId: string,
    exchangeId: string,
    input: SubmitReviewInput,
  ): Result<Review> {
    const e = deps.exchanges.readExchange(exchangeId);
    if (!e || e.status !== 'Completed') {
      return fail([
        { code: 'exchange-not-completed', message: 'Reviews are only allowed on Completed exchanges.' },
      ]);
    }
    const isA = reviewerId === e.participantA;
    const isB = reviewerId === e.participantB;
    if (!isA && !isB) {
      return fail([
        { code: 'not-participant', message: 'Only exchange participants can review.' },
      ]);
    }
    if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
      return fail([
        { code: 'invalid', field: 'score', message: 'Score must be an integer from 1 to 5.' },
      ]);
    }
    if (input.text !== undefined && input.text.length > MAX_REVIEW_TEXT) {
      return fail([
        {
          code: 'too-long',
          field: 'text',
          message: `Review text must be at most ${MAX_REVIEW_TEXT} characters.`,
        },
      ]);
    }
    const existing = store.forExchange(exchangeId).find((r) => r.reviewerId === reviewerId);
    if (existing) {
      return fail([
        { code: 'duplicate-review', message: 'You have already reviewed this exchange.' },
      ]);
    }
    const review = store.insert({
      exchangeId,
      reviewerId,
      revieweeId: isA ? e.participantB : e.participantA,
      score: input.score,
      text: input.text,
      status: 'Hidden',
      submittedAtMs: now(),
    });
    maybeReveal(exchangeId, now());
    return ok(review);
  }

  /** Publish when both sides submitted or 14 days passed since the earliest submit. Returns newly published. */
  function maybeReveal(exchangeId: string, atMs: number): Review[] {
    const hidden = store.forExchange(exchangeId).filter((r) => r.status === 'Hidden');
    if (hidden.length === 0) return [];
    const submittedCount = store
      .forExchange(exchangeId)
      .filter((r) => r.status !== 'Voided').length;
    const earliest = Math.min(...hidden.map((r) => r.submittedAtMs));
    if (submittedCount >= 2 || atMs - earliest >= REVEAL_WINDOW_MS) {
      for (const r of hidden) {
        r.status = 'Published';
        r.publishedAtMs = atMs;
        store.save(r);
        deps.notify?.emit(r.revieweeId, 'review-published', r.id);
      }
      return hidden;
    }
    return [];
  }

  /** Blind read: Hidden reviews visible to their reviewer only; Published to anyone. */
  function getReview(viewerId: string, id: string): Review | undefined {
    const r = store.get(id);
    if (!r) return undefined;
    if (r.status === 'Published') return r;
    if (r.status === 'Voided') {
      const e = deps.exchanges.readExchange(r.exchangeId);
      if (!e) return undefined;
      return viewerId === e.participantA || viewerId === e.participantB ? r : undefined;
    }
    return r.reviewerId === viewerId ? r : undefined;
  }

  function editReview(
    reviewerId: string,
    id: string,
    patch: Partial<SubmitReviewInput>,
  ): Result<Review> {
    const r = store.get(id);
    if (!r || r.reviewerId !== reviewerId) {
      return fail([{ code: 'not-found', message: 'Review not found.' }]);
    }
    if (r.status === 'Voided') {
      return fail([{ code: 'invalid-transition', message: 'Voided reviews cannot be edited.' }]);
    }
    if (now() - r.submittedAtMs >= REVIEW_EDIT_MS) {
      return fail([
        { code: 'edit-window-passed', message: 'The 48-hour edit window has passed.' },
      ]);
    }
    if (patch.score !== undefined) {
      if (!Number.isInteger(patch.score) || patch.score < 1 || patch.score > 5) {
        return fail([
          { code: 'invalid', field: 'score', message: 'Score must be an integer from 1 to 5.' },
        ]);
      }
      r.score = patch.score;
    }
    if (patch.text !== undefined) {
      if (patch.text.length > MAX_REVIEW_TEXT) {
        return fail([
          {
            code: 'too-long',
            field: 'text',
            message: `Review text must be at most ${MAX_REVIEW_TEXT} characters.`,
          },
        ]);
      }
      r.text = patch.text;
    }
    r.editedAtMs = now();
    store.save(r);
    return ok(r);
  }

  /** Aggregate reputation: average + count + distribution + full history (FR-R-3). */
  function aggregate(userId: string): Aggregate {
    const history = store.publishedFor(userId);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of history) {
      distribution[r.score as 1 | 2 | 3 | 4 | 5] += 1;
      sum += r.score;
    }
    return {
      average: history.length === 0 ? 0 : sum / history.length,
      count: history.length,
      distribution,
      history,
    };
  }

  /** One response per review by the reviewed party (FR-R-5). */
  function respondToReview(
    revieweeId: string,
    id: string,
    input: RespondInput,
  ): Result<Review> {
    const r = store.get(id);
    if (!r || r.revieweeId !== revieweeId) {
      return fail([{ code: 'not-found', message: 'Review not found.' }]);
    }
    if (r.status !== 'Published') {
      return fail([
        { code: 'invalid-transition', message: 'Only published reviews can receive a response.' },
      ]);
    }
    if (r.response) {
      return fail([
        { code: 'duplicate-response', message: 'Only one response per review is allowed.' },
      ]);
    }
    const text = input.text?.trim() ?? '';
    if (!text) {
      return fail([{ code: 'required', field: 'text', message: 'Response text is required.' }]);
    }
    if (text.length > MAX_REVIEW_TEXT) {
      return fail([
        {
          code: 'too-long',
          field: 'text',
          message: `Response text must be at most ${MAX_REVIEW_TEXT} characters.`,
        },
      ]);
    }
    r.response = { text, submittedAtMs: now() };
    store.save(r);
    deps.notify?.emit(r.reviewerId, 'review-response', r.id);
    return ok(r);
  }

  function editResponse(revieweeId: string, id: string, input: RespondInput): Result<Review> {
    const r = store.get(id);
    if (!r || r.revieweeId !== revieweeId || !r.response) {
      return fail([{ code: 'not-found', message: 'Response not found.' }]);
    }
    if (now() - r.response.submittedAtMs >= REVIEW_EDIT_MS) {
      return fail([
        { code: 'edit-window-passed', message: 'The 48-hour edit window has passed.' },
      ]);
    }
    const text = input.text?.trim() ?? '';
    if (!text) {
      return fail([{ code: 'required', field: 'text', message: 'Response text is required.' }]);
    }
    if (text.length > MAX_REVIEW_TEXT) {
      return fail([
        {
          code: 'too-long',
          field: 'text',
          message: `Response text must be at most ${MAX_REVIEW_TEXT} characters.`,
        },
      ]);
    }
    r.response = { ...r.response, text, editedAtMs: now() };
    store.save(r);
    return ok(r);
  }

  /**
   * Moderation void (FR-M-4). INTERNAL: only the moderation service may call
   * this — it enforces the moderator-role gate. The ONLY way to retract a
   * review besides the 48h edit window — voids are recorded with actor +
   * reason + timestamp, never silent (S-5).
   */
  function voidReview(by: string, id: string, reason: string): Result<Review> {
    const r = store.get(id);
    if (!r) return fail([{ code: 'not-found', message: 'Review not found.' }]);
    if (!reason?.trim()) {
      return fail([{ code: 'required', field: 'reason', message: 'A void reason is required.' }]);
    }
    r.status = 'Voided';
    r.void = { by, reason: reason.trim(), atMs: now() };
    store.save(r);
    deps.notify?.emit(r.revieweeId, 'moderation-action', r.id);
    return ok(r);
  }

  /** Time-based reveal job. Returns newly published reviews for the notification sink. */
  function revealDue(nowMs: number): Review[] {
    const published: Review[] = [];
    for (const exchangeId of store.exchangeIds()) {
      published.push(...maybeReveal(exchangeId, nowMs));
    }
    return published;
  }

  function submitReviewForSession(token: unknown, exchangeId: string, input: SubmitReviewInput): Result<Review> {
    const auth = authorize(token);
    return auth.ok ? submitReview(auth.value, exchangeId, input) : auth;
  }
  function editReviewForSession(token: unknown, id: string, patch: Partial<SubmitReviewInput>): Result<Review> {
    const auth = authorize(token);
    return auth.ok ? editReview(auth.value, id, patch) : auth;
  }
  function respondToReviewForSession(token: unknown, id: string, input: RespondInput): Result<Review> {
    const auth = authorize(token);
    return auth.ok ? respondToReview(auth.value, id, input) : auth;
  }
  function editResponseForSession(token: unknown, id: string, input: RespondInput): Result<Review> {
    const auth = authorize(token);
    return auth.ok ? editResponse(auth.value, id, input) : auth;
  }

  return { submitReview, submitReviewForSession, getReview, editReview, editReviewForSession, revealDue,
    aggregate, respondToReview, respondToReviewForSession, editResponse, editResponseForSession, voidReview, store };
}

export interface RespondInput {
  text: string;
}

export type ReputationService = ReturnType<typeof createReputationService>;
