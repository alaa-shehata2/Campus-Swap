import Link from 'next/link';
import { LoginForm } from '../../components/LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const signupHref = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup';
  return (
    <div className="flex justify-center py-8">
      <section
        aria-labelledby="login-heading"
        className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h1 id="login-heading" className="text-2xl font-bold">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Log in to publish listings and propose exchanges.
        </p>
        <div className="mt-6">
          <LoginForm returnTo={returnTo ?? '/'} />
        </div>
        <p className="mt-6 border-t border-stone-200 pt-4 text-center text-sm text-stone-600">
          No account yet?{' '}
          <Link href={signupHref} className="font-medium text-emerald-800 underline">
            Sign up
          </Link>
        </p>
      </section>
    </div>
  );
}
