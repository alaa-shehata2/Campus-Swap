import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createNotificationsService,
  lendReminderKind,
  NOTIFICATION_TYPES,
} from '../src/notifications/service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('notifications', () => {
  it('one unread item per emit; read tracking works', () => {
    const svc = createNotificationsService();
    svc.emit('u1', 'proposal-received', 'proposal-1');
    svc.emit('u1', 'schedule-set', 'exchange-1');
    svc.emit('u2', 'proposal-received', 'proposal-1');
    assert.equal(svc.unreadCount('u1'), 2);
    const inbox = svc.inbox('u1');
    assert.equal(inbox.length, 2);
    assert.equal(inbox.every((i) => i.readAtMs === undefined), true);
    svc.markRead('u1', inbox[0]!.id);
    assert.equal(svc.unreadCount('u1'), 1);
    svc.markAllRead('u1');
    assert.equal(svc.unreadCount('u1'), 0);
  });

  it('covers every FR-N-1 event type with zero emails', () => {
    assert.ok(NOTIFICATION_TYPES.includes('lend-reminder'));
    assert.ok(NOTIFICATION_TYPES.includes('report-status'));
    assert.ok(NOTIFICATION_TYPES.includes('moderation-action'));
    const svc = createNotificationsService();
    for (const t of NOTIFICATION_TYPES) svc.emit('u1', t, 'ref-1');
    assert.equal(svc.unreadCount('u1'), NOTIFICATION_TYPES.length);
    // in-app only: no mail transport exists on the service
    assert.equal((svc as unknown as Record<string, unknown>)['sendEmail'], undefined);
  });

  it('lend reminders fire at T-3d, T+0, T+3d and overdue', () => {
    const ret = Date.parse('2026-04-10T10:00:00.000Z');
    assert.equal(lendReminderKind(ret, ret - 3 * DAY_MS), 'T-3d');
    assert.equal(lendReminderKind(ret, ret), 'T+0');
    assert.equal(lendReminderKind(ret, ret + 3 * DAY_MS), 'T+3d');
    assert.equal(lendReminderKind(ret, ret + 10 * DAY_MS), 'overdue');
    assert.equal(lendReminderKind(ret, ret - 10 * DAY_MS), undefined);
  });
});
