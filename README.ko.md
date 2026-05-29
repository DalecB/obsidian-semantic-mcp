# Obsidian Semantic Search MCP

Obsidian Vault를 **읽기 전용**으로 색인해서 Codex 같은 MCP 클라이언트가 원하는 노트를 더 정확히 찾게 해주는 로컬 MCP 서버입니다.

> 상태: `0.1.0` 초기 프리뷰입니다. 실사용은 가능하지만, `1.0` 전까지 tool 형태와 ranking 방식은 바뀔 수 있습니다.

[English README](./README.md)

## 하는 일

- Obsidian Vault의 Markdown 파일을 읽습니다.
- Vault 밖에 SQLite 검색 인덱스를 만듭니다.
- Ollama 로컬 임베딩을 사용합니다. 기본 모델은 `bge-m3`입니다.
- semantic vector search와 SQLite FTS5 keyword search를 섞어 검색합니다.
- 파일 단위 결과와 매칭된 section, line range를 반환합니다.

## 하지 않는 일

- Obsidian 플러그인이 아닙니다.
- 노트를 수정, 이동, 삭제, 생성하지 않습니다.
- OpenAI, Anthropic, OpenRouter 같은 외부 임베딩 API를 호출하지 않습니다.
- 노트를 외부 서버에 동기화하지 않습니다.

## 요구사항

- Node.js `>= 24`
- Ollama
- Obsidian Vault
- Codex, Claude Desktop, Cursor 등 stdio MCP 클라이언트

Ollama 설치 후 모델을 받습니다.

```bash
# macOS: https://ollama.com/download 에서 설치
ollama pull bge-m3
curl http://localhost:11434/api/tags
```

## 빠른 시작

설정 안내를 출력합니다.

```bash
npx -y --package @dalecb/obsidian-semantic-mcp obsidian-semantic-mcp-setup
```

직접 설정하려면 아래 예시를 사용합니다.

### Codex

`~/.codex/config.toml`에 추가합니다.

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

Codex를 재시작한 뒤 실행합니다.

```text
obsidian_semantic.index_status
obsidian_semantic.index_vault { "mode": "incremental" }
obsidian_semantic.search_notes { "query": "라이브 코딩 노트", "limit": 5 }
```

### JSON 방식 MCP 클라이언트

Claude Desktop, Cursor 등 JSON 설정을 쓰는 클라이언트는 아래 형태를 사용합니다.

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

## 제공 도구

### `index_status`

인덱스 상태와 안전 설정을 반환합니다.

### `index_vault`

Vault를 색인하거나 재색인합니다.

```json
{ "mode": "incremental" }
```

특정 파일만 갱신할 수도 있습니다.

```json
{
  "mode": "incremental",
  "paths": ["02_Projects/My Note.md"]
}
```

### `search_notes`

semantic + keyword hybrid 검색을 수행합니다.

```json
{
  "query": "라이브 코딩 노트",
  "limit": 8,
  "mode": "hybrid"
}
```

### `read_note`

Vault 상대 경로로 노트 원문 또는 특정 line range를 읽습니다.

```json
{
  "path": "02_Projects/My Note.md",
  "start_line": 10,
  "end_line": 40
}
```

## 개인정보와 안전성

기본 제외 경로:

- `.obsidian/**`
- `.smart-env/**`
- `.claude/**`
- `.codex*/**`
- `08_PersonalInfo/**`
- hidden/cache folders

`08_PersonalInfo/**` 같은 민감 경로는 tool call에서 `include_sensitive: true`를 넣어도 기본 차단됩니다. 명시적으로 허용하려면 서버 환경변수에 아래 값을 추가해야 합니다.

```toml
OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE = "true"
```

SQLite 인덱스에는 snippet과 embedding vector가 저장됩니다. Vault의 파생 복사본으로 취급해야 합니다. 자세한 내용은 [PRIVACY.md](./PRIVACY.md)를 보세요.

## 수동 인덱싱

이 서버는 Vault를 실시간 감시하지 않습니다.

`OBSIDIAN_SEMANTIC_STARTUP_INDEX=true`를 설정하지 않으면 시작 시 자동 인덱싱도 하지 않습니다.

노트를 수정한 뒤에는 아래를 실행합니다.

```json
{ "mode": "incremental" }
```

초기 공개 버전에서는 백그라운드 watcher보다 수동 증분 인덱싱이 더 안전합니다.

## 개발

```bash
npm test
npm run pack:check
```

배포 전 확인:

```bash
npm pack --dry-run
```

`data/`, `*.sqlite`, 개인 Vault 파일이 포함되지 않았는지 반드시 확인합니다.

## 라이선스

MIT
