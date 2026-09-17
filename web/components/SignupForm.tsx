'use client';

import { useActionState } from 'react';
import { signupAction, type ActionState } from '../app/actions';
import { Disclaimer } from './Disclaimer';
import { FieldErrors } from './FieldErrors';
import { SubmitButton } from './SubmitButton';

const initial: ActionState = { errors: [] };

export function SignupForm({ returnTo }: { returnTo: string }) {
  const [state, action] = useActionState(signupAction, initial);
  return (
    <>
      <Disclaimer flow="signup" />
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            autoComplete="nickname"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
          <FieldErrors errors={state.errors} field="displayName" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email (any domain)
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
          <FieldErrors errors={state.errors} field="email" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password (8+ characters)
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
          <FieldErrors errors={state.errors} field="password" />
        </div>
        <div>
          <label htmlFor="campus" className="block text-sm font-medium">
            Campus / university
          </label>
          <input
            id="campus"
            name="campus"
            defaultValue="KFS University"
            required
            autoComplete="off"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
          />
          <p className="mt-1 text-sm text-stone-600">
            Self-declared, not verified. Misrepresentation violates the rules.
          </p>
          <FieldErrors errors={state.errors} field="campus" />
        </div>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="ageConfirmed18" required className="mt-1" />I confirm I am 18
            or older (18+ only).
          </label>
          <FieldErrors errors={state.errors} field="ageConfirmed18" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="rulesAccepted" required className="mt-1" />I accept the
            community rules and Terms.
          </label>
          <FieldErrors errors={state.errors} field="rulesAccepted" />
        </div>
        <FieldErrors errors={state.errors} />
        <SubmitButton>Create account</SubmitButton>
      </form>
    </>
  );
}
