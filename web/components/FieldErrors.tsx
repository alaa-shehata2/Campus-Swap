import type { FieldError } from '../../src/common/errors.js';

export function FieldErrors({ errors, field }: { errors: FieldError[]; field?: string }) {
  const list = field ? errors.filter((e) => e.field === field) : errors.filter((e) => !e.field);
  if (list.length === 0) return null;
  return (
    <ul aria-live="polite" className="mt-1 space-y-1">
      {list.map((e, i) => (
        <li key={i} role="alert" className="text-sm font-medium text-red-700">
          {e.message}
        </li>
      ))}
    </ul>
  );
}
