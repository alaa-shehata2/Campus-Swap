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
  it('accepts gmail/yahoo/KFS emails with campus default', () => {
    const svc = createIdentityService();
    for (const email of ['a@gmail.com', 'b@yahoo.com', 'c@kfs.edu.eg']) {
      const r = svc.register({
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

  it('rejects missing campus / unchecked 18+ / unaccepted rules field-specifically', () => {
    const svc = createIdentityService();
    const r1 = svc.register({ ...BASE, email: 'x@gmail.com', campus: '' });
    assert.equal(r1.ok, false);
    if (!r1.ok) assert.ok(r1.errors.some((e) => e.field === 'campus'));

    const r2 = svc.register({ ...BASE, email: 'y@gmail.com', ageConfirmed18: false });
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.ok(r2.errors.some((e) => e.field === 'ageConfirmed18'));

    const r3 = svc.register({ ...BASE, email: 'z@gmail.com', rulesAccepted: false });
    assert.equal(r3.ok, false);
    if (!r3.ok) assert.ok(r3.errors.some((e) => e.field === 'rulesAccepted'));
  });

  it('rejects duplicate email and never exposes email in profile', () => {
    const svc = createIdentityService();
    assert.equal(svc.register({ ...BASE, email: 'dup@gmail.com' }).ok, true);
    assert.equal(svc.register({ ...BASE, email: 'dup@gmail.com' }).ok, false);
    const me = svc.register({ ...BASE, email: 'me@gmail.com' });
    assert.equal(me.ok, true);
    if (me.ok) assert.ok(!('email' in me.value));
  });

  it('authenticates with password, rejects wrong password; bio cap enforced', () => {
    const svc = createIdentityService();
    svc.register({ ...BASE, email: 'l@gmail.com' });
    assert.equal(svc.authenticate('l@gmail.com', 'password1').ok, true);
    assert.equal(svc.authenticate('l@gmail.com', 'wrongpass1').ok, false);
    const me = svc.authenticate('l@gmail.com', 'password1');
    assert.equal(me.ok, true);
    if (me.ok) {
      const bad = svc.updateProfile(me.value.userId, { bio: 'x'.repeat(501) });
      assert.equal(bad.ok, false);
      const good = svc.updateProfile(me.value.userId, { bio: 'CS junior, love bikes.' });
      assert.equal(good.ok, true);
    }
  });

  it('labels campus self-declared (not verified)', () => {
    const svc = createIdentityService();
    const r = svc.register({ ...BASE, email: 'sd@gmail.com' });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value.campusVerified, false);
  });

  it('sessions resolve to owner and logout revokes', () => {
    const svc = createIdentityService();
    svc.register({ ...BASE, email: 's@gmail.com' });
    const auth = svc.authenticate('s@gmail.com', 'password1');
    assert.equal(auth.ok, true);
    if (!auth.ok) return;
    assert.equal(svc.resolveSession(auth.value.token), auth.value.userId);
    svc.logout(auth.value.token);
    assert.equal(svc.resolveSession(auth.value.token), undefined);
  });

  it('rejects non-string credentials and over-long passwords safely', () => {
    const svc = createIdentityService();
    svc.register({ ...BASE, email: 'e@gmail.com' });
    assert.equal(svc.authenticate(undefined as unknown as string, 'password1').ok, false);
    assert.equal(svc.authenticate('e@gmail.com', 'x'.repeat(300)).ok, false);
  });

  it('block/mute stops contact; symmetric check; self-block rejected', () => {
    const svc = createIdentityService();
    const a = svc.register({ ...BASE, email: 'a1@gmail.com' });
    const b = svc.register({ ...BASE, email: 'b1@gmail.com' });
    assert.equal(a.ok && b.ok, true);
    if (!a.ok || !b.ok) return;
    const aid = a.value.id;
    const bid = b.value.id;
    assert.equal(svc.isBlockedOrMuted(aid, bid), false);
    svc.block(aid, bid);
    assert.equal(svc.isBlockedOrMuted(aid, bid), true);
    assert.equal(svc.isBlockedOrMuted(bid, aid), true);
    svc.unblock(aid, bid);
    assert.equal(svc.isBlockedOrMuted(aid, bid), false);
    svc.mute(bid, aid);
    assert.equal(svc.isBlockedOrMuted(aid, bid), true);
    svc.unmute(bid, aid);
    assert.equal(svc.isBlockedOrMuted(aid, bid), false);
    assert.throws(() => svc.block(aid, aid), /cannot block yourself/i);
  });
});
