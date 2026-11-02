Tool calling is not a feature where the model directly executes functions. The model only issues structured requests like "please call this tool with this argument," while the actual execution and result delivery are handled by my code (or server).

## What is Tool Calling?

LLMs generate text only. They don't know the weather, can't see my database, and can't open files. Tool use (also called function calling) is a method where we provide the model with a "list of usable functions" in advance to overcome these limitations. When the model sees a question and determines something from the list is needed, it outputs a call request instead of a regular sentence.

Anthropic documents refer to this as "tool use (also called function calling)," using both names interchangeably. This article does the same. The large loop structure of Model → Tool → Back to Model is covered separately in [the detailed guide on agent loops](#/post/ai-agent-loop).

## The One-Lap Flow

Here's the flow based on Claude:

1. Include `tools` in the request. Each tool has a `name`, `description`, and `input_schema` (JSON schema).
2. If the model decides to call a tool, the response's `stop_reason` becomes `tool_use`, and the content includes a `tool_use` block. The block contains `id`, `name`, and `input`.
3. My code executes the function matching the `name` using the provided `input`.
4. I send the result back in a message with `role: user`, wrapping it in a `tool_result` block. At this point, I include the previously received `id` in `tool_use_id` to match which request's answer it is.
5. The model reads the result and either writes a final answer or calls another tool.

```text
나(코드)                          모델
  | -- 질문 + 도구 목록 ---------->|
  |<-- tool_use(id=t1, 이름, 인자) -|   stop_reason: tool_use
  |  (내가 함수 실행)               |
  | -- tool_result(t1, 결과) ----->|
  |<-- 최종 답 (end_turn) ---------|
```

OpenAI follows the same flow, just with different names. We include `tools` in the request, and the response includes a `function_call` item (`call_id`, `name`, and a JSON string for `arguments`). After I execute it, I append `function_call_output` with the same `call_id` and send it back again. Tool definitions use `type: "function"`, `name`, `description`, and `parameters`. Understanding one side lets you read the other.

## Example: Weather Tool

If we provide an example from the documentation, it looks like this:

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

When sending "How's the weather in San Francisco?", the model returns a block like `{"name": "get_weather", "input": {"location": "San Francisco, CA"}}` instead of a sentence. After I call the weather API and send the result string as `tool_result`, the model summarizes it in human language, such as "15 degrees with some clouds."

Here, the `description` is more important than expected. The model decides whether to call a tool and what arguments to use based solely on this description and schema. The documentation also recommends writing more detailed descriptions if calling seems problematic.

## Parallel Calling

A single response can include multiple `tool_use` blocks. If you ask for "weather in Seoul and Jeju," two tool calls come at once. According to the docs, the execution order is not determined by the API; you can run them simultaneously or sequentially. Independent read-only tasks are faster when run in parallel, while tools with side effects or dependencies should be run in order.

There are two rules for sending results: gather all results into one user message, and within that message, `tool_result` must come before text. Placing text first causes a 400 error, as noted in the docs. Additionally, `tool_result` messages must immediately follow `tool_use` messages; no other messages can be inserted between them.

To disable parallel calls, Claude uses `disable_parallel_tool_use: true` in `tool_choice`, while OpenAI uses `parallel_tool_calls: false`. The OpenAI side notes it's limited to "0 or 1" calls.

## Error Handling

Tools failing is common. The documentation's approach is simple: even on failure, always return a `tool_result`, including the error content in `content` along with `is_error: true`. This allows the model to reflect that error by explaining it to the user or retrying.

- The error message is specifically better as "Rate limit exceeded. Retry after 60 seconds." rather than just "failed," as the documentation uses this example to indicate what went wrong and what you can do next.
- Missing required arguments in a call: If you are still in development, the first step is to enhance the tool description; if errors persist, return an error `tool_result` so the model can retry filling it in. The documentation notes that after 2–3 attempts to fix and retry, you should apologize to the user.
- To prevent incorrect calls entirely, use `strict: true`. This ensures only calls matching the schema exactly are generated. OpenAI also has a `strict` option and requires all fields to be marked as `required` along with `additionalProperties: false`. This is similar in context to [Structured Output](#/post/ai-structured-output).

## What I Tested Directly

The code below uses fake responses pre-written for the model instead of calling the actual API. It does not invoke the API but only observes how the flow (two parallel calls, one failing) accumulates as messages. I verified this by running it directly.

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

Upon execution, `messages[2]` contained a single user message with two `tool_result`s: t1 succeeded, and t2 had `is_error: true`. Since these were not actual model responses but pre-written fakes, this code does not show how the model reacts to errors.

## Common Misconceptions

- The model executes functions directly: No. It only writes requests; execution is handled on my side. The exception is server tools. Tools like `web_search` and `code_execution` are run by the Anthropic server, which inserts results directly into the response. Tools I create are client tools and are executed by me.
- Providing a tool means it must be used: With the default `tool_choice: auto`, the model decides each turn whether to call a tool or respond directly. To force usage, you must set `tool_choice` accordingly (OpenAI uses `required` or specifies particular functions). The documentation also mentions that system prompts can adjust this behavior with a single line.
- Arguments are always correct: Without using `strict`, there is no guarantee. The documentation notes that models may guess and fill in missing required arguments (particularly noted for Sonnet). It is safer to validate on my side before receiving results.
- Tool results are trustworthy: Tool results can contain external content like web pages, emails, or uploaded files, which may include hidden instructions prompting the model (indirect prompt injection). The documentation warns to treat such content as untrusted. See [Prompt Injection](#/post/sec-prompt-injection) for more details.
- Tools are free: Tool definitions (name, description, schema), `tool_use`, and `tool_result` all count as input tokens. Enabling tools also adds a fixed system prompt per model (the documentation table lists ~286 tokens for the latest models). More tools or longer results fill up the [context](#/post/ai-context) faster.

## Related Reading

Instead of defining tools manually every time, you can plug in external services using standard specifications via [MCP](#/post/ai-mcp). Code and environments that repeatedly execute tool calls are covered in [Harness](#/post/ai-harness). Methods for bundling tools and instructions are discussed in [Skills](#/post/ai-skills).

<details>
<summary>Detailed explanation: tool_choice summary</summary>

Claude: The default is `{"type": "auto"}`, letting the model decide whether to call a tool. I confirmed that the token table in the documentation includes forced values like "any, tool".

OpenAI (Responses): `"auto"` (0–1 or multiple), `"required"` (1 or more), `{"type": "function", "name": "..."}` (force specific function), `"none"` (no call), `{"type": "allowed_tools", ...}` (allow only some tools).

Both companies have options to disable parallel calls. Claude uses `disable_parallel_tool_use` within `tool_choice`, while OpenAI uses `parallel_tool_calls` at the request top level. Their locations differ.

</details>

## Reference Links

- Anthropic documentation, Tool use with Claude: https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Anthropic documentation, Handle tool calls: https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
- Anthropic documentation, Parallel tool use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
- OpenAI documentation, Function calling: https://developers.openai.com/api/docs/guides/function-calling
- Anthropic documentation, Define tools: https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools

← [Concept map](#/post/ai-map)

Related posts: [Agents and Agent Loops](#/post/ai-agent-loop) · [MCP](#/post/ai-mcp) · [Structured Output](#/post/ai-structured-output)