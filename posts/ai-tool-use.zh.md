工具调用并非模型直接执行函数的功能。模型仅发出“请调用此工具并传入该参数”的结构化请求，而实际的执行与结果返回则由我的代码（或服务器）完成。

## 什么是工具调用

LLM 只能生成文本。它不知道天气，无法查看我的数据库，也无法打开文件。工具调用（tool use, function calling）是一种通过预先向模型提供“可使用的函数列表”来突破这一限制的方法。当模型看到问题后，判断列表中有所需功能时，便会发出调用请求，而非生成普通语句。

Anthropic 文档将两者统称为 "tool use (also called function calling)"，本文也沿用此说法。模型 → 工具 → 再回模型的这一大循环结构，将在 [详细解析 → 智能体循环](#/post/ai-agent-loop) 中单独讨论。

## 一轮流程概览

以 Claude 为例，流程如下：

1. 在请求中包含 `tools`。每个工具包含 `name`、`description` 和 `input_schema`（JSON Schema）。
2. 若模型决定调用工具，则响应中的 `stop_reason` 为 `tool_use`，且 content 内包含 `tool_use` 块。该块包含 `id`、`name` 和 `input`。
3. 我的代码根据 `name` 执行对应的函数，并将 `input` 作为参数传入。
4. 将结果封装为 `role: user` 消息中的 `tool_result` 块并再次发送。此时需在 `tool_use_id` 中填入之前收到的 `id`，以便模型匹配这是对哪个请求的响应。
5. 模型读取结果后生成最终回答，或调用其他工具。

```text
나(코드)                          모델
  | -- 질문 + 도구 목록 ---------->|
  |<-- tool_use(id=t1, 이름, 인자) -|   stop_reason: tool_use
  |  (내가 함수 실행)               |
  | -- tool_result(t1, 결과) ----->|
  |<-- 최종 답 (end_turn) ---------|
```

OpenAI 的流程与此相同，仅名称不同。在请求中包含 `tools`，响应中会出现 `function_call` 项（含 `call_id`、`name` 和 JSON 字符串形式的 `arguments`），我执行后以相同的 `call_id` 附加 `function_call_output` 并再次发送。工具定义包含 `type: "function"`、`name`、`description` 和 `parameters`。理解其中一方即可读懂另一方。

## 示例：天气工具

若提供文档中的示例，则呈现如下形态：

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

发送“旧金山天气如何？”时，模型会返回类似 `{"name": "get_weather", "input": {"location": "San Francisco, CA"}}` 的块，而非普通语句。我调用天气 API 并将结果字符串作为 `tool_result` 返回后，模型便会将其整理为“15 度，少许多云”这样的人话表达。

此处 `description` 的重要性远超预期。模型是否调用工具、应传入何种参数，完全依据此描述与 schema 判断。文档也建议：若调用行为异常，请更详细地编写说明。

## 并行调用

单次响应中可包含多个 `tool_use` 块。例如发送“首尔和济州岛天气”，会同时收到两个工具调用请求。根据文档，执行顺序不由 API 决定；既可并发执行，也可按序执行。仅读写的独立任务适合并发以提升速度，而存在副作用或需特定顺序的工具则应按序执行。

执行时需遵守两条规则：  
- 将所有结果汇总到一个 user 消息中返回；  
- 在该消息内，`tool_result` 必须出现在文本之前。若将文本置于前方，文档指出会引发 400 错误。此外，`tool_result` 消息必须紧跟在 `tool_use` 消息之后，中间不得插入其他消息。

若希望禁用并行调用，Claude 可在 `tool_choice` 中设置 `disable_parallel_tool_use: true`，OpenAI 则使用 `parallel_tool_calls: false`。OpenAI 文档注明其限制为“0 个或 1 个”。

## 错误处理

工具执行失败的情况十分常见。文档提出的处理方法很简单：即使失败，也必须返回 `tool_result`，并在其中包含 `is_error: true` 以及错误详情（置于 `content` 中）。如此，模型便可据此向用户说明错误或尝试重试。

- 错误消息应更具体：文档举例说明，"Rate limit exceeded. Retry after 60 seconds."比单纯的 "failed"更好。其含义是告知问题所在以及接下来可以尝试的操作。
- 缺少必需参数的调用：如果在开发阶段，首先应完善工具描述；如果仍然报错，则返回 `tool_result` 错误信息，让模型重新填充并再次调用。文档指出，经过 2~3 次修正尝试后，再向用户道歉。
- 若要完全阻止错误的调用，可使用 `strict: true`，确保只生成严格符合模式的调用。OpenAI 也提供了 `strict` 选项，要求将所有字段设为 `required` 并设置 `additionalProperties: false`。这与 [结构化输出 →](#/post/ai-structured-output) 的语境类似。

## 实际运行结果

以下是将模型响应替换为预置假数据的代码。该 API 并未真正调用，仅观察上述流程（两个并行调用，其中一个失败）在消息格式中如何累积。已通过直接执行进行验证。

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

运行后发现 `messages[2]` 包含一条用户消息和两个 `tool_result`（t1 成功，t2 为 `is_error: true`）。由于并非真实模型响应而是预设数据，因此无法通过此代码确认模型对错误的实际反应方式。

## 常见误解

- 模型会直接执行函数：并非如此。模型仅生成请求，执行由我方完成。例外情况是 server tool。像 `web_search`、`code_execution` 等工具由 Anthropic 服务器代为执行，并将结果直接放入响应中。而我方创建的工具属于 client tool，需由我方执行。
- 提供工具就必须使用：在默认值 `tool_choice: auto` 下，每轮由模型自行决定是否调用或回答。若强制要求调用，则需通过 `tool_choice` 进行设置（OpenAI 支持 `required` 或指定特定函数）。文档还提到可通过系统提示中的一行来调整模型倾向。
- 参数总是正确传入：若不使用 `strict`，则无法保证。文档指出，当缺少必需参数时，模型可能会尝试推测并填充值（Sonnet 尤其可能出现这种情况）。因此，在接收结果前由我方进行验证更为安全。
- 可信任工具返回的结果：工具结果中可能混入网页、电子邮件、上传文件等外部内容，其中可能隐藏诱导模型的指令（间接提示注入）。文档也对此类内容发出警告，建议按 untrusted 处理。更多信息请参见 [提示注入 →](#/post/sec-prompt-injection)。
- 工具是免费的：工具定义（名称、描述、模式）、`tool_use`、`tool_result` 均计入输入 token。启用工具时还会附加针对各模型的固定系统提示（文档表格显示最新模型约为 286 tokens）。工具数量多或结果长时，[上下文 →](#/post/ai-context) 会更快填满。

## 推荐阅读

与其每次手动定义工具，不如采用 [MCP →](#/post/ai-mcp) 的标准规范方式集成外部服务。关于重复调用工具的代码与环境配置，详见 [Harness →](#/post/ai-harness)。将工具与指令打包调用的方式可参考 [Skills →](#/post/ai-skills)。

<details>
<summary>详细解析：tool_choice 总结</summary>

Claude：默认为 `{"type": "auto"}`，由模型决定是否调用。文档中的 token 表中确实出现了 "any, tool" 等强制选项。

OpenAI(Responses)：支持 `"auto"`（0/1/多个）、`"required"`（至少 1 个）、`{"type": "function", "name": "..."}`（强制特定函数）、`"none"`（不调用）、`{"type": "allowed_tools", ...}`（仅允许部分工具）。

两家公司均提供禁用并行调用的选项。Claude 在 `tool_choice` 内设置 `disable_parallel_tool_use`，而 OpenAI 则在请求顶层设置 `parallel_tool_calls`。两者位置不同。

</details>

## 参考资料

- Anthropic 文档，Claude 的工具使用：https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- Anthropic 文档，处理工具调用：https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
- Anthropic 文档，并行工具使用：https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use
- OpenAI 文档，函数调用：https://developers.openai.com/api/docs/guides/function-calling
- Anthropic 文档，定义工具：https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools

← [概念图](#/post/ai-map)

相关文章：[智能体与智能体循环](#/post/ai-agent-loop) · [MCP](#/post/ai-mcp) · [结构化输出](#/post/ai-structured-output)