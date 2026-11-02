Agent 设计的出发点并非“是否要构建 Agent"，而是“能否仅通过一次 LLM 调用完成？若不行，应界定到哪一步由代码决定，哪一部分交由模型自主处理”。

## 工作流与 Agent

Anthropic 在《Building effective agents》中将二者如此区分：

- **工作流 (Workflow)**：LLM 与工具按照预先设定的代码路径串联。下一步做什么由代码决定。
- **Agent**：LLM 自主决定过程与工具使用方式，并掌控如何完成任务的权力。

将两者结合称为“Agentic 系统”。与其试图用单一 Agent 解决所有问题，不如更接近于选择将其置于该光谱的哪个位置。关于 Agent 循环本身，已在 [详见 → Agent 与 Agent 循环](#/post/ai-agent-loop) 中单独阐述。

文章首先强调的是**简单性**。建议寻找最简单的解决方案，仅在结果确凿改善时才增加复杂度。原因在于成本：Agentic 系统是用延迟和成本换取性能的“交易”，因此这笔交易必须物有所值。文中也指出，许多情况下，仅附带搜索和示例的一次 LLM 调用便已足够。

## 基础组件：增强型 LLM

各类模式的共同组件是**附加了搜索、工具和记忆的 LLM**。模型需自主生成搜索词、选择使用何种工具，并决定记忆什么内容。关于工具调用的连接方式，文中以 MCP 为例。负责调用工具的机制已在 [详见 → 工具调用](#/post/ai-tool-use) 中讨论。

## 五种工作流模式

一次概览如下：

| 模式 | 一句话描述 | 适用场景 | 代价 |
|---|---|---|---|
| **提示链 (Prompt Chaining)** | 分阶段处理，前一步输出作为后一步输入 | 当可清晰拆解为固定的子任务时 | 延迟增加 |
| **路由 (Routing)** | 对输入进行分类，分发至专用分支 | 输入类型界限分明且分类准确时 | 若分类错误则整体出错 |
| **并行化 (Parallelization)** | 同时发起多次调用并通过代码合并结果 | 需要速度或多角度分析时 | 按调用次数产生成本 |
| **编排者 - 工作者 (Orchestrator-Worker)** | 中央 LLM 将任务拆解并分配给 Worker，最后汇总结果 | 子任务无法预先预知时 | 成本与复杂度增加 |
| **评估 - 改进 (Evaluate-Improve)** | 生成型 LLM 与评估型 LLM 进行迭代 | 评估标准明确且每次反馈都能提升结果时 | 按迭代次数产生成本 |

### 提示链 (Chaining)

将任务按顺序分解。例如：撰写大纲、检查是否符合标准、撰写正文。若在中间设置代码实现的“关卡”（gate），即可在大纲阶段发现并纠正错误。文档中的示例包括：撰写营销文案并翻译、检查大纲后撰写正文等。相比一次性下达所有指令，分步调用使每一步更简单，从而提升准确率，但代价是速度变慢。

### 路由 (Routing)

首先对输入进行分类，再将其发送至对应的提示或模型分支。文档示例是将客户咨询分为“一般”、“退款”和“技术”三类。此外，也可将简单问题发送给小模型，困难问题发送给大模型。这种模式有助于降低成本，因此值得结合 [详见 → AI 服务成本结构](#/post/app-cost) 一并阅读。

### 并行化 (Parallelization)

存在两种变体。**分区（Sectioning）**：同时运行相互独立的子任务。例如，一个模型在回答的同时，另一个模型对输入进行审查。**投票（Voting）**：重复执行同一任务并通过多数决决定结果。例如，用多个提示检查代码漏洞，只要有一次检测到即标记。文中指出，与其将多个考量因素塞入一次调用，不如针对每个考量因素单独发起调用更为妥当。

### 编排者 - 工作者 (Orchestrator-Worker)

外观与并行化相似，但子任务是根据输入动态确定的，这是关键区别。典型例子是需修改多个文件的编程任务：具体要修改哪个文件必须读取请求后才能知晓。中央模型负责拆解任务，Worker 模型执行并汇总结果。关于多个模型分担角色的内容，将在 [详见 → 子 Agent 与多 Agent](#/post/ai-subagent) 中继续探讨。

### 评估 - 改进 (Evaluate-Improve)

一个模型生成内容，另一个模型进行评估并提供反馈，直至通过为止。文档示例为文学翻译：评估模型指出遗漏的细微之处（nuance）。该模式需满足两个条件：评估标准必须明确，且收到反馈后结果必须实际改善。若其中任一条件不满足，系统只会空转而无法进步。关于如何设计评估机制，将在 [详见 → LLM 应用评估](#/post/app-eval) 中继续探讨。

## 何时使用 Agent

由于无法预测步骤数量，因此无法预先锁定路径，Agent 适用于**开放性问题**。通常以人类指令或对话启动，制定计划；在每一步接收现实事实（如工具输出、代码执行结果等 ground truth）并据此推进。遇到阻塞点或检查点时，需向人类确认。文中指出，除了设定结束条件外，还需设置最大迭代次数等上限，这对控制至关重要。

实现意外地简单。目前所有工具都是通过 LLM 在环境中接收反馈并以循环方式使用的，因此工具设计成为核心。文档列举了两个适合代理（Agent）的场景：客户支持（混合了对话与行动，可根据解决情况判断成功与否）和编程（可通过测试验证结果）。两者的共同点是拥有明确的成功标准和反馈回路。相反，由于成本高且错误容易累积，建议在沙箱环境中充分测试并设置护栏（Guardrails）。关于护栏，将在 [详见 → 护栏与安全机制](#/post/app-guardrails) 中单独讨论。

## 工具设计的重要性不亚于提示词

文档的这一部分篇幅意外地长。这意味着在应用于人机界面（HCI）时投入的努力，同样要投入到代理 - 计算机界面（ACI）中。

- 工具说明应像给新开发者的 docstring 一样编写：包含使用示例、边界案例以及与相似工具的区别。
- 避免让模型难以生成的格式。diff 需要预先计算行数，JSON 中的代码存在转义负担。
- 大量尝试实际输入以发现并纠正错误。
- 通过改变参数使出错变得困难（防错设计，poka-yoke）。SWE-bench 代理在移动目录后常出现相对路径错误，但改为要求绝对路径后问题消失。文中也提到，花在打磨工具上的时间比编写提示词更多。

## 关于框架

像 Claude Agent SDK 这样的框架简化了调用、工具定义和链式处理。然而，抽象层会掩盖提示词与响应，使调试变得困难，并容易引入不必要的复杂性。文档的建议是：起初直接使用 API，使用框架时则需理解其内部运作机制。同样地，指代框架外围模型代码的术语详见 [详见 → Harness 与 Harness Engineering](#/post/ai-harness)。

## 亲自运行的最小代码示例

为了展示五种结构在代码层面的简洁程度，仅用虚构的 LLM 函数（`llm`）搭建了骨架。此处并未实际调用模型，仅用于验证流程。

```python
from concurrent.futures import ThreadPoolExecutor

def llm(prompt: str) -> str:
    """가짜 LLM. 실제로는 API 호출 한 번이 들어갈 자리."""
    if prompt.startswith("분류:"):
        return "환불" if "환불" in prompt else "일반"
    if prompt.startswith("평가:"):
        return "OK" if "근거" in prompt else "근거를 추가해라"
    if prompt.startswith("개선:"):
        return prompt[3:] + " (근거 추가)"
    return f"[{prompt[:20]}...에 대한 답]"

# 1) 체이닝: 앞 출력이 뒤 입력
def chain(topic):
    outline = llm(f"개요: {topic}")
    if len(outline) < 5:            # 게이트
        raise ValueError("개요가 너무 짧다")
    return llm(f"본문: {outline}")

# 2) 라우팅: 분류 후 갈래 선택
HANDLERS = {"환불": lambda q: llm(f"환불 절차 안내: {q}"),
            "일반": lambda q: llm(f"일반 답변: {q}")}
def route(q):
    label = llm(f"분류: {q}")
    return label, HANDLERS[label](q)

# 3) 병렬화(투표): 같은 일을 여러 번
def vote(q, n=3):
    with ThreadPoolExecutor(n) as ex:
        answers = list(ex.map(lambda _: llm(f"검토: {q}"), range(n)))
    return max(set(answers), key=answers.count)

# 4) 평가-개선: 기준 통과까지 반복, 횟수 상한
def refine(draft, max_iter=3):
    for i in range(max_iter):
        verdict = llm(f"평가: {draft}")
        if verdict == "OK":
            return draft, i
        draft = llm(f"개선: {draft}")
    return draft, max_iter

# 5) 에이전트: 다음 행동을 고르는 루프 (여기선 decide 함수로 흉내)
def agent(goal, tools, decide, max_steps=5):
    history = [goal]
    for _ in range(max_steps):
        action, arg = decide(history)
        if action == "finish":
            return arg
        history.append(tools[action](arg))
    return "상한 도달"
```

实际运行后发现：路由将“请退款”归类为 `refund` 分支，“营业时间…”则归入 `general` 分支；评估与改进通过修改一份初稿使其通过（`('只有主张的草稿 (需补充依据)', 1)`）；代理在使用一次搜索工具后结束。值得注意的是，前四种结构中流程由代码控制，而代理仅由 `decide` 控制流程。此外，`max_iter`、`max_steps` 等上限参数均被纳入其中。

<details>
<summary>详细解析：多代理的价值是多少</summary>

Anthropic 的多代理研究系统文章中提到了成本数据：代理使用的 token 量约为聊天的 4 倍，而多代理则约为 15 倍。因此，仅在经济性允许的高价值任务中使用。其结构为编排者 - 工作者（Orchestrator-Worker）模式：引导代理分析问题并制定计划，子代理并行搜索并返回结果。内部配置中，引导代理为 Claude Opus 4，子代理为 Claude Sonnet 4。

性能方面，比单一代理 Claude Opus 4 高出 90.2%，该数据来自 Anthropic 内部研究评估。在 BrowseComp 基准测试中，95% 的性能差异可归因于三个因素，其中 token 用量占 80%。另有说法称，通过并行化，复杂查询的调查时间最多可减少 90%。

但也列出了不适用的情况：所有代理必须共享同一上下文、相互依赖性强、大多数编程任务（可并行分解的部分少于研究场景）、需要实时协调的任务。初期曾出现简单查询就启动 50 个子代理的错误，因此建议在提示词中根据查询难度指定代理数量和工具调用次数。在分配子代理任务时，需明确目标、输出格式、工具指南和边界条件，以减少重复工作。

</details>

<details>
<summary>详细解析：选择何种模式（判断顺序）</summary>

按文档内容梳理的顺序如下：

1. 单次 LLM 调用能否同时完成搜索与示例？若能则到此为止。
2. 若不能，子任务是否固定？若固定，则采用链式处理；按输入类型分支则为路由（Routing）。
3. 存在独立片段或需要多数决时，采用并行化。
4. 若需根据输入了解子任务，则使用编排者 - 工作者模式。
5. 若评估标准明确且可通过修正改进，则附加评估 - 改进机制。
6. 若阶段数未知且需持续依赖环境反馈进行判断，则采用代理模式。此时需共同设计上限、人工确认点及沙箱环境。

文档还指出，这些模式可以相互组合。目标并非使用多种模式，而是仅在测量显示能带来改善时才增加复杂度。

</details>

## 常见误区

- 代理（Agent）比工作流更高级：文档的评判标准不在于是否“高级”，而在于是否存在预设路径。若可行，工作流更具可预测性且成本更低。
- 使用框架就等于使用了代理：框架仅是便利工具，关键在于由谁来定义流程走向。
- 多代理就意味着更聪明：根据研究论文，其 token 消耗接近单代理的 15 倍；涉及大量上下文共享的任务反而并不适用。
- 评估与改进并非次数越多越好：若标准模糊，盲目重复只会徒劳无功，因此需要设定迭代上限。

← [概念地图](#/post/ai-map)

相关文章：[构建 LLM 应用地图](#/post/app-map)、[代理与代理循环](#/post/ai-agent-loop)、[LLM 应用评估](#/post/app-eval)

## 参考链接

- Anthropic, Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system