结构化输出是一种让模型按照预设的形状（Schema）生成回答的功能，而“请求”与“强制”之间的可信程度存在显著差异。

## 为什么需要它

LLM 本质上是在撰写文本。对于人类阅读来说这完全没问题，但一旦交给程序处理就会出问题。假设我们要从一封邮件中提取姓名和是否请求演示的代码，如果模型这样回答就麻烦了：

```
네, 분석해 봤습니다! 이름은 김OO이고 데모를 요청했네요.
```

代码期望的是 `{"name": "김OO", "demo_requested": true}` 这种固定格式。如果前面多了一段问候语、键名变成了 `demo`，或者在 `true` 的位置填入了 `"네"`，解析就会失败。结构化输出正是为了解决这个问题而设计的。这属于让机器能够直接读取模型回答的范畴，因此理解 LLM 是基于概率生成文本这一特性会更容易明白其中的原理。

## 分为三个阶段来看

越往下阶段越强。

| 阶段 | 方法 | 保证程度 |
|---|---|---|
| 1. 请求 | 在提示词中写道“只回答 JSON，键名为 name, demo_requested" | 无。大部分情况会遵守，但偶尔也会违背 |
| 2. JSON 模式 | 通过 API 选项指定“生成有效 JSON" | JSON 语法正确，但不保证键名和类型 |
| 3. Schema 强制 | 同时发送 JSON Schema，仅允许生成符合该形状的响应 | 语法和 Schema 均符合要求（例外情况见下文） |

OpenAI 文档将 JSON 模式与结构化输出（Structured Outputs）区分开来。两者都能生成有效的 JSON，但只有结构化输出能遵守 Schema，因此建议尽可能使用结构化输出。第一阶段属于提示词工程问题，API 本身无法提供解决方案。

## 如何强制 Schema

Schema 采用名为 JSON Schema 的标准格式编写。它是一份设计图，规定了有哪些键、每个值是字符串还是布尔值、哪些键是必需的等。Anthropic 文档中的示例大致如下：

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

根据 Anthropic 文档，内部使用了受限解码（constrained decoding）技术。其原理是将 Schema 编译为语法，在逐个生成 token 时，仅从该语法允许的 token 中进行选择。即使模型试图生成“네,"之类的 token，在该位置也会被排除在候选项之外。因此，不是在回答结束后进行修正，而是在生成过程中阻断错误路径。理解 [采样](#/post/ai-sampling) 是选择下一个 token 的阶段，就能明白其中的机制了。

文档中也提到了成本问题。首次使用的 Schema 会因编译产生轻微延迟；编译后的语法会在最后一次使用后缓存 24 小时（以 Anthropic 文档为准）。OpenAI 文档也指出，新 Schema 的首次请求会有额外延迟。此外，Anthropic 提到系统提示词中附带了格式说明，导致输入 token 增加；若更改 `output_config.format`，则该对话的提示词缓存将失效。

## 与工具调用的关系

这部分容易让人混淆。结构化 JSON 的输出路径有两条：

- **响应本身结构化**：返回给用户的最终回答需遵守 Schema。Anthropic 使用 `output_config.format`，OpenAI 则在 `text.format` 中指定 `json_schema`。
- **工具调用参数结构化**：模型调用函数时传递的参数需遵循工具的 Schema。Anthropic 在工具定义中添加 `strict: true`。

