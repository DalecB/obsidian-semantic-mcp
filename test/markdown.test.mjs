import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkMarkdown } from '../src/markdown.mjs';

test('chunkMarkdown is deterministic and preserves heading lines', () => {
  const raw = `---\ntags: [project, backend]\n---\n# Title\n\nintro\n\n## Redis Lua\n\nidempotency payload mismatch`;
  const a = chunkMarkdown('02_Projects/Test.md', raw);
  const b = chunkMarkdown('02_Projects/Test.md', raw);
  assert.deepEqual(a.chunks.map((c) => c.id), b.chunks.map((c) => c.id));
  assert.equal(a.title, 'Title');
  assert.ok(a.tags.includes('project'));
  assert.ok(a.chunks.some((c) => c.heading.includes('Redis Lua') && c.startLine === 8));
  assert.equal(a.chunks[0].kind, 'summary');
});

test('extracts real tags without treating numeric issue ids as tags', () => {
  const raw = '#232 Queue 문제\n\n#backend #한글태그 #project/redis';
  const parsed = chunkMarkdown('03_Knowledge/LeetCode/232.md', raw);
  assert.deepEqual(parsed.tags, ['backend', 'project/redis', '한글태그']);
});
