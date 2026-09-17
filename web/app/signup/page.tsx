import { SignupForm } from '../../components/SignupForm';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Sign up</h1>
      <SignupForm returnTo={returnTo ?? '/'} />
    </div>
  );
}
