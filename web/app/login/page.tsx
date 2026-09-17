import { LoginForm } from '../../components/LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Log in</h1>
      <LoginForm returnTo={returnTo ?? '/'} />
    </div>
  );
}
