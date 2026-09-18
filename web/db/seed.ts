/**
 * Demo seed for local U1 walkthroughs. Members are idempotent (existing
 * emails are kept); listings append on each run — reset the DB to start over.
 * Run: `npm run seed --prefix web` (needs MYSQL_URL, e.g. via web/.env.local + docker compose).
 */
import { createIdentityService } from '../../src/identity/service.js';
import { createListingsService } from '../../src/listings/service.js';
import { createExchangesService } from '../../src/exchanges/service.js';
import { createReputationService } from '../../src/reputation/service.js';
import { createModerationService } from '../../src/moderation/service.js';
import {
  createMysqlPool,
  MySqlExchangesStore,
  MySqlIdentityStore,
  MySqlListingsStore,
  MySqlModerationStore,
  MySqlNotificationSink,
  MySqlReputationStore,
} from '../lib/db/repositories.js';

const URL = process.env['MYSQL_URL'] ?? 'mysql://campuswap:campuswap@127.0.0.1:3306/campuswap';

const MEMBERS = [
  { email: 'maya@kfs.edu.eg', password: 'password1', displayName: 'Maya', campus: 'KFS University' },
  { email: 'jonas@gmail.com', password: 'password1', displayName: 'Jonas', campus: 'KFS University' },
];

const LISTINGS: Array<{ owner: string; input: Parameters<ReturnType<typeof createListingsService>['publish']>[1] }> = [
  {
    owner: 'maya@kfs.edu.eg',
    input: {
      side: 'offer', kind: 'skill', title: 'Python tutoring for beginners',
      description: 'CS junior here — I teach Python basics, two one-hour sessions per week on campus.',
      category: 'tutoring', zone: 'North campus', images: [], availability: 'weekday evenings',
    },
  },
  {
    owner: 'maya@kfs.edu.eg',
    input: {
      side: 'offer', kind: 'skill', title: 'Video editing help',
      description: 'I can edit your videos: cuts, captions, and thumbnails.',
      category: 'design', zone: 'Library', images: [],
    },
  },
  {
    owner: 'jonas@gmail.com',
    input: {
      side: 'request', kind: 'skill', title: 'Need math tutoring',
      description: 'First-year student looking for calculus help before midterms.',
      category: 'tutoring', zone: 'North campus', images: [],
    },
  },
  {
    owner: 'jonas@gmail.com',
    input: {
      side: 'offer', kind: 'item', title: 'Lend my power drill',
      description: 'Lending a drill for weekend shelf projects. Handle with care.',
      category: 'tools', zone: 'Dorms', images: [],
      modality: 'lend', returnTerm: 'Return within 7 days.',
    },
  },
  {
    owner: 'jonas@gmail.com',
    input: {
      side: 'request', kind: 'item', title: 'Need a tent for the weekend',
      description: 'Borrow a 2-person tent for a Friday trip. Back Sunday evening.',
      category: 'other', zone: 'Dorms', images: [],
      modality: 'lend', returnTerm: 'Back Sunday evening.',
    },
  },
];

