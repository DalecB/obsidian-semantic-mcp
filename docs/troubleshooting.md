# Troubleshooting

## `OBSIDIAN_VAULT_ROOT is required`

Set the vault path in your MCP client config.

```toml
OBSIDIAN_VAULT_ROOT = "/path/to/your/Obsidian Vault"
```

## `Ollama embed failed`

Check that Ollama is installed and running.

```bash
curl http://localhost:11434/api/tags
ollama pull bge-m3
```

## Search Results Are Stale

Run incremental indexing after editing notes.

```json
{ "mode": "incremental" }
```

For a single edited file:

```json
{
  "mode": "incremental",
  "paths": ["path/to/file.md"]
}
```

Deleted or renamed files are removed from the index the next time full-vault incremental indexing runs.

## Search Is Slow

Common causes:

- First query after starting Ollama.
- Large vault.
- Multiple MCP clients querying at once.
- Very large notes producing many chunks.

The server caches repeated query embeddings and serializes Ollama embedding requests by default.

## A File Does Not Appear

Check whether it is excluded by default:

- hidden folders
- `.obsidian/**`
- `.smart-env/**`
- `.claude/**`
- `.codex*/**`
- `08_PersonalInfo/**`

`08_PersonalInfo/**` remains blocked even when a client passes `include_sensitive: true`, unless the server environment includes `OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true`.

## Permission Errors

The server writes only to `OBSIDIAN_SEMANTIC_MCP_HOME`. Make sure that directory is writable.

```bash
mkdir -p ~/.obsidian-semantic-mcp
```
