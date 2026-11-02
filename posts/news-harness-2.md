Microsoft Agent Framework는 10월 한 달 동안 Python과 .NET 릴리스를 번갈아 냈고, 바뀐 내용을 보면 요즘 에이전트 프레임워크가 어디에 힘을 쓰는지 보인다. 승인, 컨텍스트 압축, MCP 호환 같은 것들이다.

## 이 프레임워크가 뭔지

GitHub 저장소 설명은 "AI 에이전트와 멀티 에이전트 워크플로를 만들고, 조율하고, 배포하는 프레임워크"다. Python과 .NET을 지원하고 라이선스는 MIT다. Go 버전은 별도 저장소(agent-framework-go)에 있고, 공식 개요 문서에는 공개 프리뷰이며 Go 1.26 이상이 필요하다고 적혀 있다.

문서 개요는 이 프레임워크를 네 덩어리로 나눈다.

| 덩어리 | 하는 일 |
| --- | --- |
| Agents | LLM으로 입력을 처리하고, 도구와 MCP 서버를 부르고, 답을 만든다 |
| Harness Agent | 긴 다단계 작업용으로 계획·할 일 추적, 컨텍스트 압축, 파일 접근과 메모리, 도구 승인, 관측을 묶어 둔 에이전트 |
| Workflows | 에이전트와 함수를 명시적인 실행 경로로 잇는 함수형·그래프형 흐름 |
| Integrations | 모델 제공자, 도구, 컨텍스트 공급자, 미들웨어, 평가, UI 연결 |

모델 제공자로는 Microsoft Foundry, Anthropic, Azure OpenAI, OpenAI, Ollama 등이 문서에 나온다. Microsoft 모델에만 묶인 물건은 아니다.

## Semantic Kernel, AutoGen과의 관계

문서는 Agent Framework를 두 프로젝트의 "직접적인 후속"이라고 설명한다. 같은 팀이 만들었고, AutoGen의 단순한 에이전트 추상화에 Semantic Kernel의 세션 기반 상태 관리·타입 안전성·필터·텔레메트리를 합친 다음, 실행 경로를 명시적으로 짜는 워크플로를 더했다는 식이다. 각각에서 넘어오는 마이그레이션 가이드도 문서에 따로 있다.

에이전트와 워크플로를 언제 쓰는지도 표로 정리해 둔 게 눈에 들어왔다. 열린 대화나 자율적인 도구 사용이면 에이전트, 단계가 정해져 있고 실행 순서를 직접 통제해야 하면 워크플로다. 그 아래 한 줄이 있다. "함수로 짤 수 있는 일이면 AI 에이전트 말고 함수를 써라."

