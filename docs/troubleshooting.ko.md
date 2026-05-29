# 문제 해결

## `OBSIDIAN_VAULT_ROOT is required`

MCP 클라이언트 설정에 Vault 경로를 넣어야 합니다.

```toml
OBSIDIAN_VAULT_ROOT = "/path/to/your/Obsidian Vault"
```

## `Ollama embed failed`

Ollama가 설치되어 있고 실행 중인지 확인합니다.

```bash
curl http://localhost:11434/api/tags
ollama pull bge-m3
```

## 검색 결과가 오래됨

노트를 수정한 뒤 증분 인덱싱을 실행합니다.

```json
{ "mode": "incremental" }
```

특정 파일 하나만 갱신할 수도 있습니다.

```json
{
  "mode": "incremental",
  "paths": ["path/to/file.md"]
}
```

삭제되거나 이름이 바뀐 파일은 전체 Vault 증분 인덱싱을 다시 실행할 때 인덱스에서 제거됩니다.

## 검색이 느림

흔한 원인:

- Ollama 시작 후 첫 검색
- Vault가 큼
- 여러 MCP 클라이언트가 동시에 검색
- 매우 긴 노트가 많아 chunk가 많음

서버는 반복 query embedding을 캐시하고, Ollama embedding 요청을 기본적으로 직렬화합니다.

## 파일이 검색되지 않음

기본 제외 경로인지 확인합니다.

- hidden folders
- `.obsidian/**`
- `.smart-env/**`
- `.claude/**`
- `.codex*/**`
- `08_PersonalInfo/**`

`08_PersonalInfo/**`는 클라이언트가 `include_sensitive: true`를 전달해도 기본 차단됩니다. 서버 환경변수에 `OBSIDIAN_SEMANTIC_ALLOW_SENSITIVE=true`가 있을 때만 허용됩니다.

## 권한 오류

서버는 `OBSIDIAN_SEMANTIC_MCP_HOME`에만 씁니다. 해당 디렉터리에 쓰기 권한이 있어야 합니다.

```bash
mkdir -p ~/.obsidian-semantic-mcp
```
