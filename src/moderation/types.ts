export type ReportTarget = 'listing' | 'user';

export type ReasonCode =
  | 'haram-content'
  | 'medical-legal'
  | 'money-request'
  | 'stolen-goods'
  | 'spam-commercial'
  | 'harassment'
  | 'unsafe-behavior'
  | 'policy-academic'
  | 'other';

export const REASON_CODES: ReasonCode[] = [
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

export const MAX_REPORT_IMAGES = 3;
export const MIN_OTHER_DESCRIPTION = 20;
export const MAX_REPORT_IMAGE_BYTES = 10 * 1024 * 1024;

export type ReportStatus = 'Received' | 'Under review' | 'Resolved';

export interface ReportInput {
  targetType: ReportTarget;
  targetId: string;
  reasonCode: ReasonCode;
  description: string;
  images: string[];
}

export interface Report extends Omit<ReportInput, 'images'> {
  id: string;
  reporterId: string;
  images: string[];
  status: ReportStatus;
  createdAtMs: number;
  history: Array<{ status: ReportStatus; atMs: number; by?: string }>;
  escalated: boolean;
}

export type SanctionAction = 'hide' | 'unhide' | 'warn' | 'suspend' | 'ban' | 'clear-restriction';

export interface Sanction {
  id: string;
  action: SanctionAction;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  actor: string;
  atMs: number;
}

export interface ReviewVoid {
  id: string;
  reviewId: string;
  by: string;
  reason: string;
  atMs: number;
}

export interface Handover {
  id: string;
  reportId: string;
  by: string;
  atMs: number;
  /** Preserved evidence snapshot (FR-M-5): report + identities, immutable. */
  evidence: {
    reasonCode: ReasonCode;
    description: string;
    images: string[];
    history: Array<{ status: ReportStatus; atMs: number; by?: string }>;
    reporterId: string;
    targetType: ReportTarget;
    targetId: string;
  };
}

export type AuditEntry =
  | ({ kind: 'sanction' } & Sanction)
  | ({ kind: 'void' } & ReviewVoid)
  | ({ kind: 'handover' } & Handover);
