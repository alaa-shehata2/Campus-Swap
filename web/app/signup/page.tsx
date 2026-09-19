import Link from 'next/link';
import { SignupForm } from '../../components/SignupForm';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const loginHref = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';
  return (
    <div className="flex justify-center py-8">
      <section
        aria-labelledby="signup-heading"
        className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h1 id="signup-heading" className="text-2xl font-bold">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Join KFS University&apos;s money-free exchange in under 3 minutes.
        </p>
        <div className="mt-6">
          <SignupForm returnTo={returnTo ?? '/'} />
        </div>
        <p className="mt-6 border-t border-stone-200 pt-4 text-center text-sm text-stone-600">
          Already have an account?{' '}
          <Link href={loginHref} className="font-medium text-emerald-800 underline">
            Log in
          </Link>
        </p>
      </section>
    </div>
  );
}
