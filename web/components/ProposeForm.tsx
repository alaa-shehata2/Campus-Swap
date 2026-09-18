'use client';

import { useActionState } from 'react';
import { proposeAction, type ActionState } from '../app/actions';
import { FieldErrors } from './FieldErrors';
import { SubmitButton } from './SubmitButton';
import type { Listing } from '../../src/listings/types.js';

const initial: ActionState = { errors: [] };
const input = 'mt-1 w-full rounded border border-stone-300 px-3 py-2';

export function ProposeForm({ target, own }: { target: Listing; own: Listing[] }) {
  const [state, action] = useActionState(proposeAction, initial);
  return (
    <form action={action} className="mt-4 max-w-xl space-y-4">
      <input type="hidden" name="targetListingId" value={target.id} />
      <fieldset>
        <legend className="text-sm font-medium">Your listings to offer (pick at least one)</legend>
        <div className="mt-2 space-y-2">
          {own.map((l) => (
            <label key={l.id} className="flex items-start gap-2 rounded border border-stone-200 bg-white p-3 text-sm">
              <input type="checkbox" name="sideA" value={l.id} className="mt-1" />
              <span>
                <span className="font-medium">{l.title}</span>{' '}
                <span className="text-stone-500">
                  ({l.side} · {l.kind} · {l.status})
                </span>
              </span>
            </label>
          ))}
        </div>
        <FieldErrors errors={state.errors} field="sideAListingIds" />
      </fieldset>
      <div>
        <label htmlFor="terms" className="block text-sm font-medium">
          Terms (required — what each side gives and takes)
        </label>
        <textarea id="terms" name="terms" required rows={4} className={input} />
        <FieldErrors errors={state.errors} field="terms" />
      </div>
      <FieldErrors errors={state.errors} />
      <SubmitButton>Send proposal</SubmitButton>
    </form>
  );
}
