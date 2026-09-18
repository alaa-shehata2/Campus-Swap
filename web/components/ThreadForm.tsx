'use client';

import { useActionState } from 'react';
import { postMessageAction, type ActionState } from '../app/actions';
import { FieldErrors } from './FieldErrors';
import { SubmitButton } from './SubmitButton';

const initial: ActionState = { errors: [] };

export function ThreadForm({ exchangeId }: { exchangeId: string }) {
  const [state, action] = useActionState(postMessageAction, initial);
  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="exchangeId" value={exchangeId} />
      <label htmlFor="text" className="block text-sm font-medium">
        Message (plain text, max 2000)
      </label>
      <textarea id="text" name="text" required maxLength={2000} rows={3} className="mt-1 w-full rounded border border-stone-300 px-3 py-2" />
      <FieldErrors errors={state.errors} field="text" />
      <FieldErrors errors={state.errors} />
      <SubmitButton>Send</SubmitButton>
    </form>
  );
}
