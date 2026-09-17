import { redirect } from 'next/navigation';
import { formatCairoTime } from '../../../src/common/cairoTime.js';
import { services } from '../../lib/services';
import { sessionUserId } from '../../lib/auth';
import { ProfileForm } from '../../components/ProfileForm';

export default async function MePage() {
  const userId = await sessionUserId();
  if (!userId) redirect('/login?returnTo=/me');
  const { identity, listings } = services();
  const user = await identity.getProfile(userId);
  if (!user) redirect('/login?returnTo=/me');
  const activeCount = await listings.store.countActiveByOwner(userId);
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{user.displayName}</h1>
        <p className="mt-1 text-sm text-stone-600">
          {user.campus} <span className="italic">self-declared (not verified)</span> · joined{' '}
          <time>{formatCairoTime(user.joinDate)}</time>
        </p>
        {user.restriction !== 'none' && (
          <p role="status" className="mt-2 inline-block rounded bg-red-100 px-2 py-0.5 text-sm font-medium text-red-800">
            Account status: {user.restriction}
          </p>
        )}
        <p className="mt-1 text-sm text-stone-600">{activeCount} active listings (max 20)</p>
      </div>
      <ProfileForm user={user} />
    </div>
  );
}
