import { randomUUID } from 'node:crypto';
import { fail, ok, type FieldError, type Result } from '../common/errors.js';
import { IdentityStore, type StoredUser } from './store.js';
import type { ProfilePatch, RegisterInput, Session, UserPublic } from './types.js';

export const DEFAULT_CAMPUS = 'KFS University';
export const MAX_BIO_LENGTH = 500;
/** Bounds scrypt input (DoS surface); longer passwords are rejected, not truncated. */
export const MAX_PASSWORD_LENGTH = 256;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toPublic(user: StoredUser): UserPublic {
  const { email: _email, passwordHash: _h, passwordSalt: _s, ...rest } = user;
  void _email;
  void _h;
  void _s;
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
    if (!user || password.length > MAX_PASSWORD_LENGTH || !store.verifyPassword(user, password)) {
      return fail([{ code: 'invalid-credentials', message: 'Email or password is incorrect.' }]);
    }
    const token = randomUUID();
    sessions.set(token, user.id);
    return ok({ token, userId: user.id });
  }

  function getProfile(id: string): UserPublic | undefined {
    const user = store.findById(id);
    return user ? toPublic(user) : undefined;
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
  }  function unmute(userId: string, mutedId: string): void {
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
  };
}

export type IdentityService = ReturnType<typeof createIdentityService>;
