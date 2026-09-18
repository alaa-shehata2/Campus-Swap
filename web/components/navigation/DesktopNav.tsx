import Link from 'next/link';
import { Badge } from '../ui/Badge';

export function DesktopNav({
  user,
  unreadCount = 0,
  showModeration = false,
}: {
  user?: { displayName: string };
  unreadCount?: number;
  showModeration?: boolean;
}) {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-4 lg:flex">
      <Link href="/" className="text-lg font-bold text-brand-ink">
        CampusSwap
      </Link>
      <span className="text-sm text-text-muted">KFS University · money-free exchange</span>
      <span className="flex-1" />
      {user ? (
        <>
          <Link href="/proposals" className="text-sm underline">
            Proposals
          </Link>
          <Link href="/notifications" className="flex items-center gap-1 text-sm underline">
            Notifications
            {unreadCount > 0 && <Badge tone="info">{unreadCount} unread</Badge>}
          </Link>
          {showModeration && (
            <>
              <Link href="/moderation" className="text-sm underline">Moderation</Link>
              <Link href="/metrics" className="text-sm underline">Metrics</Link>
              <Link href="/launch" className="text-sm underline">Launch</Link>
            </>
          )}
          <Link href="/publish" className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-contrast">
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
          <Link href="/signup" className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-contrast">
            Sign up
          </Link>
        </>
      )}
    </nav>
  );
}
