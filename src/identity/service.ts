import { randomUUID } from 'node:crypto';
import { fail, ok, type FieldError, type Result } from '../common/errors.js';
import { IdentityStore, type IdentityStorePort, type StoredUser } from './store.js';
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

export function createIdentityService(store: IdentityStorePort = new IdentityStore()) {
  async function register(input: RegisterInput): Promise<Result<UserPublic>> {
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

    if (await store.findByEmail(email)) {
      return fail([
        { code: 'taken', field: 'email', message: 'An account with this email already exists.' },
      ]);
    }

    const user = await store.create({
      email,
      password: input.password,
      displayName: input.displayName.trim(),
      campus,
    });
    return ok(toPublic(user));
  }

  async function authenticate(email: unknown, password: unknown): Promise<Result<Session>> {
    if (typeof email !== 'string' || typeof password !== 'string') {
      return fail([{ code: 'invalid-credentials', message: 'Email or password is incorrect.' }]);
    }
    const user = await store.findByEmail(email.trim());
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
    await store.saveSession(token, user.id);
    return ok({ token, userId: user.id });
  }

  async function getProfile(id: string): Promise<UserPublic | undefined> {
    const user = await store.findById(id);
    if (!user || user.deactivated) return undefined;
    return toPublic(user);
  }

  async function updateProfile(id: string, patch: ProfilePatch): Promise<Result<UserPublic>> {
    const user = await store.findById(id);
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
    await store.save(user);
    return ok(toPublic(user));
  }

  /** Moderation-only: set a restriction badge (FR-M-4). HTTP layer must gate to moderators. */
  async function restrict(userId: string, restriction: Restriction): Promise<void> {
    if (restriction !== 'none' && restriction !== 'suspended' && restriction !== 'banned') {
      throw new Error(`Invalid restriction: ${restriction}.`);
    }
    const user = await store.findById(userId);
    if (!user) throw new Error('User not found.');
    user.restriction = restriction;
    await store.save(user);
    if (restriction !== 'none') await revokeSessions(userId);
  }

  /** Deactivation hides the profile and blocks login immediately (P-3). */
  async function deactivate(userId: string): Promise<void> {
    const user = await store.findById(userId);
    if (!user) throw new Error('User not found.');
    user.deactivated = true;
    await store.save(user);
    await revokeSessions(userId);
  }

  /**
   * Role assignment. Bootstrap (caller 'bootstrap') works only while no
   * moderator exists; afterwards the caller must be a moderator. The HTTP
   * layer must additionally gate this to the platform owner in production.
   */
  async function setRole(callerId: string, userId: string, role: Role): Promise<void> {
    if (role !== 'member' && role !== 'moderator') throw new Error(`Invalid role: ${role}.`);
    if (await store.hasModerator()) {
      const caller = await store.findById(callerId);
      if (!caller || caller.role !== 'moderator') {
        throw new Error('Only moderators can assign roles.');
      }
    }
    const user = await store.findById(userId);
    if (!user) throw new Error('User not found.');
    user.role = role;
    await store.save(user);
  }

  async function revokeSessions(userId: string): Promise<void> {
    await store.deleteSessionsByUser(userId);
  }

  /** Resolve a session token to its owner. HTTP layer must bind this to mutations (S-1/S-2). */
  async function resolveSession(token: unknown): Promise<string | undefined> {
    if (typeof token !== 'string') return undefined;
    const userId = await store.findSession(token);
    const user = userId ? await store.findById(userId) : undefined;
    if (!user || user.deactivated || user.restriction !== 'none') {
      await store.deleteSession(token);
      return undefined;
    }
    return userId;
  }

  /** Session check for authenticated mutations (S-1): any active account holder acts, including moderators. */
  async function authorizeMemberSession(token: unknown): Promise<Result<string>> {
    const userId = await resolveSession(token);
    if (!userId) return fail([{ code: 'login-required', message: 'A valid member session is required.' }]);
    const user = await store.findById(userId);
    if (!user || (user.role !== 'member' && user.role !== 'moderator')) {
      return fail([{ code: 'not-permitted', message: 'Only member sessions can perform this action.' }]);
    }
    return ok(userId);
  }

  async function logout(token: string): Promise<void> {
    await store.deleteSession(token);
  }

  /** Block stops proposals/messages from that user (FR-M-6). Symmetric enforcement. */
  async function block(userId: string, blockedId: string): Promise<void> {
    if (userId === blockedId) throw new Error('You cannot block yourself.');
    await store.addBlock(userId, blockedId);
  }

  async function unblock(userId: string, blockedId: string): Promise<void> {
    await store.removeBlock(userId, blockedId);
  }

  async function mute(userId: string, mutedId: string): Promise<void> {
    if (userId === mutedId) throw new Error('You cannot mute yourself.');
    await store.addMute(userId, mutedId);
  }

  async function unmute(userId: string, mutedId: string): Promise<void> {
    await store.removeMute(userId, mutedId);
  }

  /** MVP decision: mute is enforced symmetrically like block (stops proposals/messages
   * either direction). A directional mute is post-MVP. */
  async function isBlockedOrMuted(a: string, b: string): Promise<boolean> {
    return store.isBlockedOrMuted(a, b);
  }

  /** Narrow read for metrics/health: headline user stats, no secrets. */
  function userStats(): ReturnType<IdentityStore['stats']> {
    return store.stats();
  }

  /** Backup/restore delegates (snapshot files are sensitive — see launch/snapshot.ts). */
  function exportUsers(): ReturnType<IdentityStore['exportState']> {
    return store.exportState();
  }

  function importUsers(state: Parameters<IdentityStore['importState']>[0]): ReturnType<IdentityStore['importState']> {
    return store.importState(state);
  }

  return {
    register,
    authenticate,
    resolveSession,
    authorizeMemberSession,
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
    userStats,
    exportUsers,
    importUsers,
  };
}

export type IdentityService = ReturnType<typeof createIdentityService>;
