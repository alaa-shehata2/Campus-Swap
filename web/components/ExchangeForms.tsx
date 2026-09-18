'use client';

import { useActionState } from 'react';
import {
  scheduleAction,
  markDoneAction,
  confirmAction,
  disputeAction,
  cancelAction,
  type ActionState,
} from '../app/actions';
import { SAFETY_NUDGE } from '../../src/exchanges/types.js';
import { Disclaimer } from './Disclaimer';
import { FieldErrors } from './FieldErrors';
import { SubmitButton } from './SubmitButton';

const initial: ActionState = { errors: [] };
const input = 'mt-1 w-full rounded border border-stone-300 px-3 py-2';

export function ScheduleForm({ exchangeId }: { exchangeId: string }) {
  const [state, action] = useActionState(scheduleAction, initial);
  return (
    <div className="space-y-3">
      <Disclaimer flow="schedule-confirm" />
      <p className="rounded border border-sky-300 bg-sky-50 p-3 text-sm text-stone-800">{SAFETY_NUDGE}</p>
      <form action={action} className="max-w-xl space-y-4">
        <input type="hidden" name="exchangeId" value={exchangeId} />
        <div>
          <label htmlFor="at" className="block text-sm font-medium">
            Meeting time (Cairo time)
          </label>
          <input id="at" name="at" type="datetime-local" required className={input} />
          <FieldErrors errors={state.errors} field="at" />
        </div>
        <div>
          <label htmlFor="place" className="block text-sm font-medium">
            Meeting place
          </label>
          <input
            id="place"
            name="place"
            required
            placeholder="e.g. Library hall, North campus"
            className={input}
          />
          <FieldErrors errors={state.errors} field="place" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="ack" className="mt-1" />
          <span>
            I acknowledge the safety reminder (required for private residences such as apartments,
            dorms, or homes).
          </span>
        </label>
        <FieldErrors errors={state.errors} />
        <SubmitButton>Set schedule</SubmitButton>
      </form>
    </div>
  );
}

export function DoneForm({ exchangeId, scheduled }: { exchangeId: string; scheduled: boolean }) {
  const [state, action] = useActionState(markDoneAction, initial);
  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="exchangeId" value={exchangeId} />
      {!scheduled && (
        <div>
          <label htmlFor="overrideReason" className="block text-sm font-medium">
            No schedule set — record an explicit override reason to mark Done
          </label>
          <input id="overrideReason" name="overrideReason" className={input} />
        </div>
      )}
      <FieldErrors errors={state.errors} />
      <SubmitButton>Mark Done</SubmitButton>
    </form>
  );
}

export function ConfirmDispute({ exchangeId }: { exchangeId: string }) {
  const [cState, cAction] = useActionState(confirmAction, initial);
  const [dState, dAction] = useActionState(disputeAction, initial);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <form action={cAction}>
          <input type="hidden" name="exchangeId" value={exchangeId} />
          <SubmitButton>Confirm completion</SubmitButton>
        </form>
        <form action={dAction}>
          <input type="hidden" name="exchangeId" value={exchangeId} />
          <button
            type="submit"
            className="rounded border border-stone-300 bg-white px-4 py-2 font-medium text-stone-800"
          >
            Dispute
          </button>
        </form>
      </div>
      <FieldErrors errors={cState.errors} />
      <FieldErrors errors={dState.errors} />
    </div>
  );
}

const CANCEL_REASONS = ['no-show', 'conflict', 'item-unavailable', 'safety-concern', 'other'] as const;

export function CancelForm({ exchangeId }: { exchangeId: string }) {
  const [state, action] = useActionState(cancelAction, initial);
  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="exchangeId" value={exchangeId} />
      <div>
        <label htmlFor="reason" className="block text-sm font-medium">
          Cancellation reason (required)
        </label>
        <select id="reason" name="reason" required defaultValue="" className={input}>
          <option value="" disabled>
            Choose a reason
          </option>
          {CANCEL_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <FieldErrors errors={state.errors} field="reason" />
      </div>
      <div>
        <label htmlFor="detail" className="block text-sm font-medium">
          Detail (optional)
        </label>
        <input id="detail" name="detail" className={input} />
      </div>
      <FieldErrors errors={state.errors} />
      <button
        type="submit"
        className="rounded border border-red-300 bg-white px-4 py-2 font-medium text-red-800"
      >
        Cancel exchange
      </button>
    </form>
  );
}
