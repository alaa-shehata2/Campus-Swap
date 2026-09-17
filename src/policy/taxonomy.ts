export const CATEGORIES = [
  'tutoring',
  'programming',
  'design',
  'music',
  'languages',
  'textbooks',
  'electronics',
  'bikes',
  'tools',
  'furniture',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** Same/related-category hints for compatible discovery (FR-D-2/3). */
export const RELATED: Record<Category, Category[]> = {
  tutoring: ['languages', 'programming'],
  programming: ['tutoring', 'design'],
  design: ['programming', 'music'],
  music: ['design'],
  languages: ['tutoring'],
  textbooks: ['other'],
  electronics: ['tools'],
  bikes: ['tools'],
  tools: ['electronics', 'bikes'],
  furniture: ['other'],
  other: [],
};
