import fs from 'node:fs';
import { createPathGuard } from './fsSafety.mjs';

export async function searchNotes({ db, embeddingClient, query, limit = 8, mode = 'hybrid', folder_include, folder_exclude, include_archived = false, include_sensitive = false }) {
  if (!query || typeof query !== 'string') throw new Error('query is required');
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 8, 30));
  const queryVector = mode === 'keyword' ? null : await embeddingClient.embed(query);
  const vectorScores = queryVector ? scoreVectors(db, queryVector, { include_archived, include_sensitive }) : new Map();
  const ftsScores = mode === 'semantic' ? new Map() : scoreFts(db, query, { include_archived, include_sensitive });
  const ids = new Set([...vectorScores.keys(), ...ftsScores.keys()]);
  const chunkRows = ids.size
    ? db.prepare(`SELECT c.*, n.tags_json, n.archived, n.sensitive, n.mtime_ms FROM chunks c JOIN notes n ON n.path = c.path WHERE c.id IN (${[...ids].map(() => '?').join(',')})`).all(...ids)
    : [];
  const files = new Map();

  for (const row of chunkRows) {
    if (!include_archived && row.archived) continue;
    if (!include_sensitive && row.sensitive) continue;
    if (folder_include && !row.path.startsWith(folder_include)) continue;
    if (folder_exclude && row.path.startsWith(folder_exclude)) continue;
    const vector = vectorScores.get(row.id) ?? 0;
    const lexical = ftsScores.get(row.id) ?? 0;
    const meta = metadataBoost(query, row);
    const recency = recencyBoost(row.mtime_ms);
    const archivePenalty = row.archived ? -0.25 : 0;
    const score = mode === 'semantic'
      ? vector * 0.85 + meta * 0.15 + archivePenalty
      : mode === 'keyword'
        ? lexical * 0.75 + meta * 0.2 + recency * 0.05 + archivePenalty
        : vector * 0.45 + lexical * 0.35 + meta * 0.15 + recency * 0.05 + archivePenalty;
    const current = files.get(row.path) || {
      path: row.path,
      title: row.title,
      tags: JSON.parse(row.tags_json || '[]'),
      bestScore: -Infinity,
      chunkScores: [],
      matched_sections: [],
      mtime: new Date(row.mtime_ms).toISOString(),
    };
    current.bestScore = Math.max(current.bestScore, score);
    current.chunkScores.push(score);
    current.matched_sections.push({
      heading: row.heading,
      line: row.start_line,
      lines: [row.start_line, row.end_line],
      score: round(score),
      snippet: snippet(row.raw_text),
      reason: reason(vector, lexical, meta),
    });
    files.set(row.path, current);
  }

  return [...files.values()]
    .map((file) => {
      const top = file.chunkScores.sort((a, b) => b - a).slice(0, 3);
      const score = file.bestScore * 0.7 + (top.reduce((a, b) => a + b, 0) / top.length) * 0.3;
      return {
        path: file.path,
        title: file.title,
        score: round(score),
        tags: file.tags,
        mtime: file.mtime,
        matched_sections: file.matched_sections.sort((a, b) => b.score - a.score).slice(0, 3),
      };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, boundedLimit);
}

