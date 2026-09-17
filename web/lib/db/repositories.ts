import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { hashPassword, newSalt, verifyPasswordHash } from '../../../src/identity/crypto.js';
import type { Restriction, Role } from '../../../src/identity/types.js';
import type { StoredUser } from '../../../src/identity/store.js';
import type { Listing } from '../../../src/listings/types.js';

export function createMysqlPool(url: string): Pool {
  return mysql.createPool(url);
}

function num(v: unknown): number {
  return typeof v === 'string' ? Number(v) : (v as number);
}

function bool(v: unknown): boolean {
  return v === 1 || v === true;
}

function json<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

function mapUser(row: RowDataPacket): StoredUser {
  return {
    id: row['id'] as string,
    email: row['email'] as string,
    passwordHash: row['password_hash'] as string,
    passwordSalt: row['password_salt'] as string,
    displayName: row['display_name'] as string,
    campus: row['campus'] as string,
    campusVerified: false,
    joinDate: row['join_date'] as string,
    completedExchangeCount: num(row['completed_exchange_count']),
    bio: (row['bio'] as string | null) ?? undefined,
    skillTags: json<string[] | undefined>(row['skill_tags'], undefined),
    availabilityNotes: (row['availability_notes'] as string | null) ?? undefined,
    role: row['role'] as Role,
    restriction: row['restriction'] as Restriction,
    deactivated: bool(row['deactivated']),
  };
}

function mapListing(row: RowDataPacket): Listing {
  return {
    id: row['id'] as string,
    ownerId: row['owner_id'] as string,
    side: row['side'] as Listing['side'],
    kind: row['kind'] as Listing['kind'],
    title: row['title'] as string,
    description: row['description'] as string,
    category: row['category'] as Listing['category'],
    zone: row['zone'] as string,
    availability: (row['availability'] as string | null) ?? undefined,
    images: json<string[]>(row['images'], []),
    status: row['status'] as Listing['status'],
    modality: (row['modality'] as Listing['modality']) ?? undefined,
    returnTerm: (row['return_term'] as string | null) ?? undefined,
    counterpartDescription: (row['counterpart_description'] as string | null) ?? undefined,
    createdAt: row['created_at'] as string,
  };
}

/** MySQL-backed identity store. Same API as the in-memory IdentityStore. */
export class MySqlIdentityStore {
  constructor(private pool: Pool) {}

  async create(data: {
    email: string;
    password: string;
    displayName: string;
    campus: string;
    role?: Role;
  }): Promise<StoredUser> {
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
    await this.pool.execute(
      `INSERT INTO users (id, email, password_hash, password_salt, display_name, campus,
        campus_verified, join_date, completed_exchange_count, bio, skill_tags,
        availability_notes, role, restriction, deactivated)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, NULL, NULL, NULL, ?, 'none', 0)`,
      [user.id, user.email, user.passwordHash, user.passwordSalt, user.displayName, user.campus, user.joinDate, user.role],
    );
    return { ...user };
  }

