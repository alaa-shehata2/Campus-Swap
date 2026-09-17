import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { services } from '../../lib/services';
import { SESSION_COOKIE } from '../../lib/auth';

export async function GET(): Promise<never> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await services().identity.logout(token);
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
