import { redirect } from 'next/navigation';
import { sessionUserId } from '../../lib/auth';
import { PublishForm } from '../../components/PublishForm';

export default async function PublishPage() {
  const userId = await sessionUserId();
  if (!userId) redirect('/login?returnTo=/publish');
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Publish a listing</h1>
      <PublishForm />
    </div>
  );
}
