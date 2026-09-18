'use client';

/**
 * Desktop filter column with a labeled collapse control. Controlled: the
 * parent owns `open` and renders results wider when collapsed. Collapsing
 * never removes access — the slim rail keeps a reopen control.
 */
export function FilterRail({
  children,
  open,
  onToggle,
}: {
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  if (!open) {
    return (
      <aside aria-label="Listing filters" className="hidden lg:col-span-1 lg:block">
        <div className="sticky top-4">
          <button
            type="button"
            aria-expanded={false}
            aria-controls="desktop-filter-content"
            onClick={onToggle}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium underline"
          >
            Show filters
          </button>
        </div>
      </aside>
    );
  }
  return (
    <aside aria-label="Listing filters" className="hidden lg:col-span-3 lg:block">
      <div className="sticky top-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Filter listings</h2>
          <button
            type="button"
            aria-expanded={true}
            aria-controls="desktop-filter-content"
            onClick={onToggle}
            className="rounded-md px-2 py-1 text-xs font-medium underline"
          >
            Collapse
          </button>
        </div>
        <div id="desktop-filter-content">{children}</div>
      </div>
    </aside>
  );
}
