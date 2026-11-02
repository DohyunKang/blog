2026년 가을에 뜨는 개발자 도구 레포를 찾아보다가 OpenCode를 골랐다. 코딩 에이전트는 이번 시즌 목록에서 제일 빽빽한 칸이었고, 그중 이 레포는 별이 많은 쪽이었다. 공식 문서와 README를 열어서 확인한 것만 적는다.

## 어떤 레포인지

GitHub 저장소는 anomalyco/opencode, 설명은 "The open source coding agent."다. 라이선스는 MIT. 확인한 시점(2026-11-02)에 별은 약 22만 3.9천, 포크는 약 3만 100으로 표시됐다. 별 개수는 계속 변하는 값이라 이 날짜 기준이다.

터미널 화면(TUI)으로 쓰는 게 기본이고, 데스크톱 앱(베타)과 IDE 확장도 있다고 문서에 나온다. 데스크톱 앱은 macOS(Apple Silicon·Intel), Windows, Linux용이 README에 적혀 있다.

설치는 스크립트 한 줄(`curl -fsSL https://opencode.ai/install | bash`) 외에 npm·Bun·pnpm·Yarn, Homebrew, Arch의 pacman, Windows용 Chocolatey·Scoop 등이 문서에 있다. Windows는 WSL을 권장한다고 한다. 문서에 이상한 대목이 하나 있는데, V1과 V2가 둘 다 `opencode`라는 같은 명령을 쓰고 서로 충돌할 수 있다고 한다. Homebrew 기본 포뮬러는 V2를 깐다.

모델은 특정 업체에 묶이지 않는다. 어떤 LLM 제공자든 API 키를 설정해 쓸 수 있고, 연결은 `/connect`로 한다. 문서는 자체적으로 검증해 둔 목록(OpenCode Models)을 먼저 권한다.

## 처음 켜면 보이는 것

기본 에이전트가 둘이다. Tab 키로 바꾼다.

| 에이전트 | 하는 일 |
|---|---|
| build | 기본값. 도구가 전부 켜져 있고 파일을 고친다 |
| plan | 분석과 계획만. 편집은 막혀 있다 |

plan은 편집을 거부하는데, 예외로 `.opencode/plans/` 아래 마크다운 계획 파일은 쓸 수 있다. bash는 권한 설정을 따른다. 코드를 건드리기 전에 계획부터 보고 싶을 때 쓰는 모드로 읽혔다.

