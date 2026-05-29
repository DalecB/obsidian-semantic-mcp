import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/database.mjs';
import { indexVault } from '../src/indexer.mjs';
import { readNote, searchNotes } from '../src/search.mjs';

class FakeEmbeddingClient {
  model = 'fake';
  async embed(input) {
    const inputs = Array.isArray(input) ? input : [input];
    const vectors = inputs.map((text) => {
      const lower = text.toLowerCase();
      return [
        lower.includes('redis') || lower.includes('lua') ? 1 : 0,
        lower.includes('mvcc') || lower.includes('isolation') ? 1 : 0,
        lower.includes('당근') || lower.includes('면접') ? 1 : 0,
      ];
    });
    return Array.isArray(input) ? vectors : vectors[0];
  }
}

test('indexes fixture vault without touching source files and searches file-level results', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ossm-'));
  const vault = path.join(dir, 'vault');
  const app = path.join(dir, 'app');
  fs.mkdirSync(path.join(vault, '02_Projects', 'RealtimeAPI'), { recursive: true });
  fs.mkdirSync(path.join(vault, '03_Knowledge', 'CS'), { recursive: true });
  fs.mkdirSync(path.join(vault, '08_PersonalInfo'), { recursive: true });
  fs.writeFileSync(path.join(vault, '02_Projects', 'RealtimeAPI', '05_Interview_QA.md'), '# RealtimeAPI\n\nRedis Lua 원자성과 idempotency payload mismatch 설명');
  fs.writeFileSync(path.join(vault, '03_Knowledge', 'CS', 'Day08.md'), '# MVCC\n\nisolation level phantom read');
  fs.writeFileSync(path.join(vault, '08_PersonalInfo', 'API KEY.md'), '# secret\n\nAPI_KEY=secret');
  const before = fs.readFileSync(path.join(vault, '02_Projects', 'RealtimeAPI', '05_Interview_QA.md'), 'utf8');
  const db = openDatabase(path.join(app, 'semantic.sqlite'));
  const counts = await indexVault({ db, vaultRoot: vault, embeddingClient: new FakeEmbeddingClient() });
  assert.equal(counts.failed, 0);
  assert.equal(fs.readFileSync(path.join(vault, '02_Projects', 'RealtimeAPI', '05_Interview_QA.md'), 'utf8'), before);
  const statusNotes = db.prepare('SELECT path FROM notes ORDER BY path').all().map((r) => r.path);
  assert.deepEqual(statusNotes, ['02_Projects/RealtimeAPI/05_Interview_QA.md', '03_Knowledge/CS/Day08.md']);
  const results = await searchNotes({ db, embeddingClient: new FakeEmbeddingClient(), query: 'Redis Lua 원자성', limit: 3 });
  assert.equal(results[0].path, '02_Projects/RealtimeAPI/05_Interview_QA.md');
  assert.throws(() => readNote({ vaultRoot: vault, path: '08_PersonalInfo/API KEY.md' }), /denied/);
});

test('incremental indexing removes stale rows for deleted files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ossm-'));
  const vault = path.join(dir, 'vault');
  const app = path.join(dir, 'app');
  fs.mkdirSync(vault, { recursive: true });
  const notePath = path.join(vault, 'delete-me.md');
  fs.writeFileSync(notePath, '# Delete Me\n\nRedis Lua stale note');

  const db = openDatabase(path.join(app, 'semantic.sqlite'));
  const embeddingClient = new FakeEmbeddingClient();
  await indexVault({ db, vaultRoot: vault, embeddingClient });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM notes').get().count, 1);

  fs.unlinkSync(notePath);
  const counts = await indexVault({ db, vaultRoot: vault, embeddingClient });
  assert.equal(counts.deleted, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM notes').get().count, 0);
});
