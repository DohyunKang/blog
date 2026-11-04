可观测性（Observability）是指通过查看服务向外输出的记录，来推测内部发生了什么。在 LLM 服务中，一次用户请求会被拆分为提示词组装、检索、模型调用、工具执行等多个阶段，因此将这些阶段串联并保留下来的追踪（Tracing）是核心所在。

## 为什么普通日志不够用

Web 服务器日志仅能告知我们请求已到达且返回了 200 状态码。但在 LLM 功能中，即使返回 200，答案也可能是错误的；由于没有报错，日志中也不会留下任何痕迹。

原因主要有两点：

- **输出结果不一致**。相同的输入可能产生不同的回答，因此无法复现的问题必须保留当时实际交互的提示词和响应才能进行追踪。这种波动性也是需要进行评估的原因（[LLM 评估](#/post/ai-evals)）。
- **单个请求经过多个阶段**。如果 [Agent 循环](#/post/ai-agent-loop) 在运行，一次请求内可能包含五次模型调用和三次 [工具调用](#/post/ai-tool-use)。即使日志逐行打印，如果不将每一行与特定请求的哪个阶段关联起来，就无法阅读。

## Trace 与 Span

根据 OpenTelemetry 文档的定义：Trace 是请求穿过应用程序的完整路径，由具有相同 trace ID 的 Spans 组成；Span 是其中的单个操作。Span 包含名称、父 Span 的 ID（根节点为空）、开始和结束时间、属性（attributes）、事件和状态。由于子 Span 存储了父 Span 的 ID，因此形成了层级结构。

绘制一个 LLM 请求的大致形状如下：

```
trace  (사용자 질문 1건)
└─ span: 에이전트 실행            ← 전체 12.4초
   ├─ span: 검색                  ← 0.6초
   ├─ span: 모델 호출 #1          ← 3.1초, 도구 요청이 나옴
   ├─ span: 도구 실행 (주문 조회) ← 0.9초
   └─ span: 모델 호출 #2          ← 7.2초, 최종 답
```

每个方框显示的时间表明慢速请求具体出在哪里。上方的数字是为了展示形态而制作的示例数据。

Span 的属性是名称 - 值对，OpenTelemetry 将预先定义的标准属性名称称为语义约定（Semantic Conventions）。使用相同的名称，即使工具不同，也能以相同的方式读取。

## 记录什么内容

LLM 领域通常记录以下内容：

| 项目 | 为什么需要？ |
|---|---|
| 提示词（输入消息） | 必须查看模型实际接收到的内容以寻找原因 |
| 响应（输出消息） | 必须能够再次查看生成的回答 |
| 模型名称·参数 | 在更换模型后进行比较，观察变化 |
| 令牌数（输入·输出） | 计算成本的基础数据 |
| 延迟时间 | 从 Span 的开始和结束时间得出 |
| 工具名称·参数·结果 | 检查 Agent 是否错误地选择了工具 |
| 终止原因 | 例如是否因长度限制被截断等 |
| 用户·会话 ID、版本、标签 | 用于筛选特定用户或部署版本 |

成本是令牌数乘以各模型的单价，因此与其单独记录成本，不如保留令牌数稍后计算更为方便。由于模型调用单价可能会变化，是否同时记录记录时的单价取决于具体工具。

## OpenTelemetry 的 GenAI 约定

OpenTelemetry 中整理了一组此类属性名称，称为 GenAI 语义约定。目前这些内容正从 opentelemetry.io 的文档页面迁移到独立的存储库（semantic-conventions-genai）。该存储库的 README 介绍道，它将涵盖针对 GenAI 客户端、MCP 及各提供方的 Span、Metric 和 Event 约定。

在迁移之前，查看属性注册表页面上列出的几个名称，便能领会其意图：

| 属性 | 含义 |
|---|---|
| `gen_ai.operation.name` | 操作类型。取值包括 `chat`、`embeddings`、`execute_tool`、`invoke_agent`、`retrieval` 等 |
| `gen_ai.request.model` | 请求发送的模型名称 |
| `gen_ai.usage.input_tokens` | 输入令牌数（注明应包含缓存的输入令牌） |
| `gen_ai.usage.output_tokens` | 输出令牌数 |
| `gen_ai.response.finish_reasons` | 生成停止的原因 |
| `gen_ai.tool.name` | Agent 使用的工具名称 |
| `gen_ai.input.messages` / `gen_ai.output.messages` | 输入模型的对谈消息及输出的消息 |

由于 operation 名称涵盖了 `execute_tool`、`invoke_agent`、`retrieval`，该约定旨在不仅包含模型调用，还将工具、Agent 和检索阶段纳入同一框架。在该页面上，这些值目前标记为开发（development）阶段，因此名称可能会发生变化。

## 主流工具

OpenTelemetry 是一种规范和一个 SDK，而负责收集并展示记录的是独立的产品。我在下方记录了从官方文档中读到的概念。

LangSmith 使用了 run 和 trace 这两个术语。run 是一个工作单元，包括 LLM 调用、提示词组装、文档检索等任务，并将其与 OpenTelemetry 的 span 进行类比；trace 则是某个任务的 run 集合，并通过 trace ID 进行关联。多轮对话中，一轮对话构成一个 trace，通过 `thread_id` 元数据将其聚合为 thread。每个 run 都可以附加分数（feedback），由标签和分数值组成。

Langfuse 在 trace 之下设有 observation，observation 的类型包括 span、generation 和 event。LLM 调用、工具调用、检索步骤等都属于 observation。一次聊天构成一个 trace，而将多个 trace 聚合起来的单位是 session。数据采集构建在 OpenTelemetry 之上，SDK 以批处理模式收集数据并发送到后台。文档指出，对于运行时间较短的应用程序，必须在关闭前调用 `flush()`，否则会导致数据丢失。

虽然术语不同，但结构基本一致：单个请求（trace）下挂有层级化的步骤（span/run/observation），并附加输入输出和元数据。

## 评估与回归分析部分

积累记录后，便可在评估环节加以利用。

- 将服务中异常的 trace 移至评估集案例；评估文档中也提到，运营日志可作为优质评估案例的素材。
- 在更改提示词或模型后，比较同类 trace 中的延迟、令牌数和失败率变化，这为回归分析提供依据。
- 为响应打分：LangSmith 采用以 run 为单位附加 feedback 的结构。无论是人工点赞/点踩还是自动评分，都必须与某个 trace 关联，否则无法追溯低分的具体原因步骤。
- 若 [护栏](#/post/ai-guardrails) 拦截了某些内容，并将该事实记录为 span 或事件，则可统计其触发频率。

简而言之，评估负责生成分数，而可观测性则揭示这些分数的成因所在。

## 个人信息脱敏

完整保留提示词和响应是可观测性的核心价值，但这同时也带来风险。用户输入中可能包含姓名、联系方式或内部文档内容。OpenTelemetry 属性注册表中的 `gen_ai.input.messages` 和 `gen_ai.output.messages` 字段也存在包含用户及个人信息（PII）的风险，相关警告已明确标注。

Langfuse 提供了专门的脱敏功能，用于在数据离开应用程序之前对输入、输出和元数据进行遮蔽。Python SDK 建议在导出时接收 span 并应用钩子函数（`mask_otel_spans`）清除或修改属性；JS/TS SDK 则通过向 `LangfuseSpanProcessor` 传递 `mask` 函数实现脱敏。若仅使用 OpenTelemetry，可在应用内的 span 处理器或 Collector 的 redaction/transform 处理器中进行遮蔽。文档还列出了相关限制：该函数必须快速且具决定性，若抛出异常或返回错误值，整个批次将被丢弃。

<details>
<summary>设计脱敏方案时需考虑的因素</summary>

- 脱敏位置：在应用内部脱敏可防止数据外泄；在 Collector 处脱敏则便于集中管理。
- 脱敏内容：可选择遮蔽邮箱、电话号码等模式，或完全遮蔽输入正文，也可使用用户 ID 的哈希值等。
- 不保留正文的选项：仅保留令牌数、延迟、工具名称等元数据可大幅降低风险，但也会减少排查问题的线索。
- 保留期限：LangSmith SaaS 文档指出采集后保留 180 天；需确认所用工具的保留策略。

</details>

## 常见误解

- 日志越多就等于可观测性：若步骤未通过 trace ID 关联，则无法按请求单位读取。
- 具备可观测性即保证质量：记录用于事后分析，而防护靠护栏，评分则是评估的一部分。
- 提示词和响应全部保留是好事：因可能混入个人信息，需明确决定保留哪些内容。
- OpenTelemetry 是查看界面：它只是规范和 SDK，界面由 LangSmith、Langfuse 等独立工具或其他后端负责。

## 参考资料链接

- OpenTelemetry, Traces: https://opentelemetry.io/docs/concepts/signals/traces/
- OpenTelemetry, GenAI 属性注册表：https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/
- OpenTelemetry, semantic-conventions-genai 仓库：https://github.com/open-telemetry/semantic-conventions-genai
- LangSmith, 可观测性概念：https://docs.langchain.com/langsmith/observability-concepts
- Langfuse, 数据模型：https://langfuse.com/docs/observability/data-model
- Langfuse, 掩码：https://langfuse.com/docs/observability/features/masking

← [概念地图](#/post/ai-map)

相关文章：[LLM 评估](#/post/ai-evals) · [Agent 循环](#/post/ai-agent-loop) · [护栏](#/post/ai-guardrails)