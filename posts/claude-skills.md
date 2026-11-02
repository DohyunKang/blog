Claude Code에는 설정 수단이 여럿인데, 공식 문서를 읽어 보니 "항상 알려 줄 것 / 필요할 때만 꺼낼 것 / 반드시 강제할 것 / 밖과 연결할 것"으로 나누면 거의 정리됐다.

## 먼저 표로 보기

| 무엇을 | 언제 쓰나 | 파일 위치 |
|---|---|---|
| CLAUDE.md | 매 세션 깔고 갈 지침(빌드 명령, 규칙) | `./CLAUDE.md` 또는 `./.claude/CLAUDE.md`(프로젝트), `~/.claude/CLAUDE.md`(개인 전체), `./CLAUDE.local.md`(개인·이 프로젝트) |
| 스킬(Skill) | 특정 작업 절차를 필요할 때만 불러오기 | `~/.claude/skills/<이름>/SKILL.md`(개인), `.claude/skills/<이름>/SKILL.md`(프로젝트) |
| 슬래시 명령 | 직접 `/이름`으로 호출. 커스텀 명령은 스킬에 합쳐짐 | 내장은 파일 없음. 커스텀은 `.claude/commands/<이름>.md` 또는 스킬 |
| 훅(hooks) | 편집 뒤 포맷, 위험한 작업 차단처럼 "항상 반드시" | `~/.claude/settings.json`, `.claude/settings.json` 의 `hooks` |
| 서브에이전트 | 로그·검색처럼 출력이 많은 일을 따로 돌리고 요약만 받기 | `.claude/agents/`, `~/.claude/agents/` |
| 권한(permissions) | 허용·확인·거부 규칙, 모드 정하기 | `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json` |
| 플랜 모드 | 고치기 전에 조사하고 계획만 받기 | 파일 아님. Shift+Tab, `/plan`, `--permission-mode plan` |
| MCP | 이슈 트래커·DB 같은 바깥 도구 연결 | `.mcp.json`(프로젝트), `~/.claude.json`(로컬·사용자) |

아래는 표의 항목을 하나씩 문서에서 확인한 대로 풀어 쓴 것이다. 전부 Claude Code 공식 문서(code.claude.com)를 열어 본 내용이다.

## CLAUDE.md: 매번 깔리는 지침

