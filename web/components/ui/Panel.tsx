/**
 * Token-backed surface. Routes must use Panel instead of ad-hoc
 * bg-white/border/rounded/shadow classes.
 */
export function Panel({
  children,
  className = '',
  tone = 'elevated',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'elevated' | 'bordered' | 'sunken';
}) {
  const toneClass =
    tone === 'elevated'
      ? 'bg-surface-elevated shadow-raised rounded-lg'
      : tone === 'bordered'
        ? 'bg-surface-elevated border border-border rounded-lg'
        : 'bg-surface-sunken rounded-lg';
  return <div className={`${toneClass} p-4 sm:p-6 ${className}`}>{children}</div>;
}
