import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityService } from '../src/identity/service.js';

const BASE = {
  password: 'password1',
  displayName: 'Sam',
  campus: 'KFS University',
  ageConfirmed18: true,
  rulesAccepted: true,
};

describe('identity', () => {
  it('accepts gmail/yahoo/KFS emails with campus default', async () => {
    const svc = createIdentityService();
    for (const email of ['a@gmail.com', 'b@yahoo.com', 'c@kfs.edu.eg']) {
      const r = await svc.register({
        email,
        password: 'password1',
        displayName: 'Sam',
        campus: undefined,
        ageConfirmed18: true,
        rulesAccepted: true,
      });
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.value.campus, 'KFS University');
    }
  });

  it('rejects missing campus / unchecked 18+ / unaccepted rules field-specifically', async () => {
    const svc = createIdentityService();
    const r1 = await svc.register({ ...BASE, email: 'x@gmail.com', campus: '' });
    assert.equal(r1.ok, false);
    if (!r1.ok) assert.ok(r1.errors.some((e) => e.field === 'campus'));

    const r2 = await svc.register({ ...BASE, email: 'y@gmail.com', ageConfirmed18: false });
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.ok(r2.errors.some((e) => e.field === 'ageConfirmed18'));

    const r3 = await svc.register({ ...BASE, email: 'z@gmail.com', rulesAccepted: false });
    assert.equal(r3.ok, false);
    if (!r3.ok) assert.ok(r3.errors.some((e) => e.field === 'rulesAccepted'));
  });

  it('rejects duplicate email and never exposes email in profile', async () => {
    const svc = createIdentityService();
    assert.equal((await svc.register({ ...BASE, email: 'dup@gmail.com' })).ok, true);
    assert.equal((await svc.register({ ...BASE, email: 'dup@gmail.com' })).ok, false);
    const me = await svc.register({ ...BASE, email: 'me@gmail.com' });
    assert.equal(me.ok, true);
    if (me.ok) assert.ok(!('email' in me.value));
  });

  it('authenticates with password, rejects wrong password; bio cap enforced', async () => {
    const svc = createIdentityService();
    await svc.register({ ...BASE, email: 'l@gmail.com' });
    assert.equal((await svc.authenticate('l@gmail.com', 'password1')).ok, true);
    assert.equal((await svc.authenticate('l@gmail.com', 'wrongpass1')).ok, false);
    const me = await svc.authenticate('l@gmail.com', 'password1');
    assert.equal(me.ok, true);
    if (me.ok) {
      const bad = await svc.updateProfile(me.value.userId, { bio: 'x'.repeat(501) });
      assert.equal(bad.ok, false);
      const good = await svc.updateProfile(me.value.userId, { bio: 'CS junior, love bikes.' });
      assert.equal(good.ok, true);
    }
  });

  it('labels campus self-declared (not verified)', async () => {
    const svc = createIdentityService();
    const r = await svc.register({ ...BASE, email: 'sd@gmail.com' });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value.campusVerified, false);
  });

  it('sessions resolve to owner and logout revokes', async () => {
    const svc = createIdentityService();
    await svc.register({ ...BASE, email: 's@gmail.com' });
    const auth = await svc.authenticate('s@gmail.com', 'password1');
    assert.equal(auth.ok, true);
    if (!auth.ok) return;
    assert.equal(await svc.resolveSession(auth.value.token), auth.value.userId);
    await svc.logout(auth.value.token);
    assert.equal(await svc.resolveSession(auth.value.token), undefined);
  });

  it('rejects non-string credentials and over-long passwords safely', async () => {
    const svc = createIdentityService();
    await svc.register({ ...BASE, email: 'e@gmail.com' });
    assert.equal((await svc.authenticate(undefined as unknown as string, 'password1')).ok, false);
    assert.equal((await svc.authenticate('e@gmail.com', 'x'.repeat(300))).ok, false);
  });

  it('block/mute stops contact; symmetric check; self-block rejected', async () => {
    const svc = createIdentityService();
    const a = await svc.register({ ...BASE, email: 'a1@gmail.com' });
    const b = await svc.register({ ...BASE, email: 'b1@gmail.com' });
    assert.equal(a.ok && b.ok, true);
    if (!a.ok || !b.ok) return;
    const aid = a.value.id;
    const bid = b.value.id;
    assert.equal(await svc.isBlockedOrMuted(aid, bid), false);
    await svc.block(aid, bid);
    assert.equal(await svc.isBlockedOrMuted(aid, bid), true);
    assert.equal(await svc.isBlockedOrMuted(bid, aid), true);
    await svc.unblock(aid, bid);
    assert.equal(await svc.isBlockedOrMuted(aid, bid), false);
    await svc.mute(bid, aid);
    assert.equal(await svc.isBlockedOrMuted(aid, bid), true);
    await svc.unmute(bid, aid);
    assert.equal(await svc.isBlockedOrMuted(aid, bid), false);
    await assert.rejects(svc.block(aid, aid), /cannot block yourself/i);
  });

  it('restrict suspends/bans: login blocked, badge shown', async () => {
    const svc = createIdentityService();
    const r = await svc.register({ ...BASE, email: 'r@gmail.com' });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    await svc.restrict(r.value.id, 'suspended');
    assert.equal((await svc.getProfile(r.value.id))?.restriction, 'suspended');
    const login = await svc.authenticate('r@gmail.com', 'password1');
    assert.equal(login.ok, false);
    if (!login.ok) assert.ok(login.errors.some((e) => e.code === 'account-suspended'));
    await svc.restrict(r.value.id, 'none');
    assert.equal((await svc.authenticate('r@gmail.com', 'password1')).ok, true);
  });

  it('deactivate hides profile and blocks login immediately', async () => {
    const svc = createIdentityService();
    const r = await svc.register({ ...BASE, email: 'd@gmail.com' });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    await svc.deactivate(r.value.id);
    assert.equal(await svc.getProfile(r.value.id), undefined);
    assert.equal((await svc.authenticate('d@gmail.com', 'password1')).ok, false);
  });

  it('restrict/deactivate revoke live sessions', async () => {
    const svc = createIdentityService();
    const r = await svc.register({ ...BASE, email: 's2@gmail.com' });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    const auth = await svc.authenticate('s2@gmail.com', 'password1');
    assert.equal(auth.ok, true);
    if (!auth.ok) return;
    await svc.restrict(r.value.id, 'suspended');
    assert.equal(await svc.resolveSession(auth.value.token), undefined);
  });

  it('setRole promotes to moderator (bootstrap; HTTP layer gates in production)', async () => {
    const svc = createIdentityService();
    const r = await svc.register({ ...BASE, email: 'm@gmail.com' });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal((await svc.getProfile(r.value.id))?.role, 'member');
    await svc.setRole('bootstrap', r.value.id, 'moderator');
    assert.equal((await svc.getProfile(r.value.id))?.role, 'moderator');
  });

  it('once a moderator exists, only moderators assign roles', async () => {
    const svc = createIdentityService();
    const m = await svc.register({ ...BASE, email: 'm2@gmail.com' });
    const u = await svc.register({ ...BASE, email: 'u2@gmail.com' });
    assert.equal(m.ok && u.ok, true);
    if (!m.ok || !u.ok) return;
    await svc.setRole('bootstrap', m.value.id, 'moderator');
    await assert.rejects(svc.setRole(u.value.id, u.value.id, 'moderator'), /only moderators/i);
    await svc.setRole(m.value.id, u.value.id, 'moderator');
    assert.equal((await svc.getProfile(u.value.id))?.role, 'moderator');
  });

  it('authorizeMemberSession accepts member and moderator sessions', async () => {
    const svc = createIdentityService();
    const m = await svc.register({ ...BASE, email: 'sess-mod@gmail.com' });
    const u = await svc.register({ ...BASE, email: 'sess-user@gmail.com' });
    assert.equal(m.ok && u.ok, true);
    if (!m.ok || !u.ok) return;
    await svc.setRole('bootstrap', m.value.id, 'moderator');
    const modAuth = await svc.authenticate('sess-mod@gmail.com', 'password1');
    const userAuth = await svc.authenticate('sess-user@gmail.com', 'password1');
    assert.equal(modAuth.ok && userAuth.ok, true);
    if (!modAuth.ok || !userAuth.ok) return;
    assert.equal((await svc.authorizeMemberSession(modAuth.value.token)).ok, true);
    assert.equal((await svc.authorizeMemberSession(userAuth.value.token)).ok, true);
    assert.equal((await svc.authorizeMemberSession('bogus-token')).ok, false);
  });
});
