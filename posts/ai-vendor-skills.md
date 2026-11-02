Claude, OpenAI Codex, Gemini CLI, Cursor는 확장하는 방식이 이름만 다르고 구조는 비슷했다. 항상 읽히는 지침 파일이 하나 있고, 필요할 때만 꺼내 읽는 스킬이 있고, 그걸 묶어 배포하는 패키지(플러그인·확장)가 있다.

## 확장이 뭘 풀어 주는지

모델은 매번 빈 상태로 시작한다. 우리 프로젝트의 빌드 명령, 코드 규칙, 자주 하는 작업 절차는 어딘가에 적어서 읽혀야 한다. 코딩 에이전트 도구들은 이걸 파일로 푼다. 다만 전부 항상 읽히게 하면 [컨텍스트](#/post/ai-context)가 금방 찬다. 그래서 대부분 두 층으로 나눈다.

- 항상 읽히는 층: 짧은 지침 파일(CLAUDE.md, AGENTS.md, GEMINI.md, Cursor 규칙)
- 필요할 때만 읽히는 층: 스킬. 이름과 설명만 올려 두고 본문은 쓸 때 읽는다. 원리는 [스킬](#/post/ai-skills) 글에 정리했다.

여기에 외부 도구를 붙이는 [MCP](#/post/ai-mcp) 서버, 여러 조각을 한 번에 설치하는 패키지가 얹힌다.

## 도구별 비교표

공식 문서에서 확인한 것만 넣었다.

| 도구 | 이름 | 방식 | 파일 위치 | 예 |
|---|---|---|---|---|
| Claude Code | CLAUDE.md | 항상 로드되는 지침 | 프로젝트 `./CLAUDE.md` 또는 `./.claude/CLAUDE.md`, 개인 `~/.claude/CLAUDE.md`, 규칙 분할은 `.claude/rules/` | 빌드·테스트 명령, 코딩 규칙 |
| Claude Code | 스킬 | 설명만 상주, 본문은 필요할 때 로드 | 개인 `~/.claude/skills/<이름>/SKILL.md`, 프로젝트 `.claude/skills/<이름>/SKILL.md` | `/deploy`, 변경 요약 스킬 |
| Claude Code | 플러그인 | 스킬·에이전트·훅·MCP 서버를 한 묶음으로 설치 | `.claude-plugin/plugin.json`, 설치된 것은 `~/.claude/plugins/` | 마켓플레이스에서 `/plugin`으로 설치 |
| OpenAI Codex | AGENTS.md | 항상 로드되는 지침 | 전역 `~/.codex/AGENTS.md`, 프로젝트는 루트부터 현재 폴더까지 각 폴더의 `AGENTS.md` | 저장소 작업 규칙 |
| OpenAI Codex | 스킬 | 설명만 상주, 본문은 선택될 때 로드 | `$HOME/.agents/skills`, 저장소 `.agents/skills` | `$changelog-writer` |
| Gemini CLI | GEMINI.md | 항상 로드되는 지침 | 전역 `~/.gemini/GEMINI.md`, 작업 폴더와 상위 폴더의 `GEMINI.md` | 말투·스타일 가이드 |
| Gemini CLI | 확장(extension) | 프롬프트·MCP·명령·스킬·훅·서브에이전트 묶음 | `~/.gemini/extensions/<이름>/gemini-extension.json` | `gemini extensions install <저장소 URL>` |
| Cursor | 규칙(Rules) | 유형별로 붙는 지침 | `.cursor/rules/*.mdc`, 사용자 규칙은 설정 화면 | 특정 파일 패턴에만 붙는 규칙 |
| Cursor | AGENTS.md | 프론트매터 없는 지침 | 프로젝트 루트나 하위 폴더 | 폴더별 지침 |
| ChatGPT | GPTs | 지침·지식 파일·기능·앱·액션을 묶은 맞춤 챗봇 | 파일이 아니라 ChatGPT 안에서 만든다 | 특정 목적용 챗봇 |

## 도구별로 조금 더

### Claude

Claude Code는 확장 층이 가장 많이 나뉘어 있다. 지침은 CLAUDE.md, 절차는 스킬, 묶음은 플러그인이다. 문서는 CLAUDE.md에는 "항상 들고 있을 사실"만 두고, 여러 단계의 절차나 일부 코드에만 해당하는 내용은 스킬이나 경로별 규칙으로 옮기라고 안내한다.

스킬 쪽은 `SKILL.md` 머리말로 동작을 조절한다. `disable-model-invocation: true`면 사람이 `/이름`으로만 부를 수 있고, `user-invocable: false`면 모델만 쓴다. 옛 `.claude/commands/deploy.md` 형식도 아직 되지만 스킬이 같은 이름이면 스킬이 이긴다. 같은 이름이 겹치면 엔터프라이즈, 개인, 프로젝트 순으로 우선한다. 쓰는 요령은 [Claude 스킬 활용](#/post/claude-skills)과 [인기 스킬](#/post/claude-popular-skills) 글에 따로 있다.

플러그인은 활성화하면 스킬·에이전트의 이름과 설명이 매 턴 컨텍스트에 올라간다. 안 쓰는 세션에서도 토큰이 조금씩 나간다는 뜻이라 문서도 이 점을 미리 알리고, 공식 마켓플레이스 플러그인은 설치 전에 컨텍스트 비용 추정치를 보여 준다. 또 Claude Code는 저장소의 `AGENTS.md`를 CLAUDE.md 대신 읽을 수 있다고 한다.

### OpenAI Codex

Codex의 AGENTS.md는 시작할 때 한 번 지침 체인을 만든다. 전역 폴더(`~/.codex`)에서 하나, 프로젝트 루트에서 현재 폴더까지 내려오며 폴더마다 최대 하나씩 읽어 이어 붙인다. 현재 폴더에 가까운 파일이 뒤에 오므로 앞의 지침을 덮어쓴다. 같은 자리에 `AGENTS.override.md`가 있으면 그게 일반 파일 대신 쓰인다. 합친 크기는 기본 32KiB까지다.

스킬은 Claude와 형태가 같다. `SKILL.md`에 `name`과 `description`이 필수이고, `scripts/`, `references/`, `assets/` 폴더를 곁에 둘 수 있다. 호출은 `$스킬이름`이나 `/skills`로 직접 하거나, 작업이 설명과 맞으면 Codex가 고른다. 처음 올라가는 스킬 목록은 컨텍스트 창의 약 2%로 제한된다. 끄고 싶으면 `agents/openai.yaml`에서 `allow_implicit_invocation: false`를 준다.

### Gemini CLI

GEMINI.md는 전역, 작업 폴더와 상위 폴더, 그리고 도구가 파일에 접근할 때 그 위치를 훑는 세 군데에서 읽어 이어 붙인다. `@파일.md`로 다른 파일을 가져올 수 있고, `context.fileName`에 `["AGENTS.md", "GEMINI.md"]`처럼 적으면 읽을 파일 이름을 바꾼다. `/memory show`로 합쳐진 결과를 볼 수 있다.

확장은 이 중 묶음 역할이다. 루트에 `gemini-extension.json`을 두고, `commands/`(TOML 명령), `skills/`, `agents/`(서브에이전트, 미리보기), `hooks/hooks.json`, `policies/`를 넣을 수 있다. 매니페스트에는 `mcpServers`, `contextFileName`, `excludeTools`, `settings`(API 키 같은 사용자 값) 등을 적는다. 설치는 복사본을 만드는 방식이라 원본이 바뀌면 `gemini extensions update`를 해야 한다.

문서 상단에는 2026년 6월 18일부로 무료 요금제와 Google One 사용자에게는 Gemini CLI가 Antigravity CLI로 대체됐다는 안내가 있었다. 글을 읽는 시점에 어느 쪽을 쓰는지는 따로 확인해야 한다.

### Cursor

Cursor 규칙은 `.cursor/rules`의 `.mdc` 파일이고, 일반 `.md`는 무시된다. 머리말의 `description`, `globs`, `alwaysApply`로 네 가지 유형이 갈린다.

| 유형 | 붙는 때 |
|---|---|
| Always Apply | 모든 대화 |
| Apply to Specific Files | glob에 맞는 파일이 컨텍스트에 있을 때 |
| Apply Intelligently | 에이전트가 description을 보고 맞다고 판단할 때 |
| Apply Manually | `@규칙이름`으로 직접 불렀을 때 |

앞의 세 도구가 "항상 읽히는 파일"과 "필요할 때 읽는 스킬"로 나눈 걸, Cursor는 규칙 하나 안에서 유형으로 나눈 셈이다. 팀·엔터프라이즈 요금제에는 대시보드에서 관리하는 팀 규칙이 있고 관리자가 강제할 수 있다.

### ChatGPT

ChatGPT의 GPTs는 파일을 폴더에 두는 방식과 결이 다르다. 지침, 올려 둔 지식 파일, 기능, 앱, 액션을 화면에서 묶어 맞춤 챗봇 하나를 만든다. OpenAI 도움말에는 앱과 액션을 한 GPT에서 동시에 쓸 수 없다고 적혀 있다.

## 같이 보이는 공통점

- 지침 파일 이름은 달라도 AGENTS.md가 공통어처럼 쓰인다. Codex는 원래 쓰고, Cursor는 지원하며, Claude Code는 읽을 수 있고, Gemini CLI는 파일 이름 설정으로 읽게 할 수 있다.
- 스킬 형식은 `SKILL.md` 폴더로 수렴하는 모습이다. Claude, Codex, Gemini CLI 확장이 모두 같은 파일 이름을 쓴다.
- 상주하는 건 이름과 설명, 본문은 필요할 때. 그래서 설명 문장이 호출 정확도를 좌우한다.
- 묶음 단위는 플러그인(Claude)이나 확장(Gemini CLI)이고, 외부 도구 연결은 MCP로 통한다.

## 흔한 오해

- 지침 파일에 다 적으면 된다고 생각하기 쉽지만, 항상 읽히는 층이라 길수록 컨텍스트와 토큰을 먹는다. 절차는 스킬로 빼는 쪽이 문서의 권고다.
- 지침은 강제가 아니다. Claude 문서도 CLAUDE.md는 설정이 아니라 컨텍스트로 다뤄진다고 하고, 반드시 막아야 하는 건 훅으로 하라고 한다.
- 같은 이름의 스킬 폴더라고 도구 사이에서 그대로 옮겨지는 건 아니다. 위치(`.claude/skills`, `.agents/skills`)와 머리말 필드가 도구마다 다르다.
- 플러그인을 많이 깔수록 좋은 게 아니다. 켜 둔 것은 안 써도 설명이 컨텍스트에 올라간다.

<details>
<summary>도구별 SKILL.md 머리말 비교</summary>

| 항목 | Claude Code | Codex |
|---|---|---|
| 필수 필드 | 없음(description 권장) | name, description |
| 사람만 호출 | `disable-model-invocation: true` | - |
| 모델 자동 호출 끄기 | 위와 같음 | `agents/openai.yaml`의 `allow_implicit_invocation: false` |
| 직접 호출 | `/이름` | `$이름` |
| 서브에이전트 실행 | `context: fork` | - |

</details>

← 개념 map으로 (#/post/ai-map)

관련 글: [스킬](#/post/ai-skills), [MCP](#/post/ai-mcp), [하네스](#/post/ai-harness)

## 근거 링크

- Claude Code 스킬: https://code.claude.com/docs/en/skills
- Claude Code 플러그인: https://code.claude.com/docs/en/plugins
- Claude Code 메모리(CLAUDE.md): https://code.claude.com/docs/en/memory
- Codex 스킬: https://learn.chatgpt.com/docs/build-skills
- Codex AGENTS.md: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- Gemini CLI 확장: https://geminicli.com/docs/extensions/
- Gemini CLI 확장 레퍼런스: https://geminicli.com/docs/extensions/reference/
- Gemini CLI GEMINI.md: https://geminicli.com/docs/cli/gemini-md/
- Cursor 규칙: https://cursor.com/docs/context/rules
- OpenAI GPTs 도움말(검색 결과 요약으로만 확인): https://help-lb.openai.com/en/articles/8554407
