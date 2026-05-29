# Privacy

Obsidian Semantic Search MCP is designed for local-first use.

## What Leaves Your Machine

By default, nothing is sent to external cloud APIs by this server.

The server sends note chunks to your local Ollama server, normally at:

```text
http://localhost:11434/api/embed
```

If you configure `OLLAMA_BASE_URL` to a remote server, your note chunks will be sent there.

## What Is Stored

The server stores a local SQLite index containing:

- vault-relative file paths
- headings and snippets
- chunk text used for search
- embedding vectors
- tags and metadata used for ranking

The index is stored outside the vault by default:

```text
~/.obsidian-semantic-mcp/data/semantic.sqlite
```

## Default Exclusions

The following are excluded by default:

- `.obsidian/**`
- `.smart-env/**`
- `.claude/**`
- `.codex*/**`
- `08_PersonalInfo/**`
- hidden/cache folders

Sensitive paths remain excluded unless the server is started with:

```text
OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true
```
