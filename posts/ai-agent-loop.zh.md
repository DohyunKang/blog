Agent 的结构是：模型使用工具、查看结果，然后自行决定下一步做什么，如此循环往复。名字听起来很宏大，但其核心骨架只是一个 `while` 循环。

## Agent 是什么

Anthropic 的文章《Building effective agents》将二者做了如下区分：Workflow（工作流）是将 LLM 和工具编织成“预先设定的代码路径”的系统；而 Agent 则是 LLM“自主指挥自身工作流程与工具使用”的系统。同一篇文章中提到，实际实现 Agent 时，通常是指“接收环境反馈并使用工具的 LLM 进入循环”。

简单来说就是如此：如果步骤被硬编码在代码中，那就是 Workflow；如果下一步由模型决定，那就是 Agent。与其说两者之间有一条像刀切一样清晰的界限，不如说是取决于将多少控制权交给模型的程度的差异。关于工具是什么，已另在 [详细 → 工具调用](#/post/ai-tool-use) 中说明。

| | Workflow | Agent |
|---|---|---|
| 决定下一步的主体 | 代码 | 模型 |
| 步骤数量 | 预先可知 | 运行后才能知道 |
| 可预测性 | 高 | 低 |
| 成本与延迟 | 较低且稳定 | 较高且波动大 |

## 循环是如何运行的

Anthropic 文档（How tool use works）描述的基本流程如下：当工具由我的代码执行时，我的应用程序需要运行循环。这是因为模型无法直接执行代码。

1. 发送请求，其中包含工具列表和用户消息。
2. 模型返回一个 `tool_use` 块，即工具调用请求，同时附带 `stop_reason: "tool_use"`。
3. 我的代码执行该工具，并将结果生成 `tool_result`。
4. 将之前的对话、模型的响应以及结果合并后，再次发送请求。
5. 只要 `stop_reason` 为 `"tool_use"`，就重复步骤 2 至 4。

当出现 `end_turn`、`max_tokens`、`stop_sequence` 或 `refusal` 中的任何一个时，循环即退出。这意味着模型已给出最终答案，或因其他原因停止。按照文档的表述，模型“仅输出结构化请求”，而执行工作由我的代码（或 Anthropic 服务器）完成。

这种方式有时被称为观察（Observation）、思考（Thought）和行动（Action）。工具的结果是观察，基于结果决定下一步是思考，调用工具则是行动。这种方法的名称是 ReAct（Yao 等，2022）。根据论文摘要，这是一种交替进行推理（reasoning）和行动（acting）的提示方式；与仅在 HotpotQA 和 FEVER 等任务中使用思维链（chain-of-thought）相比，它能减少幻觉和错误传播。此外还有一个数据点：在 ALFWorld 和 WebShop 中，其成功率分别比模仿学习和强化学习方法高出 34% 和 10%（绝对值）。不过，这是 2022 年论文的实验条件，当前模型并不完全适用这些数值。

## 亲自运行的最小循环

在调用模型时，我用规则函数代替了它，仅检查结构。由于并非真实模型，无法评估其判断能力，只能观察循环形态和终止情况。

```python
def fake_model(messages):
    last = messages[-1]
    if last["role"] == "user":
        return {"stop_reason": "tool_use", "tool": "add", "args": {"a": 2, "b": 3}}
    if last["role"] == "tool":
        return {"stop_reason": "end_turn", "text": f"답은 {last['content']}"}

TOOLS = {"add": lambda a, b: a + b}

def run(task, max_steps=5):
    messages = [{"role": "user", "content": task}]
    for step in range(max_steps):
        r = fake_model(messages)
        if r["stop_reason"] != "tool_use":
            return r["text"], step + 1
        try:
            out = TOOLS[r["tool"]](**r["args"])
        except Exception as e:
            out = f"error: {e}"
        messages.append({"role": "assistant", "content": r})
        messages.append({"role": "tool", "content": out})
    return "중단: 최대 단계 도달", max_steps
```

运行后，`run("2+3 是？")` 在第二步以“答案是 5"结束。当改为让模型持续调用工具时（`max_steps=3`），则在第三步因“达到最大步骤数”而停止。如果没有这个上限，相同的代码将无法终止。

## 何时结束

结束有两种情况：

- 模型判断“已完成”，在无工具调用的情况下直接给出答案（`end_turn`）。
- 由外部强制中断。例如：最大重复次数、令牌或时间预算限制、人工确认等。

Anthropic 的文章也将设置最大重复次数等终止条件作为保持控制的方法之一。文章还提到，当 Agent 卡住或在关键节点时，也可以请求人工确认后继续推进。我认为的一个关键点是：如果只信任模型的前端输出，无法防止模型误以为“已完成”，因此必须配备外部中断机制。

在服务器代替执行工具的情况下（如 `web_search`），循环在服务器内部运行；一旦达到重复限制，则返回到 `pause_turn`。此时任务并未结束，文档指出应原样重发该对话以继续后续流程。

## 规划与上下文

当循环变长时，会出现两个问题。首先是规划。存在一次性设定并遵循的方式，也存在每步观察后重新规划的方式。上述文章提到 Agent“进行规划并独立工作”，并在每个阶段从环境中获取“ground truth”（工具结果、代码执行结果）以判断进展。我将此理解为：“应相信实际运行得到的结果，而非头脑中的计划”。

另一种是上下文问题。由于每个阶段都会累积工具的执行结果，窗口会变得越来越拥挤。这与在 [详细 → 上下文](#/post/ai-context) 和 [详细 → 压缩](#/post/ai-compaction) 中讨论的问题相同。如果要处理长任务，必须在循环外部由 Harness 来管理这部分内容。Harness 的相关整理见 [详细 → Harness](#/post/ai-harness)。

## 失败模式

将我在文档和文章中确认的内容与我推断的内容分开列出。

**已确认的内容**
- **错误累积**：Anthropic 的文章指出，“自主性意味着更高的成本和错误累积的可能性”。如果每个阶段都有微小的出错概率，那么阶段越多，整体成功率就越低。
- **成本与延迟**：据说代理（Agent）系统为了获得更好的表现，往往需要付出延迟和成本的代价。
- **建议**：建议在沙盒中进行充分测试并设置适当的护栏（Guardrails）。这也与 [详细 → 护栏](#/post/app-guardrails) 相关联。

**我的推断**
- **空转**：反复调用相同的工具并传入相同的参数，如同原地打转。
- **重复错误**：即使看到了工具的错误消息，仍然重复犯同样的错误。
- **目标遗忘或漂移**：中途忘记目标，或者目标逐渐发生偏移。

上述三点并非我亲自复现过，而是基于架构推测可能出现的现象。如果属实，解决方案大致包括限制循环次数、检测重复调用、以及让模型以更易读的方式返回错误信息等，但这也不是已确认的处方。

## 何时仅用工作流（Workflow）就足够了

同一篇文章最强烈传达的观点是：“从最简单的解决方案开始，仅在必要时增加复杂度”。据说，很多时候一次带有搜索和示例的 LLM 调用就足够了。我大致是这样理解的基准：

| 情况 | 适用方案 |
|---|---|
| 步骤已确定且预测很重要 | 工作流 (Workflow) |
| 无法预知需要多少步骤的开放性问题 | 代理 (Agent) |
| 可以信赖模型判断的环境 | 代理 (Agent) |

文章列举了工作流的五种典型模式：提示链（Prompt Chaining）、路由、并行化、编排者 - 工作者（Orchestrator-Worker）、评估者 - 优化器。关于将任务分配给多个代理的讨论，见 [详细 → 子代理](#/post/ai-subagent)。在实际设计代理应用时需要考虑的事项，见 [详细 → 代理设计](#/post/app-agent-design)。

## 常见误解

- **代理是某种特殊的独立模型**：并非如此。它只是将相同的 LLM 在循环中与工具一起使用的模式。不过，经过训练以擅长使用工具的模型确实表现更好（Anthropic 文档提到了 trained-in 工具 schema）。
- **代理总是优于工作流**：由于存在成本、延迟和错误累积的问题，对于范围狭窄且定义明确的任务，工作流更为合适。
- **运行循环后模型会自动完成**：设置外部终止条件更为安全。
- **模型执行工具**：模型仅发出请求。实际的执行是由我的代码或服务器完成的。

<details>
<summary>详细解析：按 stop_reason 处理</summary>

仅列出文档中提到的范围。

- `tool_use`：执行工具并附加结果继续运行。可能存在多个工具调用（并行调用）。
- `end_turn`：最终答案。结束循环。
- `max_tokens`：回答被截断。这不是最终答案，需要我的应用程序进行处理。
- `stop_sequence`, `refusal`：因其他原因停止。同样需要应用程序处理。
- `pause_turn`：服务器端的循环达到了重复次数限制。需包含响应重新发送并继续。

</details>

## 参考链接

- Anthropic, Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic 文档，How tool use works: https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works
- Yao et al., ReAct: Synergizing Reasoning and Acting in Language Models (仅阅读了摘要): https://arxiv.org/abs/2210.03629

← [概念图](#/post/ai-map)

相关文章：[工具调用](#/post/ai-tool-use) · [子代理与多代理](#/post/ai-subagent) · [Harness](#/post/ai-harness)