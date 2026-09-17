import { randomUUID } from 'node:crypto';
import { hashPassword, newSalt, verifyPasswordHash } from './crypto.js';
import type { Restriction, Role, UserPublic } from './types.js';

export interface StoredUser extends UserPublic {
  email: string;
  passwordHash: string;
  passwordSalt: string;
  deactivated: boolean;
}

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  campus: string;
  role?: Role;
}

export interface UserStats {
  total: number;
  active: number;
  deactivated: number;
  suspended: number;
  banned: number;
  moderators: number;
}

export interface IdentityExport {
  users: StoredUser[];
  blocked: string[];
  muted: string[];
}

/** Store port — satisfied by the in-memory store and the MySQL store. */
export interface IdentityStorePort {
  create(data: CreateUserInput): Promise<StoredUser>;
  findByEmail(email: string): Promise<StoredUser | undefined>;
  findById(id: string): Promise<StoredUser | undefined>;
  hasModerator(): Promise<boolean>;
  stats(): Promise<UserStats>;
  verifyPassword(user: StoredUser, password: string): boolean;
  save(user: StoredUser): Promise<void>;
  exportState(): Promise<IdentityExport>;
  importState(state: IdentityExport): Promise<void>;
  addBlock(a: string, b: string): Promise<void>;
  removeBlock(a: string, b: string): Promise<void>;
  addMute(a: string, b: string): Promise<void>;
  removeMute(a: string, b: string): Promise<void>;
  isBlockedOrMuted(a: string, b: string): Promise<boolean>;
  saveSession(token: string, userId: string): Promise<void>;
  findSession(token: string): Promise<string | undefined>;
  deleteSession(token: string): Promise<void>;
  deleteSessionsByUser(userId: string): Promise<void>;
}

/** In-memory user store. Repository seam: swap for MySQL (ADR-0002) without touching the service. */
export class IdentityStore {
  private byId = new Map<string, StoredUser>();
  private emailToId = new Map<string, string>();
  /** `${a}:${b}` means a blocked-or-muted b (FR-M-6). */
  private blocked = new Set<string>();
  private muted = new Set<string>();
  /** Server-side sessions (token → userId). Persisted by SQL stores. */
  private sessions = new Map<string, string>();

  async create(data: CreateUserInput): Promise<StoredUser> {
    const salt = newSalt();
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

  async findByEmail(email: string): Promise<StoredUser | undefined> {
    const id = this.emailToId.get(email.toLowerCase());
    const user = id ? this.byId.get(id) : undefined;
    return user ? { ...user } : undefined;
  }

  async findById(id: string): Promise<StoredUser | undefined> {
    const user = this.byId.get(id);
    return user ? { ...user } : undefined;
  }

  async hasModerator(): Promise<boolean> {
    for (const u of this.byId.values()) {
      if (u.role === 'moderator') return true;
    }
    return false;
  }

  /** Headline user stats for pilot metrics (NFR-O-1). */
  async stats(): Promise<UserStats> {
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
    return verifyPasswordHash(password, user.passwordSalt, user.passwordHash);
  }

  async save(user: StoredUser): Promise<void> {
    this.byId.set(user.id, user);
  }

  async saveSession(token: string, userId: string): Promise<void> {
    this.sessions.set(token, userId);
  }

  async findSession(token: string): Promise<string | undefined> {
    return this.sessions.get(token);
  }

  async deleteSession(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async deleteSessionsByUser(userId: string): Promise<void> {
    for (const [token, id] of this.sessions) {
      if (id === userId) this.sessions.delete(token);
    }
  }

  /** Full-fidelity export (includes salted password hashes — handle like a DB dump). */
  async exportState(): Promise<IdentityExport> {
    return {
      users: [...this.byId.values()].map((u) => ({ ...u })),
      blocked: [...this.blockedPairs()],
      muted: [...this.mutedPairs()],
    };
  }

  async importState(state: IdentityExport): Promise<void> {
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

  async addBlock(a: string, b: string): Promise<void> {
    this.blocked.add(this.pairKey(a, b));
  }

  async removeBlock(a: string, b: string): Promise<void> {
    this.blocked.delete(this.pairKey(a, b));
  }

  async addMute(a: string, b: string): Promise<void> {
    this.muted.add(this.pairKey(a, b));
  }

  async removeMute(a: string, b: string): Promise<void> {
    this.muted.delete(this.pairKey(a, b));
  }

  async isBlockedOrMuted(a: string, b: string): Promise<boolean> {
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
