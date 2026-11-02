구조화 출력은 모델의 답을 정해 둔 모양(스키마)에 맞춰 내게 하는 기능이고, 부탁하는 것과 강제하는 것은 믿을 수 있는 정도가 달랐다.

## 왜 필요한가

LLM은 기본적으로 글을 쓴다. 사람이 읽을 때는 그게 맞는데, 프로그램이 받으면 문제가 된다. 메일 한 통에서 이름과 데모 요청 여부를 뽑는 코드를 짠다고 하자. 모델이 이렇게 답하면 곤란하다.

```
네, 분석해 봤습니다! 이름은 김OO이고 데모를 요청했네요.
```

코드가 원하는 건 `{"name": "김OO", "demo_requested": true}` 같은 정해진 모양이다. 앞에 인사말이 붙거나, 키 이름이 `demo`로 바뀌거나, `true` 자리에 `"네"`가 들어가면 파싱이 깨진다. 구조화 출력은 이걸 줄이려는 기능이다. 모델 답을 기계가 바로 읽을 수 있게 만드는 쪽의 이야기라서 [LLM](#/post/ai-llm)이 확률로 글을 이어 쓴다는 점부터 알고 있으면 이해가 쉽다.

## 세 단계로 나눠 보면

아래로 갈수록 강하다.

| 단계 | 방법 | 보장 |
|---|---|---|
| 1. 부탁 | 프롬프트에 "JSON으로만 답해, 키는 name, demo_requested"라고 쓴다 | 없음. 대부분 따르지만 가끔 어긴다 |
| 2. JSON 모드 | API 옵션으로 "유효한 JSON을 내라"고 지정 | JSON 문법은 맞음. 키와 타입은 보장 안 함 |
| 3. 스키마 강제 | JSON Schema를 같이 보내 그 모양만 나오게 한다 | 문법과 스키마까지 맞음(예외는 아래) |

OpenAI 문서는 JSON 모드와 구조화 출력(Structured Outputs)을 이렇게 가른다. 둘 다 유효한 JSON을 만들지만 스키마를 지키는 건 구조화 출력뿐이고, 가능하면 구조화 출력을 쓰라고 권한다. 1단계는 [프롬프트](#/post/ai-prompt)를 잘 쓰는 문제라 API가 해 주는 게 없다.

## 스키마를 어떻게 강제하나

스키마는 JSON Schema라는 표준 형식으로 쓴다. 어떤 키가 있고, 각 값이 문자열인지 불리언인지, 어떤 키가 필수인지를 적은 설계도다. Anthropic 문서의 예시는 대략 이런 모양이다.

```json
{
  "type": "object",
  "properties": {
    "name": {"type": "string"},
    "demo_requested": {"type": "boolean"}
  },
  "required": ["name", "demo_requested"],
  "additionalProperties": false
}
```

Anthropic 문서에 따르면 내부에서는 제약 디코딩(constrained decoding)을 쓴다. 스키마를 문법으로 컴파일해서, 토큰을 하나씩 뽑을 때 그 문법에서 허용되는 토큰만 고르게 하는 방식이다. 모델이 "네," 같은 토큰을 뽑으려 해도 그 자리에서는 후보에서 빠진다. 그래서 답이 끝난 뒤에 고치는 게 아니라 만드는 도중에 틀릴 길을 막는다. 이 부분은 [샘플링](#/post/ai-sampling)이 다음 토큰을 고르는 단계라는 걸 알면 그림이 그려진다.

비용 얘기도 문서에 있다. 처음 쓰는 스키마는 컴파일 때문에 지연이 조금 붙고, 컴파일된 문법은 마지막 사용 후 24시간 캐시된다(Anthropic 문서 기준). OpenAI 문서도 새 스키마의 첫 요청에 추가 지연이 있다고 적는다. 또 Anthropic은 형식을 설명하는 시스템 프롬프트가 따로 붙어서 입력 토큰이 늘고, `output_config.format`을 바꾸면 그 대화의 프롬프트 캐시가 무효가 된다고 한다.

## 도구 호출과의 관계

헷갈렸던 부분이다. 구조화된 JSON이 나오는 경로가 둘이다.

- 응답 자체를 구조화: 사용자에게 돌려줄 최종 답이 스키마를 따르게 한다. Anthropic은 `output_config.format`, OpenAI는 `text.format`에 `json_schema`를 지정한다.
- 도구 호출 인자를 구조화: 모델이 함수를 부를 때 넘기는 인자가 도구의 스키마를 따르게 한다. Anthropic은 도구 정의에 `strict: true`를 붙인다.

OpenAI 문서의 구분이 쉬웠다. 모델이 내 도구·함수·데이터를 호출해야 하면 함수 호출을 쓰고, 사용자에게 가는 응답 모양을 정하고 싶으면 `text.format`을 쓴다. 도구 호출 자체는 [도구 호출](#/post/ai-tool-use) 글에서 따로 정리하기로 했고, 여기서는 "도구 인자도 결국 JSON이라서 같은 스키마 기술을 쓴다" 정도로만 잡았다. Anthropic 문서는 둘을 같이 쓸 수도 있다고 한다. 그러면 도구 호출도 스키마에 맞고 마지막 응답도 스키마에 맞는다.

[MCP](#/post/ai-mcp) 도구 정의에도 입력 스키마가 들어가는데, 같은 줄기의 이야기라고 이해했다. 다만 MCP 서버가 strict를 어떻게 다루는지는 확인 못 했다.

## 코드에서는 이렇게 쓴다

Anthropic 문서에 따르면 Python SDK는 Pydantic 모델을 넘기면 `client.messages.parse(output_format=...)`로 파싱된 객체를 돌려준다. TypeScript는 Zod 스키마를 `zodOutputFormat`으로 감싼다. 손으로 JSON Schema를 쓰는 대신 평소 쓰는 타입 정의에서 스키마를 뽑는 쪽이다. 나는 이 SDK 호출을 직접 실행해 보지는 못했다.

<details>
<summary>자세한 풀이: 스키마로 못 하는 것들 (Anthropic 문서 기준)</summary>

스키마 문법을 다 쓸 수 있는 건 아니다. 문서에서 읽은 제한을 추렸다.

- 지원: 기본 타입, `enum`, `const`, `anyOf`, 내부 `$ref`, `required`, 몇몇 문자열 형식(`date-time`, `email`, `uuid` 등). 객체에는 `additionalProperties: false`가 필수다.
- 미지원: 재귀 스키마, 외부 `$ref`, 숫자 범위(`minimum`, `maximum`), 문자열 길이(`minLength`, `maxLength`), `minItems`는 0 또는 1만.
- 미지원 기능을 쓰면 400 오류가 난다. SDK 도우미는 일부 제약을 설명문에 옮기고 응답을 로컬에서 다시 검증하는 식으로 우회한다.
- 복잡도 제한: 한 요청에서 strict 도구는 20개, 선택 파라미터는 24개, 유니온 타입 파라미터는 16개까지다. 넘으면 "Schema is too complex" 오류가 날 수 있다.

OpenAI 문서에서는 예시가 모두 `additionalProperties: false`에 모든 속성을 `required`로 둔다. 지원 기능의 전체 목록은 내가 읽은 범위에서 잘려 있어서 확인 못 했다.

그래서 "나이는 0~120"처럼 값의 범위를 스키마로 못 막는 경우가 생긴다. 모양은 맞아도 값이 이상할 수 있다는 뜻이다. 값의 의미는 결국 코드에서 한 번 더 검사해야 한다.

</details>

## 그래도 실패하는 경우

강제라고 해서 항상 성공하는 건 아니다. 두 문서가 같은 걸 짚는다.

- 거절(refusal): 모델이 안전상 이유로 답을 거절하면 스키마에 안 맞는 출력이 나올 수 있다. Anthropic은 이때 HTTP 200에 `stop_reason: "refusal"`로 오고 토큰은 과금된다고 한다. OpenAI는 응답에 `refusal` 항목이 따로 들어가니 파싱 전에 확인하라고 한다.
- 토큰 한도: 답이 `max_tokens`에서 잘리면 JSON이 중간에 끊긴다. Anthropic은 `stop_reason: "max_tokens"`, OpenAI는 `status: "incomplete"`와 `max_output_tokens` 이유로 알려 준다. 한도를 늘려서 다시 요청하는 게 방법이다.
- enum 대소문자: Anthropic 문서에 따르면 enum 값이 대소문자만 다르게 나올 수 있다. 비교할 때 대소문자를 무시하라는 얘기다.
- 값은 맞아 보여도 틀린 경우: 모양이 맞다고 내용이 맞는 건 아니다. 존재하지 않는 값을 그럴듯하게 채울 수 있고, 이건 [환각](#/post/ai-hallucination)과 같은 문제다.

그래서 실제로는 "스키마로 강제 + 코드에서 검증 + 실패하면 재시도" 세 겹이 된다고 이해했다.

## 실패 처리를 직접 짜 보면

스키마 강제를 못 쓰는 환경(예전 모델, 로컬 모델 등)에서는 검증과 재시도를 직접 해야 한다. 아래 코드는 표준 라이브러리만 쓴 최소 예시고, 모델 호출 자리는 가짜 함수로 대신해서 실행해 봤다. 첫 답은 인사말이 붙어서 JSON이 깨졌고, 둘째 답은 타입이 틀렸고, 셋째 답에서 통과했다.

```python
import json

SCHEMA = {"name": str, "demo_requested": bool}

def check(text):
    data = json.loads(text)              # 1) JSON 문법
    if not isinstance(data, dict):
        raise ValueError("객체가 아님")
    for key, typ in SCHEMA.items():      # 2) 키와 타입
        if key not in data:
            raise ValueError(f"없는 키: {key}")
        if not isinstance(data[key], typ):
            raise ValueError(f"타입 틀림: {key}")
    return data

def ask(prompt, call, retries=2):
    for _ in range(retries + 1):
        out = call(prompt)
        try:
            return check(out)
        except (json.JSONDecodeError, ValueError) as e:
            prompt += f"\n이전 답이 잘못됐다: {e}. JSON만 다시."
    raise RuntimeError("재시도 실패")

answers = iter(['네, 알겠습니다! {"name": "김"}',
                '{"name": "김", "demo_requested": "yes"}',
                '{"name": "김", "demo_requested": true}'])
print(ask("문의 메일 분석", lambda p: next(answers)))
```

실행 결과는 `{'name': '김', 'demo_requested': True}`였다(Python으로 직접 실행 확인, 모델 호출은 가짜). 실제 서비스에서는 재시도마다 요금이 들어서 횟수를 2~3번으로 막아 두는 게 맞겠다. 비용은 [토큰 아끼는 법](#/post/claude-tokens)과도 이어진다.

## 흔한 오해

- JSON 모드면 스키마도 지켜진다: 아니다. JSON 모드는 문법만 보장한다는 게 OpenAI 문서의 구분이다. 키가 빠져도 유효한 JSON이다.
- 스키마 강제면 내용도 믿어도 된다: 모양만 보장한다. 값의 사실 여부는 따로 봐야 한다.
- 강제하면 항상 성공한다: 거절과 토큰 한도 초과는 예외다. 위 두 문서 모두 이걸 적고 있다.
- 스키마가 길고 자세할수록 좋다: 복잡도 제한이 있고 컴파일 지연도 붙는다. Anthropic 문서는 정말 필요한 도구만 strict로 하라고 한다.
- 모든 모델이 지원한다: 아니다. OpenAI는 오래된 모델에는 JSON 모드가 필요할 수 있다고 하고, Anthropic은 지원 모델 목록을 따로 둔다. 모델 목록은 자주 바뀌어서 쓸 때 문서를 다시 봐야 한다.

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

확인함: Anthropic 구조화 출력 문서(JSON outputs와 strict tool use 구분, 제약 디코딩, 문법 24시간 캐시, 스키마 제한과 복잡도 제한, 거절·`max_tokens`·enum 대소문자 예외, 추가 입력 토큰), OpenAI 구조화 출력 문서(JSON 모드와의 차이, `text.format`, 함수 호출과의 구분, 거절·incomplete 처리, 첫 요청 지연). 검증·재시도 코드는 로컬에서 실행했다.

확인 못 함: 두 문서의 마지막 부분(Anthropic은 약 6천 자, OpenAI는 약 4만 5천 자를 읽지 못함). OpenAI 쪽 지원 스키마 기능 전체 목록. Google 등 다른 업체의 방식. 제약 디코딩이 답 품질에 주는 영향(문서에서 다루는지 못 읽음). SDK 도우미(`messages.parse`, Zod)의 실제 동작은 직접 실행하지 않았다. MCP 서버에서 strict가 어떻게 쓰이는지.

</details>

## 근거 링크

- Anthropic 문서, Structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- OpenAI 문서, Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs

← 개념 지도로 (#/post/ai-map)

관련 글: [도구 호출](#/post/ai-tool-use) · [프롬프트](#/post/ai-prompt) · [환각](#/post/ai-hallucination)
