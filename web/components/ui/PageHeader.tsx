/**
 * Consistent page hierarchy. eyebrow is plain descriptive text (no ALL-CAPS
 * tracking); actions render trailing controls (links, buttons, forms).
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-sm text-text-muted">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-bold text-text-primary">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
