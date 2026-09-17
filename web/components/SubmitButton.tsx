'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-50"
    >
      {pending ? 'Working…' : children}
    </button>
  );
}
