# Obsidian Semantic Search MCP

Read-only semantic search MCP server for Obsidian vaults.

It lets Codex and other MCP clients find the right Obsidian notes with local embeddings, without turning Obsidian into a plugin host and without writing to your vault.

> Status: `0.1.0` early preview. The server is usable, but public API and ranking behavior may still change before `1.0`.

[한국어 README](./README.ko.md)

## What It Does

- Reads Markdown files from an Obsidian vault.
- Builds a local SQLite search index outside the vault.
- Uses local Ollama embeddings, default model `bge-m3`.
- Combines semantic vector search with SQLite FTS5 keyword search.
- Returns file-level results with matched sections and line ranges.

## What It Does Not Do

- It is not an Obsidian plugin.
- It does not modify, move, delete, or create notes.
- It does not call OpenAI, Anthropic, OpenRouter, or any external embedding API.
- It does not sync your notes anywhere.

## Requirements

- Node.js `>= 24`
- Ollama
- An Obsidian vault
- An MCP client such as Codex, Claude Desktop, Cursor, or another stdio MCP client

Install Ollama:

```bash
# macOS: install from https://ollama.com/download
ollama pull bge-m3
curl http://localhost:11434/api/tags
```

## Quick Start

Print setup guidance:

```bash
npx -y --package @dalecb/obsidian-semantic-mcp obsidian-semantic-mcp-setup
```

Or add the server manually.

### Codex

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

### JSON-style MCP Clients

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

## Tools

### `index_status`

Returns index metadata and safety settings.

### `index_vault`

Indexes or reindexes the vault.

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

### `read_note`

Reads a note or line range by vault-relative path.

```json
{
  "path": "02_Projects/My Note.md",
  "start_line": 10,
  "end_line": 40
}
```

## Privacy and Safety

Default exclusions:

- `.obsidian/**`
- `.smart-env/**`
- `.claude/**`
- `.codex*/**`
- `08_PersonalInfo/**`
- hidden and cache folders

Sensitive paths such as `08_PersonalInfo/**` stay blocked even if a tool call asks for `include_sensitive: true`. To opt in explicitly, set:

```toml
OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE = "true"
```

The local index stores snippets and embeddings. Treat it as a derived copy of your vault. See [PRIVACY.md](./PRIVACY.md).

## Manual Indexing

The server does not watch your vault in real time.

It also does not index automatically on startup unless `OBSIDIAN_SEMANTIC_STARTUP_INDEX=true` is set.

After editing notes, run:

```json
{ "mode": "incremental" }
```

This keeps the first public version simple and avoids background watcher risks.

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
