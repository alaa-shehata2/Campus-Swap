import { fail, ok, type FieldError, type Result } from '../common/errors.js';
import { ModerationStore } from './store.js';
import type {
  AuditEntry,
  Handover,
  ReasonCode,
  Report,
  ReportStatus,
  Sanction,
  SanctionAction,
} from './types.js';
import type { Listing } from '../listings/types.js';
import type { Restriction, UserPublic } from '../identity/types.js';
import type { Exchange, Message } from '../exchanges/types.js';
import type { NotifyPort } from '../notifications/types.js';
import type { Review } from '../reputation/types.js';

export const MAX_REPORT_IMAGES = 3;
export const MIN_OTHER_DESCRIPTION = 20;

const REASON_CODES: ReasonCode[] = [
  'haram-content',
  'medical-legal',
  'money-request',
  'stolen-goods',
  'spam-commercial',
  'harassment',
  'unsafe-behavior',
  'policy-academic',
  'other',
];

const SANCTION_ACTIONS: SanctionAction[] = ['hide', 'unhide', 'warn', 'suspend', 'ban', 'clear-restriction'];
const MEMBER_SANCTIONS: SanctionAction[] = ['hide', 'warn', 'suspend', 'ban'];

export interface ModerationDeps {
  listings: {
    get(id: string): Listing | undefined;
    systemHide(id: string): Result<Listing>;
    systemUnhide(id: string): Result<Listing>;
  };
  identity: {
    getProfile(id: string): UserPublic | undefined;
    restrict(userId: string, restriction: Restriction): void;
  };
  reputation: {
    voidReview(by: string, id: string, reason: string): Result<Review>;
  };
  /** Optional: required only for case-gated thread evidence (P-4). */
  exchanges?: {
    readExchange(id: string): Exchange | undefined;
    readThread(exchangeId: string): Message[];
  };
  privacy?: {
    checkCaseAccess(
      moderatorId: string,
      hasOpenCase: boolean,
      context?: string,
    ): Result<{ granted: true; atMs: number }>;
  };
  /** Optional notification sink (FR-N-1 reporter/moderation updates). */
  notify?: NotifyPort;
}

