'use client';

import { useActionState } from 'react';
import { markReadAction, markAllReadAction, type ActionState } from '../app/actions';
import { FieldErrors } from './FieldErrors';
import { SubmitButton } from './SubmitButton';

const initial: ActionState = { errors: [] };

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [state, action] = useActionState(markReadAction, initial);
  return (
    <form action={action}>
      <input type="hidden" name="notificationId" value={notificationId} />
      <button type="submit" className="text-sm underline">
        Mark read
      </button>
      <FieldErrors errors={state.errors} />
    </form>
  );
}

export function MarkAllReadButton() {
  const [state, action] = useActionState(markAllReadAction, initial);
  return (
    <form action={action}>
      <SubmitButton>Mark all read</SubmitButton>
      <FieldErrors errors={state.errors} />
    </form>
  );
}