  async findByEmail(email: string): Promise<StoredUser | undefined> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase()],
    );
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async findById(id: string): Promise<StoredUser | undefined> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async hasModerator(): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT 1 FROM users WHERE role = 'moderator' LIMIT 1",
    );
    return rows.length > 0;
  }

  async stats(): Promise<{
    total: number;
    active: number;
    deactivated: number;
    suspended: number;
    banned: number;
    moderators: number;
  }> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS total,
        SUM(deactivated) AS deactivated,
        SUM(restriction = 'suspended' AND NOT deactivated) AS suspended,
        SUM(restriction = 'banned' AND NOT deactivated) AS banned,
        SUM(role = 'moderator') AS moderators
       FROM users`,
    );
    const r = rows[0]!;
    const total = num(r['total']);
    const deactivated = num(r['deactivated']);
    const suspended = num(r['suspended']);
    const banned = num(r['banned']);
    return {
      total,
      active: total - deactivated - suspended - banned,
      deactivated,
      suspended,
      banned,
      moderators: num(r['moderators']),
    };
  }

  verifyPassword(user: StoredUser, password: string): boolean {
    return verifyPasswordHash(password, user.passwordSalt, user.passwordHash);
  }

  async save(user: StoredUser): Promise<void> {
    await this.pool.execute(
      `UPDATE users SET email = ?, password_hash = ?, password_salt = ?, display_name = ?,
        campus = ?, bio = ?, skill_tags = ?, availability_notes = ?, role = ?,
        restriction = ?, deactivated = ?, completed_exchange_count = ? WHERE id = ?`,
      [
        user.email, user.passwordHash, user.passwordSalt, user.displayName, user.campus,
        user.bio ?? null, user.skillTags ? JSON.stringify(user.skillTags) : null,
        user.availabilityNotes ?? null, user.role, user.restriction,
        user.deactivated ? 1 : 0, user.completedExchangeCount, user.id,
      ],
    );
  }

  async exportState(): Promise<{ users: StoredUser[]; blocked: string[]; muted: string[] }> {
    const [urows] = await this.pool.execute<RowDataPacket[]>('SELECT * FROM users');
    const [brows] = await this.pool.execute<RowDataPacket[]>('SELECT owner_id, other_id, kind FROM blocks');
    const blocked: string[] = [];
    const muted: string[] = [];
    for (const b of brows) {
      const key = `${b['owner_id'] as string}:${b['other_id'] as string}`;
      if (b['kind'] === 'block') blocked.push(key);
      else muted.push(key);
    }
    return { users: urows.map(mapUser), blocked, muted };
  }

  async importState(state: { users: StoredUser[]; blocked: string[]; muted: string[] }): Promise<void> {
    if (!state || !Array.isArray(state.users)) throw new Error('Invalid identity snapshot.');
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM blocks');
      await conn.execute('DELETE FROM sessions');
      await conn.execute('DELETE FROM users');
      for (const u of state.users) {
        await conn.execute(
          `INSERT INTO users (id, email, password_hash, password_salt, display_name, campus,
            campus_verified, join_date, completed_exchange_count, bio, skill_tags,
            availability_notes, role, restriction, deactivated)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [u.id, u.email, u.passwordHash, u.passwordSalt, u.displayName, u.campus, u.joinDate,
            u.completedExchangeCount, u.bio ?? null,
            u.skillTags ? JSON.stringify(u.skillTags) : null, u.availabilityNotes ?? null,
            u.role, u.restriction, u.deactivated ? 1 : 0],
        );
      }
      for (const key of state.blocked ?? []) {
        const [a, b] = key.split(':');
        await conn.execute("INSERT INTO blocks (owner_id, other_id, kind) VALUES (?, ?, 'block')", [a, b]);
      }
      for (const key of state.muted ?? []) {
        const [a, b] = key.split(':');
        await conn.execute("INSERT INTO blocks (owner_id, other_id, kind) VALUES (?, ?, 'mute')", [a, b]);
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async addBlock(a: string, b: string): Promise<void> {
    await this.pool.execute(
      "INSERT IGNORE INTO blocks (owner_id, other_id, kind) VALUES (?, ?, 'block')",
      [a, b],
    );
  }

  async removeBlock(a: string, b: string): Promise<void> {
    await this.pool.execute(
      "DELETE FROM blocks WHERE owner_id = ? AND other_id = ? AND kind = 'block'",
      [a, b],
    );
  }

  async addMute(a: string, b: string): Promise<void> {
    await this.pool.execute(
      "INSERT IGNORE INTO blocks (owner_id, other_id, kind) VALUES (?, ?, 'mute')",
      [a, b],
    );
  }

  async removeMute(a: string, b: string): Promise<void> {
    await this.pool.execute(
      "DELETE FROM blocks WHERE owner_id = ? AND other_id = ? AND kind = 'mute'",
      [a, b],
    );
  }

  async isBlockedOrMuted(a: string, b: string): Promise<boolean> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT 1 FROM blocks WHERE (owner_id = ? AND other_id = ?) OR (owner_id = ? AND other_id = ?) LIMIT 1',
      [a, b, b, a],
    );
    return rows.length > 0;
  }

  async saveSession(token: string, userId: string): Promise<void> {
    await this.pool.execute(
      'INSERT INTO sessions (token, user_id, created_at_ms) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)',
      [token, userId, Date.now()],
    );
  }

  async findSession(token: string): Promise<string | undefined> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT user_id FROM sessions WHERE token = ? LIMIT 1',
      [token],
    );
    return rows[0] ? (rows[0]['user_id'] as string) : undefined;
  }

  async deleteSession(token: string): Promise<void> {
    await this.pool.execute('DELETE FROM sessions WHERE token = ?', [token]);
  }

  async deleteSessionsByUser(userId: string): Promise<void> {
    await this.pool.execute('DELETE FROM sessions WHERE user_id = ?', [userId]);
  }
}

