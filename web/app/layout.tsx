import type { Metadata } from 'next';
import Link from 'next/link';
import { sessionUser } from '../lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'CampusSwap — KFS student exchange',
  description: 'Exchange skills and items with KFS students. No money involved.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await sessionUser();
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-white">
          Skip to content
        </a>
        <header className="border-b border-stone-200 bg-white">
          <nav aria-label="Primary" className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-emerald-800">
              CampusSwap
            </Link>
            <span className="text-sm text-stone-500">KFS University · money-free exchange</span>
            <span className="flex-1" />
            {user ? (
              <>
                <Link href="/publish" className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white">
                  Publish
                </Link>
                <Link href="/me" className="text-sm underline">
                  {user.displayName}
                </Link>
                <Link href="/logout" className="text-sm underline">
                  Log out
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm underline">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-4xl px-4 py-6">
          {children}
        </main>
        <footer className="mx-auto max-w-4xl px-4 pb-8 text-sm text-stone-500">
          All times Cairo time (Africa/Cairo).{' '}
          <Link href="/terms" className="underline">
            Terms
          </Link>{' '}
          ·{' '}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </footer>
      </body>
    </html>
  );
}
