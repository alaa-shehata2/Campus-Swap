import { cookies } from 'next/headers';
import { services } from './services';

export const SESSION_COOKIE = 'campus_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function sessionUserId(): Promise<string | undefined> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return undefined;
  return services().identity.resolveSession(token);
}

export async function sessionUser() {
  const id = await sessionUserId();
  if (!id) return undefined;
  return services().identity.getProfile(id);
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}
