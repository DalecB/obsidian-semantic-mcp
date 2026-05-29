import readline from 'node:readline';
import { loadConfig } from './config.mjs';
import { ensureAppDirs } from './fsSafety.mjs';
import { openDatabase } from './database.mjs';
import { OllamaEmbeddingClient } from './ollama.mjs';
import { indexVault } from './indexer.mjs';
import { indexStatus, readNote, searchNotes } from './search.mjs';

const TOOLS = [
  {
    name: 'search_notes',
    description: 'Read-only hybrid semantic/keyword search over the Obsidian vault. Returns file-level results with matched sections.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', default: 8 },
        mode: { type: 'string', enum: ['hybrid', 'semantic', 'keyword'], default: 'hybrid' },
        folder_include: { type: 'string' },
        folder_exclude: { type: 'string' },
        include_archived: { type: 'boolean', default: false },
        include_sensitive: {
          type: 'boolean',
          default: false,
          description: 'Requires OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true on the server.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_note',
    description: 'Read-only markdown note reader by vault-relative path and optional line range.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        start_line: { type: 'number' },
        end_line: { type: 'number' },
        include_sensitive: {
          type: 'boolean',
          default: false,
          description: 'Requires OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true on the server.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'index_vault',
    description: 'Index or reindex the Obsidian vault into the external semantic index. Does not modify the vault.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['incremental', 'full'], default: 'incremental' },
        dry_run: { type: 'boolean', default: false },
        paths: { type: 'array', items: { type: 'string' } },
        include_sensitive: {
          type: 'boolean',
          default: false,
          description: 'Requires OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true on the server.',
        },
      },
    },
  },
  {
    name: 'index_status',
    description: 'Return semantic index status and safety settings.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export async function startServer() {
  const config = loadConfig();
  if (!config.vaultRoot) {
    throw new Error('OBSIDIAN_VAULT_ROOT is required. Set it to your Obsidian vault path.');
  }
  ensureAppDirs(config);
  const db = openDatabase(config.dbPath);
  const embeddingClient = new OllamaEmbeddingClient({
    baseUrl: config.ollamaUrl,
    model: config.embeddingModel,
    timeoutMs: config.requestTimeoutMs,
  });
  let startupIndexPromise = Promise.resolve(null);
  if (config.startupIndex) {
    startupIndexPromise = indexVault({ db, vaultRoot: config.vaultRoot, embeddingClient, mode: 'incremental' })
      .catch((error) => {
        console.error(`[obsidian-semantic-mcp] startup index skipped: ${error.message}`);
        return null;
      });
  }

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      return;
    }
    if (!Object.hasOwn(request, 'id')) {
      return;
    }
    try {
      const result = await handleRequest(request, { config, db, embeddingClient, startupIndexPromise });
      respond(request.id, result);
    } catch (error) {
      respondError(request.id, error);
    }
  });
}

async function handleRequest(request, context) {
  switch (request.method) {
    case 'initialize':
      return {
        protocolVersion: request.params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'obsidian-semantic-mcp', version: '0.1.0' },
      };
    case 'tools/list':
      return { tools: TOOLS };
    case 'tools/call':
      return callTool(request.params || {}, context);
    case 'ping':
      return {};
    default:
      throw new Error(`unsupported method: ${request.method}`);
  }
}

async function callTool(params, { config, db, embeddingClient, startupIndexPromise }) {
  const name = params.name;
  const args = params.arguments || {};
  if (name === 'index_status') {
    return textResult(indexStatus(db, config));
  }
  if (name === 'index_vault') {
    const result = await indexVault({
      db,
      vaultRoot: config.vaultRoot,
      embeddingClient,
      mode: args.mode || 'incremental',
      dryRun: Boolean(args.dry_run),
      paths: args.paths || null,
      includeSensitive: resolveSensitiveAccess(args, config),
    });
    return textResult(result);
  }
  if (name === 'search_notes') {
    await startupIndexPromise;
    const results = await searchNotes({
      db,
      embeddingClient,
      ...args,
      include_sensitive: resolveSensitiveAccess(args, config),
    });
    return textResult({ results });
  }
  if (name === 'read_note') {
    const result = readNote({
      vaultRoot: config.vaultRoot,
      ...args,
      include_sensitive: resolveSensitiveAccess(args, config),
    });
    return textResult(result);
  }
  throw new Error(`unknown tool: ${name}`);
}

export function resolveSensitiveAccess(args, config) {
  const requested = Boolean(args.include_sensitive);
  if (requested && !config.allowSensitive) {
    throw new Error('include_sensitive requires OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true on the server');
  }
  return requested;
}

function textResult(value) {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
  };
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function respondError(id, error) {
  process.stdout.write(`${JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code: -32000, message: error?.message || String(error) },
  })}\n`);
}
