'use server';

import { redirect } from 'next/navigation';
import { services } from '../lib/services';
import { sessionUserId, setSessionCookie } from '../lib/auth';
import { cairoWallToISO } from '../lib/cairo';
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

export async function proposeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const target = String(form.get('targetListingId') ?? '');
  if (!userId) redirect(`/login?returnTo=/proposals/new?listing=${encodeURIComponent(target)}`);
  const { exchanges } = services();
  const result = await exchanges.propose(userId, {
    sideAListingIds: form.getAll('sideA').map(String).filter(Boolean),
    sideBListingIds: [target],
    terms: String(form.get('terms') ?? ''),
  });
  if (!result.ok) return { errors: result.errors };
  redirect(`/proposals/${result.value.id}`);
}

export async function respondAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const proposalId = String(form.get('proposalId') ?? '');
  if (!userId) redirect(`/login?returnTo=/proposals/${encodeURIComponent(proposalId)}`);
  const decision = String(form.get('decision') ?? '');
  if (decision !== 'accept' && decision !== 'decline') {
    return { errors: [{ code: 'invalid', field: 'decision', message: 'Choose accept or decline.' }] };
  }
  const { exchanges } = services();
  const result = await exchanges.respond(userId, proposalId, decision);
  if (!result.ok) return { errors: result.errors };
  if (decision === 'accept' && typeof result.value === 'object' && 'exchange' in result.value) {
    redirect(`/exchanges/${result.value.exchange.id}`);
  }
  redirect('/proposals');
}

export async function withdrawAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const proposalId = String(form.get('proposalId') ?? '');
  if (!userId) redirect(`/login?returnTo=/proposals/${encodeURIComponent(proposalId)}`);
  const { exchanges } = services();
  const result = await exchanges.withdraw(userId, proposalId);
  if (!result.ok) return { errors: result.errors };
  redirect('/proposals');
}

export async function scheduleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const exchangeId = String(form.get('exchangeId') ?? '');
  if (!userId) redirect(`/login?returnTo=/exchanges/${encodeURIComponent(exchangeId)}`);
  const raw = String(form.get('at') ?? '');
  const at = cairoWallToISO(raw);
  if (!at) {
    return { errors: [{ code: 'schedule-invalid', field: 'at', message: 'Provide a valid date and time.' }] };
  }
  const { exchanges } = services();
  const result = await exchanges.schedule(userId, exchangeId, {
    at,
    place: String(form.get('place') ?? ''),
    acknowledgedSafetyReminder: form.get('ack') === 'on',
  });
  if (!result.ok) return { errors: result.errors };
  redirect(`/exchanges/${exchangeId}`);
}

export async function markDoneAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const exchangeId = String(form.get('exchangeId') ?? '');
  if (!userId) redirect(`/login?returnTo=/exchanges/${encodeURIComponent(exchangeId)}`);
  const { exchanges } = services();
  const override = String(form.get('overrideReason') ?? '').trim();
  const result = await exchanges.markDone(userId, exchangeId, override ? { overrideReason: override } : {});
  if (!result.ok) return { errors: result.errors };
  redirect(`/exchanges/${exchangeId}`);
}

export async function confirmAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const exchangeId = String(form.get('exchangeId') ?? '');
  if (!userId) redirect(`/login?returnTo=/exchanges/${encodeURIComponent(exchangeId)}`);
  const { exchanges } = services();
  const result = await exchanges.confirm(userId, exchangeId);
  if (!result.ok) return { errors: result.errors };
  redirect(`/exchanges/${exchangeId}`);
}

export async function disputeAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const exchangeId = String(form.get('exchangeId') ?? '');
  if (!userId) redirect(`/login?returnTo=/exchanges/${encodeURIComponent(exchangeId)}`);
  const { exchanges } = services();
  const result = await exchanges.dispute(userId, exchangeId);
  if (!result.ok) return { errors: result.errors };
  redirect(`/exchanges/${exchangeId}`);
}

