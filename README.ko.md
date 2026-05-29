<h1 align="center">Obsidian Semantic Search MCP</h1>

<p align="center">
  AI agent가 Obsidian Vault에서 맞는 노트를 찾게 해주는 읽기 전용 semantic retrieval MCP.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dalecb/obsidian-semantic-mcp"><img alt="npm" src="https://img.shields.io/npm/v/@dalecb/obsidian-semantic-mcp?color=111827"></a>
  <a href="https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.DalecB/obsidian-semantic-mcp"><img alt="MCP Registry" src="https://img.shields.io/badge/MCP%20Registry-active-111827"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-111827"></a>
  <img alt="Node.js" src="https://img.shields.io/badge/node-%3E%3D24-111827">
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="#빠른-시작">빠른 시작</a> ·
  <a href="#왜-이게-필요한가">왜 필요한가</a> ·
  <a href="#동작-방식">동작 방식</a>
</p>

---

Obsidian Vault는 agent가 **맞는 노트**를 찾을 수 있을 때 가치가 커집니다.

키워드 검색은 표현이 다르면 놓칩니다. write-capable Obsidian MCP 서버는 retrieval만 필요한 agent에게 권한 표면이 넓습니다. Obsidian 플러그인은 Obsidian 안에서는 좋지만, Codex, Claude Desktop, Cursor 같은 MCP client의 안전한 검색 경계로는 항상 최선이 아닙니다.

이 프로젝트는 좁게 갑니다.

```text
local Obsidian vault -> read-only scanner -> local SQLite index -> MCP search/read tools
```

노트 수정 없음. 클라우드 임베딩 없음. Obsidian plugin runtime 없음. 동기화 서비스 없음.

> 상태: `0.1.1` early preview입니다. 지금 사용할 수 있지만, `1.0` 전까지 ranking과 tool schema는 바뀔 수 있습니다.

## 무엇을 해주는가

| 필요 | 이 서버가 하는 일 |
| --- | --- |
| agent가 읽어야 할 노트 찾기 | Markdown 노트에 semantic + keyword hybrid search 수행 |
| Vault 보호 | search/read/index/status만 제공. write, patch, move, rename, delete tool 없음 |
| local-first 유지 | Ollama 임베딩 사용, 인덱스는 로컬 SQLite에 저장 |
| agent가 바로 쓰기 좋은 결과 | 파일 단위 결과, heading, snippet, line range 반환 |
| Obsidian 상태와 분리 | Obsidian을 켜지 않아도 Vault 파일 시스템에서 직접 읽음 |

결과 예시:

```json
{
  "path": "02_Projects/RealtimeAPI/05_Interview_QA.md",
  "title": "면접 예상 Q&A",
  "score": 0.7431,
  "matched_sections": [
    {
      "heading": "Level 4 > Redis Lua 원자성",
      "lines": [266, 305],
      "reason": "semantic=1, keyword=0.5565, metadata=0.6"
    }
  ]
}
```

## 빠른 시작

요구사항:

- Node.js `>= 24`
- Ollama
- Obsidian Vault
- Codex, Claude Desktop, Cursor 등 stdio MCP client

임베딩 모델 설치:

```bash
ollama pull bge-m3
curl http://localhost:11434/api/tags
```

설정 안내 출력:

```bash
npx -y --package @dalecb/obsidian-semantic-mcp obsidian-semantic-mcp-setup
```

## Codex 설정

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

## JSON MCP Client 설정

Claude Desktop, Cursor 등 JSON 설정을 쓰는 MCP client는 아래 형태를 사용합니다.

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

## 왜 이게 필요한가

이 프로젝트는 가장 강력한 Obsidian 자동화 서버가 되려는 게 아닙니다. 목표는 agent에게 줄 수 있는 **가장 안전한 실사용 retrieval layer**입니다.

