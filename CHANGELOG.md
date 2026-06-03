# Changelog

## 0.2.0

- Add `OBSIDIAN_SEMANTIC_EXCLUDE` to let users always exclude their own folders from indexing, search, and read.
- Add `OBSIDIAN_SEMANTIC_SENSITIVE_PATHS` to override the default `08_PersonalInfo/` sensitive (unlockable) folder list.
- `index_status` now reports the active `system_denied`, `excluded_paths`, and `sensitive_paths` lists.
- Align `serverInfo.version` with the package version.

## 0.1.1

- Fix MCP Registry name casing to match the GitHub namespace authorization.
- Keep npm package metadata aligned with `server.json`.

## 0.1.0

- Early preview release.
- Read-only Obsidian vault semantic search over MCP.
- Local Ollama `bge-m3` embeddings.
- SQLite FTS5 + vector hybrid ranking.
- Default safety exclusions for Obsidian internals, hidden folders, and sensitive paths.
