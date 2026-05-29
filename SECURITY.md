# Security Policy

## Supported Versions

This project is currently pre-1.0. Security fixes target the latest `0.x` release.

## Reporting a Vulnerability

Please open a private security advisory on GitHub or contact the maintainer directly.

Do not include private Obsidian vault contents in public issues.

## Security Model

- The MCP server is read-only with respect to the Obsidian vault.
- The server does not expose note write, patch, delete, rename, or move tools.
- All vault paths are checked with `realpath` to block traversal and symlink escape.
- Hidden folders and sensitive folders are excluded by default.
- Sensitive paths require both a tool argument and `OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true`.
- Embeddings and SQLite index files are stored outside the vault by default.
