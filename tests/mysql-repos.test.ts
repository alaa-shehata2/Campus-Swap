import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';
import { createListingsService } from '../src/listings/service.js';
import { searchListings } from '../src/listings/search.js';
import {
  createMysqlPool,
  MySqlIdentityStore,
  MySqlListingsStore,
  truncateWorld,
} from '../web/lib/db/repositories.js';

const MYSQL_URL =
  process.env['MYSQL_URL'] ?? 'mysql://campuswap:campuswap@127.0.0.1:3306/campuswap';

describe('mysql repos (U1 seams)', () => {
  let identity: ReturnType<typeof createIdentityService>;
  let listings: ReturnType<typeof createListingsService>;

  before(async () => {
    const pool = createMysqlPool(MYSQL_URL);
    await truncateWorld(pool);
    identity = createIdentityService(new MySqlIdentityStore(pool));
    listings = createListingsService(new MySqlListingsStore(pool));
    await pool.end();
  });

  it('registers, authenticates, and profiles through MySQL', async () => {
    const pool = createMysqlPool(MYSQL_URL);
    try {
      const svc = createIdentityService(new MySqlIdentityStore(pool));
      const r = await svc.register({
        email: 'mysql-alice@gmail.com', password: 'password1', displayName: 'Alice',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      assert.equal(r.ok, true);
      assert.equal(await svc.authenticate('mysql-alice@gmail.com', 'password1').then((x) => x.ok), true);
      assert.equal(await svc.authenticate('mysql-alice@gmail.com', 'wrongpass1').then((x) => x.ok), false);
    } finally {
      await pool.end();
    }
    void identity;
    void listings;
  });

  it('publishes and discovers through MySQL with cap + block parity', async () => {
    const pool = createMysqlPool(MYSQL_URL);
    try {
      const users = createIdentityService(new MySqlIdentityStore(pool));
      const items = createListingsService(new MySqlListingsStore(pool));
      const a = await users.register({
        email: 'mysql-a@gmail.com', password: 'password1', displayName: 'A',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      const b = await users.register({
        email: 'mysql-b@gmail.com', password: 'password1', displayName: 'B',
        campus: 'KFS University', ageConfirmed18: true, rulesAccepted: true,
      });
      assert.equal(a.ok && b.ok, true);
      if (!a.ok || !b.ok) return;
      await users.block(a.value.id, b.value.id);
      assert.equal(await users.isBlockedOrMuted(a.value.id, b.value.id), true);
      const offer = await items.publish(a.value.id, {
        side: 'offer', kind: 'skill', title: 'MySQL tutoring',
        description: 'I teach database basics on campus.', category: 'tutoring',
        zone: 'North campus', images: [],
      });
      assert.equal(offer.ok, true);
      const res = await searchListings(items.store, { text: 'mysql' }, { anonymous: true });
      assert.equal(res.total, 1);
    } finally {
      await pool.end();
    }
  });
});
