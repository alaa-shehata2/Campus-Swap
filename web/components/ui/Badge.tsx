/**
 * Status/side indicator. Color is never the sole signal: callers always pass
 * a text label as children (web-ui-standards §3).
 */
const tones = {
  offer: 'bg-offer-bg text-offer-ink',
  request: 'bg-request-bg text-request-ink',
  active: 'bg-status-active-bg text-status-active-ink',
  paused: 'bg-status-paused-bg text-status-paused-ink',
  warning: 'bg-status-warning-bg text-status-warning-ink',
  danger: 'bg-status-danger-bg text-status-danger-ink',
  info: 'bg-status-info-bg text-status-info-ink',
  neutral: 'bg-surface-sunken text-text-muted',
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded-sm px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}
