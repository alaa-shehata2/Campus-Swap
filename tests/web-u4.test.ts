import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('U4 metrics and launch views', () => {
  it('defines moderator-gated metrics and launch routes', () => {
    for (const file of ['web/app/metrics/page.tsx', 'web/app/launch/page.tsx', 'web/components/GateChecker.tsx']) {
      assert.ok(existsSync(join(root, file)), `${file} exists`);
    }
    assert.match(read('web/app/metrics/page.tsx'), /computePilotMetrics|metrics\(/);
    assert.match(read('web/app/launch/page.tsx'), /health|attestation|evaluateLaunchGate/i);
    assert.match(read('web/components/GateChecker.tsx'), /evaluateLaunchGate/);
  });

  it('exposes U4 navigation links only through the moderator navigation branch', () => {
    for (const file of ['web/components/navigation/DesktopNav.tsx', 'web/components/navigation/MobileNav.tsx']) {
      const source = read(file);
      assert.match(source, /showModeration/);
      assert.match(source, /\/metrics/);
      assert.match(source, /\/launch/);
    }
  });
});
