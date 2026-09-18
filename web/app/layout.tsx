import type { Metadata } from 'next';
import Link from 'next/link';
import { sessionUser } from '../lib/auth';
import { services } from '../lib/services';
import { Container } from '../components/ui/Container';
import { DesktopNav } from '../components/navigation/DesktopNav';
import { MobileNav } from '../components/navigation/MobileNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'CampusSwap — KFS student exchange',
  description: 'Exchange skills and items with KFS students. No money involved.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await sessionUser();
  let unreadCount = 0;
  let showModeration = false;
  if (user) {
    const svc = services();
    unreadCount = await svc.notify.unreadCount(user.id);
    showModeration = (await svc.identity.getProfile(user.id))?.role === 'moderator';
  }
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2 focus:bg-white">
          Skip to content
        </a>
        <header className="border-b border-border bg-surface-elevated">
          <Container>
            <DesktopNav user={user} unreadCount={unreadCount} showModeration={showModeration} />
            <MobileNav user={user} unreadCount={unreadCount} showModeration={showModeration} />
          </Container>
        </header>
        <main id="main" className="py-6">
          <Container>{children}</Container>
        </main>
        <footer className="pb-8 text-sm text-text-muted">
          <Container>
            All times Cairo time (Africa/Cairo).{' '}
            <Link href="/terms" className="underline">
              Terms
            </Link>{' '}
            ·{' '}
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
          </Container>
        </footer>
      </body>
    </html>
  );
}