| 비교 대상 | 이 서버가 더 나은 경우 | 이 서버가 더 약한 경우 |
| --- | --- | --- |
| Obsidian Local REST API MCP 계열 | retrieval-only agent에게 더 작은 read-only tool surface를 주고 싶을 때 | 노트 CRUD, active file, template, frontmatter 편집이 필요할 때 |
| Smart Connections | Obsidian UI/plugin 상태에 기대지 않고 MCP로 검색하고 싶을 때 | Obsidian 안에서 완성도 높은 semantic search/related notes UX가 필요할 때 |
| 단순 keyword search | 질의 표현과 노트 표현이 달라도 관련 파일을 찾고 싶을 때 | 정확한 grep 방식 검색만 필요할 때 |
| Qdrant/LanceDB 계열 vector stack | SQLite 하나로 단순하게 로컬 설치하고 싶을 때 | 매우 큰 Vault에서 vector index 성능이 중요할 때 |

이런 질문에 맞습니다.

- "이 프로젝트 결정이 어디 노트에 있지?"
- "idempotency payload mismatch 쓴 파일 찾아줘."
- "이 면접 주제와 관련된 커리어 노트를 찾아줘."
- "Vault를 검색하되 절대 수정하지 마."

아래 목적이면 이 서버가 맞지 않습니다.

- Obsidian UI 플러그인
- 자동 노트 생성
- write-capable vault automation
- 대형 vector DB 수준의 확장성

## 제공 도구

### `index_status`

인덱스 상태와 안전 설정을 반환합니다.

### `index_vault`

외부 SQLite 인덱스를 생성하거나 갱신합니다.

```json
{ "mode": "incremental" }
```

특정 파일:

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

검색 모드:

- `hybrid`: semantic vector + SQLite FTS5 + metadata boost
- `semantic`: vector 중심 검색
- `keyword`: query embedding 없이 FTS5 keyword 검색

### `read_note`

Vault 상대 경로로 노트 전체 또는 특정 line range를 읽습니다.

```json
{
  "path": "02_Projects/My Note.md",
  "start_line": 10,
  "end_line": 40
}
```

## 동작 방식

```text
index_vault
  -> OBSIDIAN_VAULT_ROOT 아래 Markdown 파일 스캔
  -> deny path와 symlink escape 차단
  -> Markdown heading 기준 chunking
  -> 파일마다 summary chunk 생성
  -> Ollama bge-m3로 chunk embedding
  -> notes, chunks, FTS row, vector를 SQLite에 저장

search_notes
  -> query를 Ollama로 embedding
  -> vector similarity 계산
  -> SQLite FTS5 keyword match 계산
  -> title/path/heading metadata boost 적용
  -> chunk match를 파일 단위 결과로 재집계
```

기본 저장 위치:

```text
~/.obsidian-semantic-mcp/
  data/semantic.sqlite
  logs/
  cache/
```

Vault는 source of truth입니다. SQLite DB는 언제든 지우고 다시 만들 수 있는 파생 인덱스입니다.

## 안전 모델

기본 제외 경로:

- `.obsidian/**`
- `.smart-env/**`
- `.claude/**`
- `.codex*/**`
- `08_PersonalInfo/**`
- hidden folders
- `node_modules`, `cache`, `logs`

추가 보호:

- 모든 경로는 `realpath` 기준으로 검증합니다.
- path traversal과 URL-encoded traversal을 차단합니다.
- Vault 밖으로 나가는 symlink를 차단합니다.
- tool call에서 `include_sensitive: true`를 넘겨도 기본적으로 민감 경로는 막힙니다. 허용하려면 서버 환경변수에 명시적으로 추가해야 합니다.

```toml
OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE = "true"
```

SQLite 인덱스에는 snippet과 embedding vector가 저장됩니다. Vault의 파생 복사본으로 취급해야 합니다. 자세한 내용은 [PRIVACY.md](./PRIVACY.md)를 보세요.

## 인덱싱 전략

이 서버는 Vault를 실시간 감시하지 않습니다.

노트를 수정한 뒤에는 아래를 실행합니다.

```json
{ "mode": "incremental" }
```

초기 공개 버전에서는 background watcher보다 명시적 증분 인덱싱이 더 예측 가능합니다. 시작 시 자동 인덱싱을 원하면 아래를 설정합니다.

```toml
OBSIDIAN_SEMANTIC_STARTUP_INDEX = "true"
```

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
