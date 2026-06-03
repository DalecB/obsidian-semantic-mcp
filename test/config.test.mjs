import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, parsePathPrefixes } from '../src/config.mjs';

test('startup indexing and sensitive access default to opt-in only', () => {
  const config = loadConfig({});
  assert.equal(config.startupIndex, false);
  assert.equal(config.allowSensitive, false);
  assert.equal(loadConfig({ OBSIDIAN_SEMANTIC_STARTUP_INDEX: 'true' }).startupIndex, true);
  assert.equal(loadConfig({ OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE: 'true' }).allowSensitive, true);
});

test('exclude and sensitive paths come from env, with a sensible default', () => {
  const base = loadConfig({});
  assert.deepEqual(base.excludePaths, []);
  assert.deepEqual(base.sensitivePaths, ['08_PersonalInfo/']);

  const custom = loadConfig({
    OBSIDIAN_SEMANTIC_EXCLUDE: '03_Journal, /Private/',
    OBSIDIAN_SEMANTIC_SENSITIVE_PATHS: 'Secrets',
  });
  assert.deepEqual(custom.excludePaths, ['03_Journal/', 'Private/']);
  assert.deepEqual(custom.sensitivePaths, ['Secrets/']);
});

test('parsePathPrefixes normalizes, dedupes, and ignores blanks', () => {
  assert.deepEqual(parsePathPrefixes(''), []);
  assert.deepEqual(parsePathPrefixes('a\\b , a/b/ ,, '), ['a/b/']);
});
