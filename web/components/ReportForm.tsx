'use client';

import { useActionState } from 'react';
import { reportAction, type ActionState } from '../app/actions';
import { REASON_CODES, MAX_REPORT_IMAGES } from '../../src/moderation/types.js';
import { FieldErrors } from './FieldErrors';
import { SubmitButton } from './SubmitButton';

const initial: ActionState = { errors: [] };
const input = 'mt-1 w-full rounded-md border border-border bg-surface-elevated px-3 py-2';

export function ReportForm({ targetType, targetId }: { targetType: 'listing' | 'user'; targetId: string }) {
  const [state, action] = useActionState(reportAction, initial);
  return (
    <form action={action} className="max-w-xl space-y-4">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <div>
        <label htmlFor="reasonCode" className="block text-sm font-medium">
          Reason (required)
        </label>
        <select id="reasonCode" name="reasonCode" required defaultValue="" className={input}>
          <option value="" disabled>
            Choose a reason
          </option>
          {REASON_CODES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <FieldErrors errors={state.errors} field="reasonCode" />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Description (required; ≥20 characters for “other”)
        </label>
        <textarea id="description" name="description" required rows={5} className={input} />
        <FieldErrors errors={state.errors} field="description" />
      </div>
      <fieldset>
        <legend className="text-sm font-medium">
          Image references (optional, max {MAX_REPORT_IMAGES} — URLs or file names, never executables)
        </legend>
        <div className="mt-2 space-y-2">
          {[1, 2, 3].map((i) => (
            <input
              key={i}
              name={`image${i}`}
              placeholder={`Image ${i} reference`}
              className={input}
            />
          ))}
        </div>
        <FieldErrors errors={state.errors} field="images" />
      </fieldset>
      <FieldErrors errors={state.errors} />
      <SubmitButton>Submit report</SubmitButton>
    </form>
  );
}
