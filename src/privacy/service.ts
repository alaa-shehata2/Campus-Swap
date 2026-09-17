import { fail, ok, type Result } from '../common/errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Retention clocks (P-3). Month counts approximated as 365/730 days. */
export const MESSAGE_RETENTION_MS = 365 * DAY_MS;
export const LOG_RETENTION_MS = 730 * DAY_MS;

export interface AccessLogEntry {
  moderatorId: string;
  granted: boolean;
  atMs: number;
  context?: string;
}

/**
 * Privacy duties (P-3/P-4): retention clocks, anonymization marker, and
 * purpose-bound moderator access (visible only on an opened case, logged).
 */
export function createPrivacyService(opts: { now?: () => number } = {}) {
  const now = opts.now ?? Date.now;
  const accessLog: AccessLogEntry[] = [];

  function dueForAnonymization(
    kind: 'message' | 'log',
    referenceMs: number,
    nowMs: number,
  ): boolean {
    const window = kind === 'message' ? MESSAGE_RETENTION_MS : LOG_RETENTION_MS;
    return nowMs - referenceMs >= window;
  }

  /** Counts preserved, text dropped (P-3). */
  function anonymizeText(_text: string): string {
    void _text;
    return '[anonymized]';
  }

  function checkCaseAccess(
    moderatorId: string,
    hasOpenCase: boolean,
    context?: string,
  ): Result<{ granted: true; atMs: number }> {
    const atMs = now();
    accessLog.push({ moderatorId, granted: hasOpenCase, atMs, context });
    if (!hasOpenCase) {
      return fail([
        {
          code: 'case-required',
          message: 'Messages are visible to moderators only on an opened case.',
        },
      ]);
    }
    return ok({ granted: true as const, atMs });
  }

  function getAccessLog(): AccessLogEntry[] {
    return accessLog.map((e) => ({ ...e }));
  }

  return { dueForAnonymization, anonymizeText, checkCaseAccess, getAccessLog };
}

export type PrivacyService = ReturnType<typeof createPrivacyService>;
