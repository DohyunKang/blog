관측성(observability)은 서비스가 밖으로 내보내는 기록을 보고 안에서 무슨 일이 있었는지 짐작할 수 있게 해 두는 것이다. LLM 서비스에서는 사용자 한 번의 요청이 프롬프트 조립, 검색, 모델 호출, 도구 실행 같은 여러 단계로 쪼개지기 때문에, 이 단계들을 하나로 묶어 남기는 트레이싱이 중심이 된다.

## 일반 로그로는 왜 모자라나

웹 서버 로그는 요청이 들어왔고 200을 돌려줬다는 걸 알려 준다. LLM 기능에서는 200이 나와도 답이 틀릴 수 있다. 에러가 없으니 로그에는 아무 흔적이 안 남는다.

이유가 두 가지다.

- 출력이 일정하지 않다. 같은 입력에도 답이 달라서, 재현이 안 되는 제보는 그때 실제로 오간 프롬프트와 응답이 남아 있어야 따라갈 수 있다. 이 변동이 평가가 필요한 이유이기도 하다([LLM 평가](#/post/ai-evals)).
- 한 요청이 여러 단계를 지난다. [에이전트 루프](#/post/ai-agent-loop)가 돌면 모델 호출 다섯 번, [도구 호출](#/post/ai-tool-use) 세 번이 한 요청 안에 들어간다. 로그가 줄줄이 찍혀도 어느 줄이 어느 요청의 몇 번째 단계인지 엮이지 않으면 읽을 수가 없다.

## trace와 span

OpenTelemetry 문서의 정의를 옮기면 이렇다. trace는 요청이 애플리케이션을 지나간 전체 경로이고, 같은 trace ID를 가진 span들로 이뤄진다. span은 그 안의 작업 하나다. 이름, 부모 span의 ID(최상위는 비어 있음), 시작·종료 시각, 속성(attributes), 이벤트, 상태를 가진다. 자식 span은 부모의 ID를 저장하기 때문에 계층이 생긴다.

LLM 요청 하나를 그려 보면 이런 모양이다.

```
trace  (사용자 질문 1건)
└─ span: 에이전트 실행            ← 전체 12.4초
   ├─ span: 검색                  ← 0.6초
   ├─ span: 모델 호출 #1          ← 3.1초, 도구 요청이 나옴
   ├─ span: 도구 실행 (주문 조회) ← 0.9초
   └─ span: 모델 호출 #2          ← 7.2초, 최종 답
```

각 칸에 걸린 시간이 보이니 느린 요청이 어디서 느린지 바로 나온다. 위 숫자는 모양을 보이려고 만든 예시다.

span의 속성은 이름·값 쌍이고, OpenTelemetry는 표준 속성 이름을 정해 둔 것을 시맨틱 규약(semantic conventions)이라고 부른다. 같은 이름을 쓰면 도구가 달라도 같은 방식으로 읽는다.

## 무엇을 기록하나

LLM 쪽에서 남기는 것은 대체로 이렇다.

| 항목 | 왜 필요한가 |
|---|---|
| 프롬프트(입력 메시지) | 그때 모델이 실제로 받은 내용을 봐야 원인을 찾는다 |
| 응답(출력 메시지) | 어떤 답이 나갔는지, 다시 볼 수 있어야 한다 |
| 모델 이름·파라미터 | 모델을 바꾼 뒤 달라졌는지 비교한다 |
| 토큰 수(입력·출력) | 비용 계산의 재료다 |
| 지연 시간 | span의 시작·종료로 나온다 |
| 도구 이름·인자·결과 | 에이전트가 도구를 잘못 골랐는지 본다 |
| 종료 이유 | 길이 제한으로 잘렸는지 등 |
| 사용자·세션 ID, 버전, 태그 | 특정 사용자나 배포 버전으로 걸러 본다 |

비용은 토큰 수에 모델별 단가를 곱한 값이라 따로 찍기보다 토큰 수를 남겨 두고 나중에 계산하는 쪽이 쉽다. 모델 호출 단가는 바뀌니까 기록 시점의 단가도 같이 두는지는 도구마다 다를 수 있다.

## OpenTelemetry의 GenAI 규약

OpenTelemetry에는 이런 속성 이름을 정리한 GenAI 시맨틱 규약이 있다. 지금은 opentelemetry.io의 문서 페이지에서 별도 저장소(semantic-conventions-genai)로 옮겨 가는 중이다. 이 저장소의 README는 GenAI 클라이언트, MCP, 제공사별 규약에 대한 span·metric·event를 다룬다고 소개한다.

옮겨 가기 전 속성 레지스트리 페이지에 적힌 이름 몇 개를 보면 감이 온다.

| 속성 | 뜻 |
|---|---|
| `gen_ai.operation.name` | 어떤 작업인지. `chat`, `embeddings`, `execute_tool`, `invoke_agent`, `retrieval` 등이 값으로 나온다 |
| `gen_ai.request.model` | 요청을 보낸 모델 이름 |
| `gen_ai.usage.input_tokens` | 입력 토큰 수(캐시된 입력 토큰을 포함해야 한다고 적혀 있다) |
| `gen_ai.usage.output_tokens` | 출력 토큰 수 |
| `gen_ai.response.finish_reasons` | 생성이 멈춘 이유 |
| `gen_ai.tool.name` | 에이전트가 쓴 도구 이름 |
| `gen_ai.input.messages` / `gen_ai.output.messages` | 모델에 들어간 대화와 나온 메시지 |

operation 이름이 `execute_tool`, `invoke_agent`, `retrieval`까지 있으니 모델 호출뿐 아니라 도구·에이전트·검색 단계도 같은 틀로 남기는 걸 염두에 둔 규약이다. 해당 페이지에서 이 값들은 아직 개발(development) 단계로 표시돼 있어서 이름이 바뀔 수 있다.

## 대표 도구

OpenTelemetry는 규격과 SDK이고, 기록을 모아 보여 주는 쪽은 별도 제품이다. 공식 문서에서 개념을 읽은 둘을 적어 둔다.

LangSmith는 run과 trace라는 말을 쓴다. run은 LLM 호출, 프롬프트 조립, 문서 검색 같은 작업 단위 하나이고 문서도 OpenTelemetry의 span에 비교한다. trace는 한 작업의 run 모음이고, trace ID로 묶인다. 여러 턴의 대화는 trace 하나가 한 턴이 되고, `thread_id` 메타데이터로 묶어 thread로 본다. run마다 점수(feedback)를 붙일 수 있고 태그와 점수 값으로 이뤄진다.

Langfuse는 trace 아래에 observation이 있고, observation의 종류로 span, generation, event가 있다. LLM 호출, 도구 호출, 검색 단계 같은 것이 observation이다. 채팅 한 번이 trace이고, 여러 trace를 묶는 선택 단위가 session이다. 수집은 OpenTelemetry 위에 만들어졌고, SDK가 배치로 모아 백그라운드로 보낸다. 짧게 끝나는 앱은 종료 전에 `flush()`를 불러야 데이터를 잃지 않는다고 문서에 적혀 있다.

용어만 다르고 구조는 같다. 요청 하나(trace)에 단계(span/run/observation)가 계층으로 달리고, 거기에 입출력·메타데이터가 붙는다.

## 평가·회귀와 이어지는 부분

기록을 쌓아 두면 평가 쪽에서 쓸 데가 생긴다.

- 서비스에서 이상했던 trace를 평가 세트의 사례로 옮긴다. 평가 글에서도 운영 로그를 좋은 평가 사례의 재료로 본다고 했다.
- 프롬프트나 모델을 바꾼 뒤 같은 종류의 trace에서 지연, 토큰, 실패율이 어떻게 변했는지 비교한다. 회귀를 잡는 근거가 된다.
- 응답에 점수를 붙인다. LangSmith는 run 단위로 feedback을 붙이는 구조를 가진다. 사람의 좋아요·싫어요든 자동 채점이든 어느 trace에 대한 점수인지 연결돼 있어야 나쁜 점수의 원인 단계를 열어 볼 수 있다.
- [가드레일](#/post/ai-guardrails)이 무언가를 막았을 때 그 사실도 span이나 이벤트로 남기면, 얼마나 자주 걸리는지 센다.

정리하면 평가는 점수를 만들고, 관측성은 그 점수의 원인이 어디 있는지 열어 보게 한다.

## 개인정보 마스킹

프롬프트와 응답을 통째로 남기는 게 관측성의 핵심 가치인데, 그게 곧 위험이다. 사용자 입력에는 이름, 연락처, 내부 문서 내용이 들어갈 수 있다. OpenTelemetry 속성 레지스트리의 `gen_ai.input.messages`와 `gen_ai.output.messages` 항목에도 사용자·개인정보(PII)를 포함할 가능성이 높다는 경고가 달려 있다.

Langfuse는 마스킹 기능을 따로 둔다. 데이터가 애플리케이션을 떠나기 전에 입력·출력·메타데이터를 가리는 용도다. Python SDK에서는 내보내기 시점에 span을 받아 속성을 지우거나 바꾸는 훅(`mask_otel_spans`)을 권장하고, JS/TS SDK에서는 `LangfuseSpanProcessor`에 `mask` 함수를 넘긴다. OpenTelemetry만 쓰는 구성이면 앱 안의 span 프로세서나 Collector의 redaction·transform 프로세서에서 가릴 수 있다고 한다. 문서에 적힌 제약도 있다. 이 함수는 빠르고 결정적이어야 하고, 예외가 나거나 잘못된 값을 돌려주면 그 배치를 통째로 버린다.

<details>
<summary>마스킹 설계할 때 따져 볼 것</summary>

- 가릴 위치: 앱 안에서 가리면 외부로 안 나가고, Collector에서 가리면 한 곳에서 관리된다.
- 무엇을 가릴지: 이메일·전화번호 같은 패턴, 아예 입력 본문 전체, 사용자 ID를 해시한 값 등 선택지가 있다.
- 본문을 안 남기는 선택도 있다: 토큰 수, 지연, 도구 이름 같은 메타데이터만 남기면 위험이 훨씬 줄지만 원인을 찾을 단서도 줄어든다.
- 보관 기간: LangSmith SaaS 문서는 수집 후 180일 보관이라고 적고 있다. 쓰는 도구의 보관 기간을 확인해 둔다.

</details>

## 흔한 오해

- 로그를 많이 찍으면 관측성이다: 단계가 trace ID로 묶이지 않으면 요청 단위로 읽을 수 없다.
- 관측성이 있으면 품질이 보장된다: 기록은 사후에 보는 것이고, 막는 건 가드레일, 점수는 평가의 일이다.
- 프롬프트와 응답은 전부 남기는 게 좋다: 개인정보가 섞이므로 무엇을 남길지 정해야 한다.
- OpenTelemetry는 보는 화면이다: 규격과 SDK이고, 화면은 LangSmith·Langfuse 같은 별도 도구나 다른 백엔드가 맡는다.

## 근거 링크

- OpenTelemetry, Traces: https://opentelemetry.io/docs/concepts/signals/traces/
- OpenTelemetry, GenAI 속성 레지스트리: https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/
- OpenTelemetry, semantic-conventions-genai 저장소: https://github.com/open-telemetry/semantic-conventions-genai
- LangSmith, Observability concepts: https://docs.langchain.com/langsmith/observability-concepts
- Langfuse, Data model: https://langfuse.com/docs/observability/data-model
- Langfuse, Masking: https://langfuse.com/docs/observability/features/masking

← [개념 지도로](#/post/ai-map)

관련 글: [LLM 평가](#/post/ai-evals) · [에이전트 루프](#/post/ai-agent-loop) · [가드레일](#/post/ai-guardrails)
