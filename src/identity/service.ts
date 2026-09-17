import { randomUUID } from 'node:crypto';
import { fail, ok, type FieldError, type Result } from '../common/errors.js';
import { IdentityStore, type StoredUser } from './store.js';
import type { ProfilePatch, RegisterInput, Restriction, Role, Session, UserPublic } from './types.js';

export const DEFAULT_CAMPUS = 'KFS University';
export const MAX_BIO_LENGTH = 500;
/** Bounds scrypt input (DoS surface); longer passwords are rejected, not truncated. */
export const MAX_PASSWORD_LENGTH = 256;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublic(user: StoredUser): UserPublic {
  const { email: _email, passwordHash: _h, passwordSalt: _s, deactivated: _d, ...rest } = user;
  void _email;
  void _h;
  void _s;
  void _d;
  return rest;
}

export function createIdentityService(store = new IdentityStore()) {
  const sessions = new Map<string, string>();
  /** Block/mute pairs. Key `${a}:${b}` means a blocked-or-muted b (FR-M-6). */
  const blocked = new Set<string>();
  const muted = new Set<string>();

  function register(input: RegisterInput): Result<UserPublic> {
    const errors: FieldError[] = [];
    const email = input.email?.trim() ?? '';

    if (!email || !EMAIL_RE.test(email)) {
      errors.push({
        code: 'invalid',
        field: 'email',
        message: 'Provide a valid email address (any domain is accepted).',
      });
    }
    if (!input.password || input.password.length < 8) {
      errors.push({
        code: 'too-short',
        field: 'password',
        message: 'Password must be at least 8 characters.',
      });
    } else if (input.password.length > MAX_PASSWORD_LENGTH) {
      errors.push({
        code: 'too-long',
        field: 'password',
        message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`,
      });
    }
    if (!input.displayName?.trim()) {
      errors.push({ code: 'required', field: 'displayName', message: 'Display name is required.' });
    }
    const campus = (input.campus ?? DEFAULT_CAMPUS).trim();
    if (!campus) {
      errors.push({
        code: 'required',
        field: 'campus',
        message: 'Campus is required (default: KFS University). It is self-declared, not verified.',
      });
    }
    if (input.ageConfirmed18 !== true) {
      errors.push({
        code: 'required',
        field: 'ageConfirmed18',
        message: 'You must confirm you are 18 or older.',
      });
    }
    if (input.rulesAccepted !== true) {
      errors.push({
        code: 'required',
        field: 'rulesAccepted',
        message: 'You must accept the community rules.',
      });
    }
    if (errors.length > 0) return fail(errors);

    if (store.findByEmail(email)) {
      return fail([
        { code: 'taken', field: 'email', message: 'An account with this email already exists.' },
      ]);
    }

    const user = store.create({
      email,
      password: input.password,
      displayName: input.displayName.trim(),
      campus,
    });
    return ok(toPublic(user));
  }

  function authenticate(email: unknown, password: unknown): Result<Session> {
    if (typeof email !== 'string' || typeof password !== 'string') {
      return fail([{ code: 'invalid-credentials', message: 'Email or password is incorrect.' }]);
    }
    const user = store.findByEmail(email.trim());
    if (!user) {
      return fail([{ code: 'invalid-credentials', message: 'Email or password is incorrect.' }]);
    }
    if (user.deactivated) {
      return fail([{ code: 'account-deactivated', message: 'This account has been deactivated.' }]);
    }
    if (password.length > MAX_PASSWORD_LENGTH || !store.verifyPassword(user, password)) {
      return fail([{ code: 'invalid-credentials', message: 'Email or password is incorrect.' }]);
    }
    if (user.restriction === 'suspended') {
      return fail([{ code: 'account-suspended', message: 'This account is suspended.' }]);
    }
    if (user.restriction === 'banned') {
      return fail([{ code: 'account-banned', message: 'This account is banned.' }]);
    }
    const token = randomUUID();
    sessions.set(token, user.id);
    return ok({ token, userId: user.id });
  }

  function getProfile(id: string): UserPublic | undefined {
    const user = store.findById(id);
    if (!user || user.deactivated) return undefined;
    return toPublic(user);
  }

  function updateProfile(id: string, patch: ProfilePatch): Result<UserPublic> {
    const user = store.findById(id);
    if (!user) return fail([{ code: 'not-found', message: 'Profile not found.' }]);
    if (patch.displayName !== undefined) {
      if (!patch.displayName.trim()) {
        return fail([
          { code: 'required', field: 'displayName', message: 'Display name cannot be empty.' },
        ]);
      }
      user.displayName = patch.displayName.trim();
    }
    if (patch.bio !== undefined) {
      if (patch.bio.length > MAX_BIO_LENGTH) {
        return fail([
          {
            code: 'too-long',
            field: 'bio',
            message: `Bio must be at most ${MAX_BIO_LENGTH} characters.`,
          },
        ]);
      }
      user.bio = patch.bio;
    }
    if (patch.skillTags !== undefined) user.skillTags = patch.skillTags;
    if (patch.availabilityNotes !== undefined) user.availabilityNotes = patch.availabilityNotes;
    store.save(user);
    return ok(toPublic(user));
  }

  /** Moderation-only: set a restriction badge (FR-M-4). HTTP layer must gate to moderators. */
  function restrict(userId: string, restriction: Restriction): void {
    if (restriction !== 'none' && restriction !== 'suspended' && restriction !== 'banned') {
      throw new Error(`Invalid restriction: ${restriction}.`);
    }
    const user = store.findById(userId);
    if (!user) throw new Error('User not found.');
    user.restriction = restriction;
    store.save(user);
    if (restriction !== 'none') revokeSessions(userId);
  }

  /** Deactivation hides the profile and blocks login immediately (P-3). */
  function deactivate(userId: string): void {
    const user = store.findById(userId);
    if (!user) throw new Error('User not found.');
    user.deactivated = true;
    store.save(user);
    revokeSessions(userId);
  }

  /**
   * Role assignment. Bootstrap (caller 'bootstrap') works only while no
   * moderator exists; afterwards the caller must be a moderator. The HTTP
   * layer must additionally gate this to the platform owner in production.
   */
  function setRole(callerId: string, userId: string, role: Role): void {
    if (role !== 'member' && role !== 'moderator') throw new Error(`Invalid role: ${role}.`);
    if (store.hasModerator()) {
      const caller = store.findById(callerId);
      if (!caller || caller.role !== 'moderator') {
        throw new Error('Only moderators can assign roles.');
      }
    }
    const user = store.findById(userId);
    if (!user) throw new Error('User not found.');
    user.role = role;
    store.save(user);
  }

  function revokeSessions(userId: string): void {
    for (const [token, id] of sessions) {
      if (id === userId) sessions.delete(token);
    }
  }

  /** Resolve a session token to its owner. HTTP layer must bind this to mutations (S-1/S-2). */
  function resolveSession(token: string): string | undefined {
    return sessions.get(token);
  }

  function logout(token: string): void {
    sessions.delete(token);
  }

  function pairKey(a: string, b: string): string {
    return `${a}:${b}`;
  }

  /** Block stops proposals/messages from that user (FR-M-6). Symmetric enforcement. */
  function block(userId: string, blockedId: string): void {
    if (userId === blockedId) throw new Error('You cannot block yourself.');
    blocked.add(pairKey(userId, blockedId));
  }

  function unblock(userId: string, blockedId: string): void {
    blocked.delete(pairKey(userId, blockedId));
  }

  function mute(userId: string, mutedId: string): void {
    if (userId === mutedId) throw new Error('You cannot mute yourself.');
    muted.add(pairKey(userId, mutedId));
  }

  function unmute(userId: string, mutedId: string): void {
    muted.delete(pairKey(userId, mutedId));
  }

  /** MVP decision: mute is enforced symmetrically like block (stops proposals/messages
   * either direction). A directional mute is post-MVP. */
  function isBlockedOrMuted(a: string, b: string): boolean {
    return (
      blocked.has(pairKey(a, b)) ||
      blocked.has(pairKey(b, a)) ||
      muted.has(pairKey(a, b)) ||
      muted.has(pairKey(b, a))
    );
  }

  return {
    register,
    authenticate,
    resolveSession,
    logout,
    getProfile,
    updateProfile,
    block,
    unblock,
    mute,
    unmute,
    isBlockedOrMuted,
    restrict,
    deactivate,
    setRole,
  };
}

export type IdentityService = ReturnType<typeof createIdentityService>;
