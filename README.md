<h1 align="center">Obsidian Semantic Search MCP</h1>

<p align="center">
  Read-only semantic retrieval for agents that need to find the right Obsidian note without write access.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dalecb/obsidian-semantic-mcp"><img alt="npm" src="https://img.shields.io/npm/v/@dalecb/obsidian-semantic-mcp?color=111827"></a>
  <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.DalecB/obsidian-semantic-mcp"><img alt="MCP Registry" src="https://img.shields.io/badge/MCP%20Registry-active-111827"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-111827"></a>
  <img alt="Node.js" src="https://img.shields.io/badge/node-%3E%3D24-111827">
</p>

<p align="center">
  <a href="./README.ko.md">한국어</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#why-this-exists">Why This Exists</a> ·
  <a href="#how-it-works">How It Works</a>
</p>

---

Your Obsidian vault is useful only if your agent can find the right note.

Keyword search misses context. Full write-capable Obsidian MCP servers expose more power than a retrieval agent needs. Obsidian plugins are great inside Obsidian, but they are not always the right boundary for Codex, Claude Desktop, Cursor, or any other MCP client.

This project is the narrow version:

```text
local Obsidian vault -> read-only scanner -> local SQLite index -> MCP search/read tools
```

No note writes. No cloud embeddings. No Obsidian plugin runtime. No sync service.

<p align="center">
  <img src="https://raw.githubusercontent.com/DalecB/obsidian-semantic-mcp/main/docs/architecture.png" alt="Local, read-only pipeline: Obsidian vault to scanner to chunker to Ollama embeddings to SQLite index, queried by an MCP client via search_notes and read_note" width="100%">
</p>

> Status: `0.2.1` early preview. The server is usable today, but ranking behavior and tool schemas may change before `1.0`.

## What You Get

| Need | What this server does |
| --- | --- |
| Find the note an agent should read | Hybrid semantic + keyword search over Markdown notes |
| Keep the vault safe | Exposes search/read/index/status only; no write, patch, move, rename, or delete tools |
| Stay local-first | Uses Ollama embeddings and stores the index on your machine |
| Make results agent-friendly | Returns file-level matches with headings, snippets, and line ranges |
| Avoid plugin state | Reads the vault directly from the filesystem; Obsidian does not need to be running |

Example result shape:

```json
{
  "path": "02_Projects/RealtimeAPI/05_Interview_QA.md",
  "title": "Interview Q&A",
  "score": 0.7431,
  "matched_sections": [
    {
      "heading": "Level 4 > Redis Lua atomicity",
      "lines": [266, 305],
      "reason": "semantic=1, keyword=0.5565, metadata=0.6"
    }
  ]
}
```

## Quick Start

Requirements:

- Node.js `>= 24`
- Ollama
- An Obsidian vault
- An MCP client such as Codex, Claude Desktop, Cursor, or another stdio MCP client

Install the embedding model:

```bash
ollama pull bge-m3
curl http://localhost:11434/api/tags
```

Print setup guidance:

```bash
npx -y --package @dalecb/obsidian-semantic-mcp obsidian-semantic-mcp-setup
```

## Codex Setup

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.obsidian_semantic]
command = "npx"
args = ["-y", "@dalecb/obsidian-semantic-mcp"]

