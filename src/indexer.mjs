import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ARCHIVE_PATTERNS } from './config.mjs';
import { assertMarkdownPath, createPathGuard, isDeniedRelativePath, normalizeRelPath } from './fsSafety.mjs';
import { chunkMarkdown, sha256 } from './markdown.mjs';
import { setMeta } from './database.mjs';

export async function scanMarkdownFiles(vaultRoot, options = {}) {
  const guard = createPathGuard(vaultRoot);
  const out = [];

  function walk(absDir, relDir = '') {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = path.posix.join(relDir, entry.name);
      if (isDeniedRelativePath(entry.isDirectory() ? `${rel}/` : rel, options)) continue;
      const abs = path.join(absDir, entry.name);
      let real;
      try {
        real = fs.realpathSync(abs);
      } catch {
        continue;
      }
      if (real !== guard.rootReal && !real.startsWith(`${guard.rootReal}${path.sep}`)) continue;
      if (entry.isDirectory()) {
        walk(real, rel);
      } else if (entry.isFile() && rel.endsWith('.md')) {
        out.push(rel);
      }
    }
  }

  walk(guard.rootReal);
  return out.sort();
}

export async function indexVault({ db, vaultRoot, embeddingClient, mode = 'incremental', dryRun = false, paths = null, includeSensitive = false }) {
  const guard = createPathGuard(vaultRoot);
  const now = Date.now();
  const candidatePaths = paths?.length
    ? paths.map((p) => resolveRequestedPath(p, { includeSensitive }))
    : await scanMarkdownFiles(vaultRoot, { includeSensitive });
  const seen = new Set(candidatePaths);
  const counts = { indexed: 0, updated: 0, skipped: 0, deleted: 0, failed: 0, dryRun: Boolean(dryRun) };

  const existing = db.prepare('SELECT path FROM notes').all().map((row) => row.path);
  if (!paths?.length) {
    for (const rel of existing) {
      if (!seen.has(rel)) {
        if (!dryRun) deleteNote(db, rel);
        counts.deleted += 1;
      }
    }
  }

  for (const relPath of candidatePaths) {
    try {
      assertMarkdownPath(relPath);
      if (!fs.existsSync(path.join(guard.rootReal, relPath))) {
        if (existing.includes(relPath)) {
          if (!dryRun) deleteNote(db, relPath);
          counts.deleted += 1;
        } else {
          counts.skipped += 1;
        }
        continue;
      }
      const { absPath } = guard.resolveVaultPath(relPath, { includeSensitive });
      const stat = fs.statSync(absPath);
      const raw = fs.readFileSync(absPath, 'utf8');
      const hash = sha256(raw);
      const previous = db.prepare('SELECT hash FROM notes WHERE path = ?').get(relPath);
      if (mode !== 'full' && previous?.hash === hash) {
        counts.skipped += 1;
        continue;
      }
      if (dryRun) {
        previous ? counts.updated += 1 : counts.indexed += 1;
        continue;
      }
      const parsed = chunkMarkdown(relPath, raw);
      const embeddings = await embedInBatches(embeddingClient, parsed.chunks.map((chunk) => chunk.text), 16);
      replaceNote(db, {
        relPath,
        parsed,
        stat,
        hash,
        embeddings,
        updatedAt: now,
        archived: isArchived(relPath),
        sensitive: relPath.startsWith('08_PersonalInfo/'),
      });
      previous ? counts.updated += 1 : counts.indexed += 1;
    } catch (error) {
      counts.failed += 1;
      console.error(`[obsidian-semantic-mcp] index failed for ${relPath}: ${error.message}`);
    }
  }

  if (!dryRun) {
    setMeta(db, 'last_indexed_at', new Date(now).toISOString());
    setMeta(db, 'embedding_model', embeddingClient.model || 'unknown');
  }
  return counts;
}

function resolveRequestedPath(input, options) {
  const clean = normalizeRelPath(input);
  assertMarkdownPath(clean);
  if (isDeniedRelativePath(clean, options)) {
    throw new Error(`path is denied: ${clean}`);
  }
  return clean;
}

function replaceNote(db, { relPath, parsed, stat, hash, embeddings, updatedAt, archived, sensitive }) {
  db.exec('BEGIN IMMEDIATE');
  try {
    deleteNote(db, relPath);
    db.prepare(`
      INSERT INTO notes(path, title, mtime_ms, size, hash, tags_json, headings_json, archived, sensitive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      relPath,
      parsed.title,
      Math.round(stat.mtimeMs),
      stat.size,
      hash,
      JSON.stringify(parsed.tags),
      JSON.stringify(parsed.headings),
      archived ? 1 : 0,
      sensitive ? 1 : 0,
    );
    const insertChunk = db.prepare(`
      INSERT INTO chunks(id, path, kind, title, heading, start_line, end_line, text, raw_text, embedding_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertFts = db.prepare(`
      INSERT INTO chunks_fts(id, path, title, heading, tags, text)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    parsed.chunks.forEach((chunk, index) => {
      insertChunk.run(
        chunk.id,
        relPath,
        chunk.kind,
        chunk.title,
        chunk.heading,
        chunk.startLine,
        chunk.endLine,
        chunk.text,
        chunk.rawText,
        JSON.stringify(embeddings[index]),
        updatedAt,
      );
      insertFts.run(chunk.id, relPath, chunk.title, chunk.heading, chunk.tags.join(' '), chunk.rawText);
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function deleteNote(db, relPath) {
  const ids = db.prepare('SELECT id FROM chunks WHERE path = ?').all(relPath).map((row) => row.id);
  for (const id of ids) {
    db.prepare('DELETE FROM chunks_fts WHERE id = ?').run(id);
  }
  db.prepare('DELETE FROM chunks WHERE path = ?').run(relPath);
  db.prepare('DELETE FROM notes WHERE path = ?').run(relPath);
}

async function embedInBatches(client, texts, batchSize) {
  const out = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const vectors = await client.embed(batch);
    out.push(...vectors);
  }
  const dim = out[0]?.length;
  if (!dim || out.some((vector) => vector.length !== dim)) {
    throw new Error('embedding dimension mismatch');
  }
  return out;
}

function isArchived(relPath) {
  return DEFAULT_ARCHIVE_PATTERNS.some((pattern) => relPath.includes(pattern));
}