export async function cancelAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const exchangeId = String(form.get('exchangeId') ?? '');
  if (!userId) redirect(`/login?returnTo=/exchanges/${encodeURIComponent(exchangeId)}`);
  const reason = String(form.get('reason') ?? '');
  const valid = ['no-show', 'conflict', 'item-unavailable', 'safety-concern', 'other'];
  if (!valid.includes(reason)) {
    return {
      errors: [{
        code: 'invalid', field: 'reason',
        message: 'Cancellation requires a reason: no-show, conflict, item-unavailable, safety-concern, or other.',
      }],
    };
  }
  const { exchanges } = services();
  const detail = String(form.get('detail') ?? '').trim();
  const result = await exchanges.cancel(userId, exchangeId, {
    reason: reason as 'no-show' | 'conflict' | 'item-unavailable' | 'safety-concern' | 'other',
    ...(detail ? { detail } : {}),
  });
  if (!result.ok) return { errors: result.errors };
  redirect(`/exchanges/${exchangeId}`);
}

export async function postMessageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const exchangeId = String(form.get('exchangeId') ?? '');
  if (!userId) redirect(`/login?returnTo=/exchanges/${encodeURIComponent(exchangeId)}`);
  const { exchanges } = services();
  const result = await exchanges.postMessage(userId, exchangeId, String(form.get('text') ?? ''));
  if (!result.ok) return { errors: result.errors };
  redirect(`/exchanges/${exchangeId}`);
}

export async function submitReviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const exchangeId = String(form.get('exchangeId') ?? '');
  if (!userId) redirect(`/login?returnTo=/exchanges/${encodeURIComponent(exchangeId)}/review`);
  const { reputation } = services();
  const result = await reputation.submitReview(userId, exchangeId, {
    score: Number(form.get('score') ?? 0),
    text: String(form.get('text') ?? ''),
  });
  if (!result.ok) return { errors: result.errors };
  redirect(`/exchanges/${exchangeId}/review`);
}

export async function editReviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const exchangeId = String(form.get('exchangeId') ?? '');
  const reviewId = String(form.get('reviewId') ?? '');
  if (!userId) redirect(`/login?returnTo=/exchanges/${encodeURIComponent(exchangeId)}/review`);
  const { reputation } = services();
  const result = await reputation.editReview(userId, reviewId, {
    score: Number(form.get('score') ?? 0),
    text: String(form.get('text') ?? ''),
  });
  if (!result.ok) return { errors: result.errors };
  redirect(`/exchanges/${exchangeId}/review`);
}

export async function respondReviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  const exchangeId = String(form.get('exchangeId') ?? '');
  const reviewId = String(form.get('reviewId') ?? '');
  if (!userId) redirect(`/login?returnTo=/exchanges/${encodeURIComponent(exchangeId)}/review`);
  const { reputation } = services();
  const result = await reputation.respondToReview(userId, reviewId, {
    text: String(form.get('text') ?? ''),
  });
  if (!result.ok) return { errors: result.errors };
  redirect(`/exchanges/${exchangeId}/review`);
}

const REPORT_REASONS = [
  'haram-content', 'medical-legal', 'money-request', 'stolen-goods', 'spam-commercial',
  'harassment', 'unsafe-behavior', 'policy-academic', 'other',
] as const;

