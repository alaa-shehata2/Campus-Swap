import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Restriction, Role, UserPublic } from './types.js';

export interface StoredUser extends UserPublic {
  email: string;
  passwordHash: string;
  passwordSalt: string;
  deactivated: boolean;
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

/** In-memory user store. Repository seam: swap for MySQL (ADR-0002) without touching the service. */
export class IdentityStore {
  private byId = new Map<string, StoredUser>();
  private emailToId = new Map<string, string>();
  /** `${a}:${b}` means a blocked-or-muted b (FR-M-6). */
  private blocked = new Set<string>();
  private muted = new Set<string>();

  create(data: {
    email: string;
    password: string;
    displayName: string;
    campus: string;
    role?: Role;
  }): StoredUser {
    const salt = randomUUID().replace(/-/g, '');
    const user: StoredUser = {
      id: randomUUID(),
      email: data.email.toLowerCase(),
      passwordHash: hashPassword(data.password, salt),
      passwordSalt: salt,
      displayName: data.displayName,
      campus: data.campus,
      campusVerified: false,
      joinDate: new Date().toISOString(),
      completedExchangeCount: 0,
      role: data.role ?? 'member',
      restriction: 'none' as Restriction,
      deactivated: false,
    };
    this.byId.set(user.id, user);
    this.emailToId.set(user.email, user.id);
    return user;
  }

  findByEmail(email: string): StoredUser | undefined {
    const id = this.emailToId.get(email.toLowerCase());
    const user = id ? this.byId.get(id) : undefined;
    return user ? { ...user } : undefined;
  }

  findById(id: string): StoredUser | undefined {
    const user = this.byId.get(id);
    return user ? { ...user } : undefined;
  }

  hasModerator(): boolean {
    for (const u of this.byId.values()) {
      if (u.role === 'moderator') return true;
    }
    return false;
  }

  /** Headline user stats for pilot metrics (NFR-O-1). */
  stats(): {
    total: number;
    active: number;
    deactivated: number;
    suspended: number;
    banned: number;
    moderators: number;
  } {
    const s = { total: 0, active: 0, deactivated: 0, suspended: 0, banned: 0, moderators: 0 };
    for (const u of this.byId.values()) {
      s.total += 1;
      if (u.deactivated) s.deactivated += 1;
      else if (u.restriction === 'suspended') s.suspended += 1;
      else if (u.restriction === 'banned') s.banned += 1;
      else s.active += 1;
      if (u.role === 'moderator') s.moderators += 1;
    }
    return s;
  }

  verifyPassword(user: StoredUser, password: string): boolean {
    const attempt = scryptSync(password, user.passwordSalt, 64);
    const expected = Buffer.from(user.passwordHash, 'hex');
    return attempt.length === expected.length && timingSafeEqual(attempt, expected);
  }

  save(user: StoredUser): void {
    this.byId.set(user.id, user);
  }

  /** Full-fidelity export (includes salted password hashes — handle like a DB dump). */
  exportState(): {
    users: StoredUser[];
    blocked: string[];
    muted: string[];
  } {
    return {
      users: [...this.byId.values()].map((u) => ({ ...u })),
      blocked: [...this.blockedPairs()],
      muted: [...this.mutedPairs()],
    };
  }

  importState(state: { users: StoredUser[]; blocked: string[]; muted: string[] }): void {
    if (!state || !Array.isArray(state.users)) throw new Error('Invalid identity snapshot.');
    this.byId.clear();
    this.emailToId.clear();
    this.blocked.clear();
    this.muted.clear();
    for (const u of state.users) {
      this.byId.set(u.id, { ...u });
      this.emailToId.set(u.email, u.id);
    }
    for (const b of state.blocked ?? []) this.blocked.add(b);
    for (const m of state.muted ?? []) this.muted.add(m);
  }

  private pairKey(a: string, b: string): string {
    return `${a}:${b}`;
  }

  addBlock(a: string, b: string): void {
    this.blocked.add(this.pairKey(a, b));
  }

  removeBlock(a: string, b: string): void {
    this.blocked.delete(this.pairKey(a, b));
  }

  addMute(a: string, b: string): void {
    this.muted.add(this.pairKey(a, b));
  }

  removeMute(a: string, b: string): void {
    this.muted.delete(this.pairKey(a, b));
  }

  isBlockedOrMuted(a: string, b: string): boolean {
    return (
      this.blocked.has(this.pairKey(a, b)) ||
      this.blocked.has(this.pairKey(b, a)) ||
      this.muted.has(this.pairKey(a, b)) ||
      this.muted.has(this.pairKey(b, a))
    );
  }

  private blockedPairs(): string[] {
    return [...this.blocked];
  }

  private mutedPairs(): string[] {
    return [...this.muted];
  }
}
