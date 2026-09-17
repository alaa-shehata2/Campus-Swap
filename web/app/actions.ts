'use server';

import { redirect } from 'next/navigation';
import { services } from '../lib/services';
import { sessionUserId, setSessionCookie } from '../lib/auth';
import type { FieldError } from '../../src/common/errors.js';

export interface ActionState {
  errors: FieldError[];
}

function safeReturnTo(form: FormData): string {
  const raw = String(form.get('returnTo') ?? '/');
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

export async function signupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { identity } = services();
  const result = await identity.register({
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
    displayName: String(form.get('displayName') ?? ''),
    campus: String(form.get('campus') ?? '') || undefined,
    ageConfirmed18: form.get('ageConfirmed18') === 'on',
    rulesAccepted: form.get('rulesAccepted') === 'on',
  });
  if (!result.ok) return { errors: result.errors };
  const auth = await identity.authenticate(
    String(form.get('email') ?? ''),
    String(form.get('password') ?? ''),
  );
  if (auth.ok) await setSessionCookie(auth.value.token);
  redirect(safeReturnTo(form));
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { identity } = services();
  const result = await identity.authenticate(
    String(form.get('email') ?? ''),
    String(form.get('password') ?? ''),
  );
  if (!result.ok) return { errors: result.errors };
  await setSessionCookie(result.value.token);
  redirect(safeReturnTo(form));
}

export interface PublishState {
  errors: FieldError[];
}

export async function publishAction(_prev: PublishState, form: FormData): Promise<PublishState> {
  const userId = await sessionUserId();
  if (!userId) redirect('/login?returnTo=/publish');
  const { listings } = services();
  const kind = String(form.get('kind') ?? 'skill');
  const modality = String(form.get('modality') ?? '');
  const result = await listings.publish(userId, {
    side: String(form.get('side') ?? 'offer') as 'offer' | 'request',
    kind: kind as 'skill' | 'item',
    title: String(form.get('title') ?? ''),
    description: String(form.get('description') ?? ''),
    category: String(form.get('category') ?? ''),
    zone: String(form.get('zone') ?? ''),
    availability: String(form.get('availability') ?? '') || undefined,
    images: [],
    modality: (kind === 'item' ? modality : undefined) as 'lend' | 'give' | 'swap' | undefined,
    returnTerm: String(form.get('returnTerm') ?? '') || undefined,
    counterpartDescription: String(form.get('counterpartDescription') ?? '') || undefined,
  });
  if (!result.ok) return { errors: result.errors };
  redirect(`/listings/${result.value.id}`);
}

export async function updateProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  if (!userId) redirect('/login?returnTo=/me');
  const { identity } = services();
  const result = await identity.updateProfile(userId, {
    displayName: String(form.get('displayName') ?? ''),
    bio: String(form.get('bio') ?? ''),
    skillTags: String(form.get('skillTags') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    availabilityNotes: String(form.get('availabilityNotes') ?? ''),
  });
  if (!result.ok) return { errors: result.errors };
  redirect('/me');
}
