import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPathGuard, isDeniedRelativePath, normalizeRelPath } from '../src/fsSafety.mjs';

test('normalizeRelPath blocks traversal and absolute paths', () => {
  assert.equal(normalizeRelPath('foo/bar.md'), 'foo/bar.md');
  assert.throws(() => normalizeRelPath('../secret.md'), /traversal/);
  assert.throws(() => normalizeRelPath('%2e%2e/secret.md'), /traversal/);
  assert.throws(() => normalizeRelPath('/tmp/secret.md'), /absolute/);
});

test('denylist blocks hidden and sensitive folders', () => {
  assert.equal(isDeniedRelativePath('.obsidian/app.json'), true);
  assert.equal(isDeniedRelativePath('.smart-env/index'), true);
  assert.equal(isDeniedRelativePath('Projects/.secret/note.md'), true);
  assert.equal(isDeniedRelativePath('Projects/cache/note.md'), true);
  assert.equal(isDeniedRelativePath('Projects/node_modules/pkg/readme.md'), true);
  assert.equal(isDeniedRelativePath('08_PersonalInfo/API KEY.md'), true);
  assert.equal(isDeniedRelativePath('08_PersonalInfo/API KEY.md', { includeSensitive: true }), false);
});

test('user-defined excludePaths are always denied', () => {
  const opts = { excludePaths: ['03_Journal/', 'Private/'] };
  assert.equal(isDeniedRelativePath('03_Journal/2026-06.md', opts), true);
  assert.equal(isDeniedRelativePath('Private/budget.md', opts), true);
  assert.equal(isDeniedRelativePath('02_Projects/note.md', opts), false);
  // excludePaths cannot be unlocked with include_sensitive
  assert.equal(isDeniedRelativePath('03_Journal/2026-06.md', { ...opts, includeSensitive: true }), true);
});

test('custom sensitivePaths replace the default and stay unlockable', () => {
  const opts = { sensitivePaths: ['Secrets/'] };
  assert.equal(isDeniedRelativePath('Secrets/key.md', opts), true);
  assert.equal(isDeniedRelativePath('Secrets/key.md', { ...opts, includeSensitive: true }), false);
  // the built-in default no longer applies once overridden
  assert.equal(isDeniedRelativePath('08_PersonalInfo/note.md', opts), false);
});

test('path guard blocks symlink escape', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ossm-'));
  const vault = path.join(dir, 'vault');
  const outside = path.join(dir, 'outside.md');
  fs.mkdirSync(vault);
  fs.writeFileSync(path.join(vault, 'inside.md'), 'ok');
  fs.writeFileSync(outside, 'no');
  fs.symlinkSync(outside, path.join(vault, 'link.md'));
  const guard = createPathGuard(vault);
  assert.equal(guard.resolveVaultPath('inside.md').relPath, 'inside.md');
  assert.throws(() => guard.resolveVaultPath('link.md'), /escapes/);
});
