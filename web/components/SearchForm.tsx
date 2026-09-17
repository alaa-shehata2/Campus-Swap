'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CATEGORIES } from '../../src/policy/taxonomy.js';

export function SearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <form
      role="search"
      aria-label="Search listings"
      className="grid gap-2 rounded border border-stone-200 bg-white p-4 sm:grid-cols-3"
      action={(form) => {
        const q = new URLSearchParams();
        for (const key of ['text', 'side', 'kind', 'category', 'zone']) {
          const v = String(form.get(key) ?? '').trim();
          if (v) q.set(key, v);
        }
        router.push(`/?${q.toString()}`);
      }}
    >
      <label className="text-sm font-medium">
        Keywords
        <input
          name="text"
          defaultValue={params.get('text') ?? ''}
          placeholder="e.g. Python, drill"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-normal"
        />
      </label>
      <label className="text-sm font-medium">
        Side
        <select name="side" defaultValue={params.get('side') ?? ''} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-normal">
          <option value="">Offer or request</option>
          <option value="offer">Offer (I give)</option>
          <option value="request">Request (I need)</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        Kind
        <select name="kind" defaultValue={params.get('kind') ?? ''} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-normal">
          <option value="">Skill or item</option>
          <option value="skill">Skill</option>
          <option value="item">Item</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        Category
        <select name="category" defaultValue={params.get('category') ?? ''} className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-normal">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Zone
        <input
          name="zone"
          defaultValue={params.get('zone') ?? ''}
          placeholder="e.g. North campus"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-normal"
        />
      </label>
      <div className="flex items-end">
        <button type="submit" className="rounded bg-emerald-700 px-4 py-2 font-medium text-white">
          Search
        </button>
      </div>
    </form>
  );
}