async function main(): Promise<void> {
  const pool = createMysqlPool(URL);
  try {
    await pool.query('SELECT 1');
    const identity = createIdentityService(new MySqlIdentityStore(pool));
    const listings = createListingsService(new MySqlListingsStore(pool));
    const ids: Record<string, string> = {};
    for (const m of MEMBERS) {
      const r = await identity.register({
        ...m, ageConfirmed18: true, rulesAccepted: true,
      });
      if (r.ok) {
        ids[m.email] = r.value.id;
        console.log(`member: ${m.email} / ${m.password}`);
      } else if (r.errors.some((e) => e.code === 'taken')) {
        const me = await identity.authenticate(m.email, m.password);
        if (me.ok) ids[m.email] = me.value.userId;
        console.log(`member exists: ${m.email}`);
      } else {
        throw new Error(`seed register failed: ${JSON.stringify(r)}`);
      }
    }
    for (const l of LISTINGS) {
      const ownerId = ids[l.owner];
      if (!ownerId) throw new Error(`missing owner ${l.owner}`);
      const r = await listings.publish(ownerId, l.input);
      console.log(r.ok ? `listing: ${l.input.title}` : `skip: ${JSON.stringify(r.errors)}`);
    }
    // U2 demo: Maya proposes on Jonas's request → accept → schedule → thread.
    // Skips gracefully when the pair already exchanged (listings auto-paused).
    const listingsStore = new MySqlListingsStore(pool);
    const notify = new MySqlNotificationSink(pool);
    const exchanges = createExchangesService(
      {
        listings: { get: (id) => listingsStore.get(id), systemPause: (id) => listings.systemPause(id) },
        identity: {
          getProfile: (id) => identity.getProfile(id),
          isBlockedOrMuted: (a, b) => identity.isBlockedOrMuted(a, b),
        },
        notify,
      },
      { store: new MySqlExchangesStore(pool) },
    );
    const reputation = createReputationService(
      { exchanges: { readExchange: (id) => exchanges.readExchange(id) }, notify },
      { store: new MySqlReputationStore(pool) },
    );
    const moderation = createModerationService(
      {
        listings: {
          get: (id) => listingsStore.get(id),
          systemHide: (id) => listings.systemHide(id),
          systemUnhide: (id) => listings.systemUnhide(id),
        },
        identity: {
          getProfile: (id) => identity.getProfile(id),
          restrict: (id, r) => identity.restrict(id, r),
        },
        reputation: { voidReview: (by, id, reason) => reputation.voidReview(by, id, reason) },
        notify,
      },
      { store: new MySqlModerationStore(pool) },
    );
    const mayaId = ids['maya@kfs.edu.eg'];
    const jonasId = ids['jonas@gmail.com'];
    if (mayaId && jonasId) {
      const all = await listingsStore.all();
      const mine = all.find((l) => l.ownerId === mayaId && l.status === 'Active');
      const theirs = all.find((l) => l.ownerId === jonasId && l.status === 'Active');
      if (mine && theirs) {
        const prop = await exchanges.propose(mayaId, {
          sideAListingIds: [mine.id],
          sideBListingIds: [theirs.id],
          terms: 'Demo terms: two beginner sessions per week, my guitar provided.',
        });
        if (prop.ok) {
          console.log(`proposal: ${prop.value.id}`);
          const acc = await exchanges.respond(jonasId, prop.value.id, 'accept');
          if (acc.ok && 'exchange' in acc.value) {
            const exId = acc.value.exchange.id;
            console.log(`exchange: ${exId}`);
            const sched = await exchanges.schedule(mayaId, exId, {
              at: new Date(Date.now() + 86400000).toISOString(),
              place: 'Library hall, North campus',
            });
            console.log(sched.ok ? 'scheduled: tomorrow, Library hall' : `schedule skip: ${JSON.stringify(sched)}`);
            await exchanges.postMessage(mayaId, exId, 'Hi! Looking forward to meeting tomorrow.');
            await exchanges.postMessage(jonasId, exId, 'Me too — I will bring my notebook.');
            console.log('thread: 2 demo messages');
          }
        } else {
          console.log(`proposal skip: ${JSON.stringify(prop.errors)}`);
        }
      } else {
        console.log('proposal skip: no Active Maya/Jonas pair (already exchanged — reset DB for a fresh demo)');
      }
    }
    // U3 demo: Jonas becomes moderator (bootstrap, first run only), the demo
    // exchange completes with bilateral reviews, and a demo report stays open.
    if (mayaId && jonasId) {
      try {
        await identity.setRole('bootstrap', jonasId, 'moderator');
        console.log('moderator: jonas@gmail.com (bootstrap)');
      } catch {
        console.log('moderator exists already');
      }
      const allEx = await exchanges.store.exportState();
      const demo = allEx.exchanges.find(
        (e) =>
          e.status === 'Scheduled' &&
          [e.participantA, e.participantB].includes(mayaId) &&
          [e.participantA, e.participantB].includes(jonasId),
      );
      if (demo) {
        const done = await exchanges.markDone(demo.participantA, demo.id);
        const other = demo.participantA === mayaId ? jonasId : mayaId;
        const confirmed = done.ok ? await exchanges.confirm(other, demo.id) : done;
        if (confirmed.ok) {
          console.log(`completed: ${demo.id}`);
          const r1 = await reputation.submitReview(demo.participantA, demo.id, { score: 5, text: 'Great swap, highly recommended!' });
          const r2 = await reputation.submitReview(other, demo.id, { score: 4, text: 'Thanks, smooth exchange!' });
          console.log(r1.ok && r2.ok ? 'reviews: bilateral demo reviews published' : 'reviews skip');
        } else {
          console.log('complete skip: demo exchange not completable (already handled — reset DB for a fresh demo)');
        }
      } else {
        console.log('complete skip: no Scheduled Maya/Jonas exchange (already completed — reset DB for a fresh demo)');
      }
      const all = await listingsStore.all();
      const target = all.find((l) => l.ownerId === jonasId && (l.status === 'Active' || l.status === 'Paused'));
      if (target) {
        const rep = await moderation.report(mayaId, {
          targetType: 'listing', targetId: target.id, reasonCode: 'spam-commercial',
          description: 'Demo report: this listing looks commercial, please review it.',
          images: [],
        });
        console.log(rep.ok ? `report: ${rep.value.id} (Received)` : 'report skip (already reported or invalid)');
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
