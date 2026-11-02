ツール呼び出しは、モデルが関数を直接実行する機能ではありません。モデルは「このツールをこの引数で呼び出してください」という構造化されたリクエストのみを送信し、実際の実行と結果の返却は私のコード（またはサーバー）が行います。

## ツール呼び出しとは何か

LLM はテキストのみを作成します。天気を知っておらず、私のデータベースも見えず、ファイルも開けません。ツール呼び出し（tool use, function calling）はこの限界を越えるために、「使える関数のリスト」をモデルに事前に伝える方式です。モデルが質問を見てリストの中に必要なものがあると判断すると、通常の文章の代わりに呼び出しリクエストを出力します。

Anthropic のドキュメントでは「tool use (also called function calling)」と 2 つの名前を同じものとして扱っています。この記事でも同様に扱います。モデル → ツール → またはモデルという大きなループ構造については、[詳細 → エージェントループ](#/post/ai-agent-loop) で別途取り上げています。

## 1 周のフロー

Claude を基準に整理すると以下のようになります。

1. リクエストに `tools` を含めます。各ツールには `name`, `description`, `input_schema`(JSON スキーマ) があります。
2. モデルが呼び出しを決定すると、レスポンスの `stop_reason` が `tool_use` になり、content 内に `tool_use` ブロックが含まれます。ブロックには `id`, `name`, `input` があります。
3. 私のコードは `name` に一致する関数を `input` で実行します。
4. 結果を `role: user` メッセージ内の `tool_result` ブロックに 담아再送信します。この際、`tool_use_id` に先ほど受け取った `id` を記入して、どのリクエストへの回答かを一致させます。
5. モデルが結果を読み取り最終的な答えを作成するか、別のツールを呼び出します。

```text
나(코드)                          모델
  | -- 질문 + 도구 목록 ---------->|
  |<-- tool_use(id=t1, 이름, 인자) -|   stop_reason: tool_use
  |  (내가 함수 실행)               |
  | -- tool_result(t1, 결과) ----->|
  |<-- 최종 답 (end_turn) ---------|
```

OpenAI の場合もフローは同じです。名称だけが異なります。リクエストに `tools` を含め、レスポンスには `function_call` アイテムが返ってきます（`call_id`, `name`, JSON 文字列である `arguments`）。私が実行した後、同じ `call_id` で `function_call_output` を付けて再送信します。ツールの定義は `type: "function"`, `name`, `description`, `parameters` です。片方を理解すればもう片方も読み取れます。

## 例：天気ツール

ドキュメントの例を挙げると以下のようになります。

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

「サンフランシスコの天気はどうですか？」と送ると、モデルは文章の代わりに `{"name": "get_weather", "input": {"location": "San Francisco, CA"}}` のようなブロックを返します。私が天気 API を呼び出して結果文字列を `tool_result` で送信すると、モデルが「15 度で少し曇り」のように人間言葉で要約します。

ここで `description` が予想以上に重要です。モデルがツールを呼ぶかどうか、どのような引数を投入すべきかは、この説明とスキーマのみを見て決定します。ドキュメントも呼び出しが不自然な場合は説明をより詳細に書くよう推奨しています。

## 並列呼び出し

1 つのレスポンスに複数の `tool_use` ブロックが含まれることがあります。「ソウルと済州の天気」のように指示すると、2 つのツール呼び出しが一度にやってきます。ドキュメントによると実行順序は API が決定しません。同時に実行しても構わず、順番に実行しても構いません。読み取りだけの独立したタスクは同時実行の方が速く、副作用があるか順序が必要なツールは順次実行する方が良いでしょう。

実行時のルールは 2 つあります。結果は 1 つの user メッセージにまとめて送信します。そしてそのメッセージ内では `tool_result` が先に来て、テキストが後に来なければなりません。テキストを先にすると 400 エラーが発生するということがドキュメントにあります。また、tool_result メッセージは tool_use メッセージの直後に来なければならず、間に他のメッセージを挟むことはできません。

並列呼び出しを止めるには、Claude では `tool_choice` に `disable_parallel_tool_use: true` を設定し、OpenAI では `parallel_tool_calls: false` を使用します。OpenAI 側は「0 つまたは 1 つ」と制限されていると記載されています。

## エラー処理

ツールが失敗するケースは頻繁です。ドキュメントが述べる方法は単純です。失敗しても `tool_result` は必ず返す必要があり、`is_error: true` とともにエラー内容を `content` に含めます。そうするとモデルはそのエラーを反映させてユーザーに説明するか、再試行します。

- 오류 메시지는 구체적으로 "failed"보다 "Rate limit exceeded. Retry after 60 seconds."를 예시로 들며, 이는 무엇을 잘못했고 다음에 무엇을 시도해야 하는지 알려주어야 함을 의미합니다.
- 필수 인자가 누락된 호출: 개발 중이라면 도구 설명을 보강하는 것이 우선이며, 그래도 오류가 발생하면 `tool_result`를 반환하여 모델이 다시 값을 채우고 호출하도록 합니다. 문서는 2~3 번 수정과 시도 후 사용자에게 사과한다고 명시합니다.
- 아예 잘못된 호출을 막고 싶다면 `strict: true`를 사용합니다. 이는 스키마에 정확히 맞는 호출만 나오도록 합니다. OpenAI 도 `strict` 옵션이 있으며, 모든 필드를 `required`로 설정하고 `additionalProperties: false`를 요구합니다. [자세히 → 구조화된 출력](#/post/ai-structured-output)과 같은 맥락입니다.

## 직접 실행해 본 것

아래는 모델 응답을 미리 준비한 가짜 데이터로 변경한 코드입니다. API 를 호출하지 않고, 위 흐름 (병렬 호출 2 개 중 하나는 실패) 이 메시지 형태로 어떻게 쌓이는지만 확인합니다. 직접 실행하여 검증했습니다.

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

실행 결과 `messages[2]`는 하나의 user 메시지에 `tool_result` 2 개 (t1 성공, t2 는 `is_error: true`) 가 들어가는 것으로 나타났습니다. 실제 모델이 아닌 미리 준비한 응답이므로, 모델이 오류를 보고 어떻게 반응하는지는 이 코드로 확인한 것이 아닙니다.

## 흔한 오해

- 모델이 함수를 직접 실행한다: 그렇지 않습니다. 요청서를 작성할 뿐이며, 실행은我方 (내부) 에서 수행합니다. 예외는 server tool 입니다. `web_search`, `code_execution` 등은 Anthropic 서버가 대신 실행하여 결과를 응답에 바로 포함시킵니다. 제가 만든 도구는 client tool 이므로 제가 실행합니다.
- 도구를 주면 반드시 사용한다: 기본값 `tool_choice: auto`에서는 매 턴마다 모델이 호출할지 직접 답할지 결정합니다. 반드시 호출하게 하려면 `tool_choice` 로 강제해야 합니다 (OpenAI 는 `required` 나 특정 함수 지정). 시스템 프롬프트 한 줄로 성향을 조절할 수도 있다고 문서에 나와 있습니다.
- 인자가 항상 올바르게 온다: `strict` 를 사용하지 않으면 보장이 없습니다. 문서는 필수 인자가 누락되었을 때 모델이 값을 추측하여 채우는 경우도 있다고 명시합니다 (Sonnet 이 특히 그럴 수 있다는 서술). 결과를 받기 전에我方에서 검증하는 것이 안전합니다.
- 도구 결과는 믿어도 된다: 도구 결과에는 웹페이지, 이메일, 업로드 파일 같은 외부 콘텐츠가 섞일 수 있으며, 여기에 모델을 유인하는 지시문이 숨어 있을 수 있습니다 (간접 프롬프트 주입). 문서도 이러한 내용은 untrusted 로 취급하라고 경고합니다. [자세히 → 프롬프트 주입](#/post/sec-prompt-injection) 에서 더 확인하세요.
- 도구는 무료다: 도구 정의 (이름, 설명, 스키마), `tool_use`, `tool_result` 가 모두 입력 토큰입니다. 도구를 활성화하면 모델별 고정 시스템 프롬프트도 추가됩니다 (문서 표에 최신 모델 기준 286 토큰 등으로 나옴). 도구가 많거나 결과가 길수록 [자세히 → 컨텍스트](#/post/ai-context) 가 빨리 차버립니다.

## 같이 보면 좋은 것

도구를 매번 직접 정의하는 대신 표준 규격으로 외부 서비스를 연결하는 방식은 [자세히 → MCP](#/post/ai-mcp) 입니다. 도구 호출을 반복하여 실행하는 코드와 환경은 [자세히 → 하네스](#/post/ai-harness) 에서 다룹니다. 도구와 지침을 묶어 불러오는 방식은 [자세히 → 스킬](#/post/ai-skills) 이 있습니다.

<details>
<summary>자세한 풀이: tool_choice 정리</summary>

Claude: 기본값은 `{"type": "auto"}`로, 모델이 호출할지 결정합니다. 문서의 토큰 표에 "any", "tool"이라는 강제 옵션 값이 있다는 것을 확인했습니다.

OpenAI(Responses): `"auto"` (0 개, 1 개, 여러 개), `"required"` (1 개 이상), `{"type": "function", "name": "..."}` (특정 함수 강제), `"none"` (호출 안 함), `{"type": "allowed_tools", ...}` (일부 도구만 허용).

두 회사 모두 병렬 호출을 끄는 옵션이 따로 있습니다. Claude 는 `tool_choice` 내의 `disable_parallel_tool_use`, OpenAI 는 요청 최상위의 `parallel_tool_calls` 입니다. 위치가 다릅니다.

</details>

## 근거 링크

- Anthropic 文書、Tool use with Claude: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Anthropic 文書、Handle tool calls: https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
- Anthropic 文書、Parallel tool use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
- OpenAI 文書、Function calling: https://developers.openai.com/api/docs/guides/function-calling
- Anthropic 文書、Define tools: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools

← [概念マップへ](#/post/ai-map)

関連記事：[エージェントとエージェントループ](#/post/ai-agent-loop) · [MCP](#/post/ai-mcp) · [構造化出力](#/post/ai-structured-output)