그 밑에 서브에이전트가 있다. general은 복잡한 검색이나 여러 단계 작업용이고 `todowrite`를 뺀 모든 도구를 쓴다. explore는 읽기 전용이다. `@general`처럼 @로 직접 부르기도 하고, 기본 에이전트가 알아서 부르기도 한다. 이 개념이 낯설면 [자세히 → 서브에이전트](#/post/ai-subagent)를 보면 된다. 그 밖에 compaction, title, summary라는 숨은 시스템 에이전트가 자동으로 돌고 UI에서 고를 수는 없다고 한다.

프로젝트 안에서 `/init`을 치면 코드를 훑어서 루트에 `AGENTS.md`를 만든다. 문서는 이 파일을 Git에 커밋해 두라고 권한다. 에이전트가 매번 읽는 프로젝트 안내문인 셈이다. 이런 지시문이 [컨텍스트](#/post/ai-context)에 어떻게 올라가는지는 따로 정리한 글이 있다.

## 권한 설정이 생각보다 촘촘했다

이 레포에서 제일 오래 읽은 부분이다. 권한 값은 세 가지다.

- allow: 승인 없이 실행
- ask: 실행 전에 물어봄
- deny: 막음

권한을 걸 수 있는 대상은 read, edit, glob, grep, list, bash, task, todowrite, webfetch, websearch, lsp, skill, question, external_directory, doom_loop 등이다. edit 하나가 파일 수정 전체(edit·write·patch)를 덮는다. `task`는 어떤 서브에이전트를 부를 수 있는지를 정하는데, deny로 두면 그 서브에이전트가 Task 도구 목록에서 아예 사라진다.

기본값은 대부분 allow다. 예외가 있다. `doom_loop`(같은 도구 호출이 같은 입력으로 세 번 반복될 때)와 `external_directory`(프로젝트 밖 경로)는 기본이 ask다. `.env`와 `.env.*` 파일 읽기도 기본이 ask이고, `.env.example`만 allow다.

bash는 명령어 패턴으로 나눌 수 있다. 문서의 예시는 이렇다.

```json
{
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "rm *": "deny"
    }
  }
}
```

규칙은 위에서 아래로 평가하고 마지막에 맞은 규칙이 이긴다. 그래서 `*`를 맨 앞에 두고 구체적인 규칙을 뒤에 쓴다. 이 설정이면 `git status`는 통과, `rm -rf build`는 차단, `npm test`는 물어본다.

여기까지 읽고 든 생각은, 에이전트가 쓰는 [도구 호출](#/post/ai-tool-use)을 한 겹 감싸는 승인 층이 레포의 핵심 부품이라는 것이다. 모델이 똑똑해지는 것과 별개로, 뭘 해도 되는지는 설정 파일이 정한다.

## 설정이 놓이는 자리

설정 파일은 `opencode.json`(또는 `opencode.jsonc`)이고 TUI 설정은 `tui.json`으로 따로 뺐다. 예전에 `opencode.json`에 있던 `theme`, `keybinds`, `tui` 키는 deprecated이고 `tui.json`으로 옮겨진다고 한다.

<details>
<summary>설정 파일 위치와 우선순위</summary>

문서에 나온 위치는 이렇다.

- 원격: `.well-known/opencode` (조직 기본값)
- 전역: `~/.config/opencode/opencode.json`
- 사용자 지정: 환경변수 `OPENCODE_CONFIG`가 가리키는 경로
- 프로젝트: 프로젝트 루트의 `opencode.json` (현재 디렉터리에서 가장 가까운 Git 디렉터리까지 올라가며 찾음)
- 인라인: 환경변수 `OPENCODE_CONFIG_CONTENT`
- 관리형: macOS `/Library/Application Support/opencode/`, Linux `/etc/opencode/`, Windows `%ProgramData%\opencode`

우선순위는 뒤에 오는 게 앞을 덮어쓴다. 원격 → 전역 → 사용자 지정 → 프로젝트 → `.opencode` 디렉터리 → 인라인 → 관리형 파일 → macOS 관리형 환경설정 순이다. 덮어쓰기가 아니라 병합이라서, 충돌하지 않는 키는 모든 출처의 것이 남는다.

주요 키는 `model`, `small_model`, `provider`, `permission`, `mcp`, `instructions`, `agent`, `default_agent`, `plugin`, `compaction` 등이다. 스키마는 `https://opencode.ai/config.json`에 있다.

</details>

에이전트·명령·플러그인 같은 것들은 `.opencode/`(프로젝트) 또는 `~/.config/opencode/`(전역) 폴더에 둔다. 조직이 관리형 설정으로 기본값을 내려보내는 경로가 따로 있다는 점이 눈에 띄었다. 개인 도구로 시작했는데 회사에서 쓰는 쪽까지 생각한 구조로 보였다.

## 나만의 에이전트 만들기

커스텀 에이전트는 두 방식으로 정의한다. `opencode.json`의 `agent` 키에 JSON으로 쓰거나, 마크다운 파일을 `.opencode/agents/`(프로젝트) 또는 `~/.config/opencode/agents/`(전역)에 둔다. 마크다운이면 파일 이름이 에이전트 이름이 되고 본문이 프롬프트가 된다.

<details>
<summary>에이전트 옵션 목록</summary>

- `description`(필수)
- `mode`: `primary`, `subagent`, `all` 중 하나, 기본값은 `all`
- `model`: `provider/model-id` 형식
- `temperature`, `top_p`
- `steps`: 예전 이름 `maxSteps`는 deprecated
- `prompt`: 설정 파일 기준 상대 경로
- `permission`: 이 에이전트에만 적용되는 권한
- `hidden`: 서브에이전트를 `@` 메뉴에서 숨김
- `disable`, `color`
- `tools`: `permission`으로 대체되어 deprecated

CLI로는 `opencode agent create`로 대화형 생성, `opencode agent list`로 목록을 본다. 에이전트별 `permission`은 전역 권한보다 우선한다.

</details>

예를 들어 읽기만 하는 리뷰어 에이전트를 만들고 싶으면 mode를 subagent로, edit 권한을 deny로 두는 식이 된다. 같은 권한 체계 위에서 역할만 나누는 것이다. 이런 에이전트가 루프를 도는 원리는 [에이전트 루프](#/post/ai-agent-loop) 글에서 따로 다뤘다.

## 다른 글과 이어서 보면

설정의 `mcp` 키에 MCP 서버를 등록하고, `skill`이 권한 키 목록에 있는 것을 보면 [MCP](#/post/ai-mcp)와 [스킬](#/post/ai-skills)도 같은 틀에서 다루는 듯하다. 다만 이 두 항목의 상세 사용법은 내가 연 문서 페이지에서는 사이드바 제목 수준이어서 더 쓰지 않는다. 로컬 모델을 직접 돌려 연결하는 쪽은 [오픈소스 분석: Ollama](#/post/repo-ollama)와 이어서 보면 그림이 맞춰진다. 이런 도구 전체를 부르는 말이 [하네스](#/post/ai-harness)다.

별이 22만이라는 숫자보다, 권한 값 세 개와 마지막 규칙이 이기는 패턴 매칭이 이 레포를 이해하는 데 더 쓸모 있었다. 설정 파일 하나로 읽기·쓰기·셸을 나눠서 허용하는 방식은 다른 코딩 에이전트를 볼 때도 비교 기준이 될 것 같다.

← [개념 map으로](#/post/ai-map)

관련 글: [서브에이전트와 멀티에이전트](#/post/ai-subagent) · [도구 호출(Function calling)](#/post/ai-tool-use) · [에이전트와 에이전트 루프](#/post/ai-agent-loop)

## 근거 링크

- [anomalyco/opencode (GitHub 저장소, 2026-11-02 확인)](https://github.com/sst/opencode)
- [OpenCode 문서: 소개·설치](https://opencode.ai/docs/)
- [OpenCode 문서: Agents](https://opencode.ai/docs/agents/)
- [OpenCode 문서: Config](https://opencode.ai/docs/config/)
- [OpenCode 문서: Permissions](https://opencode.ai/docs/permissions/)
