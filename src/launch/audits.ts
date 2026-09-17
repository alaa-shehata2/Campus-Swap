import { disclaimerFor, type DisclaimerFlow } from '../policy/disclaimers.js';
import { formatCairoTime } from '../common/cairoTime.js';

/** The 5 flows requiring a short disclaimer + full-terms link (NFR-L-1). */
export const DISCLAIMER_FLOWS: DisclaimerFlow[] = [
  'signup',
  'listing-create',
  'proposal-accept',
  'schedule-confirm',
  'item-lend',
];

const MIN_DISCLAIMER_LENGTH = 80;
const MAX_AVG_WORDS_PER_SENTENCE = 30;

export interface DisclaimerFinding {
  flow: DisclaimerFlow;
  ok: boolean;
  issues: string[];
}

/**
 * Release gate (BL-15 automated part): every required flow carries a
 * substantive, plain-language notice that points at the full Terms.
 * Contrast/screen-reader checks are manual (attested in the launch gate —
 * no UI exists in this repo yet).
 */
export function disclaimerAudit(): DisclaimerFinding[] {
  return DISCLAIMER_FLOWS.map((flow) => {
    const text = disclaimerFor(flow);
    const issues: string[] = [];
    if (!text || !text.trim()) issues.push('missing disclaimer text');
    if (!/(?:https?:\/\/|\/)terms\b/i.test(text)) issues.push('must link to the full Terms');
    if (text.trim().length < MIN_DISCLAIMER_LENGTH) {
      issues.push(`too short to be substantive (min ${MIN_DISCLAIMER_LENGTH} chars)`);
    }
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length > 0) {
      const words = sentences.join(' ').split(/\s+/).length;
      const avg = words / sentences.length;
      if (avg > MAX_AVG_WORDS_PER_SENTENCE) {
        issues.push(`average sentence length ${avg.toFixed(1)} words exceeds plain-language bar`);
      }
    }
    return { flow, ok: issues.length === 0, issues };
  });
}

export interface CairoAudit {
  ok: boolean;
  issues: string[];
}

const LABEL_RE = /^\d{2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} Cairo time$/;

/**
 * Cairo-time labeling audit (NFR-U-2): winter (UTC+2) and summer DST (UTC+3)
 * samples must carry the explicit label.
 */
export function cairoLabelAudit(): CairoAudit {
  const issues: string[] = [];
  const cases: Array<[string, string]> = [
    ['2026-03-12T13:30:00.000Z', '12 Mar 2026, 15:30 Cairo time'],
    ['2026-07-12T13:30:00.000Z', '12 Jul 2026, 16:30 Cairo time'],
  ];
  for (const [input, expected] of cases) {
    let actual: string;
    try {
      actual = formatCairoTime(input);
    } catch {
      issues.push(`${input}: threw on valid input`);
      continue;
    }
    if (actual !== expected) issues.push(`${input}: got "${actual}", want "${expected}"`);
    if (!LABEL_RE.test(actual)) issues.push(`${input}: missing explicit Cairo label`);
  }
  return { ok: issues.length === 0, issues };
}