export function createModerationService(
  deps: ModerationDeps,
  opts: { now?: () => number; store?: ModerationStore } = {},
) {
  const store = opts.store ?? new ModerationStore();
  const now = opts.now ?? Date.now;

  /** Only moderators wield triage/sanction/escalate powers (S-2). */
  function requireModerator(actor: string): FieldError | undefined {
    const profile = deps.identity.getProfile(actor);
    if (!profile || profile.role !== 'moderator') {
      return { code: 'not-permitted', message: 'Only moderators can perform this action.' };
    }
    return undefined;
  }

  function report(
    reporterId: string,
    input: {
      targetType: 'listing' | 'user';
      targetId: string;
      reasonCode: ReasonCode;
      description: string;
      images: string[];
    },
  ): Result<Report> {
    if (!deps.identity.getProfile(reporterId)) {
      return fail([{ code: 'not-found', message: 'Reporter not found.' }]);
    }
    const targetExists =
      input.targetType === 'listing'
        ? deps.listings.get(input.targetId) !== undefined
        : deps.identity.getProfile(input.targetId) !== undefined;
    if (!targetExists) {
      return fail([{ code: 'not-found', message: 'Report target not found.' }]);
    }
    if (!REASON_CODES.includes(input.reasonCode)) {
      return fail([
        { code: 'invalid', field: 'reasonCode', message: 'Unknown report reason code.' },
      ]);
    }
    const description = input.description?.trim() ?? '';
    if (!description) {
      return fail([{ code: 'required', field: 'description', message: 'A description is required.' }]);
    }
    if (input.reasonCode === 'other' && description.length < MIN_OTHER_DESCRIPTION) {
      return fail([
        {
          code: 'too-short',
          field: 'description',
          message: `Describe "other" reports in at least ${MIN_OTHER_DESCRIPTION} characters.`,
        },
      ]);
    }
    if (!Array.isArray(input.images) || input.images.length > MAX_REPORT_IMAGES) {
      return fail([
        {
          code: 'too-many',
          field: 'images',
          message: `Reports allow at most ${MAX_REPORT_IMAGES} images.`,
        },
      ]);
    }
    const atMs = now();
    const created = store.insertReport({
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reasonCode: input.reasonCode,
      description,
      images: [...input.images],
      status: 'Received',
      createdAtMs: atMs,
      history: [{ status: 'Received', atMs }],
      escalated: false,
    });
    // Stolen-item path (FR-M-5): hide-first, then moderator review.
    // The case opens even if hiding fails (e.g. already archived) so
    // evidence access never silently degrades.
    if (input.reasonCode === 'stolen-goods' && input.targetType === 'listing') {
      deps.listings.systemHide(input.targetId);
      created.escalated = true;
      created.status = 'Under review';
      created.history.push({ status: 'Under review', atMs });
      store.openCase(created.id);
      store.saveReport(created);
    }
    deps.notify?.emit(reporterId, 'report-status', created.id);
    return ok(created);
  }

  function getReport(id: string): Report | undefined {
    return store.getReport(id);
  }

  /** Triage: Received → Under review → Resolved (FR-M-3). Opens/closes the case. */
  function triage(
    id: string,
    moderatorId: string,
    decision: 'acknowledge' | 'resolve',
  ): Result<Report> {
    const gate = requireModerator(moderatorId);
    if (gate) return fail([gate]);
    const r = store.getReport(id);
    if (!r) return fail([{ code: 'not-found', message: 'Report not found.' }]);
    const next: ReportStatus | undefined =
      decision === 'acknowledge'
        ? r.status === 'Received'
          ? 'Under review'
          : undefined
        : r.status === 'Under review'
          ? 'Resolved'
          : undefined;
    if (!next) {
      return fail([
        { code: 'invalid-transition', message: `Cannot ${decision} a ${r.status} report.` },
      ]);
    }
    r.status = next;
    r.history.push({ status: next, atMs: now(), by: moderatorId });
    if (next === 'Under review') store.openCase(id);
    else store.closeCase(id);
    store.saveReport(r);
    deps.notify?.emit(r.reporterId, 'report-status', id);
    return ok(r);
  }

  /** Sanctions (FR-M-4). Every action audit-logged with actor + reason + timestamp (S-5). */
  function sanction(
    actor: string,
    input: { action: SanctionAction; targetType: 'listing' | 'user'; targetId: string; reason: string },
  ): Result<Sanction> {
    const gate = requireModerator(actor);
    if (gate) return fail([gate]);
    if (!MEMBER_SANCTIONS.includes(input.action)) {
      return fail([{ code: 'invalid', field: 'action', message: 'Unknown sanction action.' }]);
    }
    if (!input.reason?.trim()) {
      return fail([{ code: 'required', field: 'reason', message: 'A sanction reason is required.' }]);
    }
    if (input.action === 'hide') {
      if (input.targetType !== 'listing') {
        return fail([{ code: 'invalid', field: 'targetType', message: 'Hide applies to listings.' }]);
      }
      const hidden = deps.listings.systemHide(input.targetId);
      if (!hidden.ok) return hidden as Result<Sanction>;
    } else {
      if (input.targetType !== 'user' || !deps.identity.getProfile(input.targetId)) {
        return fail([{ code: 'not-found', message: 'Sanction target user not found.' }]);
      }
      if (input.action === 'suspend') deps.identity.restrict(input.targetId, 'suspended');
      if (input.action === 'ban') deps.identity.restrict(input.targetId, 'banned');
    }
    const created = store.addSanction({
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason.trim(),
      actor,
      atMs: now(),
    });
    // Reported party notified only on action (FR-M-3): mere reports stay silent.
    const notifyTarget =
      input.targetType === 'user'
        ? input.targetId
        : deps.listings.get(input.targetId)?.ownerId;
    if (notifyTarget) deps.notify?.emit(notifyTarget, 'moderation-action', created.id);
    return ok(created);
  }

  /** Lift a user restriction (unsuspend/unban). Moderator-guarded and audit-logged. */
  function clearRestriction(actor: string, userId: string, reason: string): Result<Sanction> {
    const gate = requireModerator(actor);
    if (gate) return fail([gate]);
    if (!deps.identity.getProfile(userId)) {
      return fail([{ code: 'not-found', message: 'User not found.' }]);
    }
    if (!reason?.trim()) {
      return fail([{ code: 'required', field: 'reason', message: 'A reason is required.' }]);
    }
    deps.identity.restrict(userId, 'none');
    const created = store.addSanction({
      action: 'clear-restriction',
      targetType: 'user',
      targetId: userId,
      reason: reason.trim(),
      actor,
      atMs: now(),
    });
    deps.notify?.emit(userId, 'moderation-action', created.id);
    return ok(created);
  }

  /** Reverse a hide (appeal upheld). Parks the listing as Paused; audit-logged. */
  function unhide(actor: string, listingId: string, reason: string): Result<Sanction> {
    const gate = requireModerator(actor);
    if (gate) return fail([gate]);
    if (!reason?.trim()) {
      return fail([{ code: 'required', field: 'reason', message: 'An unhide reason is required.' }]);
    }
    const restored = deps.listings.systemUnhide(listingId);
    if (!restored.ok) return restored as Result<Sanction>;
    const created = store.addSanction({
      action: 'unhide',
      targetType: 'listing',
      targetId: listingId,
      reason: reason.trim(),
      actor,
      atMs: now(),
    });
    if (restored.value.ownerId) deps.notify?.emit(restored.value.ownerId, 'moderation-action', created.id);
    return ok(created);
  }

  /** Void an abusive review (FR-M-4). Delegates to reputation; void is logged. */
  function voidReview(actor: string, reviewId: string, reason: string): Result<Review> {
    const gate = requireModerator(actor);
    if (gate) return fail([gate]);
    const voided = deps.reputation.voidReview(actor, reviewId, reason);
    if (!voided.ok) return voided;
    store.addVoid({ reviewId, by: actor, reason: reason.trim(), atMs: now() });
    return voided;
  }

  /**
   * Law-enforcement handover for stolen items (FR-M-5). Requires verifiable
   * owner (human developer) approval: the approver must be a moderator other
   * than the escalating moderator (separation of duties — the moderation lead
   * owns handover decisions per D14). Both identities are recorded in the
   * handover log; the HTTP layer binds caller/mod/approver ids to verified
   * sessions, which is what makes the separation real (in-process callers
   * could otherwise name any id). Evidence is preserved immutably in the
   * handover log. No delete APIs exist, so post-escalation deletion is
   * impossible by construction.
   */
  function escalate(
    reportId: string,
    moderatorId: string,
    input: { ownerApprovedBy: string },
  ): Result<Handover> {
    const gate = requireModerator(moderatorId);
    if (gate) return fail([gate]);
    const r = store.getReport(reportId);
    if (!r) return fail([{ code: 'not-found', message: 'Report not found.' }]);
    if (!r.escalated || r.status !== 'Under review') {
      return fail([
        { code: 'invalid-transition', message: 'Only escalated reports under review can be handed over.' },
      ]);
    }
    const approver = deps.identity.getProfile(input.ownerApprovedBy);
    if (!approver || approver.role !== 'moderator' || input.ownerApprovedBy === moderatorId) {
      return fail([
        {
          code: 'handover-approval-required',
          message:
            'Law-enforcement handover requires approval by the owner ' +
            '(a moderator other than the escalating moderator).',
        },
      ]);
    }
    const atMs = now();
    const handover = store.addHandover({
      reportId,
      by: moderatorId,
      atMs,
      evidence: {
        reasonCode: r.reasonCode,
        description: r.description,
        images: [...r.images],
        history: r.history.map((h) => ({ ...h })),
        reporterId: r.reporterId,
        targetType: r.targetType,
        targetId: r.targetId,
      },
    });
    r.status = 'Resolved';
    r.history.push({ status: 'Resolved', atMs, by: moderatorId });
    store.closeCase(reportId);
    store.saveReport(r);
    deps.notify?.emit(r.reporterId, 'report-status', reportId);
    return ok(handover);
  }

  /**
   * Purpose-scoped thread evidence (P-4): allowed only when an open
   * (Under review) report targets one of the exchange's listings or a
   * participant. Every check is logged with its context.
   */
  function viewThread(moderatorId: string, exchangeId: string): Result<Message[]> {
    if (!deps.exchanges || !deps.privacy) {
      return fail([{ code: 'not-configured', message: 'Thread evidence is not configured.' }]);
    }
    const gateMod = requireModerator(moderatorId);
    if (gateMod) return fail([gateMod]);
    const exchange = deps.exchanges.readExchange(exchangeId);
    if (!exchange) return fail([{ code: 'not-found', message: 'Exchange not found.' }]);
    const participants = [exchange.participantA, exchange.participantB];
    const scoped = store.openReports().some(
      (r) =>
        (r.targetType === 'listing' && exchange.listingIds.includes(r.targetId)) ||
        (r.targetType === 'user' && participants.includes(r.targetId)),
    );
    const gate = deps.privacy.checkCaseAccess(moderatorId, scoped, `thread:${exchangeId}`);
    if (!gate.ok) return gate;
    return ok(deps.exchanges.readThread(exchangeId));
  }

  function auditLog(): AuditEntry[] {
    const entries: AuditEntry[] = [
      ...store.getSanctions().map((s) => ({ kind: 'sanction' as const, ...s })),
      ...store.getVoids().map((v) => ({ kind: 'void' as const, ...v })),
      ...store.getHandovers().map((h) => ({ kind: 'handover' as const, ...h })),
    ];
    return entries.sort((a, b) => a.atMs - b.atMs);
  }

  return { report, getReport, triage, sanction, unhide, clearRestriction, voidReview, escalate, viewThread, auditLog, store };
}

export type ModerationService = ReturnType<typeof createModerationService>;
