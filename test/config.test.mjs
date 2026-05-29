import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.mjs';

test('startup indexing and sensitive access default to opt-in only', () => {
  const config = loadConfig({});
  assert.equal(config.startupIndex, false);
  assert.equal(config.allowSensitive, false);
  assert.equal(loadConfig({ OBSIDIAN_SEMANTIC_STARTUP_INDEX: 'true' }).startupIndex, true);
  assert.equal(loadConfig({ OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE: 'true' }).allowSensitive, true);
});
