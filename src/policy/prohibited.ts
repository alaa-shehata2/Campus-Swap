/**
 * Prohibited-class screening (FR-L-6, BR-5).
 * Keyword screen against the enumerated classes; moderators enforce the
 * enumerated list. Medical/legal advice wording is owned by the human
 * developer (Terms) — this screen is a first pass, not a verdict.
 */
const RULES: Array<[RegExp, string]> = [
  [/\b(viagra|diagnos(is|e)|prescription|medical (advice|treatment|clinic))\b/i, 'medical'],
  [/\b(lawyer|legal (advice|representation)|court defense)\b/i, 'legal'],
  [/\b(rifle|pistol|gun|ammo|ak-47|ammunition)\b/i, 'weapons'],
  [/\b(cocaine|heroin|weed for sale|alcohol delivery|vodka|whiskey sale)\b/i, 'drugs-alcohol'],
  [/\b(stolen|no questions asked)\b/i, 'stolen'],
  [/\b(escort|sexual services|onlyfans promo)\b/i, 'sexual'],
  [/(% off|sale now|commercial|promo code|buy now|discount store)/i, 'commercial'],
];

export function isProhibited(title: string, description: string): {
  blocked: boolean;
  reason?: string;
} {
  const text = `${title} ${description}`;
  for (const [re, reason] of RULES) {
    if (re.test(text)) return { blocked: true, reason };
  }
  return { blocked: false };
}
