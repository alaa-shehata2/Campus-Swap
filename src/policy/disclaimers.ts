/** Short disclaimers + full-terms link (NFR-L-1, 5 required flows). */
const FLOWS = [
  'signup',
  'listing-create',
  'proposal-accept',
  'schedule-confirm',
  'item-lend',
] as const;

export type DisclaimerFlow = (typeof FLOWS)[number];

export function disclaimerFor(flow: DisclaimerFlow): string {
  return (
    `Notice (${flow}): CampusSwap is a money-free student exchange. ` +
    `Meet in public on-campus spots where possible; the platform has zero ` +
    `liability for damage, loss, theft, or safety outcomes. ` +
    `Read the full Terms at /terms before continuing.`
  );
}