[자세히 → 하네스](#/post/ai-harness)

## 10월 릴리스 목록

저장소 릴리스 페이지에서 10월 것만 추렸다. Python은 `python-` 태그, .NET은 `dotnet-` 태그로 따로 나간다.

| 태그 | 날짜 | 눈에 띈 것 |
| --- | --- | --- |
| dotnet-1.25.0 | 10/14 | 응답이 없는 도구 승인 요청은 자동 거절, 닫힌 목록 질문(워크플로) |
| python-1.22.0 | 10/15 | Python 3.15 지원(코어와 루트 패키지), 저장 상태 형식 변경 |
| python-1.23.0 | 10/22 | MCP 2.x 호환, AG-UI 엔드포인트에 인증 범위 필수 |
| dotnet-1.26.0 | 10/23 | 중복된 도구 승인 요청 ID 거부, MCP 호출 헤더 검증 |
| python-1.24.0 | 10/30 | 로컬 MCP 도구의 기본 승인 모드, 에이전트가 직접 일으키는 컨텍스트 압축(실험) |
| dotnet-1.27.0 | 10/30 | AgentServer 의존성 갱신, 리다이렉트 처리 변경 |

릴리스 노트에 연도는 안 보이지만 문서 날짜가 2026년 10월이라 그 해 것으로 읽었다. 이 표는 글 쓴 시점(11월 2일)에 릴리스 페이지에서 본 내용이다.

## 바뀐 것 중 흥미로운 것

세 가지가 눈에 걸렸다.

첫째는 도구 승인이다. .NET 쪽은 응답이 오지 않는 승인 요청을 자동으로 거절하고, 같은 ID의 승인 요청은 받지 않는다. Python 쪽은 로컬 MCP 도구에 기본 승인 모드가 생겼다. 에이전트가 도구를 마음대로 쓰게 두는 것보다 사람이 확인하는 지점을 촘촘히 두는 쪽으로 가는 것 같다.

둘째는 MCP다. python-1.23.0이 MCP 2.x 호환을 넣으면서 전송 방식, 오류, 수명 주기 처리를 옮겼다. 릴리스 노트에는 이게 breaking 항목으로 적혀 있어서, MCP 서버를 붙여 쓰던 코드는 올리기 전에 노트를 읽어야 한다.

[자세히 → MCP](#/post/ai-mcp)

셋째는 컨텍스트 압축이다. python-1.24.0에 에이전트가 스스로 압축을 일으키고 스킬을 내리는 기능이 실험으로 들어갔다. 개요 문서의 Harness Agent 설명에도 컨텍스트 압축이 있으니 같은 방향이다.

[자세히 → 컴팩션](#/post/ai-compaction)

<details>
<summary>breaking 항목만 따로 정리</summary>

- python-1.22.0: 제공자 전반에서 콘텐츠 식별, 호스티드 실행, 프로토콜 메타데이터, 재생, 스트림 병합 의미가 통합됐다. 1.22 이전 런타임은 `hosted`나 `merge_mode`가 들어간 새 레코드를 읽지 못한다. 같은 저장소에 옛 워커와 새 워커를 같이 돌리지 말고, 새 레코드가 쓰인 뒤에는 다운그레이드하지 말라고 적혀 있다.
- python-1.23.0: AG-UI 엔드포인트는 명시적 인증 범위나 단일 사용자 선언이 필요하다. Docker 셸 옵션 `extra_run_args`가 `unsafe_extra_run_args`로 바뀌었다.
- python-1.24.0: 베타 `RedisContextProvider`가 옛 인덱스 스키마를 거부한다. 옛 인덱스와 컨텍스트 해시를 지우고 다시 넣어야 한다. Python 3.11이 지원 기준선이고 다음 릴리스에서 3.10이 빠진다.
- dotnet-1.25.0: Cosmos 채팅 메타데이터가 파티션 키 전략과 분리됐다.
- dotnet-1.27.0: Foundry 호스티드 앱에서는 `builder.AddFoundryResponses(...)`를 쓴다. 업그레이드 전에 만든 로컬 durable 응답 파일은 읽히지 않는다.

</details>

## 직접 써 본다면

개요 문서의 시작 예제는 몇 줄이다. Python은 `pip install agent-framework`로 설치하고 `Agent`에 클라이언트, 이름, 지시문을 넘겨서 만든다. 실행은 `await agent.run("...")`이다. 예제는 Foundry 클라이언트를 쓰지만 다른 제공자 클라이언트로 바꿔 쓰는 구조다.

한 가지 눈에 띄는 주의 문구가 있다. Python에서 `.env` 파일을 자동으로 읽지 않으니, 쓰려면 시작할 때 `load_dotenv()`를 직접 불러야 한다. 환경 변수를 셸에서 직접 지정해도 된다.

릴리스 주기가 일주일 안팎이고 breaking 표시가 거의 매번 붙는다. 버전을 고정하지 않고 쓰면 올릴 때마다 노트를 읽어야 할 것 같다. 저장소 스타 수는 확인한 시점(11월 2일)에 14.5k였다.

[자세히 → 에이전트 루프](#/post/ai-agent-loop)

← 개념 map으로 (#/post/ai-map)

관련 글: [하네스](#/post/ai-harness), [MCP](#/post/ai-mcp), [컴팩션](#/post/ai-compaction)

## 근거 링크

- [microsoft/agent-framework (GitHub)](https://github.com/microsoft/agent-framework)
- [Releases · microsoft/agent-framework](https://github.com/microsoft/agent-framework/releases)
- [Microsoft Agent Framework Overview (Microsoft Learn)](https://learn.microsoft.com/en-us/agent-framework/overview/)
