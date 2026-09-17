import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default async function PrivacyPage() {
  const text = await readFile(join(process.cwd(), '..', 'PRIVACY.md'), 'utf8');
  return (
    <article className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Privacy Notice</h1>
      <pre className="whitespace-pre-wrap rounded border border-stone-200 bg-white p-4 text-sm">
        {text}
      </pre>
    </article>
  );
}
