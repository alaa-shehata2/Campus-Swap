'use client';

import { useActionState } from 'react';
import {
  submitReviewAction,
  editReviewAction,
  respondReviewAction,
  type ActionState,
} from '../app/actions';
import { MAX_REVIEW_TEXT } from '../../src/reputation/types.js';
import { FieldErrors } from './FieldErrors';
import { SubmitButton } from './SubmitButton';

const initial: ActionState = { errors: [] };
const input = 'mt-1 w-full rounded-md border border-border bg-surface-elevated px-3 py-2';

function ScoreText({
  state,
  defaultScore,
  defaultText,
}: {
  state: ActionState;
  defaultScore?: number;
  defaultText?: string;
}) {
  return (
    <>
      <div>
        <label htmlFor="score" className="block text-sm font-medium">
          Score (1–5)
        </label>
        <select id="score" name="score" required defaultValue={defaultScore ?? ''} className={input}>
          <option value="" disabled>
            Choose a score
          </option>
          {[1, 2, 3, 4, 5].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <FieldErrors errors={state.errors} field="score" />
      </div>
      <div>
        <label htmlFor="text" className="block text-sm font-medium">
          Review text (optional, max {MAX_REVIEW_TEXT})
        </label>
        <textarea
          id="text"
          name="text"
          rows={4}
          maxLength={MAX_REVIEW_TEXT}
          defaultValue={defaultText ?? ''}
          className={input}
        />
        <FieldErrors errors={state.errors} field="text" />
      </div>
      <FieldErrors errors={state.errors} />
    </>
  );
}

export function SubmitReviewForm({ exchangeId }: { exchangeId: string }) {
  const [state, action] = useActionState(submitReviewAction, initial);
  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="exchangeId" value={exchangeId} />
      <ScoreText state={state} />
      <SubmitButton>Submit review</SubmitButton>
    </form>
  );
}

export function EditReviewForm({
  exchangeId,
  reviewId,
  defaultScore,
  defaultText,
}: {
  exchangeId: string;
  reviewId: string;
  defaultScore: number;
  defaultText?: string;
}) {
  const [state, action] = useActionState(editReviewAction, initial);
  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="exchangeId" value={exchangeId} />
      <input type="hidden" name="reviewId" value={reviewId} />
      <ScoreText state={state} defaultScore={defaultScore} defaultText={defaultText} />
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}

export function RespondReviewForm({ exchangeId, reviewId }: { exchangeId: string; reviewId: string }) {
  const [state, action] = useActionState(respondReviewAction, initial);
  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="exchangeId" value={exchangeId} />
      <input type="hidden" name="reviewId" value={reviewId} />
      <div>
        <label htmlFor="response-text" className="block text-sm font-medium">
          Your response (once only, max {MAX_REVIEW_TEXT})
        </label>
        <textarea
          id="response-text"
          name="text"
          required
          rows={3}
          maxLength={MAX_REVIEW_TEXT}
          className={input}
        />
        <FieldErrors errors={state.errors} field="text" />
      </div>
      <FieldErrors errors={state.errors} />
      <SubmitButton>Post response</SubmitButton>
    </form>
  );
}
