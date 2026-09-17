import Link from 'next/link';
import { disclaimerFor, type DisclaimerFlow } from '../../src/policy/disclaimers.js';

/** Short disclaimer + full-terms link (NFR-L-1). */
export function Disclaimer({ flow }: { flow: DisclaimerFlow }) {
  return (
    <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-stone-800">
      {disclaimerFor(flow)}{' '}
      <Link href="/terms" className="font-medium underline">
        Full Terms
      </Link>
    </p>
  );
}
