import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const TOKENS = [
  '--color-surface-page', '--color-surface-elevated', '--color-surface-sunken',
  '--color-text-primary', '--color-text-muted', '--color-text-inverse',
  '--color-border', '--color-focus',
  '--color-brand', '--color-brand-ink', '--color-brand-contrast',
  '--color-offer-bg', '--color-offer-ink',
  '--color-request-bg', '--color-request-ink',
  '--color-status-active-bg', '--color-status-active-ink',
  '--color-status-paused-bg', '--color-status-paused-ink',
  '--color-status-warning-bg', '--color-status-warning-ink',
  '--color-status-danger-bg', '--color-status-danger-ink',
  '--color-status-info-bg', '--color-status-info-ink',
  '--radius-sm', '--radius-md', '--radius-lg', '--shadow-raised',
];

describe('marketplace shell (R-T1)', () => {
  it('layout has no narrow global wrapper, one main landmark, and a skip link', () => {
    const layout = read('web/app/layout.tsx');
    assert.ok(!layout.includes('max-w-4xl'), 'no max-w-4xl wrapper');
    assert.ok(!layout.includes('max-w-5xl'), 'no max-w-5xl wrapper');
    assert.equal(layout.match(/<main[\s>]/g)?.length, 1, 'exactly one main landmark');
    assert.ok(layout.includes('href="#main"'), 'skip link targets #main');
    assert.ok(layout.includes('id="main"'), 'main region has the skip target id');
  });

  it('globals.css defines the token system, reduced-motion, and focus treatment', () => {
    const css = read('web/app/globals.css');
    for (const token of TOKENS) {
      assert.ok(css.includes(token), `token defined: ${token}`);
    }
    assert.ok(css.includes('prefers-reduced-motion'), 'reduced-motion respected');
    assert.ok(css.includes(':focus-visible'), 'visible focus treatment');
  });

  it('shared primitives exist with the contracted exports', async () => {
    for (const [file, name] of [
      ['web/components/ui/Container.tsx', 'Container'],
      ['web/components/ui/Panel.tsx', 'Panel'],
      ['web/components/ui/PageHeader.tsx', 'PageHeader'],
      ['web/components/ui/Badge.tsx', 'Badge'],
    ] as const) {
      assert.ok(existsSync(join(root, file)), `${file} exists`);
      const mod = (await import(`../${file.replace(/\.tsx$/, '.js')}`)) as Record<string, unknown>;
      assert.equal(typeof mod[name], 'function', `${name} exported from ${file}`);
    }
  });
});
