import { randomUUID } from 'node:crypto';
import type { NotificationItem, NotificationType } from './types.js';

/** Every FR-N-1 event lands in-app (D9: no email/SMS/push in MVP). */
export const NOTIFICATION_TYPES: NotificationType[] = [
  'proposal-received',
  'proposal-accepted',
  'proposal-declined',
  'proposal-expired',
  'schedule-set',
  'schedule-changed',
  'completion-requested',
  'completion-confirmed',
  'cancellation',
  'review-available',
  'review-published',
  'review-response',
  'report-status',
  'lend-reminder',
  'overdue',
  'moderation-action',
];

const DAY_MS = 24 * 60 * 60 * 1000;

export type LendReminderKind = 'T-3d' | 'T+0' | 'T+3d' | 'overdue';

/**
 * Pure lend-reminder schedule vs a return date (FR-N-1).
 * NOTE: listing lend terms are free text in Phases 1–2, so callers pass an
 * explicit return date; capturing a structured return date at lend time is
 * future work.
 */
export function lendReminderKind(returnDateMs: number, nowMs: number): LendReminderKind | undefined {
  const diffDays = Math.round((nowMs - returnDateMs) / DAY_MS);
  if (diffDays === -3) return 'T-3d';
  if (diffDays === 0) return 'T+0';
  if (diffDays === 3) return 'T+3d';
  if (diffDays > 3) return 'overdue';
  return undefined;
}

/**
 * In-app inbox sink (FR-N-1). Intentionally shallow: modules emit events,
 * nothing depends on notifications. There is deliberately no mail transport.
 */
export function createNotificationsService(opts: { now?: () => number } = {}) {
  const now = opts.now ?? Date.now;
  const items: NotificationItem[] = [];

  function emit(userId: string, type: NotificationType, ref: string): NotificationItem {
    if (!NOTIFICATION_TYPES.includes(type)) throw new Error(`Unknown notification type: ${type}.`);
    const item: NotificationItem = { id: randomUUID(), userId, type, ref, createdAtMs: now() };
    items.push(item);
    return { ...item };
  }

  function inbox(userId: string): NotificationItem[] {
    return items.filter((i) => i.userId === userId).map((i) => ({ ...i }));
  }

  function unreadCount(userId: string): number {
    return items.filter((i) => i.userId === userId && i.readAtMs === undefined).length;
  }

  function markRead(userId: string, id: string): void {
    const item = items.find((i) => i.id === id && i.userId === userId);
    if (item && item.readAtMs === undefined) item.readAtMs = now();
  }

  function markAllRead(userId: string): void {
    for (const i of items) {
      if (i.userId === userId && i.readAtMs === undefined) i.readAtMs = now();
    }
  }

  return { emit, inbox, unreadCount, markRead, markAllRead };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
