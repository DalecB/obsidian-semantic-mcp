import test from 'node:test';
import assert from 'node:assert/strict';
import { OllamaEmbeddingClient } from '../src/ollama.mjs';

test('OllamaEmbeddingClient rejects invalid responses', async () => {
  const client = new OllamaEmbeddingClient({
    baseUrl: 'http://localhost:11434',
    model: 'bge-m3',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ embeddings: [] }),
    }),
  });
  await assert.rejects(() => client.embed('hello'), /invalid embeddings/);
});

test('OllamaEmbeddingClient reports HTTP failures', async () => {
  const client = new OllamaEmbeddingClient({
    baseUrl: 'http://localhost:11434',
    model: 'bge-m3',
    fetchImpl: async () => ({ ok: false, status: 500 }),
  });
  await assert.rejects(() => client.embed('hello'), /HTTP 500/);
});

test('OllamaEmbeddingClient caches identical single-text embeddings', async () => {
  let calls = 0;
  const client = new OllamaEmbeddingClient({
    baseUrl: 'http://localhost:11434',
    model: 'bge-m3',
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, json: async () => ({ embeddings: [[1, 2, 3]] }) };
    },
  });
  assert.deepEqual(await client.embed('same query'), [1, 2, 3]);
  assert.deepEqual(await client.embed('same query'), [1, 2, 3]);
  assert.equal(calls, 1);
});

test('OllamaEmbeddingClient deduplicates concurrent identical single-text embeddings', async () => {
  let calls = 0;
  const client = new OllamaEmbeddingClient({
    baseUrl: 'http://localhost:11434',
    model: 'bge-m3',
    fetchImpl: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true, json: async () => ({ embeddings: [[4, 5, 6]] }) };
    },
  });
  const results = await Promise.all([
    client.embed('concurrent query'),
    client.embed('concurrent query'),
    client.embed('concurrent query'),
  ]);
  assert.deepEqual(results, [[4, 5, 6], [4, 5, 6], [4, 5, 6]]);
  assert.equal(calls, 1);
});

test('OllamaEmbeddingClient limits request concurrency', async () => {
  let active = 0;
  let maxActive = 0;
  const client = new OllamaEmbeddingClient({
    baseUrl: 'http://localhost:11434',
    model: 'bge-m3',
    concurrency: 1,
    fetchImpl: async (_url, options) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      const count = JSON.parse(options.body).input.length;
      return { ok: true, json: async () => ({ embeddings: Array.from({ length: count }, (_, index) => [index]) }) };
    },
  });
  await Promise.all([
    client.embed(['a', 'b']),
    client.embed(['c', 'd']),
    client.embed(['e', 'f']),
  ]);
  assert.equal(maxActive, 1);
});
