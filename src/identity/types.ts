export type Role = 'member' | 'moderator';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  /** Required; defaults to KFS University when undefined. Empty string rejected. */
  campus?: string;
  ageConfirmed18: boolean;
  rulesAccepted: boolean;
}

/** Public profile — email is never exposed (FR-ID-3, P-2). */
export interface UserPublic {
  id: string;
  displayName: string;
  campus: string;
  /** Always false in MVP: self-declared, not verified (FR-ID-3, D1). */
  campusVerified: false;
  joinDate: string;
  completedExchangeCount: number;
  bio?: string;
  skillTags?: string[];
  availabilityNotes?: string;
  role: Role;
}

export interface Session {
  token: string;
  userId: string;
}

export interface ProfilePatch {
  displayName?: string;
  bio?: string;
  skillTags?: string[];
  availabilityNotes?: string;
}
