import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ok, fail } from '../src/common/errors.js';

describe('errors', () => {
  it('ok wraps a value', async () => {
    const r = ok(1);
    assert.equal(r.ok, true);
  });

  it('fail carries field errors', async () => {
    const r = fail<number>([
      { code: 'required', field: 'email', message: 'Email is required.' },
    ]);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.errors[0]?.field, 'email');
  });
});
