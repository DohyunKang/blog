Observability is the practice of recording what a service emits externally so that we can infer what happened internally. In LLM services, a single user request is broken down into multiple stages such as prompt assembly, retrieval, model invocation, and tool execution; therefore, tracing that bundles these stages together becomes central.

## Why general logs are insufficient

Web server logs indicate that a request was received and a 200 status code was returned. However, in LLM functionality, a 200 response does not guarantee a correct answer. Since no error occurred, logs leave no trace.

There are two reasons for this:

- Outputs are inconsistent. Even with the same input, different answers can be produced; therefore, to reproduce an issue, the actual prompts and responses exchanged at that time must be retained. This variability is also why evaluation is necessary ([LLM Evaluation](#/post/ai-evals)).
- A single request passes through multiple stages. If an [agent loop](#/post/ai-agent-loop) runs, five model invocations and three [tool calls](#/post/ai-tool-use) may occur within one request. Even if logs are printed sequentially, without linking them to identify which line corresponds to which stage of a specific request, they become unreadable.

## Trace and Span

Translating the definition from the OpenTelemetry documentation: a `trace` represents the entire path a request takes through an application and consists of spans sharing the same trace ID. A `span` is a single operation within that trace. It possesses a name, its parent span's ID (empty for the root), start and end timestamps, attributes, events, and status. Child spans store their parent's ID, creating a hierarchy.

Visualizing a single LLM request looks like this:

```
trace  (사용자 질문 1건)
└─ span: 에이전트 실행            ← 전체 12.4초
   ├─ span: 검색                  ← 0.6초
   ├─ span: 모델 호출 #1          ← 3.1초, 도구 요청이 나옴
   ├─ span: 도구 실행 (주문 조회) ← 0.9초
   └─ span: 모델 호출 #2          ← 7.2초, 최종 답
```

The time spent in each box immediately reveals where slow requests originate. The numbers above are examples created to illustrate the structure.

Span attributes are key-value pairs, and OpenTelemetry refers to its set of standardized attribute names as semantic conventions. Using the same name ensures tools can be read consistently regardless of differences.

## What to Record

Generally, LLM services record the following:

| Item | Why is it needed? |
|---|---|
| Prompt (input message) | To identify the cause, we must see exactly what the model received at that time. |
| Response (output message) | We need to be able to review which answer was generated. |
| Model name & parameters | To compare changes after switching models. |
| Token count (input/output) | Raw material for cost calculation. |
| Latency | Derived from span start and end times. |
| Tool name, arguments, result | To check if the agent selected the wrong tool. |
| Termination reason | E.g., whether it was truncated due to length limits. |
| User/session ID, version, tags | To filter by specific users or deployment versions. |

Cost is calculated by multiplying token count by the unit price per model; therefore, it is easier to retain token counts and calculate later rather than recording cost separately. Since model invocation unit prices can change, whether to also record the unit price at the time of logging may vary by tool.

## OpenTelemetry GenAI Conventions

OpenTelemetry has standardized attribute names for GenAI in its semantic conventions. These are currently being moved from a separate repository (`semantic-conventions-genai`) on opentelemetry.io. The README of this repository introduces spans, metrics, and events covering GenAI clients, MCP, and provider-specific conventions.

Looking at a few attribute names listed on the pre-migration attribute registry page gives us a sense of the structure:

| Attribute | Meaning |
|---|---|
| `gen_ai.operation.name` | The type of operation. Values include `chat`, `embeddings`, `execute_tool`, `invoke_agent`, `retrieval`, etc. |
| `gen_ai.request.model` | The name of the model being requested. |
| `gen_ai.usage.input_tokens` | Number of input tokens (note: includes cached input tokens). |
| `gen_ai.usage.output_tokens` | Number of output tokens. |
| `gen_ai.response.finish_reasons` | Reasons why generation stopped. |
| `gen_ai.tool.name` | The name of the tool used by the agent. |
| `gen_ai.input.messages` / `gen_ai.output.messages` | Messages sent to and received from the model. |

Since operation names extend to `execute_tool`, `invoke_agent`, and `retrieval`, these conventions are designed to cover not just model invocations but also tool, agent, and retrieval stages within the same framework. On that page, these values are marked as being in development, so their names may change.

## Representative Tools

OpenTelemetry is a specification and SDK; the component responsible for collecting and visualizing traces is a separate product. Below are notes on concepts read from the official documentation.

LangSmith uses the terms "run" and "trace." A **run** represents a single unit of work, such as an LLM call, prompt assembly, or document retrieval, and is comparable to a span in OpenTelemetry. A **trace** is a collection of runs for a single task, grouped by a `trace_id`. Multiple turns in a conversation constitute one trace per turn, and these are grouped into threads using the `thread_id` metadata. Feedback (scores) can be attached to each run, consisting of tags and score values.

Langfuse has an **observation** under a trace, with types including span, generation, and event. An observation corresponds to steps like LLM calls, tool invocations, or search stages. A single chat interaction is a trace, and multiple traces are grouped into a session. Collection is built on top of OpenTelemetry; the SDK aggregates data locally and sends it to the backend in the background. For short-lived applications, the documentation states that you must call `flush()` before termination to avoid losing data.

The terminology differs, but the structure is identical: requests (traces) have hierarchical stages (spans/runs/observations), with inputs, outputs, and metadata attached.

## Evaluation & Regression

Storing records enables evaluation use cases.

- Traces that exhibited anomalies in production are moved to an evaluation set. The evaluation documentation also notes that operational logs can serve as material for good evaluation examples.
- After changing prompts or models, you compare metrics such as latency, token usage, and failure rates across traces of the same type. This provides evidence for regression analysis.
- Scores are assigned to responses. LangSmith is structured to attach feedback at the run level. Whether it's human thumbs-up/down or automated grading, the score must be linked to a specific trace so that problematic stages causing low scores can be identified.
- If a [guardrail](#/post/ai-guardrails) blocks something, recording this fact as a span or event allows you to measure how frequently it triggers.

In summary, evaluation creates scores, while observability reveals where those scores originate.

## Data Masking

Preserving prompts and responses in full is central to the value of observability, but it also poses risks. User inputs may contain names, contact details, or internal document content. Warnings are attached to `gen_ai.input.messages` and `gen_ai.output.messages` attributes in the OpenTelemetry attribute registry, indicating a high likelihood of containing user data or Personally Identifiable Information (PII).

Langfuse provides a dedicated masking feature designed to obscure inputs, outputs, and metadata before data leaves the application. For the Python SDK, it recommends using a hook (`mask_otel_spans`) that clears or modifies attributes when exporting spans. For JS/TS SDKs, you pass a `mask` function to `LangfuseSpanProcessor`. If using only OpenTelemetry, masking can be handled by span processors within the application or redaction/transform processors in the Collector. The documentation also specifies constraints for this function: it must be fast and deterministic; if an exception occurs or incorrect values are returned, the entire batch is discarded.

<details>
<summary>Considerations when designing masking</summary>

- **Where to mask**: Masking within the application prevents data from leaving externally, while masking in the Collector allows centralized management.
- **What to mask**: Options include patterns like email addresses or phone numbers, entire input bodies, or hashed user IDs.
- **Omitting content entirely**: Retaining only metadata such as token count, latency, and tool names significantly reduces risk but also limits clues for root cause analysis.
- **Retention period**: LangSmith SaaS documentation states data is retained for 180 days after collection. Verify the retention periods of the tools you use.

</details>

## Common Misconceptions

- **Logging more equals observability**: Without grouping stages by `trace_id`, requests cannot be read as units.
- **Observability guarantees quality**: Records are for post-mortem analysis; prevention is handled by guardrails, and scoring is part of evaluation.
- **Keeping all prompts and responses is best**: Since they may contain PII, you must decide what to retain.
- **OpenTelemetry is a visualization dashboard**: It is a specification and SDK; dashboards are provided by separate tools like LangSmith or Langfuse, or other backends.

## Reference Links

- OpenTelemetry, Traces: https://opentelemetry.io/docs/concepts/signals/traces/
- OpenTelemetry, GenAI attributes registry: https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/
- OpenTelemetry, semantic-conventions-genai repository: https://github.com/open-telemetry/semantic-conventions-genai
- LangSmith, Observability concepts: https://docs.langchain.com/langsmith/observability-concepts
- Langfuse, Data model: https://langfuse.com/docs/observability/data-model
- Langfuse, Masking: https://langfuse.com/docs/observability/features/masking

← [Concept map](#/post/ai-map)

Related posts: [LLM evaluation](#/post/ai-evals) · [Agent loop](#/post/ai-agent-loop) · [Guardrails](#/post/ai-guardrails)