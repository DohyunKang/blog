Structured Outputs is a feature that forces the model's response to conform to a predefined shape (schema). The reliability differs between asking and forcing.

## Why is it needed?

LLMs are fundamentally designed to write text. This works fine for humans, but becomes problematic when programs need to parse the output. Imagine writing code to extract a name and whether a demo was requested from an email. If the model responds like this, it's problematic:

```
네, 분석해 봤습니다! 이름은 김OO이고 데모를 요청했네요.
```

The code expects a specific shape like `{"name": "Kim OO", "demo_requested": true}`. If a greeting is added at the beginning, the key name changes to `demo`, or `"네"` (yes) appears instead of `true`, parsing breaks. Structured Outputs is a feature designed to mitigate this. It's about making the model's response directly readable by machines, so understanding that LLMs [continue writing text based on probability](#/post/ai-llm) makes it easier to grasp.

## Breaking it down into three steps

The methods become stronger as you go down the list.

| Step | Method | Guarantee |
|---|---|---|
| 1. Ask | Write in the prompt "Answer only in JSON, with keys name and demo_requested" | None. Mostly followed but occasionally ignored |
| 2. JSON Mode | Specify via API option to output valid JSON | JSON syntax is correct, but keys and types are not guaranteed |
| 3. Schema Enforcement | Send a JSON Schema together to enforce the shape | Syntax and schema are both correct (exceptions below) |

OpenAI documentation distinguishes between JSON Mode and Structured Outputs this way. Both produce valid JSON, but only Structured Outputs adheres to the schema; they recommend using Structured Outputs whenever possible. Step 1 is a matter of using [prompts](#/post/ai-prompt) well, so the API doesn't help there.

## How to enforce the schema

Schemas are written in the JSON Schema standard format. It's a blueprint specifying which keys exist, whether each value is a string or boolean, and which keys are required. An example from Anthropic documentation looks roughly like this:

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

According to Anthropic documentation, constrained decoding is used internally. The schema is compiled into grammar rules, and when tokens are generated one by one, only tokens allowed by that grammar are selected. Even if the model tries to generate a token like "네," (yes), it is excluded from candidates at that position. Thus, errors are prevented during generation rather than corrected after completion. This makes sense if you understand that [sampling](#/post/ai-sampling) is the stage where the next token is selected.

The documentation also mentions costs. Using a new schema incurs some latency due to compilation, and compiled schemas are cached for 24 hours after last use (per Anthropic documentation). OpenAI documentation also notes additional latency on the first request with a new schema. Additionally, Anthropic states that a separate system prompt explaining the format increases input tokens, and changing `output_config.format` invalidates the conversation's prompt cache.

## Relationship with Tool Calls

This was a confusing part. There are two paths for structured JSON output:

- Structuring the response itself: The final answer returned to the user adheres to the schema. Anthropic uses `output_config.format`, while OpenAI uses `text.format` with `json_schema`.
- Structuring tool call arguments: When the model invokes a function, the arguments passed adhere to the tool's schema. Anthropic attaches `strict: true` to tool definitions.

OpenAI documentation makes this distinction clear. If the model needs to call your tools, functions, or data, use function calling; if you want to define the shape of the response going to the user, use `text.format`. Tool calling itself was covered separately in the [tool use](#/post/ai-tool-use) article, and here it's treated as "tool arguments are ultimately JSON, so the same schema techniques apply." Anthropic documentation says both can be used together. In that case, tool calls also match the schema, and the final response matches the schema.

[MCP](#/post/ai-mcp) tool definitions also include input schemas, which I interpret as part of the same lineage.

## How to use it in code

According to Anthropic documentation, the Python SDK returns a parsed object via `client.messages.parse(output_format=...)` when passing a Pydantic model. TypeScript wraps Zod schemas with `zodOutputFormat`. Instead of writing JSON Schema by hand, this extracts the schema from your usual type definitions. I haven't directly executed these SDK calls myself.

<details>
<summary>Detailed explanation: What can't be done with schemas (per Anthropic documentation)</summary>

Schema syntax cannot be fully enforced; the limitations listed below are derived from documentation.

- **Supported**: Basic types, `enum`, `const`, `anyOf`, internal `$ref`, `required`, and certain string formats (`date-time`, `email`, `uuid`, etc.). Objects must include `additionalProperties: false`.
- **Unsupported**: Recursive schemas, external `$ref`, numeric ranges (`minimum`, `maximum`), string lengths (`minLength`, `maxLength`), and `minItems` (only 0 or 1 are allowed).
- Using unsupported features results in a 400 error. The SDK helper works around this by moving some constraints into the documentation and re-validating responses locally.
- **Complexity limits**: A single request supports up to 20 strict tools, 24 optional parameters, and 16 union type parameters. Exceeding these may trigger a "Schema is too complex" error.

OpenAI documentation examples typically set `additionalProperties: false` and mark all properties as `required`.

Consequently, cases arise where schema constraints cannot enforce value ranges (e.g., "age between 0 and 120"). While the shape may be correct, the values might still be invalid; semantic correctness ultimately requires additional code-level validation.

</details>

## Cases Where Enforcement Still Fails

Enforcement is not guaranteed to succeed even when forced. The following scenarios illustrate common failure modes:

- **Refusal**: If the model refuses to answer for safety reasons, the output may not conform to the schema. Anthropic returns HTTP 200 with `stop_reason: "refusal"` and charges tokens for such responses. OpenAI includes a separate `refusal` field in the response, so you should check for it before parsing.
- **Token limits**: If the response is truncated at `max_tokens`, the JSON may be cut off mid-stream. Anthropic indicates this with `stop_reason: "max_tokens"`, while OpenAI provides `status: "incomplete"` and `max_output_tokens`. The solution is to increase the limit and retry.
- **Enum case sensitivity**: According to Anthropic documentation, enum values may differ only in case (e.g., `Value` vs. `value`). You must ignore case when comparing them.
- **Plausible but incorrect values**: A valid shape does not guarantee correct content. The model can fabricate plausible-looking values for non-existent entities, which is a form of [hallucination](#/post/ai-hallucination).

Therefore, in practice, the approach should be understood as a three-layer strategy: "Schema enforcement + code validation + retry on failure."

## Implementing Your Own Failure Handling

In environments where schema enforcement is unavailable (e.g., older models or local models), you must implement your own validation and retry logic. The code below uses only standard libraries; the model call is replaced with a dummy function for demonstration. The first response included a greeting that broke the JSON, the second had an incorrect type, and the third passed validation.

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

The execution result was `{'name': '김', 'demo_requested': True}` (verified by running directly in Python; model calls were simulated). In production services, retries incur costs, so limiting attempts to 2–3 is advisable. This also ties into [token-saving techniques](#/post/claude-tokens).

## Common Misconceptions

- **JSON mode ensures schema compliance**: No. As OpenAI documentation clarifies, JSON mode guarantees syntax only; missing keys still produce valid JSON.
- **Schema enforcement implies content correctness**: It guarantees shape, not truthfulness. You must independently verify factual accuracy.
- **Enforcement always succeeds**: Refusals and token limit exceedances are exceptions. Both Anthropic and OpenAI documents explicitly mention these cases.
- **More verbose schemas are better**: There are complexity limits and compilation delays. Anthropic recommends using `strict` only for essential tools.
- **All models support this**: No. OpenAI notes that older models may require JSON mode, while Anthropic maintains a separate list of supported models. Since model lists change frequently, always consult the latest documentation before use.

## Reference Links

- Anthropic documentation, Structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- OpenAI documentation, Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs

← Concept map: (#/post/ai-map)

Related posts: [Tool use](#/post/ai-tool-use) · [Prompts](#/post/ai-prompt) · [Hallucination](#/post/ai-hallucination)