문서는 세션이 항상 새 컨텍스트 창으로 시작한다고 말한다. 그래서 세션을 넘어 지식을 이어 주는 장치가 둘 있다. 내가 쓰는 CLAUDE.md, Claude가 알아서 적는 auto memory다. CLAUDE.md는 매 세션 불러온다. [컨텍스트](#/post/ai-context)에 항상 실리니까 짧을수록 좋다. 문서는 파일 하나를 200줄 아래로 맞추라고 한다. 길면 컨텍스트를 더 먹고 지침이 덜 지켜진다고 한다.

`/init`을 치면 코드베이스를 보고 빌드 명령·테스트 방법·관례를 담은 CLAUDE.md를 만들어 준다. 이미 있으면 덮어쓰지 않고 개선을 제안한다. 다른 파일은 `@path/to/import` 문법으로 끌어올 수 있는데, 문서에 따르면 이건 정리용이지 컨텍스트 비용을 줄여 주지는 않는다. 일부 폴더에만 해당하는 규칙은 `.claude/rules/`에 파일로 나누고 경로를 지정해 두면 그 파일을 만질 때만 로드된다.

중요한 한계가 하나 있다. 문서는 CLAUDE.md를 "강제 설정이 아니라 컨텍스트"로 취급한다고 적는다. 어떤 행동을 반드시 막으려면 훅을 쓰라고 한다.

## 스킬: 필요할 때만 꺼내는 절차

스킬은 `SKILL.md` 파일 하나가 중심인 폴더다. Claude가 관련 있다고 판단하면 불러오고, `/스킬이름`으로 직접 부를 수도 있다. 본문은 쓰일 때만 로드돼서, 긴 참고 자료를 넣어 둬도 평소 비용이 작다. CLAUDE.md와 가장 다른 점이 이거다.

구조는 두 부분이다. 맨 첫 줄이 `---`인 YAML 프론트매터, 그 아래 마크다운 지침.

```yaml
---
name: deploy
description: Deploy the application to production
disable-model-invocation: true
---

Deploy the application:
1. Run the test suite
2. Build the application
3. Push to the deployment target
```

프론트매터에서 눈여겨본 필드는 이렇다.

| 필드 | 뜻 |
|---|---|
| `name` | `/` 메뉴에 뜨는 이름. 생략하면 폴더 이름 |
| `description` | 무엇을 하고 언제 쓰는지. Claude가 이걸 보고 적용 여부를 정함(문서가 권장) |
| `when_to_use` | 트리거가 될 말·요청 예시. description 뒤에 붙음 |
| `disable-model-invocation` | `true`면 Claude가 스스로 안 부름. 내가 `/`로만 호출 |
| `user-invocable` | `false`면 `/` 메뉴에서 숨김. Claude만 호출 |
| `allowed-tools` | 스킬이 도는 턴에 승인 없이 쓸 수 있는 도구 |
| `context: fork` | 스킬을 서브에이전트에서 실행 |
| `paths` | 해당 경로 파일일 때만 자동 로드 |

폴더에는 `SKILL.md` 말고 `reference.md`, `examples.md`, `scripts/` 같은 보조 파일을 둘 수 있다. 문서는 SKILL.md를 500줄 아래로 두고 자세한 건 다른 파일로 빼서 SKILL.md에서 가리키라고 한다. 이름이 겹치면 enterprise, 개인, 프로젝트 순으로 이긴다고 한다.

### 설명(description) 쓰는 법

Claude는 매 세션에서 모든 스킬의 description만 본다. 이 한 줄이 스킬을 부를지 말지를 가른다. 문서가 주는 요령은 세 가지다. 핵심 용도를 맨 앞에 쓴다. 무엇을 하는지와 언제 쓰는지를 같이 쓰고, 트리거가 될 표현을 넣는다. 관계없는 일에 불려 나오지 않을 만큼 구체적으로 쓴다. 문서 예시는 이렇다.

> Summarizes uncommitted changes and flags anything risky. Use when the user asks what changed, wants a commit message, or asks to review their diff.

description과 when_to_use를 합친 글은 목록에서 1,536자에서 잘린다고 하니, 뒤에 중요한 말을 두면 안 된다.

배포나 커밋처럼 부작용이 있는 작업은 `disable-model-invocation: true`로 두라고 문서가 권한다. 타이밍을 내가 정하려는 용도다. 배경 지식처럼 행동이 아닌 것은 `user-invocable: false`로 둔다.

## 슬래시 명령: 이제 스킬과 한 몸

문서 기준으로 커스텀 명령은 스킬에 합쳐졌다. `.claude/commands/deploy.md`와 `.claude/skills/deploy/SKILL.md`는 둘 다 `/deploy`를 만들고 똑같이 동작한다. 기존 command 파일은 그대로 되고, 새로 만들 땐 스킬을 권한다. 이름이 겹치면 스킬이 이긴다. 내장 명령은 문서에서 `/help`, `/compact`, `/skills`, `/add-dir`, `/status`, `/usage` 등이 언급되는데 전체 목록은 명령 레퍼런스에 있다고 한다.

## 훅: 반드시 일어나게 하는 장치

훅은 Claude Code 수명주기의 특정 시점에 실행되는 셸 명령이다. 문서의 요지는 LLM이 알아서 하길 바라는 게 아니라 "항상 일어나게" 하는 것이다. 설정 파일(`~/.claude/settings.json`, 프로젝트의 `.claude/settings.json`)의 `hooks` 블록에 이벤트 이름을 키로 넣는다. 이벤트는 `PreToolUse`(도구 실행 전, 막을 수 있음), `PostToolUse`(성공 후), `PostToolUseFailure`, `Notification`(입력을 기다릴 때), `SessionStart` 등이다. 예시로 `PostToolUse`에 `Edit|Write` 매처를 걸어 편집 후 Prettier를 돌리는 설정이 나온다. 등록되면 `/hooks`에서 확인한다.

종료 코드가 규칙이다. 0이면 이의 없음, 2면 실행을 막고, stderr에 쓴 이유가 Claude에게 피드백으로 간다. 다만 `PreToolUse`에서 0으로 끝내는 건 승인이 아니어서 평소 권한 절차를 그대로 탄다. 또 훅이 allow를 돌려줘도 deny·ask 규칙은 그대로 적용된다고 문서에 적혀 있다.

## 서브에이전트: 따로 돌리고 요약만 받기

서브에이전트는 자기 컨텍스트 창, 자기 시스템 프롬프트, 자기 도구 권한을 가진 보조 에이전트다. 일이 description에 맞으면 Claude가 넘기고, 메인 대화에는 요약만 돌아온다. 이점은 문서가 꼽은 대로 컨텍스트 보존, 도구 제한, 설정 재사용, 더 싼 모델(Haiku 등)로 돌리기다. 같은 사용량 한도에 잡힌다고도 적혀 있다.

마크다운 파일에 프론트매터(필수는 `name`, `description`)를 쓰고 본문이 시스템 프롬프트가 된다. 위치는 `.claude/agents/`(프로젝트), `~/.claude/agents/`(개인)다. 기본 제공으로 Explore(읽기 전용 탐색), Plan, general-purpose가 있다. 문서 팁은 테스트 돌려서 실패만 보고받는 식의 출력 많은 독립 작업에 쓰고, 주고받으며 다듬는 일은 메인 대화에 두라는 것이다. [하네스](#/post/ai-harness) 쪽 이야기로 보면 컨텍스트를 아끼는 방법이기도 하다.

## 권한과 플랜 모드

권한 규칙은 `permissions` 아래 `allow`/`ask`/`deny`로 쓰고, 평가 순서는 deny, ask, allow이며 먼저 맞는 것이 결정한다. 위치는 `.claude/settings.json`(공유), `.claude/settings.local.json`(개인), `~/.claude/settings.json`(전체)다. 문서는 Bash 규칙이 Claude가 쓴 명령 문자열에 맞춰 매칭되기 때문에, 같은 프로그램을 다른 형태로 부르면 빠져나갈 수 있어 deny·ask가 보안 경계는 아니라고 경고한다.

모드는 여섯 가지로 정리돼 있다.

| 모드 | 요약 |
|---|---|
| `default` | 읽기만 자동, 나머지는 확인 |
| `acceptEdits` | 작업 폴더 안 파일 편집도 자동 승인 |
| `plan` | 조사하고 계획만 제안, 승인 전엔 소스를 안 고침 |
| `auto` | 별도 분류 모델이 검토하면서 실행 |
| `dontAsk` | 미리 허용한 것만 실행, 나머지는 거부(CI용) |
| `bypassPermissions` | 검사 없이 전부 실행. 격리된 컨테이너·VM에서만 |

플랜 모드 진입은 Shift+Tab을 눌러 상태 표시줄에 plan mode가 뜰 때까지 돌리거나, 프롬프트 앞에 `/plan`을 붙이거나, `claude --permission-mode plan`으로 시작한다. 계획이 나오면 승인하고 다른 모드로 넘어가거나 계속 계획할 수 있고, Ctrl+G로 계획을 편집기에서 고칠 수 있다.

## MCP: 바깥 시스템 연결

[MCP](#/post/ai-mcp)는 AI 도구를 외부 도구·데이터와 잇는 공개 표준이다. 연결하면 이슈 트래커나 DB를 붙여넣기 없이 직접 읽고 쓴다. 명령은 `claude mcp add --transport <종류> <이름> <주소 또는 명령>`이고 `claude mcp list`, `claude mcp remove`, 세션 안 `/mcp`로 관리한다. 범위(scope)는 셋이다.

| 범위 | 어디서 로드 | 팀 공유 | 저장 위치 |
|---|---|---|---|
| local(기본) | 이 프로젝트만 | 아니오 | `~/.claude.json` |
| project | 이 프로젝트만 | 예 | 프로젝트 루트 `.mcp.json` |
| user | 내 모든 프로젝트 | 아니오 | `~/.claude.json` |

전송 방식은 원격 서버엔 HTTP를 권하고, SSE는 더 안 쓰는 방식이라고 한다. 로컬 프로세스는 stdio다. 문서가 짚은 주의는 외부 내용을 가져오는 서버는 프롬프트 인젝션 위험이 있으니 신뢰하는 서버만 연결하라는 것이다.

## 어떻게 고르나

- 항상 알아야 하면 CLAUDE.md. 짧게.
- 가끔만 필요한 절차면 스킬. 평소엔 description만 올라가니까.
- 어기면 안 되는 것은 훅이나 deny 규칙. CLAUDE.md는 부탁이고 훅은 강제다.
- 출력이 큰 독립 작업은 서브에이전트.
- 큰 변경은 플랜 모드로 계획부터.
- 바깥 시스템은 MCP.

## 흔한 오해

- CLAUDE.md에 쓰면 반드시 지킨다: 문서가 컨텍스트이지 강제 설정이 아니라고 적는다.
- 스킬과 슬래시 명령이 별개다: 지금은 합쳐졌고 같은 `/이름`이 된다.
- 훅이 exit 0이면 승인된 거다: `PreToolUse`에서 0은 승인이 아니라 이의 없음이다.
- deny에 넣으면 보안이 끝난다: 문서가 명령 형태를 바꾸면 우회될 수 있다고 경고한다.

<details>
<summary>자세한 풀이: 훅 설정 예(문서 흐름 요약)</summary>

문서의 첫 예제는 `~/.claude/settings.json`에 `Notification` 훅을 넣어 Claude가 입력을 기다릴 때 데스크톱 알림을 띄우는 것이다. 이미 `hooks` 키가 있으면 통째로 바꾸지 말고 이벤트 키를 형제로 추가한다. 편집 후 포맷은 `PostToolUse`+`Edit|Write` 매처, 보호 파일 차단은 `PreToolUse`가 파일 경로를 검사해 일치하면 stderr에 이유를 쓰고 `exit 2`를 하는 스크립트다. 판단이 필요한 조건은 모델이 평가하는 prompt 기반·agent 기반 훅도 있다고 나오는데 직접 확인하진 않았다.

</details>

## 근거 링크

- Claude Code 문서, Skills: https://code.claude.com/docs/en/skills
- Claude Code 문서, How Claude remembers your project(CLAUDE.md): https://code.claude.com/docs/en/memory
- Claude Code 문서, Hooks guide: https://code.claude.com/docs/en/hooks-guide
- Claude Code 문서, Subagents: https://code.claude.com/docs/en/sub-agents
- Claude Code 문서, Permissions: https://code.claude.com/docs/en/permissions
- Claude Code 문서, Permission modes: https://code.claude.com/docs/en/permission-modes
- Claude Code 문서, MCP: https://code.claude.com/docs/en/mcp
- Claude Code 문서, Slash commands: https://code.claude.com/docs/en/slash-commands

← [개념 map으로](#/post/ai-map)

관련 글: [Claude 토큰 아끼는 법](#/post/claude-tokens) · [MCP](#/post/ai-mcp) · [컨텍스트와 컨텍스트 엔지니어링](#/post/ai-context)
