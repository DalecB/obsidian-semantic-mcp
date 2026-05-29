import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSensitiveAccess } from '../src/server.mjs';

test('sensitive access requires explicit server-side opt-in', () => {
  assert.equal(resolveSensitiveAccess({}, { allowSensitive: false }), false);
  assert.throws(
    () => resolveSensitiveAccess({ include_sensitive: true }, { allowSensitive: false }),
    /OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true/,
  );
  assert.equal(resolveSensitiveAccess({ include_sensitive: true }, { allowSensitive: true }), true);
});
