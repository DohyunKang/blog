Multi-agent orchestration is a structure where multiple LLM calls (agents) handle their own tasks, while someone else coordinates the sequence and combines the results. If the [sub-agent](#/post/ai-subagent) post asked "why divide?", this post summarizes what needs to be decided after dividing into five areas: who divides, parallel or sequential, where to store state, how to handle failures, and how to manage costs.

## First, terminology: Workflow vs. Agent

Anthropic's "Building effective agents" distinguishes the two as follows: a workflow is a system where LLMs and tools are coordinated along a "predefined code path," whereas an agent is a system where the LLM "directs its own process and tool usage." Orchestration appears in both approaches. The OpenAI Agents SDK documentation makes the same distinction, categorizing orchestration into methods where the LLM plans and decides versus methods where the flow is defined by code. It states that defining via code leads to more decisive and predictable speed, cost, and performance, though the two can be mixed.

This distinction underpins all subsequent choices. If a human knows the flow in advance, it should be coded; if division depends on inputs, let the model decide.

## 1. Who divides: Three patterns

| Pattern | Dividing Agent | Example |
|---|---|---|
| Chaining | Code (fixed order) | Research → Outline → Draft → Critique → Revision |
| Parallelization | Code (fixed fragments) | Simultaneously by section, or running the same task multiple times for voting |
| Orchestrator-Worker | Central LLM | Decides sub-tasks dynamically based on input and synthesizes results |

Under Anthropic's definition, an orchestrator-worker involves a "central LLM dynamically splitting tasks and assigning them to worker LLMs, then synthesizing results." Unlike parallelization, sub-tasks are not predefined but determined by the orchestrator based on input. Chaining is a choice that trades latency for accuracy, where each call processes the output of the previous one. The OpenAI documentation's chaining example (research → outline → draft → critique → revision) follows the same pattern. Additionally, feedback loops that iterate until an evaluator approves are introduced as code patterns.

## 2. Parallel or Sequential

Independent fragments are faster in parallel. The Claude Agent SDK documentation explains that a parallel sub-agent finishes at "the time of the slowest task," not the sum of all tasks. Anthropic's multi-agent research system article notes that a lead agent runs 3–5 sub-agents in parallel, and each sub-agent uses 3+ tools in parallel, reducing investigation time for complex queries by up to 90%. These figures are from the article and have not been reproduced by me.

Conversely, tasks where earlier results feed into later inputs must be sequential. Whether something can run in parallel depends on "whether one fragment requires the result of another." The same article states that tasks requiring all agents to share the same context or having heavy inter-agent dependencies do not fit well with current structures, and most coding work has fewer parts suitable for parallel splitting compared to research.

OpenAI documentation cites Python built-ins like `asyncio.gather` for code-based parallelism, indicating that independent calls can be executed simultaneously without additional frameworks.

## 3. Where to store state

When multiple agents run without sharing conversations, a channel for information exchange is needed. There are broadly two approaches:

- Message-only passing: According to the Claude Agent SDK documentation, sub-agents start with fresh context, and the parent passes only the prompt string of the agent tool. Tool calls and results occurring within the sub-agent remain inside it, and only the final message returns to the parent. Therefore, necessary file paths, error messages, and decisions must be written directly into the prompt.
- Shared state object: LangGraph places shared data that nodes read and write into a State, with reducers combining updates for each key. The default reducer overwrites values, but specifying a reducer like `Annotated[list[str], operator.add]` appends results from parallel nodes to a list.

Anthropic's research system article also uses external storage for another reason: if the context window exceeds 200,000 tokens, it gets truncated, so the lead agent saves plans to external memory and spawns a new sub-agent with clean context as limits approach, handing off with stored memory. This appears to be moving problems seen in [compaction](#/post/ai-compaction) or [session](#/post/ai-session) posts into between agents.

In LangGraph, parallel fan-out is done via `Send`. At runtime, items with known counts invoke the same node separately as inputs, and results are combined via reducers.

```python
def fan_out(state):
    return [Send("worker", {"task": t}) for t in state["tasks"]]

graph.add_conditional_edges("planner", fan_out)
```

This code is a shortened version of the map-reduce example from the documentation; I have not installed LangGraph to run it.

## 4. What if it fails

As the number of agents increases, at least one is guaranteed to fail. Here are the responses documented for handling such situations:

| Situation | Response | Source |
|---|---|---|
| Transient errors | Retry, periodic checkpoints, resume from where it stopped | Anthropic Research System post |
| Node restart | Nodes restart from the beginning due to checkpoint/retry boundaries. Side effects are idempotent | LangGraph documentation |
| Sub-agent termination | If `maxTurns` is reached, results are marked as "partial"; resume with the same agent to continue | Claude Agent SDK documentation |
| Infinite loops | Recursion limit (upper bound on super-steps); exceeding it raises `GraphRecursionError` | LangGraph documentation |

The Claude Agent SDK documentation also notes that if a sub-agent ends early due to an API error, that error is not propagated as the result. This design distinguishes between errors and results so that the parent does not misinterpret them as a "successful empty result."

Handling failures in code looks like this: I simulated concurrency limits, timeouts, retries, and token budgets using a fake worker (a function that randomly fails instead of calling an LLM).

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

I ran this code directly in Python. With a 0.3 failure probability, the output was `done: 6 failed: [] tokens: 3000`. Raising the probability to 0.5 yielded `done: 5 failed: [('q/part5', 'rate limit')] tokens: 2500`; even after exhausting retries, failed fragments remained in `failed`, while other results were preserved. Even if one part fails, the system does not discard everything but distinguishes between "what succeeded" and "what failed." Since this is not a real API call, actual costs and latency cannot be measured here. During concurrent calls, there may be a gap between budget checks and usage recording, allowing slight overages of the limit.

## 5. Cost: The First Thing to Prevent

According to Anthropic, agents use about 4× more tokens than chat, while multi-agent setups use about 15× more. In the same document, it is stated that a configuration with Claude Opus 4 as the lead and Claude Sonnet 4 as sub-agents performed 90.2% better in internal research evaluations compared to a single Opus 4 alone. This implies that both performance and cost increase together. When the number of calls per customer doubles in AI features, so does the [cost](#/post/app-cost).

Here are the cost control measures provided by the documentation:

- Encode scale into prompts: Anthropic reportedly inserted rules such as simple queries using one agent with 3–10 tool calls, direct comparisons using 2–4 sub-agents, and complex investigations using more than 10.
- Hard limits: The Claude Agent SDK allows setting nesting depth (default 3 levels), concurrent sub-agent count (default 20), and query spend limits (`maxBudgetUsd` / `max_budget_usd`). Upon reaching the spend limit, new sub-agents are rejected, running background sub-agents are stopped, and queries end with `error_max_budget_usd`. Since sub-agents can create their own sub-agents, a single prompt can expand into an agent tree; this option exists to prevent that.
- Specify models per sub-agent: As noted in the same documentation, lightweight tasks like investigations can be assigned to smaller models via the `model` field.
- Reduce the task itself: These limits are safety mechanisms; the cheapest approach is simply not using agents. Anthropic recommends "finding the simplest possible solution and increasing complexity only when necessary." It also warns that frameworks can add an extra abstraction layer that obscures prompts. The design order is covered in [Agent Design Patterns](#/post/app-agent-design).

<details>
<summary>Detailed explanation: Handoff vs. agents-as-tools</summary>

OpenAI Agents SDK documentation distinguishes two delegation modes. In `agents-as-tools`, the manager agent retains control of the conversation, while specialized agents assist with "limited subtasks" without taking over the user dialogue. In contrast, `handoff` means the selected specialized agent "owns" the remainder of that turn. These can be combined: a specialized agent reached via handoff may still invoke other agents as tools for narrow subtasks. This distinction is essentially another way of asking "who holds the state?" If the manager holds it, it's a tool; if handed off, it's a handoff.

</details>

<details>
<summary>Detailed explanation: Prompts passed to sub-agents are everything</summary>

According to the Claude Agent SDK documentation, subagents receive their own system prompt, agent tool prompts, project CLAUDE.md, and tool definitions. They do not receive the parent's conversation history, tool results, or the parent's system prompt. Forks are an exception, as they start by copying the conversation up to that point. Results return only a single final message; since the parent summarizes this for the user, instructions must be provided if you wish to pass it through verbatim, as the documentation notes. Therefore, precisely defining goals, output formats, and scope in the delegation prompt is a major part of orchestration quality.

</details>

<details>
<summary>Detailed explanation: What I verified directly in this post vs. what I did not</summary>

The Python code executed the fake worker version described above (results are in the main text). The code for LangGraph, OpenAI Agents SDK, and Claude Agent SDK was not installed or executed; instead, I read the official documentation and examples. The numerical values (15x increase, 90.2%, 90% reduction, default depth 3 with concurrency 20) are all figures stated in the relevant official documents and articles, which I did not measure myself. The Claude Agent SDK documentation also notes that default values may vary depending on the document version.

</details>

## Common Misconceptions

- **More agents are always better**: Costs can increase by approximately 15x, and Anthropic's own writing notes that tasks with many dependencies do not work well.
- **The orchestrator knows everything**: Subagents cannot see the parent's conversation and only receive passed-down prompts.
- **Failures can be handled by retries**: Retries incur additional costs. Limits on both attempt count and budget must be set together.
- **Using a framework solves orchestration**: Frameworks provide state management and retry structures, but they do not determine what to delegate; the designer decides this. Anthropic actually warns that abstraction layers can obscure prompts.

## Conclusion

By mapping how each framework handles the five key aspects (who delegates, parallel/sequential execution, state, failure handling, and cost), it became clear that despite different names, the questions are identical. Before adding another model, it seems correct to first consider whether the work can be fixed in code.

[Read more → Agent Design Patterns](#/post/app-agent-design) · [Read more → Agents and Agent Loops](#/post/ai-agent-loop) · [Read more → AI Service Cost Structure](#/post/app-cost)

← [Map for Building LLM Apps](#/post/app-map)

Related posts: [Subagents and Multi-agents](#/post/ai-subagent) · [Tool Use](#/post/ai-tool-use) · [Context](#/post/ai-context)

## Reference Links

- Anthropic, Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system
- Claude Agent SDK documentation, Subagents: https://code.claude.com/docs/en/agent-sdk/subagents
- OpenAI Agents SDK documentation, Agent orchestration: https://openai.github.io/openai-agents-python/multi_agent/
- LangGraph documentation, Graph API: https://docs.langchain.com/oss/python/langgraph/graph-api