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
