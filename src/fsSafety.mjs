import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_DENY_PREFIXES, DEFAULT_SENSITIVE_PREFIXES } from './config.mjs';

export function normalizeRelPath(input) {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('path must be a non-empty string');
  }
  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    decoded = input;
  }
  const normalized = decoded.replaceAll('\\', '/').replace(/^\/+/, '');
  if (path.isAbsolute(decoded) || normalized.includes('\0')) {
    throw new Error('absolute or invalid paths are not allowed');
  }
  const clean = path.posix.normalize(normalized);
  if (clean === '.' || clean.startsWith('../') || clean === '..') {
    throw new Error('path traversal is not allowed');
  }
  return clean;
}

export function isDeniedRelativePath(
  relPath,
  { includeSensitive = false, excludePaths = [], sensitivePaths = DEFAULT_SENSITIVE_PREFIXES } = {},
) {
  const rel = relPath.replaceAll('\\', '/');
  const segments = rel.split('/').filter(Boolean);
  if (segments.some((segment) => segment.startsWith('.'))) return true;
  if (segments.some((segment) => ['node_modules', 'cache', 'logs'].includes(segment))) return true;
  if (excludePaths.some((prefix) => rel.startsWith(prefix))) return true;
  if (DEFAULT_DENY_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
  if (!includeSensitive && sensitivePaths.some((prefix) => rel.startsWith(prefix))) return true;
  return false;
}

export function assertMarkdownPath(relPath) {
  if (!relPath.endsWith('.md')) {
    throw new Error('only markdown files are allowed');
  }
}

export function createPathGuard(vaultRoot) {
  const rootReal = fs.realpathSync(vaultRoot);
  const rootWithSep = rootReal.endsWith(path.sep) ? rootReal : `${rootReal}${path.sep}`;

  function resolveVaultPath(relPath, options = {}) {
    const clean = normalizeRelPath(relPath);
    if (isDeniedRelativePath(clean, options)) {
      throw new Error(`path is denied: ${clean}`);
    }
    const joined = path.join(rootReal, clean);
    const real = fs.realpathSync(joined);
    if (real !== rootReal && !real.startsWith(rootWithSep)) {
      throw new Error('resolved path escapes vault root');
    }
    return { relPath: clean, absPath: real };
  }

  return { rootReal, resolveVaultPath };
}

export function ensureAppDirs(config) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.logDir, { recursive: true });
  fs.mkdirSync(config.cacheDir, { recursive: true });
}
