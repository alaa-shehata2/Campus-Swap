'use client';

import { useEffect, useRef } from 'react';

export function FilterDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Return focus to the control that opened the drawer.
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Listing filters">
      <button type="button" aria-label="Close filters" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <section className="absolute inset-y-0 left-0 w-[min(22rem,90vw)] overflow-y-auto bg-surface-elevated p-4 shadow-raised">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filter listings</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md border border-border px-3 py-2 text-sm">
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