/** MySQL-backed listings store. Same API as the in-memory ListingsStore. */
export class MySqlListingsStore {
  constructor(private pool: Pool) {}

  async insert(listing: Omit<Listing, 'id' | 'createdAt'>): Promise<Listing> {
    const full: Listing = { ...listing, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.pool.execute(
      `INSERT INTO listings (id, owner_id, side, kind, title, description, category, zone,
        availability, images, status, modality, return_term, counterpart_description,
        created_at_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [full.id, full.ownerId, full.side, full.kind, full.title, full.description, full.category,
        full.zone, full.availability ?? null, JSON.stringify(full.images), full.status,
        full.modality ?? null, full.returnTerm ?? null, full.counterpartDescription ?? null,
        Date.parse(full.createdAt), full.createdAt],
    );
    return { ...full, images: [...full.images] };
  }

  async get(id: string): Promise<Listing | undefined> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT * FROM listings WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] ? mapListing(rows[0]) : undefined;
  }

  async save(listing: Listing): Promise<void> {
    await this.pool.execute(
      `UPDATE listings SET owner_id = ?, side = ?, kind = ?, title = ?, description = ?,
        category = ?, zone = ?, availability = ?, images = ?, status = ?, modality = ?,
        return_term = ?, counterpart_description = ? WHERE id = ?`,
      [listing.ownerId, listing.side, listing.kind, listing.title, listing.description,
        listing.category, listing.zone, listing.availability ?? null, JSON.stringify(listing.images),
        listing.status, listing.modality ?? null, listing.returnTerm ?? null,
        listing.counterpartDescription ?? null, listing.id],
    );
  }

  async all(): Promise<Listing[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT * FROM listings');
    return rows.map(mapListing);
  }

  async countActiveByOwner(ownerId: string): Promise<number> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM listings WHERE owner_id = ? AND status = 'Active'",
      [ownerId],
    );
    return num(rows[0]!['n']);
  }

  async countByStatus(): Promise<Record<Listing['status'], number>> {
    const counts: Record<Listing['status'], number> = {
      Draft: 0, Active: 0, Paused: 0, Archived: 0, Hidden: 0,
    };
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT status, COUNT(*) AS n FROM listings GROUP BY status',
    );
    for (const r of rows) {
      const status = r['status'] as Listing['status'];
      counts[status] = (counts[status] ?? 0) + num(r['n']);
    }
    return counts;
  }

  async exportState(): Promise<{ items: Listing[]; order: string[] }> {    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT * FROM listings ORDER BY created_at_ms',
    );
    const items = rows.map(mapListing);
    return { items, order: items.map((l) => l.id) };
  }

  async importState(state: { items: Listing[]; order: string[] }): Promise<void> {
    if (!state || !Array.isArray(state.items) || !Array.isArray(state.order)) {
      throw new Error('Invalid listings snapshot.');
    }
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM listings');
      for (const l of state.items) {
        await conn.execute(
          `INSERT INTO listings (id, owner_id, side, kind, title, description, category, zone,
            availability, images, status, modality, return_term, counterpart_description,
            created_at_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [l.id, l.ownerId, l.side, l.kind, l.title, l.description, l.category, l.zone,
            l.availability ?? null, JSON.stringify(l.images), l.status, l.modality ?? null,
            l.returnTerm ?? null, l.counterpartDescription ?? null, Date.parse(l.createdAt), l.createdAt],
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /** Deactivation cascade is service-level (deactivateOwner); this store only persists. */
}

/** Wipe all U1 tables (FK-safe order). Test/dev only. */
export async function truncateWorld(pool: Pool): Promise<void> {
  await pool.execute('DELETE FROM blocks');
  await pool.execute('DELETE FROM sessions');
  await pool.execute('DELETE FROM listings');
  await pool.execute('DELETE FROM users');
}
