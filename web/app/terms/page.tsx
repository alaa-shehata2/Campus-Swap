import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function doc(name: string): Promise<string> {
  return readFile(join(process.cwd(), '..', name), 'utf8');
}

export default async function TermsPage() {
  const text = await doc('TERMS.md');
  return (
    <article className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Terms of Use</h1>
      <pre className="whitespace-pre-wrap rounded border border-stone-200 bg-white p-4 text-sm">
        {text}
      </pre>
    </article>
  );
}
