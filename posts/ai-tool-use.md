도구 호출은 모델이 함수를 직접 실행하는 기능이 아니다. 모델은 "이 도구를 이 인자로 불러 달라"는 구조화된 요청만 쓰고, 실제 실행과 결과 전달은 내 코드(또는 서버)가 한다.

## 도구 호출이 뭔지

LLM은 글만 만든다. 날씨를 모르고, 내 DB도 못 보고, 파일도 못 연다. 도구 호출(tool use, function calling)은 이 한계를 넘기려고 "쓸 수 있는 함수 목록"을 모델에게 미리 알려 주는 방식이다. 모델이 질문을 보고 목록 중에 필요한 게 있다고 판단하면, 일반 문장 대신 호출 요청을 내놓는다.

Anthropic 문서는 "tool use (also called function calling)"라고 두 이름을 같은 것으로 쓴다. 이 글에서도 같은 말로 쓴다. 모델 → 도구 → 다시 모델로 도는 큰 구조는 [자세히 → 에이전트 루프](#/post/ai-agent-loop)에서 따로 다룬다.

## 한 바퀴 흐름

Claude 기준으로 정리하면 이렇다.

1. 요청에 `tools`를 담는다. 도구마다 `name`, `description`, `input_schema`(JSON 스키마)가 있다.
2. 모델이 호출하기로 하면 응답의 `stop_reason`이 `tool_use`가 되고, content 안에 `tool_use` 블록이 들어 있다. 블록에는 `id`, `name`, `input`이 있다.
3. 내 코드가 `name`에 맞는 함수를 `input`으로 실행한다.
4. 결과를 `role: user` 메시지에 `tool_result` 블록으로 담아 다시 보낸다. 이때 `tool_use_id`에 아까 받은 `id`를 적어서 어느 요청의 답인지 맞춘다.
5. 모델이 결과를 읽고 최종 답을 쓰거나, 또 다른 도구를 부른다.

```text
나(코드)                          모델
  | -- 질문 + 도구 목록 ---------->|
  |<-- tool_use(id=t1, 이름, 인자) -|   stop_reason: tool_use
  |  (내가 함수 실행)               |
  | -- tool_result(t1, 결과) ----->|
  |<-- 최종 답 (end_turn) ---------|
```

OpenAI도 흐름은 같다. 이름만 다르다. 요청에 `tools`를 담고, 응답에 `function_call` 항목이 오고(`call_id`, `name`, JSON 문자열인 `arguments`), 내가 실행한 뒤 같은 `call_id`로 `function_call_output`을 붙여 다시 보낸다. 도구 정의는 `type: "function"`, `name`, `description`, `parameters`다. 한쪽을 이해하면 다른 쪽도 읽힌다.

## 예시: 날씨 도구

문서의 예시를 줄이면 이런 모양이다.

```python
tools = [{
    "name": "get_weather",
    "description": "Get the current weather for a given location.",
    "input_schema": {
        "type": "object",
        "properties": {"location": {"type": "string"}},
        "required": ["location"],
    },
}]
```

"샌프란시스코 날씨 어때?"를 보내면 모델은 문장 대신 `{"name": "get_weather", "input": {"location": "San Francisco, CA"}}` 같은 블록을 돌려준다. 내가 날씨 API를 부르고 그 결과 문자열을 `tool_result`로 보내면, 모델이 "15도에 구름 조금"처럼 사람 말로 정리한다.

여기서 `description`이 생각보다 중요하다. 모델이 도구를 부를지 말지, 무슨 인자를 넣을지를 이 설명과 스키마만 보고 정한다. 문서도 호출이 이상하면 설명을 더 자세히 쓰라고 권한다.

## 병렬 호출

한 번의 응답에 `tool_use` 블록이 여러 개 올 수 있다. "서울이랑 제주 날씨"라고 하면 도구 호출 2개가 한 번에 온다. 문서에 따르면 실행 순서는 API가 정하지 않는다. 동시에 돌려도 되고 순서대로 돌려도 된다. 읽기만 하는 독립 작업은 동시에 돌리는 게 빠르고, 부작용이 있거나 순서가 있는 도구는 차례대로 돌리는 게 낫다.

돌려줄 때 규칙이 두 개 있다. 결과는 한 user 메시지에 모아서 보낸다. 그리고 그 메시지 안에서 `tool_result`가 앞에 오고 텍스트는 뒤에 와야 한다. 텍스트를 앞에 두면 400 오류가 난다고 문서에 나온다. 또 tool_result 메시지는 tool_use 메시지 바로 다음에 와야 하고 사이에 다른 메시지를 끼울 수 없다.

끄고 싶으면 Claude는 `tool_choice`에 `disable_parallel_tool_use: true`를 넣고, OpenAI는 `parallel_tool_calls: false`를 쓴다. OpenAI 쪽은 "0개 또는 1개"로 제한된다고 적혀 있다.

## 오류 처리

도구가 실패하는 경우는 흔하다. 문서가 말하는 방법은 단순하다. 실패해도 `tool_result`는 반드시 돌려주고, `is_error: true`와 함께 오류 내용을 `content`에 담는다. 그러면 모델이 그 오류를 반영해서 사용자에게 설명하거나 다시 시도한다.

- 오류 문구는 구체적으로: "failed"보다 "Rate limit exceeded. Retry after 60 seconds."가 낫다고 문서가 예시로 든다. 뭐가 잘못됐고 다음에 뭘 해 볼 수 있는지 알려 주라는 뜻이다.
- 필수 인자가 빠진 호출: 개발 중이면 도구 설명을 보강하는 게 먼저고, 그래도 오면 오류 `tool_result`를 돌려주면 모델이 다시 채워서 부른다. 문서는 2~3번 고쳐 시도한 뒤 사용자에게 사과한다고 적는다.
- 아예 잘못된 호출을 막고 싶으면 `strict: true`. 스키마에 정확히 맞는 호출만 나오게 한다. OpenAI도 `strict`가 있고, 모든 필드를 `required`에 넣고 `additionalProperties: false`를 요구한다. [자세히 → 구조화 출력](#/post/ai-structured-output)과 같은 맥락이다.

## 직접 돌려 본 것

아래는 모델 응답을 미리 짜 둔 가짜로 바꾼 코드다. API는 부르지 않고, 위 흐름(병렬 호출 2개, 하나는 실패)이 메시지 모양으로 어떻게 쌓이는지만 본다. 직접 실행해서 확인했다.

```python
import json

def get_weather(location):
    data = {"서울": "맑음 18도", "부산": "흐림 20도"}
    if location not in data:
        raise KeyError(f"모르는 도시: {location}")
    return data[location]

TOOLS = {"get_weather": get_weather}

scripted = [
    {"stop_reason": "tool_use", "content": [
        {"type": "text", "text": "두 도시를 같이 볼게요."},
        {"type": "tool_use", "id": "t1", "name": "get_weather", "input": {"location": "서울"}},
        {"type": "tool_use", "id": "t2", "name": "get_weather", "input": {"location": "제주"}},
    ]},
    {"stop_reason": "end_turn", "content": [
        {"type": "text", "text": "서울은 맑음 18도. 제주는 조회에 실패했다."}]},
]

def fake_model(messages, step):
    return scripted[step]

messages = [{"role": "user", "content": "서울이랑 제주 날씨 알려줘"}]
for step in range(5):                      # 무한 루프 방지 상한
    resp = fake_model(messages, step)
    messages.append({"role": "assistant", "content": resp["content"]})
    if resp["stop_reason"] != "tool_use":
        break
    results = []
    for block in resp["content"]:
        if block["type"] != "tool_use":
            continue
        try:
            out = TOOLS[block["name"]](**block["input"])
            results.append({"type": "tool_result", "tool_use_id": block["id"], "content": out})
        except Exception as e:
            results.append({"type": "tool_result", "tool_use_id": block["id"],
                            "content": f"Error: {e}", "is_error": True})
    messages.append({"role": "user", "content": results})   # 결과는 한 메시지에 모음
```

돌려 보니 `messages[2]`가 user 메시지 하나에 `tool_result` 2개(t1 성공, t2는 `is_error: true`)로 들어갔다. 실제 모델이 아니라 짜 둔 응답이라, 모델이 오류를 보고 어떻게 반응하는지는 이 코드로 확인한 게 아니다.

## 흔한 오해

- 모델이 함수를 직접 실행한다: 아니다. 요청서를 쓸 뿐이고 실행은 내 쪽이다. 예외가 server tool이다. `web_search`, `code_execution` 같은 건 Anthropic 서버가 대신 돌려서 결과를 응답에 바로 넣어 준다. 내가 만든 도구는 client tool이라 내가 돌린다.
- 도구를 주면 반드시 쓴다: 기본값 `tool_choice: auto`에서는 매 턴 모델이 부를지 직접 답할지 정한다. 꼭 부르게 하려면 `tool_choice`로 강제한다(OpenAI는 `required`나 특정 함수 지정). 시스템 프롬프트 한 줄로 성향을 조절할 수도 있다고 문서에 나온다.
- 인자가 항상 맞게 온다: `strict`를 안 쓰면 보장이 없다. 문서는 필수 인자가 빠졌을 때 모델이 값을 추측해서 채우는 경우도 있다고 적는다(Sonnet이 특히 그럴 수 있다는 서술). 결과를 받기 전에 내 쪽에서 검증하는 게 안전하다.
- 도구 결과는 믿어도 된다: 도구 결과에는 웹페이지, 이메일, 업로드 파일 같은 바깥 글이 섞일 수 있고, 거기에 모델을 꼬드기는 지시문이 숨어 있을 수 있다(간접 프롬프트 주입). 문서도 이런 내용은 untrusted로 다루라고 경고한다. 자세히 → 프롬프트 주입에서 더 본다.
- 도구가 공짜다: 도구 정의(이름·설명·스키마), `tool_use`, `tool_result`가 전부 입력 토큰이다. 도구를 켜면 모델별 고정 시스템 프롬프트도 붙는다(문서 표에 최신 모델 기준 286토큰 등으로 나옴). 도구가 많거나 결과가 길수록 [자세히 → 컨텍스트](#/post/ai-context)가 빨리 찬다.

## 같이 보면 좋은 것

도구를 매번 내가 직접 정의하는 대신 표준 규격으로 외부 서비스를 꽂는 방식이 [자세히 → MCP](#/post/ai-mcp)다. 도구 호출을 반복해서 돌리는 쪽 코드와 환경은 [자세히 → 하네스](#/post/ai-harness)에서 다룬다. 도구와 지침을 묶어 불러 쓰는 방식은 [자세히 → 스킬](#/post/ai-skills)이 있다.

<details>
<summary>자세한 풀이: tool_choice 정리</summary>

Claude: 기본은 `{"type": "auto"}`로, 모델이 부를지 정한다. 문서의 토큰 표에 "any, tool"이라는 강제 쪽 값이 나오는 것은 확인했다. 각 값의 정확한 동작은 define-tools 페이지에 있는데 이번에 읽지 못했다.

OpenAI(Responses): `"auto"`(0·1·여러 개), `"required"`(1개 이상), `{"type": "function", "name": "..."}`(특정 함수 강제), `"none"`(호출 안 함), `{"type": "allowed_tools", ...}`(일부 도구만 허용).

두 회사 모두 병렬 호출을 끄는 옵션이 따로 있다. Claude는 `tool_choice` 안의 `disable_parallel_tool_use`, OpenAI는 요청 최상위의 `parallel_tool_calls`다. 위치가 다르다.

</details>

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

확인함: Claude 문서(Tool use overview, Handle tool calls, Parallel tool use)의 흐름·필드 이름·`is_error`·결과 메시지 형식 규칙·client/server tool 구분·토큰 과금 설명, OpenAI 함수 호출 가이드의 흐름과 필드·`strict` 조건·`tool_choice` 값, 위 파이썬 코드(직접 실행).

확인 못 함: 실제 Claude·OpenAI API를 호출해서 본 동작(코드는 가짜 응답 사용). `tool_choice`의 `any`·`tool` 세부 동작과 strict tool use 페이지 본문. 병렬 호출을 잘 유도하는 프롬프트 요령(페이지가 길어 일부만 확인). 도구 목록이 아주 많을 때의 선택 정확도 수치.

</details>

## 근거 링크

- Anthropic 문서, Tool use with Claude: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Anthropic 문서, Handle tool calls: https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
- Anthropic 문서, Parallel tool use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
- OpenAI 문서, Function calling: https://developers.openai.com/api/docs/guides/function-calling
- (읽지 못함) Anthropic 문서, Define tools: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools

← [개념 지도로](#/post/ai-map)

관련 글: [에이전트와 에이전트 루프](#/post/ai-agent-loop) · [MCP](#/post/ai-mcp) · [구조화 출력](#/post/ai-structured-output)
