export type NotificationType =
  | 'proposal-received'
  | 'proposal-accepted'
  | 'proposal-declined'
  | 'proposal-expired'
  | 'schedule-set'
  | 'schedule-changed'
  | 'completion-requested'
  | 'completion-confirmed'
  | 'cancellation'
  | 'review-available'
  | 'review-published'
  | 'review-response'
  | 'report-status'
  | 'lend-reminder'
  | 'overdue'
  | 'moderation-action';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  ref: string;
  createdAtMs: number;
  readAtMs?: number;
}

/** Sink port consumed by domain modules. In-app only — no mail transport. */
export interface NotifyPort {
  emit(userId: string, type: NotificationType, ref: string): unknown;
}
