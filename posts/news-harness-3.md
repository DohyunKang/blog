2026년 7월 28일에 MCP 명세의 새 개정판이 안정판으로 나왔다. 버전 이름이 날짜라서 2026-07-28이다. GitHub 릴리스 페이지에는 "이 개정판의 안정 릴리스"라는 한 줄뿐이고, 바뀐 내용은 명세 사이트의 changelog에 정리돼 있다. 그 changelog를 읽고 정리했다(확인한 시점 2026-11-02). MCP가 뭔지부터 알고 싶으면 [자세히 → MCP](#/post/ai-mcp)를 먼저 보면 된다.

## 한 줄로

이전 판(2025-11-25)과 가장 크게 다른 점은 MCP가 상태 없는(stateless) 프로토콜이 됐다는 것이다. 연결을 맺고 세션을 유지하던 구조가 빠지고, 요청 하나하나가 그것만으로 처리될 수 있게 바뀌었다.

## 큰 변경 9개 중 핵심

changelog의 "Major changes"는 아홉 항목이다. 그중 흐름을 이해하는 데 필요한 것만 추렸다.

| 바뀐 것 | 내용 |
|---|---|
| 세션 제거 | Streamable HTTP에서 `Mcp-Session-Id` 헤더와 프로토콜 수준 세션이 없어졌다. `tools/list`, `resources/list`, `prompts/list`가 연결마다 달라지지 않는다 |
| 초기화 제거 | `initialize` / `notifications/initialized` 핸드셰이크가 없어졌다. 대신 모든 요청이 `_meta`에 프로토콜 버전과 클라이언트 능력을 싣는다 |
| `server/discover` | 서버가 반드시 구현해야 하는 새 호출. 지원하는 버전·능력·정체를 알려 준다 |
| `subscriptions/listen` | HTTP GET 엔드포인트와 `resources/subscribe`를 대신하는, 오래 열어 두는 알림 스트림 하나 |
| 재개 기능 제거 | SSE 스트림 재개(`Last-Event-ID`)가 없어졌다. 스트림이 끊기면 그 요청은 새 요청으로 다시 보내야 한다 |
| 태스크 분리 | 실험 기능이던 tasks가 코어에서 빠져 공식 확장(`io.modelcontextprotocol/tasks`)이 됐다 |
| MRTR | 서버가 먼저 클라이언트에 요청하던 방식을 대체하는 새 패턴(아래에서 설명) |

세션 대신 상태가 필요한 서버는 어떻게 하느냐도 적혀 있다. 서버가 직접 만든 핸들을 평범한 도구 인자로 주고받으라는 것이다. 프로토콜이 상태를 들고 있지 않고, 필요하면 앱이 도구 인자로 알아서 든다.

## 왜 이렇게 바꿨나

changelog 자체에는 이유 설명이 길게 나오지 않는다. 다만 MRTR 문서에 목적이 한 줄로 있다. 서버가 추가 정보를 요청하는 일을 "서버 인스턴스끼리 공유 저장소를 두거나 로드밸런서가 같은 서버로 계속 보내 주지 않아도" 처리하게 한다는 것이다. 변경 항목들이 전부 이 방향이다. 요청마다 필요한 정보가 다 들어 있으니, 어느 서버 인스턴스가 받아도 처리할 수 있다.

## MRTR: 서버가 되묻는 새 방식

이전에는 도구를 실행하던 서버가 중간에 사용자에게 뭔가 물어야 하면(elicitation) 클라이언트에 요청을 거꾸로 보냈다. 이 방식은 서버가 그 연결을 계속 붙들고 있어야 한다. 새 판은 이걸 금지하고(문서가 breaking change라고 적는다) 다음 흐름으로 바꿨다.

1. 클라이언트가 `tools/call` 같은 요청을 보낸다.
2. 서버가 추가 정보가 필요하다고 판단하면, 결과로 `resultType: "input_required"`를 돌려준다. 여기에 `inputRequests`(물어볼 것)와 `requestState`(서버만 아는 불투명 문자열)가 들어 있다.
3. 클라이언트가 사용자에게 물어서 답을 모은 뒤, 같은 요청을 `inputResponses`와 `requestState`를 붙여 다시 보낸다. 요청 ID는 새로 바뀐다.
4. 서버가 충분하다고 판단하면 최종 결과를 돌려준다.

```
클라이언트 ── tools/call (id:1) ─────────────▶ 서버
클라이언트 ◀─ input_required + requestState ── 서버   (요청 1은 여기서 끝)
   (사용자에게 물어봄)
클라이언트 ── tools/call (id:2) + 답 + requestState ▶ 서버
클라이언트 ◀─ 최종 결과 ───────────────────── 서버
```

핵심은 서버가 중간 상태를 저장하지 않는다는 점이다. 필요한 맥락은 `requestState`에 담아 클라이언트에 맡기고, 재시도 때 돌려받는다. 문서는 이 값을 "공격자가 조작할 수 있는 입력"으로 보라고 한다. 권한이나 비즈니스 로직에 영향을 주면 HMAC이나 AEAD 같은 방법으로 무결성을 보호하고, 검증에 실패하면 거절해야 한다(MUST). 재사용을 막으려면 인증된 사용자, 짧은 만료 시간, 원래 요청의 식별자를 보호되는 페이로드 안에 넣으라고(SHOULD) 권한다.

이 방식으로 물을 수 있는 요청은 `prompts/get`, `resources/read`, `tools/call` 세 가지로 한정돼 있다. 물을 수 있는 내용은 elicitation, sampling, roots 목록 요청 중 하나다.

<details>
<summary>자세한 풀이: inputRequests와 inputResponses의 모양</summary>

문서의 예시를 줄이면 이렇다. 서버가 돌려주는 `inputRequests`는 서버가 붙인 이름을 키로 하는 맵이다.

```json
{
  "resultType": "input_required",
  "inputRequests": {
    "github_login": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Please provide your GitHub username",
        "requestedSchema": {
          "type": "object",
          "properties": { "name": { "type": "string" } },
          "required": ["name"]
        }
      }
    }
  },
  "requestState": "AEAD-protected blob"
}
```

클라이언트는 같은 키로 답을 채워 재시도한다.

```json
{
  "github_login": { "action": "accept", "content": { "name": "octocat" } }
}
```

클라이언트가 일부만 답하면 서버는 오류를 내지 말고 모자란 것을 다시 `input_required`로 물어야 한다(SHOULD). 클라이언트가 선언하지 않은 능력(예: elicitation 미지원)에 대한 요청은 서버가 보내면 안 된다(MUST NOT).

</details>

## 모든 요청에 붙는 `_meta`

초기화가 없어졌으니 버전과 능력은 요청마다 실린다.

- 필수: `io.modelcontextprotocol/protocolVersion`, `io.modelcontextprotocol/clientCapabilities`
- 권장: 클라이언트는 `clientInfo`를, 서버는 결과의 `_meta`에 `serverInfo`를 싣는다
- 버전이 안 맞으면 `UnsupportedProtocolVersionError`가 돌아온다

로그 수준도 이제 `logging/setLevel`로 따로 정하지 않고 요청마다 `io.modelcontextprotocol/logLevel`로 보낸다. 이 값이 없는 요청에는 서버가 `notifications/message`를 보내면 안 된다. `ping`과 `notifications/roots/list_changed`도 사라졌다.

## 작은 변경 중 눈에 띈 것

- 캐시: `tools/list`, `prompts/list`, `resources/list`, `resources/read`, `resources/templates/list` 결과에 `ttlMs`(신선도 힌트, 밀리초)와 `cacheScope`(`public` / `private`)가 필수가 됐다. 클라이언트가 응답을 캐시해 폴링을 줄이라는 뜻이다.
- 도구 순서: 서버는 `tools/list`를 매번 같은 순서로 돌려주라고(SHOULD) 한다. 이유로 클라이언트 캐시와 LLM 프롬프트 캐시 적중률을 든다. 도구 목록이 프롬프트 앞부분에 들어가니, 순서가 바뀌면 [프롬프트 캐싱](#/post/ai-prompt-caching)이 깨지기 때문일 것이다.
- 헤더: Streamable HTTP POST에 `Mcp-Method`, `Mcp-Name` 헤더가 필수가 됐다. 본문을 열지 않고도 라우팅할 수 있게 하는 것으로 보인다.
- 스키마: 도구의 `inputSchema`와 `outputSchema`에 JSON Schema 2020-12의 모든 키워드를 쓸 수 있고, `structuredContent`는 아무 JSON 값이나 된다.
- 오류 코드: 리소스를 못 찾을 때의 코드가 `-32002`에서 `-32602`(Invalid Params)로 바뀌었다. MCP 전용 코드는 `-32020`~`-32099` 범위로 정리됐다.
- 추적: `_meta`에 OpenTelemetry의 `traceparent`, `tracestate`, `baggage`를 싣는 관례가 문서화됐다.
- 인증: 인증 서버는 응답에 `iss` 파라미터를 넣는 게 권장(SHOULD)이고, 클라이언트는 들어 있으면 기록해 둔 발급자와 대조해야 한다(MUST).

## 사라지는 것과 대체 경로

"Deprecated" 목록은 당장 없어지는 게 아니라 제거 예정이다. 새 명세는 최소 12개월의 폐지 유예 기간을 두는 기능 수명주기 정책을 함께 도입했다. 상태는 Active, Deprecated, Removed 셋이고 폐지 기능은 별도 레지스트리에 모인다.

| 폐지 대상 | changelog가 제안한 대안 |
|---|---|
| Roots | 디렉터리·파일을 도구 파라미터, 리소스 URI, 서버 설정으로 전달 |
| Sampling | LLM 제공자 API를 직접 연동 |
| Logging | stdio면 `stderr`로 기록, 아니면 OpenTelemetry |
| 동적 클라이언트 등록(DCR, RFC 7591) | Client ID Metadata Documents. DCR은 이를 지원하지 않는 인증 서버를 위해 남는다 |
| HTTP+SSE 전송 | Streamable HTTP |

Sampling이 빠지면 서버가 클라이언트의 모델을 빌려 쓰는 길이 막히고, 서버가 쓸 모델은 서버 쪽이 따로 연결해야 한다. 이 변화는 MCP 서버를 만드는 사람에게 설계가 달라지는 부분이다. 직접 만들어 보는 흐름은 [자세히 → MCP 서버 만들어 보기](#/post/app-mcp-server)에 따로 있다.

## 확장 프레임워크

`ClientCapabilities`와 `ServerCapabilities`에 `extensions` 필드가 생겨서, 코어 밖의 선택 기능을 협상할 수 있다. 태스크가 첫 번째 사례다. 장시간 작업을 코어에서 빼 확장으로 옮기고, 막고 기다리던 `tasks/result` 대신 `tasks/get` 폴링과 클라이언트가 입력을 보내는 `tasks/update`를 쓰도록 다시 설계했다. `tasks/list`는 없어졌고, 서버는 요청마다 허락을 받지 않아도 태스크 핸들을 먼저 돌려줄 수 있다.

## 이게 에이전트 쪽에서 의미하는 것

모델이 도구를 부르는 흐름은 그대로다([자세히 → 도구 호출](#/post/ai-tool-use)). 바뀌는 건 도구가 있는 서버와 호스트 사이의 선이다. 호스트가 대화 상태를 들고 있고 서버는 요청마다 독립적으로 처리하니, [세션과 대화 기록](#/post/ai-session)에서 본 LLM API의 모양과 비슷해졌다. 호스트가 도구 호출을 가로채 서버로 전달하고 결과를 다시 대화에 넣는 [하네스](#/post/ai-harness)의 역할은 같다. 다만 서버가 되묻는 경우를 처리하는 코드, 즉 `input_required`를 받으면 사용자에게 물어 재시도하는 루프가 클라이언트(하네스) 쪽에 필요하다.

기존 서버가 곧바로 깨지는지는 이 글에서 다룬 문서만으로는 말하기 어렵다. 문서는 이전 서버의 결과에 `resultType`이 없으면 클라이언트가 `"complete"`로 취급하라고 해서(MUST) 일부 호환 경로를 두고 있다.

## 근거 링크

- 명세 changelog(Key Changes): https://modelcontextprotocol.io/specification/2026-07-28/changelog
- Multi Round-Trip Requests 문서: https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr
- GitHub 릴리스 2026-07-28: https://github.com/modelcontextprotocol/specification/releases/tag/2026-07-28

관련 글: [MCP](#/post/ai-mcp) · [도구 호출](#/post/ai-tool-use) · [하네스](#/post/ai-harness)
