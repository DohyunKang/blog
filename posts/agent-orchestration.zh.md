多智能体编排是指一种结构：多个 LLM 调用（智能体）各自承担任务，而有人负责协调它们的顺序并整合结果。如果 [子智能体](#/post/ai-subagent) 那篇文章探讨的是“为什么要拆分”，那么这篇文章则总结了拆分后需要确定的五个方面：由谁来拆分、是并行还是串行、状态存储在哪里、失败时如何处理、以及如何控制成本。

## 首先明确术语：工作流与智能体

Anthropic 的 "Building effective agents" 将二者区分如下：工作流（Workflow）是指 LLM 和工具按照“预先设定的代码路径”进行协调的系统；而智能体（Agent）是指 LLM“自主指挥自身过程及工具使用”的系统。编排（Orchestration）在这两种方式中都会出现。OpenAI Agents SDK 文档也做了同样的区分。它将编排分为由 LLM 进行规划和决策的方式，以及通过代码确定流程的方式；后者在速度、成本和性能方面更具决定性和可预测性。两者也可以混合使用。

这种区分影响了后续的所有选择：如果人类预先知道流程，就用代码实现；如果需要根据输入来决定如何拆分，则让模型来负责拆分。

## 1. 由谁拆分：三种模式

| 模式 | 拆分主体 | 示例 |
|---|---|---|
| 链式调用 (Chaining) | 代码（顺序固定） | 调查 → 大纲 → 草稿 → 评论 → 修改 |
| 并行化 (Parallelization) | 代码（片段固定） | 各部分同时处理，或重复执行相同任务并进行投票 |
| 编排者 - 工作者 (Orchestrator-Worker) | 中央 LLM | 根据输入动态决定子任务并分配给工作者 LLM，最后汇总结果 |

按照 Anthropic 的定义，“编排者 - 工作者”模式是指“中央 LLM 将任务动态拆分并交给工作者 LLM 执行，最后汇总结果”。与并行化不同，子任务并非预先定义，而是由编排者根据输入决定。链式调用中，每次调用处理前一次调用的输出，这是一种以延迟换取准确性的选择。OpenAI 文档中的链式调用示例（调查→大纲→草稿→评论→修改）也符合这一模式。此外，通过评估者循环直到通过的反馈回路也被介绍为一种代码模式。

## 2. 并行还是串行

独立的片段适合并行处理以提升速度。Claude Agent SDK 文档指出，并行子智能体的结束时间是“所有任务中最慢的那个”的耗时，而非所有任务时间的总和。Anthropic 的多智能体研究系统文章提到，引导智能体（Lead Agent）并行运行 3~5 个子智能体，且每个子智能体并行使用 3 个以上工具，使得复杂查询的调查时间最多减少了 90%。该数值为文章中引用的数据，并非本人复现结果。

反之，如果前一个结果作为后一个任务的输入，则必须串行处理。能否并行取决于“一个片段是否需要另一个片段的结果”。同一篇文章指出，所有智能体需要共享相同上下文，或智能体之间存在强依赖的任务，与当前架构不太契合；大多数编码任务中，可并行拆分的部分少于研究类任务。

OpenAI 文档在代码层面的并行化方面，提到了如 `asyncio.gather` 等 Python 内置工具。这意味着即使不使用额外框架，独立的调用也可以同时执行。

## 3. 状态存储在哪里

多个智能体运行时，若彼此不共享对话，则需要信息传递的通道。主要有两种方式：

- **仅通过消息传递**：根据 Claude Agent SDK 文档，子智能体以新上下文开始，父智能体传递给它的仅是 Agent 工具的提示字符串。子智能体内部进行的工具调用及其结果保留在内部，父智能体只接收最终消息。因此，必须将所需的文件路径、错误消息、决策等直接写入提示中。
- **共享状态对象**：LangGraph 让节点读写共享数据（State），每个键都有 reducer 来合并更新。默认 reducer 覆盖值；若指定如 `Annotated[list[str], operator.add]` 这样的 reducer，则并行节点的结果会追加到列表中。

Anthropic 的研究系统文章还提到因其他原因使用外部存储：当上下文窗口超过 200,000 个 token 时会被截断，因此引导智能体将计划保存到外部内存；当接近限制时，启动新的子智能体以干净的上下文继续，并与之前保存的内存进行交接。这似乎是将 [压缩](#/post/ai-compaction) 或 [会话](#/post/ai-session) 文章中遇到的问题转移到了智能体之间。

在 LangGraph 中，并行扇出（Fan-out）通过 `Send` 实现：运行时为每个已知数量的项单独调用同一节点作为输入，结果再通过 reducer 合并。

```python
def fan_out(state):
    return [Send("worker", {"task": t}) for t in state["tasks"]]

graph.add_conditional_edges("planner", fan_out)
```

此代码是对文档中 map-reduce 示例的简化版本，尚未安装 LangGraph 进行实际运行。

## 4. 失败时如何处理

随着代理（Agent）数量的增加，其中必然会有失败的情况。根据文档中提到的应对策略，情况如下：

| 情况 | 应对措施 | 来源 |
|---|---|---|
| 临时性错误 | 重试、定期检查点、从中断处恢复 | Anthropic 研究系统文章 |
| 节点重新执行 | 由于节点处于检查点和重试边界，因此从头开始重新运行。副作用是幂等的 | LangGraph 文档 |
| 子代理中断 | 达到 `maxTurns` 时，将结果标记为“部分”，通过恢复相同的代理继续后续操作 | Claude Agent SDK 文档 |
| 无限循环 | 递归限制（super-step 数量上限），超出则抛出 `GraphRecursionError` | LangGraph 文档 |

在 Claude Agent SDK 文档中还提到：如果由于 API 错误导致子代理过早结束，该错误不会作为结果传递。我将其解读为一种设计，旨在区分错误与结果，防止父代理误以为获得了“成功的空结果”。

处理失败情况的代码大致如下所示。我们使用了一个假想的工作者（用随机失败的函数代替 LLM 调用），一次性测试了并发执行限制、超时、重试和令牌预算。

```python
import asyncio, random

random.seed(1)
MAX_TOKENS = 3000
state = {"results": {}, "failed": [], "tokens": 0}   # 오케스트레이터만 쓰는 공유 상태

async def worker(task):
    """LLM 호출 자리. 가짜: 가끔 실패하고 토큰을 쓴다."""
    await asyncio.sleep(0.01)
    if random.random() < 0.3:
        raise RuntimeError("rate limit")
    return f"{task}: summary", 500

async def run_worker(task, sem, retries=2):
    async with sem:                                   # 동시 실행 수 제한
        for attempt in range(retries + 1):
            if state["tokens"] >= MAX_TOKENS:          # 예산 초과면 새 호출 안 함
                state["failed"].append((task, "budget"))
                return
            try:
                text, used = await asyncio.wait_for(worker(task), timeout=5)
                state["tokens"] += used
                state["results"][task] = text
                return
            except Exception as e:
                if attempt == retries:
                    state["failed"].append((task, str(e)))

async def orchestrate(question):
    subtasks = [f"{question}/part{i}" for i in range(1, 7)]   # 실제로는 모델이 쪼갠다
    sem = asyncio.Semaphore(3)
    await asyncio.gather(*(run_worker(t, sem) for t in subtasks))
    return state

s = asyncio.run(orchestrate("q"))
print("done:", len(s["results"]), "failed:", s["failed"], "tokens:", s["tokens"])
```

我们用 Python 直接运行了这段代码。当失败概率为 0.3 时，输出结果为 `done: 6 failed: [] tokens: 3000`。将失败概率提高到 0.5 后，输出变为 `done: 5 failed: [('q/part5', 'rate limit')] tokens: 2500`。即使重试次数用尽，失败的片段仍保留在 `failed` 中，而其他结果保持不变。即使单个任务失败，系统也不会丢弃整个流程，而是区分“成功”与“失败”的部分并返回相应结果。由于并非真实的 API 调用，因此无法通过此运行得知实际的成本或延迟。在并发调用期间，预算检查与用量记录之间存在间隙，可能导致略微超出上限。

## 5. 成本：首要需要防范的问题

根据 Anthropic 的文章，代理使用的令牌量约为聊天的 4 倍，多代理系统则约为 15 倍。同一篇文章指出，使用 Claude Opus 4 作为主代理、Claude Sonnet 4 作为子代理的配置，在内部研究中比单一 Opus 4 的表现高出 90.2%。这意味着性能与成本同步上升。AI 功能中，如果单个客户使用的调用量翻倍，[成本](#/post/app-cost) 也会相应翻倍。

文档提供的成本控制手段如下：

- **在提示词（Prompt）中设定规模限制**：Anthropic 表示，初始代理即使面对简单问题也可能过度启动子代理；他们制定了规则：简单调查使用 1 个代理和 3~10 次工具调用，直接比较使用 2~4 个子代理，复杂调查则需 10 个以上。
- **硬性上限**：Claude Agent SDK 文档指出，可以设置嵌套深度（默认为 3 层）、并发子代理数量（默认为 20）以及查询支出上限（`maxBudgetUsd` / `max_budget_usd`）。一旦触及支出上限，系统将拒绝启动新的子代理、停止正在运行的后台子代理，并将查询以 `error_max_budget_usd` 结束。由于子代理可以创建自己的子代理，因此单个提示词可能演变为代理树，这也是设置该选项的原因。
- **为每个子代理指定模型**：根据同一文档中的 `model` 字段，像调查这类轻量级任务可交由较小模型处理。
- **减少任务本身**：这些限制是安全机制，最经济的方式是不使用代理。Anthropic 建议：“尽可能寻找最简单的解决方案，仅在必要时增加复杂度”。文档也警告说，框架可能会为提示词添加额外的抽象层从而掩盖其内容。设计顺序请参考 [代理设计模式](#/post/app-agent-design)。

<details>
<summary>详细解析：Handoff 与 agents-as-tools</summary>

OpenAI Agents SDK 文档区分了两种委托方式：`agents-as-tools` 模式下，管理器代理掌握对话控制权，专业代理协助完成“有限的子任务”，但不接管与用户的对话；而 `handoff` 模式下，被选中的专业代理将当前轮次的剩余部分“拥有”。两者可结合使用：通过 `handoff` 移交的专业代理在处理狭窄的子任务时，也可调用其他代理作为工具。这种区分本质上是对“谁掌握状态”的不同表述：由管理器掌控即为工具模式，移交出去则为 `handoff`。

</details>

<details>
<summary>详细解析：传递给子代理的提示词即全部内容</summary>

根据 Claude Agent SDK 文档中的表格，子代理会接收其自身的系统提示、代理工具的提示、项目 CLAUDE.md 以及工具定义。它不会接收父代理的对话历史、工具结果或父代理的系统提示。Fork（分叉）是一个例外，它会复制迄今为止的对话作为起点。文档指出，结果仅返回一条最终消息，而父代理会对该消息进行摘要后呈现给用户；因此，若要原样传递原文本，必须发出相应指示。正因如此，在委托提示中准确定义目标、输出格式和范围是提升编排质量的关键部分。
</details>

<details>
<summary>详细解析：本文直接验证与未验证的内容</summary>

Python 代码直接运行了上述虚假 worker 版本（结果见正文）。对于 LangGraph、OpenAI Agents SDK 和 Claude Agent SDK 的代码，并未进行安装或运行，而是阅读了其官方文档的说明与示例。文中提到的数值（15 倍、90.2%、缩短 90%、默认深度 3·并发 20）均源自相关官方文档，并非本人实测数据。Claude Agent SDK 文档也指出，默认值可能因文档版本不同而有所差异。

</details>

## 常见误区

- **代理越多越好**：Anthropic 的文章也指出，成本可能增加约 15 倍，且对于依赖关系复杂的事务并不适用。
- **编排器全知全能**：子代理无法查看父代理的对话，仅能接收传递下来的提示词。
- **失败可通过重试解决**：重试会产生额外成本。必须同时设置尝试次数和预算上限。
- **使用框架即可解决编排问题**：框架仅提供状态管理和重试机制，至于如何分配任务则由设计者决定。Anthropic 甚至警告称，抽象层可能会掩盖提示词（prompt）的细节。

## 结语

将五种要素（由谁分配、并行/串行、状态管理、失败处理、成本）与各个框架的处理方式进行对照后发现，尽管名称各异，核心问题实则相同。在增加更多模型之前，先评估任务是否可以通过代码固定下来，这才是正确的顺序。

[详情 → 代理设计模式](#/post/app-agent-design) · [详情 → 代理与代理循环](#/post/ai-agent-loop) · [详情 → AI 服务成本结构](#/post/app-cost)

← [LLM 应用构建指南](#/post/app-map)

相关文章：[子代理与多代理](#/post/ai-subagent) · [工具调用](#/post/ai-tool-use) · [上下文](#/post/ai-context)

## 参考链接

- Anthropic, Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system
- Claude Agent SDK 文档，Subagents: https://code.claude.com/docs/en/agent-sdk/subagents
- OpenAI Agents SDK 文档，Agent orchestration: https://openai.github.io/openai-agents-python/multi_agent/
- LangGraph 文档，Graph API: https://docs.langchain.com/oss/python/langgraph/graph-api