export async function reportAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const targetType = String(form.get('targetType') ?? '');
  const targetId = String(form.get('targetId') ?? '');
  const userId = await sessionUserId();
  if (!userId) {
    const back = targetType && targetId
      ? `/reports/new?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`
      : '/reports/new';
    redirect(`/login?returnTo=${encodeURIComponent(back)}`);
  }
  if (targetType !== 'listing' && targetType !== 'user') {
    return { errors: [{ code: 'invalid', field: 'targetType', message: 'Report target must be a listing or a user.' }] };
  }
  const reasonCode = String(form.get('reasonCode') ?? '');
  if (!(REPORT_REASONS as readonly string[]).includes(reasonCode)) {
    return { errors: [{ code: 'invalid', field: 'reasonCode', message: 'Choose a valid reason code.' }] };
  }
  const images = ['image1', 'image2', 'image3']
    .map((k) => String(form.get(k) ?? '').trim())
    .filter(Boolean);
  const { moderation } = services();
  const result = await moderation.report(userId, {
    targetType,
    targetId,
    reasonCode: reasonCode as (typeof REPORT_REASONS)[number],
    description: String(form.get('description') ?? ''),
    images,
  });
  if (!result.ok) return { errors: result.errors };
  redirect('/reports');
}

export async function triageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  if (!userId) redirect('/login?returnTo=/moderation');
  const decision = String(form.get('decision') ?? '');
  if (decision !== 'acknowledge' && decision !== 'resolve') {
    return { errors: [{ code: 'invalid', field: 'decision', message: 'Choose acknowledge or resolve.' }] };
  }
  const { moderation } = services();
  const result = await moderation.triage(String(form.get('reportId') ?? ''), userId, decision);
  if (!result.ok) return { errors: result.errors };
  redirect('/moderation');
}

const SANCTION_ACTIONS = ['hide', 'unhide', 'warn', 'suspend', 'ban', 'clear-restriction'] as const;

export async function sanctionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  if (!userId) redirect('/login?returnTo=/moderation');
  const action = String(form.get('sanctionAction') ?? '');
  if (!(SANCTION_ACTIONS as readonly string[]).includes(action)) {
    return { errors: [{ code: 'invalid', field: 'sanctionAction', message: 'Choose a valid sanction.' }] };
  }
  const targetType = String(form.get('targetType') ?? '');
  if (targetType !== 'listing' && targetType !== 'user') {
    return { errors: [{ code: 'invalid', field: 'targetType', message: 'Sanction target must be a listing or a user.' }] };
  }
  const { moderation } = services();
  if (action === 'unhide') {
    const result = await moderation.unhide(userId, String(form.get('targetId') ?? ''), String(form.get('reason') ?? ''));
    if (!result.ok) return { errors: result.errors };
    redirect('/moderation');
  }
  if (action === 'clear-restriction') {
    const result = await moderation.clearRestriction(userId, String(form.get('targetId') ?? ''), String(form.get('reason') ?? ''));
    if (!result.ok) return { errors: result.errors };
    redirect('/moderation');
  }
  const result = await moderation.sanction(userId, {
    action: action as 'hide' | 'warn' | 'suspend' | 'ban',
    targetType,
    targetId: String(form.get('targetId') ?? ''),
    reason: String(form.get('reason') ?? ''),
  });
  if (!result.ok) return { errors: result.errors };
  redirect('/moderation');
}

export async function escalateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  if (!userId) redirect('/login?returnTo=/moderation');
  const ownerId = process.env['MODERATION_OWNER_ID'];
  if (!ownerId) {
    return {
      errors: [{
        code: 'not-configured', field: 'ownerApprovedBy',
        message: 'Law-enforcement handover is unavailable: no owner approver is configured (MODERATION_OWNER_ID).',
      }],
    };
  }
  const { moderation } = services();
  const result = await moderation.escalate(String(form.get('reportId') ?? ''), userId, { ownerApprovedBy: ownerId });
  if (!result.ok) return { errors: result.errors };
  redirect('/moderation');
}

export async function markReadAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  if (!userId) redirect('/login?returnTo=/notifications');
  const { notify } = services();
  await notify.markRead(userId, String(form.get('notificationId') ?? ''));
  redirect('/notifications');
}

export async function markAllReadAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const userId = await sessionUserId();
  if (!userId) redirect('/login?returnTo=/notifications');
  const { notify } = services();
  await notify.markAllRead(userId);
  redirect('/notifications');
}