export function readNote({ vaultRoot, path: relPath, start_line, end_line, include_sensitive = false }) {
  const guard = createPathGuard(vaultRoot);
  const { absPath, relPath: clean } = guard.resolveVaultPath(relPath, { includeSensitive: include_sensitive });
  const raw = fs.readFileSync(absPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const start = start_line ? Math.max(1, Number(start_line)) : 1;
  const end = end_line ? Math.min(lines.length, Number(end_line)) : lines.length;
  return {
    path: clean,
    start_line: start,
    end_line: end,
    content: lines.slice(start - 1, end).join('\n'),
  };
}

export function indexStatus(db, config) {
  const notes = db.prepare('SELECT COUNT(*) AS count FROM notes').get().count;
  const chunks = db.prepare('SELECT COUNT(*) AS count FROM chunks').get().count;
  const archived = db.prepare('SELECT COUNT(*) AS count FROM notes WHERE archived = 1').get().count;
  const sensitive = db.prepare('SELECT COUNT(*) AS count FROM notes WHERE sensitive = 1').get().count;
  const model = db.prepare("SELECT value FROM meta WHERE key = 'embedding_model'").get()?.value || config.embeddingModel;
  const lastIndexedAt = db.prepare("SELECT value FROM meta WHERE key = 'last_indexed_at'").get()?.value || null;
  return {
    vault_root: config.vaultRoot,
    db_path: config.dbPath,
    embedding_model: model,
    last_indexed_at: lastIndexedAt,
    notes,
    chunks,
    archived,
    sensitive,
    read_only: true,
    startup_index: config.startupIndex,
    sensitive_access_enabled: config.allowSensitive,
    denied_defaults: ['.obsidian/**', '.smart-env/**', '.claude/**', '.codex*/**', '08_PersonalInfo/**'],
  };
}

function scoreVectors(db, queryVector, { include_archived, include_sensitive }) {
  const rows = db.prepare(`
    SELECT c.id, c.embedding_json, n.archived, n.sensitive
    FROM chunks c JOIN notes n ON n.path = c.path
  `).all();
  const scores = rows
    .filter((row) => (include_archived || !row.archived) && (include_sensitive || !row.sensitive))
    .map((row) => [row.id, cosine(queryVector, JSON.parse(row.embedding_json || '[]'))])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 120);
  return normalizeScores(scores);
}

function scoreFts(db, query, { include_archived, include_sensitive }) {
  const fts = toFtsQuery(query);
  if (!fts) return new Map();
  let rows = [];
  try {
    rows = db.prepare(`
      SELECT f.id, bm25(chunks_fts) AS rank, n.archived, n.sensitive
      FROM chunks_fts f
      JOIN chunks c ON c.id = f.id
      JOIN notes n ON n.path = c.path
      WHERE chunks_fts MATCH ?
      ORDER BY rank
      LIMIT 120
    `).all(fts);
  } catch {
    return new Map();
  }
  const pairs = rows
    .filter((row) => (include_archived || !row.archived) && (include_sensitive || !row.sensitive))
    .map((row) => [row.id, -row.rank]);
  return normalizeScores(pairs);
}

function normalizeScores(pairs) {
  if (!pairs.length) return new Map();
  const values = pairs.map(([, score]) => score);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return new Map(pairs.map(([id, score]) => [id, (score - min) / range]));
}

function toFtsQuery(query) {
  return query
    .split(/\s+/)
    .map((term) => term.trim().replaceAll('"', ''))
    .filter((term) => term.length >= 2)
    .slice(0, 12)
    .map((term) => `"${term}"`)
    .join(' OR ');
}

function cosine(a, b) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return dot / (Math.sqrt(aa) * Math.sqrt(bb) || 1);
}

function metadataBoost(query, row) {
  const q = query.toLowerCase();
  let boost = 0;
  for (const value of [row.path, row.title, row.heading]) {
    const lower = String(value || '').toLowerCase();
    if (lower.includes(q)) boost += 1;
    for (const token of q.split(/\s+/)) {
      if (token.length >= 2 && lower.includes(token)) boost += 0.2;
    }
  }
  if (row.kind === 'summary') boost += 0.1;
  return Math.min(boost, 1);
}

function recencyBoost(mtimeMs) {
  const ageDays = Math.max(0, (Date.now() - Number(mtimeMs)) / 86400000);
  return Math.max(0, 1 - ageDays / 365) * 0.2;
}

function snippet(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function reason(vector, lexical, meta) {
  const parts = [];
  if (vector > 0) parts.push(`semantic=${round(vector)}`);
  if (lexical > 0) parts.push(`keyword=${round(lexical)}`);
  if (meta > 0) parts.push(`metadata=${round(meta)}`);
  return parts.join(', ') || 'low-confidence match';
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
