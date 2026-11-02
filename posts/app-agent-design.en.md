The starting point of agent design is not "Should we build an agent?" but rather "Can it be done with a single LLM call? If not, where do we set the boundaries and what do we delegate to the model?"

## Workflows and Agents

Anthropic's "Building effective agents" distinguishes between the two as follows:

- **Workflow**: A sequence where an LLM and tools are woven together along a predefined code path. The code determines what comes next.
- **Agent**: An LLM that autonomously determines the process and tool usage, retaining control over how to complete the task.

Combining both is referred to as an "Agentic System." Rather than solving everything with a single agent, it is more about choosing where on this spectrum to place your solution. The agent loop itself is covered separately in [Details → Agents and Agent Loops](#/post/ai-agent-loop).

The article emphasizes simplicity above all. It advises finding the simplest solution first and only increasing complexity when results are reliably improved. The reason is cost: agentic systems are a trade-off where you pay for latency and cost to buy performance, so that trade must be worthwhile. In many cases, a single LLM call augmented with search and examples is sufficient.

## Underlying Components: Augmented LLMs

The common components across these patterns are an LLM equipped with search, tools, and memory. The model directly generates search queries, selects which tools to use, and decides what to remember. As an example of tool connection methods, MCP is mentioned. Tool invocation is covered in [Details → Tool Use](#/post/ai-tool-use).

## Five Workflow Patterns

Here they are at a glance:

| Pattern | One-Liner Description | Best For | Trade-off |
|---|---|---|---|
| Prompt Chaining | Splitting steps, using the output of one as input to the next | When sub-tasks can be cleanly decomposed into fixed steps | Increased latency |
| Routing | Classifying input and routing to specialized branches | When input types are distinct and classification is accurate | If classification fails, the entire process fails |
| Parallelization | Making multiple calls simultaneously and combining results with code | When speed is needed or multiple perspectives are required | Cost proportional to the number of calls |
| Orchestrator-Worker | A central LLM splits tasks and delegates to workers, then synthesizes results | When sub-tasks cannot be known in advance | Cost and complexity |
| Evaluate-Improve | Iteration between a generation LLM and an evaluation LLM | When evaluation criteria are clear and improvements yield better results | Cost proportional to the number of iterations |

### Chaining

Tasks are executed sequentially. An outline is written, checked against criteria, and then the main body is drafted. If you insert code-based checkpoints (gates) in between, errors made during the outlining phase can be caught there. Document examples include writing marketing copy and translating it, or checking an outline before writing the main body. Breaking tasks into smaller calls per invocation improves accuracy compared to doing everything at once, though it slows things down.

### Routing

Input is classified first, then sent to branch-specific prompts or models. A document example involves dividing customer inquiries into general, refund, and technical categories. Another use case is sending easy questions to a small model and difficult questions to a large model. This approach looks promising for reducing costs and is worth reading alongside [Details → AI Service Cost Structure](#/post/app-cost).

### Parallelization

There are two variations. **Sectioning** runs independent sub-tasks simultaneously; for example, while one model answers, another censors the input. **Voting** performs the same task multiple times and decides by majority vote. For instance, code vulnerabilities are reviewed using multiple prompts, and if any flag an issue, it is marked. It is generally better to make separate calls for each consideration rather than cramming multiple considerations into a single call.

### Orchestrator-Worker

While similar in appearance to parallelization, the key difference is that sub-tasks are determined dynamically based on input. Coding tasks requiring modifications to multiple files are representative examples; which file to touch can only be known after reading the request. The central model splits the work, worker models execute it, and results are synthesized. Topics regarding models sharing roles are continued in [Details → Sub-agents and Multi-agents](#/post/ai-subagent).

### Evaluate-Improve

One model generates content, another evaluates it, provides feedback, and the process repeats until passing criteria. A document example involves a literary translation where the evaluation model points out nuances missed by the generation model. Two conditions apply: evaluation criteria must be clear, and receiving feedback must actually improve the result. If either condition fails, the loop spins without improvement. How to design the evaluation is continued in [Details → LLM App Evaluation](#/post/app-eval).

## When to Use Agents

Agents are used for open-ended problems where the number of steps cannot be predicted, making it impossible to hardcode a path beforehand. They start with human commands or conversation, formulate plans, and proceed by receiving real-world facts (ground truth) such as tool results or code execution at each step. If stuck or at checkpoints, they consult a human. Setting an upper limit on the number of iterations, separate from termination conditions, is necessary for control.

Implementation is surprisingly simple. It's all about LLMs using tools in a loop while receiving feedback from the environment, making tool design the core challenge. The document highlights two areas where agents excel: customer support (a mix of conversation and action, with success measured by resolution) and coding (results can be verified via tests). The common thread is clear success criteria and a feedback loop. Conversely, due to high costs and potential error accumulation, it advises thoroughly testing in sandboxes and implementing guardrails. Guardrails are covered separately in [detailed → Guardrails and Safety Mechanisms](#/post/app-guardrails).

## Tool Design Is as Important as Prompting

This appendix is surprisingly lengthy. It advocates applying the same level of effort to Agent-Computer Interfaces (ACI) that is typically used for Human-Computer Interfaces (HCI).

- Tool descriptions should be written like docstrings for new developers, including usage examples, edge cases, and differences from similar tools.
- Avoid formats that are difficult for models to generate. For instance, `diff` requires counting lines in advance, and code inside JSON carries an escaping burden.
- Test with actual inputs frequently to identify and fix errors.
- Modify arguments to make mistakes less likely (poka-yoke). For example, SWE-bench agents made frequent errors using relative paths after moving directories; requiring absolute paths eliminated these issues. There is also a note that more time was spent refining tools than writing prompts.

## About Frameworks

Frameworks like the Claude Agent SDK simplify calling, defining tools, and chaining. However, abstraction layers can obscure prompts and responses, making debugging difficult and easily introducing unnecessary complexity. The document advises starting by using APIs directly; if you use a framework, ensure you understand what's happening inside. Similarly, code surrounding models outside the framework is referred to as [detailed → Harnessing and AI Engineering](#/post/ai-harness).

## Minimal Code for Direct Execution

To demonstrate how small five structures are in code, only the skeleton was built using a fake LLM function (`llm`); no actual model calls were made, serving solely to verify the flow.

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

Upon actual execution, routing sent "Please refund" to the `refund` branch and "Business hours..." to the `general` branch. Evaluation and improvement involved passing with one revision of a draft containing only claims (e.g., `('claim-only_draft (add evidence)', 1)`), while the agent finished after using a search tool once. Notably, in the first four cases, code controlled the flow, whereas only the agent held the flow via `decide`. Both included limits such as `max_iter` and `max_steps`.

<details>
<summary>Detailed Explanation: What Is the Value of Multi-Agent Systems?</summary>

Anthropic's research paper on multi-agent systems includes cost figures. Agents use about 4x the tokens of chat, while multi-agents use about 15x. Therefore, they are economically viable only for high-value tasks. The structure is orchestrator-worker: a lead agent analyzes questions and plans, while subordinate agents search in parallel and return results. Internally, Claude Opus 4 served as the lead and Claude Sonnet 4 as subordinates.

Performance was reported to be 90.2% higher than single-agent Claude Opus 4, based on Anthropic's internal research evaluation. In BrowseComp, 95% of the performance difference was explained by three factors, with token usage accounting for 80%. It is also noted that parallelization reduced investigation time for complex queries by up to 90%.

Scenarios where it does not fit well are also documented: tasks requiring all agents to share the same context, tasks with high interdependence, most coding work (fewer parts can be split in parallel compared to research), and tasks requiring real-time coordination. Early on, a mistake occurred where 50 subordinate agents were spawned even for simple queries; consequently, the number of agents and tool calls were specified in the prompt based on query difficulty. When assigning tasks to subordinates, goals, output formats, tool guidance, and boundaries must be specified concretely to reduce redundant work.

</details>

<details>
<summary>Detailed Explanation: Which Pattern to Choose (Decision Order)</summary>

Rearranging the document content by order yields the following:

1. Can a single LLM call handle search and examples? If yes, stop there.
2. If not, are subtasks fixed? If fixed, proceed with chaining; if input types vary, use routing.
3. If independent fragments exist or voting is needed, parallelize.
4. If subtasks depend on inputs, use orchestrator-worker.
5. If success criteria are clear and improvement occurs upon revision, add evaluation-improvement.
6. If the number of steps is truly unknown and continuous judgment via environmental feedback is required, use an agent. In this case, design limits, human checkpoints, and sandboxes together.

The document also notes that patterns can be combined. The goal is not to use many patterns indiscriminately but to add them only when measured improvements are observed.

</details>

## Common Misconceptions

- Agents are more advanced than workflows: The criterion is not whether something is "advanced," but whether a predefined path is possible. When feasible, workflows are more predictable and cost-effective.
- Using a framework makes it an agent: Frameworks are merely convenience tools; the key distinction lies in who defines the flow.
- Multi-agent systems are smarter: Based on research papers, they consume nearly 15 times as many tokens. Tasks involving extensive context sharing often do not work well with this approach.
- More evaluation and refinement cycles are always better: If the criteria are ambiguous, endless iterations occur; an upper limit on the number of cycles is necessary.

← [Concept map](#/post/ai-map)

Related articles: [LLM App Building Map](#/post/app-map), [Agents and Agent Loops](#/post/ai-agent-loop), [LLM App Evaluation](#/post/app-eval)

## Reference Links

- Anthropic, Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system