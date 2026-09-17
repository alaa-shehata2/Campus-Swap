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

  verifyPassword(user: StoredUser, password: string): boolean {
    const attempt = scryptSync(password, user.passwordSalt, 64);
    const expected = Buffer.from(user.passwordHash, 'hex');
    return attempt.length === expected.length && timingSafeEqual(attempt, expected);
  }

  save(user: StoredUser): void {
    this.byId.set(user.id, user);
  }
}
