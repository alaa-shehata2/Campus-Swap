const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  day: '2-digit',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Format an ISO datetime with an explicit Cairo label (NFR-U-2).
 * Example: `12 Mar 2026, 15:30 Cairo time`. Throws RangeError on invalid input.
 */
export function formatCairoTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid datetime: ${iso}`);
  const segs: Record<string, string> = {};
  for (const p of parts.formatToParts(date)) {
    if (p.type !== 'literal') segs[p.type] = p.value;
  }
  const month = MONTHS[Number(segs['month']) - 1];
  return `${segs['day']} ${month} ${segs['year']}, ${segs['hour']}:${segs['minute']} Cairo time`;
}
