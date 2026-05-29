#!/usr/bin/env node
import fs from 'node:fs';

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  console.error('usage: check-vault-unchanged.mjs <before.sha256> <after.sha256>');
  process.exit(2);
}

const before = fs.readFileSync(beforePath, 'utf8').trim().split('\n').filter(Boolean).sort();
const after = fs.readFileSync(afterPath, 'utf8').trim().split('\n').filter(Boolean).sort();

const beforeSet = new Set(before);
const afterSet = new Set(after);
const added = after.filter((line) => !beforeSet.has(line));
const removed = before.filter((line) => !afterSet.has(line));

if (added.length || removed.length) {
  console.error(JSON.stringify({ unchanged: false, added, removed }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ unchanged: true, entries: before.length }, null, 2));
