import os from 'node:os';
import path from 'node:path';

export const DEFAULT_APP_ROOT = path.join(os.homedir(), '.obsidian-semantic-mcp');
export const DEFAULT_MODEL = 'bge-m3';
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export function loadConfig(env = process.env) {
  const appRoot = env.OBSIDIAN_SEMANTIC_MCP_HOME || DEFAULT_APP_ROOT;
  return {
    appRoot,
    dataDir: path.join(appRoot, 'data'),
    logDir: path.join(appRoot, 'logs'),
    cacheDir: path.join(appRoot, 'cache'),
    dbPath: env.OBSIDIAN_SEMANTIC_DB || path.join(appRoot, 'data', 'semantic.sqlite'),
    vaultRoot: env.OBSIDIAN_VAULT_ROOT || '',
    ollamaUrl: env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_URL,
    embeddingModel: env.OBSIDIAN_EMBED_MODEL || DEFAULT_MODEL,
    startupIndex: env.OBSIDIAN_SEMANTIC_STARTUP_INDEX === 'true',
    allowSensitive: env.OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE === 'true',
    requestTimeoutMs: Number(env.OBSIDIAN_SEMANTIC_TIMEOUT_MS || 60000),
    excludePaths: parsePathPrefixes(env.OBSIDIAN_SEMANTIC_EXCLUDE),
    sensitivePaths: env.OBSIDIAN_SEMANTIC_SENSITIVE_PATHS
      ? parsePathPrefixes(env.OBSIDIAN_SEMANTIC_SENSITIVE_PATHS)
      : DEFAULT_SENSITIVE_PREFIXES,
  };
}

// Parse a comma/newline separated list of folders into normalized directory prefixes.
// "03_Journal, /Private" -> ["03_Journal/", "Private/"]
export function parsePathPrefixes(value) {
  if (!value) return [];
  return [...new Set(
    value
      .split(/[,\n]/)
      .map((entry) => entry.trim().replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/+$/, ''))
      .filter(Boolean)
      .map((entry) => `${entry}/`),
  )];
}

// Always-denied system/tooling folders. Never indexed, no unlock.
export const DEFAULT_DENY_PREFIXES = [
  '.obsidian/',
  '.smart-env/',
  '.claude/',
  '.codex-skill-staging/',
  '.codex-semantic-mcp/',
];

// Denied by default, but unlockable per call with include_sensitive when the
// server runs with OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true. Override via
// OBSIDIAN_SEMANTIC_SENSITIVE_PATHS.
export const DEFAULT_SENSITIVE_PREFIXES = ['08_PersonalInfo/'];

export const DEFAULT_ARCHIVE_PATTERNS = [
  '/Archive/',
  '_backup',
  '/_backup',
];
