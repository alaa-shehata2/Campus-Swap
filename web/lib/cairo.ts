/**
 * Interpret a `datetime-local` value ("YYYY-MM-DDTHH:mm") as an Africa/Cairo
 * wall time and return UTC ISO (FR-E-5: schedule interpreted Cairo, labeled).
 * No new dependency: resolve the zone offset iteratively via Intl.
 */
export function cairoWallToISO(naive: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(naive);
  if (!m) return undefined;
  const parts = m.slice(1).map(Number);
  const [y, mo, d, h, mi] = parts as [number, number, number, number, number];
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  let guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const target = guess;
  for (let i = 0; i < 3; i++) {
    const wall = fmt.format(new Date(guess));
    const w = /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})/.exec(wall);
    if (!w) return undefined;
    const wallMs = Date.UTC(Number(w[3]), Number(w[1]) - 1, Number(w[2]), Number(w[4]), Number(w[5]), Number(w[6]));
    const diff = target - wallMs;
    if (diff === 0) break;
    guess += diff;
  }
  const check = new Date(guess);
  if (Number.isNaN(check.getTime())) return undefined;
  return check.toISOString();
}
