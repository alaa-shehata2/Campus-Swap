import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isProhibited } from '../src/policy/prohibited.js';
import { CATEGORIES } from '../src/policy/taxonomy.js';
import { disclaimerFor } from '../src/policy/disclaimers.js';

describe('policy', () => {
  it('exposes a fixed category taxonomy', () => {
    assert.ok(CATEGORIES.includes('tutoring'));
    assert.ok(CATEGORIES.includes('textbooks'));
  });

  it('blocks each prohibited class fixture', () => {
    const fixtures = [
      'buy my viagra prescription medicine',
      'lawyer legal representation for court',
      'AK-47 rifle for sale',
      'cocaine for sale cheap',
      'stolen iphone no questions asked',
      'escort sexual services available',
      'promo: 50% off commercial store sale',
    ];
    for (const text of fixtures) {
      assert.equal(isProhibited(text, '').blocked, true, text);
    }
  });

  it('allows a benign tutoring offer', () => {
    assert.equal(
      isProhibited('Python tutoring', 'I teach Python basics on campus').blocked,
      false,
    );
  });

  it('provides disclaimers for all 5 flows', () => {
    for (const f of [
      'signup',
      'listing-create',
      'proposal-accept',
      'schedule-confirm',
      'item-lend',
    ] as const) {
      assert.match(disclaimerFor(f), /terms/i);
    }
  });
});