OpenAI 文档的区分较为清晰：若模型需要调用其工具、函数或数据，则使用函数调用；若想设定返回给用户的响应格式，则使用 `text.format`。关于工具调用本身，已在 [工具调用](#/post/ai-tool-use) 文章中单独整理，此处仅概括为“工具参数终究也是 JSON，因此采用相同的 Schema 技术”。Anthropic 文档指出两者也可同时使用。这样既保证工具调用符合 Schema，也保证最终响应符合 Schema。

[MCP](#/post/ai-mcp) 工具定义中也包含输入 Schema，我认为这属于同一体系下的内容。

## 代码中的用法

根据 Anthropic 文档，Python SDK 在传递 Pydantic 模型后，会通过 `client.messages.parse(output_format=...)` 返回解析后的对象。TypeScript 则使用 Zod Schema 并用 `zodOutputFormat` 包裹。这种方式避免了手动编写 JSON Schema，而是从平时使用的类型定义中提取 Schema。我尚未亲自运行过该 SDK 调用。

<details>
<summary>详细解析：Schema 无法实现的内容（以 Anthropic 文档为准）</summary>

并非所有 Schema 语法都能被支持，本文档总结了已知的限制。

- **支持**：基本类型、`enum`、`const`、`anyOf`、内部 `$ref`、`required`、以及部分字符串格式（如 `date-time`、`email`、`uuid` 等）。对象必须包含 `additionalProperties: false`。
- **不支持**：递归 Schema、外部 `$ref`、数字范围（`minimum`、`maximum`）、字符串长度（`minLength`、`maxLength`），以及 `minItems` 仅允许为 0 或 1。
- 使用不支持的功能会导致 400 错误。SDK 助手通过将部分约束移至说明文档，并在本地重新验证响应来规避这些问题。
- **复杂度限制**：在单次请求中，strict 模式工具上限为 20 个，可选参数上限为 24 个，联合类型（Union types）参数上限为 16 个。超出此限制可能会引发 "Schema is too complex" 错误。

OpenAI 文档中的示例均将 `additionalProperties: false` 应用于所有属性，并将其设为 `required`。

因此，无法通过 Schema 限制值范围的情况时有发生（例如“年龄必须在 0~120 之间”）。这仅表示格式正确，但数值可能异常。值的语义最终仍需由代码再次校验。

</details>

## 仍然会失败的情况

即使强制要求也不总是能成功。以下两种情况会导致问题：

- **拒绝（refusal）**：如果模型因安全原因拒绝回答，输出可能不符合 Schema。Anthropic 在此情况下返回 HTTP 200，但 `stop_reason` 为 `"refusal"`，且 Token 会被计费。OpenAI 则在响应中包含单独的 `refusal` 字段，建议在解析前进行检查。
- **Token 限制**：如果回答在 `max_tokens` 处被截断，JSON 会在中间断裂。Anthropic 会返回 `stop_reason: "max_tokens"`，而 OpenAI 则通过 `status: "incomplete"` 和 `max_output_tokens` 原因进行提示。解决方法是增加限制后重新请求。
- **enum 大小写**：根据 Anthropic 文档，enum 值可能仅因大小写不同而产生差异。比较时应忽略大小写。
- **看似正确实则错误**：格式正确并不代表内容正确。模型可能会填充看似合理但不存在的值，这属于 [幻觉](#/post/ai-hallucination) 类问题。

因此，实际上应理解为“Schema 强制 + 代码验证 + 失败则重试”的三层机制。

## 尝试自行处理失败情况

在无法使用 Schema 强制的环境（如旧版模型、本地模型等）中，必须自行实现验证与重试逻辑。以下代码仅使用标准库，是最小化示例；其中模型调用部分用假函数代替以进行演示。第一次回答附带了问候语导致 JSON 解析失败，第二次回答类型错误，第三次回答才通过验证。

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

执行结果为 `{'name': '김', 'demo_requested': True}`（已使用 Python 直接运行验证，模型调用为模拟）。在实际服务中，由于每次重试都会产生费用，建议将重试次数限制在 2~3 次为宜。这也与 [节省 Token 的方法](#/post/claude-tokens) 相关。

## 常见误解

- **JSON 模式即遵守 Schema**：并非如此。OpenAI 文档明确指出，JSON 模式仅保证语法正确。缺少键值仍构成有效的 JSON。
- **Schema 强制即内容可信**：Schema 仅保证格式，值的真实性需另行核查。
- **强制总能成功**：拒绝和 Token 超限属于例外情况。上述两篇文档均已提及这些例外。
- **Schema 越详细越好**：存在复杂度限制，且会增加编译延迟。Anthropic 文档建议仅在必要时启用 strict 模式。
- **所有模型都支持**：并非如此。OpenAI 指出旧版模型可能需要 JSON 模式；Anthropic 则单独列出了支持的模型列表。由于模型列表频繁变动，使用时需重新查阅文档。

## 参考链接

- Anthropic 文档，结构化输出：https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- OpenAI 文档，结构化输出：https://developers.openai.com/api/docs/guides/structured-outputs

← 概念图 (#/post/ai-map)

相关文章：[工具调用](#/post/ai-tool-use) · [提示词](#/post/ai-prompt) · [幻觉](#/post/ai-hallucination)