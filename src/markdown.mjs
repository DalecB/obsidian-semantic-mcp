import crypto from 'node:crypto';
import path from 'node:path';

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) return { frontmatter: {}, bodyStartLine: 1 };
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return { frontmatter: {}, bodyStartLine: 1 };
  const block = raw.slice(4, end).trim();
  const frontmatter = {};
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    frontmatter[key] = value.replace(/^["']|["']$/g, '');
  }
  const bodyStartLine = raw.slice(0, end + 4).split(/\r?\n/).length;
  return { frontmatter, bodyStartLine };
}

export function extractTags(raw, frontmatter = {}) {
  const tags = new Set();
  const fmTags = frontmatter.tags || frontmatter.tag;
  if (typeof fmTags === 'string') {
    fmTags
      .replace(/^\[|\]$/g, '')
      .split(/[,\s]+/)
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .forEach((tag) => tags.add(tag));
  }
  for (const match of raw.matchAll(/(^|\s)#([A-Za-z가-힣_][A-Za-z0-9가-힣_/-]*)/g)) {
    tags.add(match[2]);
  }
  return [...tags].sort();
}

export function chunkMarkdown(relPath, raw) {
  const lines = raw.split(/\r?\n/);
  const { frontmatter } = parseFrontmatter(raw);
  const tags = extractTags(raw, frontmatter);
  const title = inferTitle(relPath, lines);
  const headings = collectHeadings(lines);
  const chunks = [];

  chunks.push(createSummaryChunk(relPath, title, frontmatter, tags, headings, lines));

  const sections = splitSections(lines);
  for (const section of sections) {
    for (const part of splitLongSection(section, 1200, 160)) {
      const text = part.lines.join('\n').trim();
      if (!text) continue;
      chunks.push({
        id: chunkId(relPath, part.headingPath, part.startLine, part.endLine, text, 'section'),
        path: relPath,
        kind: 'section',
        title,
        heading: part.headingPath,
        startLine: part.startLine,
        endLine: part.endLine,
        text: decorateChunkText(relPath, title, tags, part.headingPath, text),
        rawText: text,
        tags,
      });
    }
  }

  return { title, tags, frontmatter, headings, chunks };
}

function inferTitle(relPath, lines) {
  const heading = lines.find((line) => /^#\s+/.test(line));
  if (heading) return heading.replace(/^#\s+/, '').trim();
  return path.basename(relPath, '.md');
}

function collectHeadings(lines) {
  return lines
    .map((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) return null;
      return { level: match[1].length, text: match[2].trim(), line: index + 1 };
    })
    .filter(Boolean);
}

function splitSections(lines) {
  const sections = [];
  let stack = [];
  let current = { headingPath: '', startLine: 1, lines: [] };

  function pushCurrent(endLine) {
    if (current.lines.some((line) => line.trim())) {
      sections.push({ ...current, endLine });
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      pushCurrent(i);
      const level = match[1].length;
      stack = stack.filter((h) => h.level < level);
      stack.push({ level, text: match[2].trim() });
      current = {
        headingPath: stack.map((h) => h.text).join(' > '),
        startLine: i + 1,
        lines: [line],
      };
    } else {
      current.lines.push(line);
    }
  }
  pushCurrent(lines.length);
  return sections;
}

function splitLongSection(section, maxChars, overlapChars) {
  const text = section.lines.join('\n');
  if (text.length <= maxChars) return [section];
  const parts = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + maxChars);
    const partText = text.slice(start, end);
    const startLine = section.startLine + text.slice(0, start).split('\n').length - 1;
    const endLine = startLine + partText.split('\n').length - 1;
    parts.push({
      headingPath: section.headingPath,
      startLine,
      endLine,
      lines: partText.split('\n'),
    });
    if (end === text.length) break;
    start = Math.max(0, end - overlapChars);
  }
  return parts;
}

function createSummaryChunk(relPath, title, frontmatter, tags, headings, lines) {
  const firstParagraph = lines
    .filter((line) => line.trim() && !line.startsWith('---'))
    .slice(0, 8)
    .join('\n');
  const headingList = headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`).slice(0, 40).join('\n');
  const text = [
    `path: ${relPath}`,
    `title: ${title}`,
    tags.length ? `tags: ${tags.join(', ')}` : '',
    Object.keys(frontmatter).length ? `frontmatter: ${JSON.stringify(frontmatter)}` : '',
    headingList ? `headings:\n${headingList}` : '',
    firstParagraph ? `preview:\n${firstParagraph}` : '',
  ].filter(Boolean).join('\n');
  return {
    id: chunkId(relPath, '__summary__', 1, Math.min(lines.length, 40), text, 'summary'),
    path: relPath,
    kind: 'summary',
    title,
    heading: '__summary__',
    startLine: 1,
    endLine: Math.min(lines.length, 40),
    text,
    rawText: text,
    tags,
  };
}

function decorateChunkText(relPath, title, tags, heading, text) {
  return [
    `path: ${relPath}`,
    `title: ${title}`,
    heading ? `heading: ${heading}` : '',
    tags.length ? `tags: ${tags.join(', ')}` : '',
    text,
  ].filter(Boolean).join('\n');
}

function chunkId(relPath, heading, startLine, endLine, text, kind) {
  return sha256(`${kind}\n${relPath}\n${heading}\n${startLine}\n${endLine}\n${text}`).slice(0, 32);
}
