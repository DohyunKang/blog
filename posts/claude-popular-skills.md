스킬을 직접 짜기 전에 남들이 뭘 쓰는지부터 보려고 Anthropic 공식 저장소(github.com/anthropics/skills)를 열어 봤다. 스킬이 뭔지, 어디에 두는지는 [스킬·설정 정리](#/post/claude-skills)에 적어 둬서 여기서는 어떤 스킬이 있는지만 본다.

## 먼저 알아 둘 것

공식 저장소의 `skills/` 아래에는 이 글을 쓰는 시점(2026-11-02)에 폴더가 19개 있었다. 스타는 약 18.6만이다. 저장소 README는 이 폴더를 창작·디자인, 개발·기술, 기업 커뮤니케이션, 문서 스킬 예시라고 설명한다. 문서 스킬 넷(docx, pdf, pptx, xlsx)은 오픈소스가 아니라 소스 공개(source-available)라고 적혀 있다.

설치 방법은 둘로 나뉜다. 저장소 자체가 플러그인 마켓플레이스라서 Claude Code에서 이렇게 등록한다.

```
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
/plugin install example-skills@anthropic-agent-skills
```

`marketplace.json`을 열어 보면 `document-skills` 플러그인에 xlsx·docx·pptx·pdf가, `example-skills`에 나머지 열두 개(algorithmic-art, brand-guidelines, canvas-design, doc-coauthoring, frontend-design, internal-comms, mcp-builder, skill-creator, slack-gif-creator, theme-factory, web-artifacts-builder, webapp-testing)가 들어 있다. `claude-api`, `academy-guide`, `discernment-nudge`는 각각 따로 플러그인이다. 직접 폴더를 `~/.claude/skills/<이름>/SKILL.md`에 복사해 쓰는 방법도 있다.

Claude Code 문서에는 `/plugin install skill-creator@claude-plugins-official`처럼 공식 마켓플레이스(`claude-plugins-official`)로 받는 예도 나온다. 그리고 `pdf`, `xlsx` 같은 Anthropic 기본 스킬은 claude.ai 계정에서 동기화되어 `~/.claude/skills/synced/`에 내려온다고 한다.

## 공식 스킬, 종류별 표

각 스킬의 `SKILL.md` 맨 위 description을 읽고 정리했다.

### 문서 만들기·고치기

| 이름 | 하는 일 | 언제 쓰나 |
|---|---|---|
| docx | Word(.docx)·템플릿(.dotx) 만들기, 읽기, 고치기 | 목차·머리글·쪽번호 있는 문서를 뽑을 때 |
| pptx | 슬라이드(.pptx) 만들기, 텍스트 뽑기, 편집, 합치기·나누기 | 발표 자료를 만들거나 기존 덱을 고칠 때 |
| xlsx | 스프레드시트(.xlsx, .csv, .tsv) 만들기, 수식·서식·차트, 정리 | 표 파일이 입력이나 결과물일 때 |
| pdf | 텍스트·표 추출, 합치기·나누기, 회전, 워터마크, 양식 채우기, OCR | PDF로 뭐든 해야 할 때 |
| doc-coauthoring | 문서를 같이 쓰는 절차(맥락 모으기, 다듬기, 독자 테스트) | 제안서·기술 명세·결정 문서를 처음 쓸 때 |

### 디자인·화면

| 이름 | 하는 일 | 언제 쓰나 |
|---|---|---|
| frontend-design | 뻔한 템플릿 같지 않은 UI를 만들도록 방향·타이포 선택을 안내 | 새 화면을 만들거나 기존 화면을 갈아엎을 때 |
| theme-factory | 슬라이드·문서·랜딩 페이지에 테마 적용. 미리 만든 10개 테마, 즉석 생성도 가능 | 산출물에 일관된 색·글꼴을 입힐 때 |
| brand-guidelines | Anthropic 공식 색과 글꼴을 입힘 | Anthropic 스타일로 맞출 때. 다른 회사 브랜드용은 아니다 |
| canvas-design | 디자인 철학을 정하고 .png·.pdf 포스터·시각물을 만듦 | 포스터나 정적인 디자인 작품을 만들 때 |
| algorithmic-art | p5.js로 시드 기반 생성 아트, 파라미터 조절 뷰어 | 플로 필드·파티클 같은 코드 아트 |
| slack-gif-creator | Slack 규격에 맞는 애니메이션 GIF를 만들고 검증 | Slack용 GIF를 만들 때 |
| web-artifacts-builder | React, Tailwind, shadcn/ui로 claude.ai용 복잡한 HTML 아티팩트 제작 | 상태·라우팅이 필요한 아티팩트. 간단한 한 파일짜리에는 쓰지 말라고 적혀 있다 |

### 개발·테스트

| 이름 | 하는 일 | 언제 쓰나 |
|---|---|---|
| skill-creator | 스킬 만들기·고치기, 평가 돌리기, description 최적화 | 내 스킬을 만들 때 |
| mcp-builder | MCP 서버를 잘 만드는 가이드(Python FastMCP, Node/TypeScript SDK) | 외부 서비스를 [MCP](#/post/ai-mcp)로 붙일 때 |
| webapp-testing | Playwright로 로컬 웹앱 테스트, 스크린샷, 브라우저 로그 확인 | 화면 동작을 확인하거나 디버깅할 때 |
| claude-api | Claude API·SDK 레퍼런스(모델 ID, 요금, 스트리밍, 도구 호출, 캐싱 등) | Claude를 코드에서 부르는 일을 할 때 |

### 글·업무

| 이름 | 하는 일 | 언제 쓰나 |
|---|---|---|
| internal-comms | 현황 보고, 리더십 업데이트, 뉴스레터, FAQ, 장애 보고 같은 사내 글 형식 | 사내 공지·보고를 쓸 때 |
| academy-guide | Claude 쓰는 법을 물으면 Claude Academy의 강의·튜토리얼을 추천 | 사용법 질문에 자료를 붙이고 싶을 때 |
| discernment-nudge | 조언·계획·추정 같은 답을 내놓기 전에 한 번 더 따져 보게 함 | 사용자가 그 답을 믿고 행동할 수 있을 때 |

academy-guide와 discernment-nudge는 이름만으로는 용도가 안 보여서 SKILL.md 앞부분만 읽었다. 둘 다 세부 동작은 끝까지 확인하지 않았다.

<details>
<summary>자세한 풀이: 문서 스킬 네 개는 뭐가 다른가</summary>

docx, pptx, xlsx, pdf의 description은 모두 "이 확장자가 관련되면 무조건 이 스킬"이라는 식으로 쓰여 있다. pptx는 입력으로든 출력으로든 .pptx가 끼면 쓰고, 결과를 이메일에 쓸 요약용으로 텍스트만 뽑는 경우까지 포함한다고 적었다. xlsx는 스프레드시트가 주된 입력이나 출력인 작업 전반이다. 이렇게 트리거 범위를 넓게 쓰는 건 [스킬 문서](#/post/claude-skills)가 권하는 description 쓰는 법(무엇을 하는지, 언제 쓰는지, 트리거 표현)과 맞아떨어진다.

</details>

## 커뮤니티 스킬

공식 저장소 말고도 저장소가 많다. GitHub 검색으로 확인한 큰 것들만 적는다. 스타 수는 2026-11-02에 GitHub API로 본 값이다.

| 이름 | 스타 | 하는 일 | 설치 |
|---|---|---|---|
| obra/superpowers | 약 31만 | 코딩 에이전트용 개발 방법론. 먼저 사양을 묻고, 계획을 짜고, 하위 에이전트로 구현·검토를 진행. TDD, YAGNI, DRY 강조 | `/plugin install superpowers@claude-plugins-official` |
| epoko77-ai/im-not-ai | 약 6,400 | AI가 쓴 한글을 사람 글처럼 윤문. 사실·주장·수치는 그대로 두고 문체·리듬·표현만 고침 | `/plugin marketplace add epoko77-ai/im-not-ai` 후 `/plugin install humanize-korean@im-not-ai` |
| IsaacEryn/humanizer-ko | 6 | 한국어 AI 글투(ChatGPT 문체, 이중 피동, 번역투 등) 33개 패턴 탐지 | 저장소 README 참고 |
| dotoricode/korean-humanizer | 17 | 생성된 글의 AI 티를 지우는 한국어 프롬프트·스킬 | 저장소 README 참고 |

superpowers 스킬 폴더에는 brainstorming, writing-plans, test-driven-development, systematic-debugging, requesting-code-review, verification-before-completion, using-git-worktrees 같은 이름이 있었다. 이름 그대로 계획·테스트·디버깅·검토 단계를 하나씩 맡는 구성이다.

im-not-ai는 한국어 글을 다듬는 스킬 중 스타가 가장 많았다. README에 따르면 번역투, 기계적인 병렬("첫째·둘째·셋째"), "결론적으로", "시사하는 바가 크다" 같은 관용구, 피동 남용 등을 10개 범주, 85개 하위 패턴으로 나누어 심각도(S1~S3)별로 잡아낸다. Claude Code에서는 `/humanize-korean`으로 부르거나 "이 글 AI 티 없애줘"라고 말하면 된다. Codex CLI, Gemini CLI, Copilot CLI용 설치법도 같이 있다. 다만 Gemini 확장은 별도 룰북(47개 패턴)을 쓴다고 README에 적혀 있다. 라이선스는 MIT다. 이름이 비슷한 변형 저장소(im-not-ai-codex 72, im-not-ai-kiro 28 등)는 포트로 보인다.

스타 수가 같은 뜻은 아니다. 31만이라고 해서 내 작업에 맞는다는 보장은 없고, 스타 6짜리가 내 용도에 더 맞을 수도 있다.

## 어떻게 골라 쓰나

- 파일 형식이 정해진 작업(Word, PPT, 엑셀, PDF)은 문서 스킬 넷이 가장 먼저 쓸 만하다.
- 화면을 만들면 frontend-design, 확인은 webapp-testing.
- 내 업무 절차는 skill-creator로 만들고 `~/.claude/skills`나 프로젝트의 `.claude/skills`에 둔다.
- 한국어 글 다듬기는 커뮤니티 스킬이다. 공식 저장소에는 없다.

## 주의할 점

- 스킬은 `description`만 매 세션 컨텍스트에 올라가고 본문은 쓸 때 로드된다. 그래도 많이 깔수록 description이 쌓이니 필요한 것만 깐다.
- 마켓플레이스나 외부 저장소의 스킬은 남이 쓴 지침과 스크립트다. 깔기 전에 `SKILL.md`와 `scripts/`를 한 번 읽는 게 낫다.- 문서 스킬 네 개는 라이선스가 오픈소스가 아니라 소스 공개다. 쓰기 전에 각 폴더의 LICENSE.txt를 본다.

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

확인함: anthropics/skills 저장소 메인 페이지와 README, `skills/` 폴더 19개 목록, 각 SKILL.md 머리말(description), `.claude-plugin/marketplace.json`의 플러그인 구성, GitHub API로 본 스타 수, im-not-ai와 superpowers의 README 앞부분과 superpowers의 `skills/` 폴더 목록, Claude Code 스킬 문서 앞 100,000자(설치 명령, 저장 위치).

확인 못 함: 각 스킬 본문의 세부 동작, 스킬 문서의 마지막 약 19,000자, im-not-ai 외 한국어 윤문 저장소들의 실제 품질, 커뮤니티 스킬 중 코드 리뷰 전용으로 많이 쓰이는 스킬의 순위(스타 기준 목록은 보지 않았다), awesome 목록류(ComposioHQ/awesome-claude-skills 약 7.8만 스타)의 내용.

</details>

## 근거 링크

- anthropics/skills 저장소: https://github.com/anthropics/skills
- anthropics/skills marketplace.json: https://github.com/anthropics/skills/blob/main/.claude-plugin/marketplace.json
- Claude Code 문서, Skills: https://code.claude.com/docs/en/skills
- epoko77-ai/im-not-ai: https://github.com/epoko77-ai/im-not-ai
- obra/superpowers: https://github.com/obra/superpowers

← [개념 지도로](#/post/ai-map)

관련 글: [Claude 스킬·설정, 언제 뭘 쓰나](#/post/claude-skills) · [MCP](#/post/ai-mcp) · [Claude 토큰 아끼는 법](#/post/claude-tokens)
