'use client';

import { useActionState } from 'react';
import { triageAction, sanctionAction, escalateAction, type ActionState } from '../app/actions';
import { FieldErrors } from './FieldErrors';
import { SubmitButton } from './SubmitButton';

const initial: ActionState = { errors: [] };
const input = 'mt-1 w-full rounded-md border border-border bg-surface-elevated px-3 py-2';
const quietButton = 'rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium';

export function TriageButtons({ reportId, status }: { reportId: string; status: string }) {
  const [state, action] = useActionState(triageAction, initial);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="reportId" value={reportId} />
      <div className="flex flex-wrap gap-2">
        {status === 'Received' && (
          <button type="submit" name="decision" value="acknowledge" className={quietButton}>
            Acknowledge (→ Under review)
          </button>
        )}
        {status === 'Under review' && (
          <button type="submit" name="decision" value="resolve" className={quietButton}>
            Resolve
          </button>
        )}
      </div>
      <FieldErrors errors={state.errors} />
    </form>
  );
}

const SANCTION_ACTIONS = [
  { value: 'hide', label: 'Hide listing', target: 'listing' },
  { value: 'unhide', label: 'Unhide listing', target: 'listing' },
  { value: 'warn', label: 'Warn user', target: 'user' },
  { value: 'suspend', label: 'Suspend user', target: 'user' },
  { value: 'ban', label: 'Ban user', target: 'user' },
  { value: 'clear-restriction', label: 'Clear restriction', target: 'user' },
] as const;

export function SanctionForm({
  targetType,
  targetId,
}: {
  targetType: 'listing' | 'user';
  targetId: string;
}) {
  const [state, action] = useActionState(sanctionAction, initial);
  const options = SANCTION_ACTIONS.filter((o) => o.target === targetType);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Sanction
          <select name="sanctionAction" required defaultValue="" className={input}>
            <option value="" disabled>
              Choose
            </option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Reason (required)
          <input name="reason" required className={input} />
        </label>
      </div>
      <FieldErrors errors={state.errors} />
      <SubmitButton>Apply sanction</SubmitButton>
    </form>
  );
}

export function EscalateButton({ reportId }: { reportId: string }) {
  const [state, action] = useActionState(escalateAction, initial);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="reportId" value={reportId} />
      <button
        type="submit"
        className="rounded-md border border-status-danger-ink bg-status-danger-bg px-3 py-1.5 text-sm font-medium text-status-danger-ink"
      >
        Hand over to law enforcement (owner-approved)
      </button>
      <FieldErrors errors={state.errors} />
      <p className="text-xs text-text-muted">
        Requires owner approval by a moderator other than you. Unavailable unless MODERATION_OWNER_ID
        is configured.
      </p>
    </form>
  );
}