[mcp_servers.obsidian_semantic.env]
OBSIDIAN_VAULT_ROOT = "/path/to/your/Obsidian Vault"
OBSIDIAN_SEMANTIC_MCP_HOME = "/Users/you/.obsidian-semantic-mcp"
OBSIDIAN_EMBED_MODEL = "bge-m3"
OBSIDIAN_SEMANTIC_STARTUP_INDEX = "false"
```

Restart Codex, then run:

```text
obsidian_semantic.index_status
obsidian_semantic.index_vault { "mode": "incremental" }
obsidian_semantic.search_notes { "query": "Redis Lua atomicity", "limit": 5 }
```

## JSON MCP Clients

Claude Desktop, Cursor, and other JSON-style MCP clients can use:

```json
{
  "mcpServers": {
    "obsidian_semantic": {
      "command": "npx",
      "args": ["-y", "@dalecb/obsidian-semantic-mcp"],
      "env": {
        "OBSIDIAN_VAULT_ROOT": "/path/to/your/Obsidian Vault",
        "OBSIDIAN_SEMANTIC_MCP_HOME": "/Users/you/.obsidian-semantic-mcp",
        "OBSIDIAN_EMBED_MODEL": "bge-m3",
        "OBSIDIAN_SEMANTIC_STARTUP_INDEX": "false"
      }
    }
  }
}
```

## Why This Exists

This isn't aiming to be the most powerful Obsidian automation server. It aims to be the safest retrieval tool you can hand an agent.

Here's how it stacks up against the two tools it usually comes down to — a full-permission Obsidian MCP server (Local REST API based) and GBrain (a broader knowledge-compilation platform):

| | **This project** | **Full-permission Obsidian MCP** | **GBrain** |
| --- | --- | --- | --- |
| Access model | Read-only: search / read / index | Read + write + edit + delete | Read + write; compiles notes into its own model |
| Touches your vault | Never | Yes | Yes — restructures content |
| Obsidian must run | No — reads files directly | Yes — needs the REST API plugin | No |
| Extra runtime | None | Obsidian + plugin | Standalone platform |
| Embeddings & data | Local Ollama; nothing leaves the machine | Local API; embeddings vary by setup | Built-in pipeline; optional sync |
| Storage | One SQLite file you can delete and rebuild | Plugin-managed | Its own store / migration |
| Best for | A small read-only retrieval boundary for agents | Full vault automation and editing | Building a compiled knowledge base across sources |

That trade is on purpose: give up writing, editing, and running inside Obsidian, and you get fewer moving parts and a smaller blast radius in return.

Use this if your agent should answer:

- "Which note explains this project decision?"
- "Find the file where I wrote about idempotency payload mismatch."
- "Show me the career notes related to this interview topic."
- "Search my vault, but do not mutate it."

Do not use this if you want an Obsidian UI plugin, automatic note generation, or write-capable vault automation.

## Tools

### `index_status`

Returns index metadata and safety settings.

### `index_vault`

Builds or updates the external SQLite index.

```json
{ "mode": "incremental" }
```

Specific files:

```json
{
  "mode": "incremental",
  "paths": ["02_Projects/My Note.md"]
}
```

### `search_notes`

Searches notes with hybrid semantic and keyword ranking.

```json
{
  "query": "live coding notes",
  "limit": 8,
  "mode": "hybrid"
}
```

Modes:

- `hybrid`: semantic vector + SQLite FTS5 + metadata boosts
- `semantic`: vector-first search
- `keyword`: FTS5 keyword search without embedding the query

### `read_note`

Reads a note or line range by vault-relative path.

```json
{
  "path": "02_Projects/My Note.md",
  "start_line": 10,
  "end_line": 40
}
```

## How It Works

```text
index_vault
  -> scan Markdown files under OBSIDIAN_VAULT_ROOT
  -> block denied paths and symlink escapes
  -> split notes by Markdown headings
  -> create one summary chunk per file
  -> embed chunks with Ollama bge-m3
  -> store notes, chunks, FTS rows, and vectors in SQLite

search_notes
  -> embed the query with Ollama
  -> score vector similarity
  -> score SQLite FTS5 keyword matches
  -> apply title/path/heading metadata boosts
  -> regroup chunk matches into file-level results
```

Default storage:

```text
~/.obsidian-semantic-mcp/
  data/semantic.sqlite
  logs/
  cache/
```

The vault remains the source of truth. The SQLite database is a derived index and can be deleted/rebuilt.

## Safety Model

The server reads your vault and never writes to it. Three layers decide what an agent can see.

**1. Always denied (system / tooling).** Never indexed, no override:

- `.obsidian/`, `.smart-env/`, `.claude/`, `.codex-*/`
- any hidden folder (name starts with `.`)
- `node_modules`, `cache`, `logs`

**2. Sensitive — denied by default, unlockable.** Stays blocked even when a tool call passes `include_sensitive: true`, unless the server is started with `OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true`. Defaults to `08_PersonalInfo/`. Override the list with `OBSIDIAN_SEMANTIC_SENSITIVE_PATHS` (comma- or newline-separated folders):

```toml
OBSIDIAN_SEMANTIC_SENSITIVE_PATHS = "08_PersonalInfo, 09_Finance"
```

**3. Your own excludes — always denied.** Folders you never want indexed, searched, or read. No unlock flag:

```toml
OBSIDIAN_SEMANTIC_EXCLUDE = "03_Journal, Private, Clients/Acme"
```

Which one do you want?

- **"Don't index this at all"** → `OBSIDIAN_SEMANTIC_EXCLUDE`
- **"Keep it locked, but I can unlock it with a flag when I need to"** → `OBSIDIAN_SEMANTIC_SENSITIVE_PATHS` + `OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE`

Additional guards:

- All paths are resolved through `realpath`.
- Path traversal and URL-encoded traversal are blocked.
- Symlinks that escape the vault root are blocked.

> **Changing these lists only affects new indexing.** Already-indexed notes keep their stored state until you reindex. After tightening `EXCLUDE` or `SENSITIVE`, run `index_vault { "mode": "full" }` so `search_notes` cannot surface stale hits. (`read_note` always enforces the live config.) You can confirm the active lists with `index_status`.

The local index stores snippets and embedding vectors. Treat it as a derived copy of your vault. See [PRIVACY.md](./PRIVACY.md).

## Indexing Strategy

The server does not watch your vault in real time.

After editing notes, run:

```json
{ "mode": "incremental" }
```

This keeps the first public version predictable and avoids background watcher risks. You can opt into startup indexing with:

```toml
OBSIDIAN_SEMANTIC_STARTUP_INDEX = "true"
```

## Development

```bash
npm test
npm run pack:check
```

Before publishing:

```bash
npm pack --dry-run
```

Confirm the package does not include `data/`, `*.sqlite`, or private vault files.

## License

MIT
