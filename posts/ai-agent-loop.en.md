An agent is a structure that repeats the cycle of using tools, observing results, and deciding what to do next until it reaches a conclusion. The name sounds grand, but its backbone is simply a `while` loop.

## What is an Agent?

Anthropic's article "Building effective agents" distinguishes between the two as follows: A workflow is a system where an LLM and tools are woven together via "pre-defined code paths," whereas an agent is a system where an LLM "directs its own task process and tool usage." The same article states that when actually implementing an agent, it generally amounts to "an LLM using tools in a loop while receiving feedback from the environment."

Simply put, if the next step is hardcoded, it's a workflow; if the model decides the next step, it's an agent. Rather than seeing a sharp line dividing the two, I read this as a matter of degree regarding how much autonomy is delegated to the model. Details on what tools are can be found separately in [Tool Invocation →](#/post/ai-tool-use).

| | Workflow | Agent |
|---|---|---|
| Who decides the next step | Code | Model |
| Number of steps | Known in advance | Must run to know |
| Predictability | High | Low |
| Cost & Latency | Lower and stable | Higher and erratic |

## How the Loop Works

The basic structure described in Anthropic's documentation (How tool use works) is as follows. When tools are executed by your code, your application must run the loop because the model cannot execute code directly.

1. Send a request containing the list of available tools and the user message.
2. The model returns a tool invocation request (`tool_use` block) along with `stop_reason: "tool_use"`.
3. Your code executes that tool and creates the result as `tool_result`.
4. Combine the conversation history, the model's response, and the result to send another request.
5. Repeat from step 2 while `stop_reason` is `"tool_use"`.

The loop exits when one of `end_turn`, `max_tokens`, `stop_sequence`, or `refusal` is returned. This indicates that the model has provided a final answer or stopped for another reason. In Anthropic's documentation, it is expressed that the model "only emits structured requests," while execution is performed by your code (or the Anthropic server).

This approach is also referred to as Observe, Think, Act. Tool results are "Observe," deciding what to do next based on them is "Think," and invoking tools is "Act." The name of this method is ReAct (Yao et al., 2022). Based on the paper abstract, it is a prompting method that alternates between reasoning and acting, reporting reduced hallucinations and error propagation compared to using chain-of-thought alone in HotpotQA and FEVER. To add one more data point, it states that success rates were higher by absolute values of 34%p and 10%p respectively in ALFWorld and WebShop compared to imitation learning or reinforcement learning methods. However, these are experimental conditions from a 2022 paper and do not necessarily match current models directly.

## Minimal Loop Run Directly

I replaced model calls with rule functions to check only the structure. Since it is not an actual model, I could not observe judgment capabilities, focusing instead on the loop shape and termination.

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

Upon execution, `run("2+3?")` ended at the second step with "The answer is 5." In cases where the model was modified to call tools continuously (`max_steps=3`), it stopped at step 3 with "Maximum steps reached." Without this upper limit, the same code would not terminate.

## When Does It End?

Termination occurs in two ways:

- The model judges that it is "done" and provides an answer without tool invocation (`end_turn`).
- It is interrupted from the outside, such as by a maximum iteration count, token/time budget, or human confirmation.

Anthropic's article also cites termination conditions like maximum iteration counts as methods to maintain control. It mentions that agents may proceed with human confirmation at points where they get stuck or are critical. My understanding of the key point is that relying solely on the front end cannot prevent the model from mistakenly thinking it is "done," so a separate mechanism to interrupt from the outside is necessary.

In cases where the server executes tools on behalf of the agent (such as `web_search`), the loop runs within the server, and if the iteration limit is reached, it returns to `pause_turn`. The documentation states that since the work is not finished, the conversation should be sent back as is to continue.

## Planning and Context

As loops become longer, two issues arise. One is planning. There are approaches where plans are set once and followed, versus approaches where plans are reviewed and re-decided at each step. The aforementioned article states that agents "plan and operate independently," and must judge progress by obtaining "ground truth" (tool results, code execution results) from the environment at each step. I interpret this as "trusting actual run results rather than mental plans."

Another aspect is context. Since tool results accumulate at each step, the window gradually fills up. This mirrors the issues discussed in [Details → Context](#/post/ai-context) and [Details → Compaction](#/post/ai-compaction). To handle long tasks, Harness must manage this from outside the loop. Harness is documented in [Details → Harness](#/post/ai-harness).

## Failure Modes

I separate what I've verified from what I've inferred.

**Verified**
- Errors accumulate: Anthropic's text states that "autonomy implies higher costs and a greater likelihood of accumulating errors." If there is a small probability of failure at each step, the overall success rate decreases as the number of steps increases.
- Cost and Latency: Agent systems often incur latency and cost in exchange for better performance.
- Recommendation: Test thoroughly in a sandbox and implement appropriate guardrails. This connects to [Details → Guardrails](#/post/app-guardrails).

**Inferred**
- Spinning wheels by repeatedly calling the same tool with the same arguments.
- Repeating the same mistake despite seeing tool error messages.
- Forgetting the goal midway or having the goal subtly shift.

These three points are based on structural reasoning rather than direct reproduction, as I haven't reproduced them myself yet. If true, solutions would likely involve retry limits, detecting repeated calls, and returning errors in a model-friendly format; however, these are not verified prescriptions either.

## When Workflows Suffice

The most strongly emphasized point is to "start with the simplest solution and increase complexity only when necessary." It is often sufficient with a single LLM call augmented with search and examples. The criteria were roughly interpreted as follows:

| Situation | Appropriate Approach |
|---|---|
| Steps are defined and prediction is important | Workflow |
| Open-ended problems where the number of steps is unknown | Agent |
| Environments where model judgment can be trusted | Agent |

The text lists five representative workflow patterns: prompt chaining, routing, parallelization, orchestrator-worker, and evaluator-optimizer. Discussions on dividing into multiple agents continue in [Details → Subagents](#/post/ai-subagent). Considerations for actually designing agent apps are found in [Details → Agent Design](#/post/app-agent-design).

## Common Misconceptions

- Agents use a separate, special model: No. They use the same LLM within a loop alongside tools. However, models trained to use tools effectively tend to perform better (Anthropic's documentation mentions `trained-in` tool schemas).
- Agents are always superior to workflows: Due to cost, latency, and error accumulation, workflows are preferable for narrow, well-defined tasks.
- Running a loop means the model finishes automatically: It is safer to set termination conditions externally as well.
- The model executes tools: The model only sends requests; execution is performed by your code or server.

<details>
<summary>Detailed explanation: Handling by stop_reason</summary>

I list only what was read from the documentation.

- `tool_use`: Execute a tool and continue with the result. Multiple tool calls may occur (parallel calls).
- `end_turn`: Final answer; ends the loop.
- `max_tokens`: Answer was truncated. This is not the final answer, so your app must handle it.
- `stop_sequence`, `refusal`: Stopped for other reasons; similarly, the app must handle these.
- `pause_turn`: The server-side loop hit a repetition limit. Resend including the response to continue.

</details>

## Reference Links

- Anthropic, Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Anthropic documentation, How tool use works: https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works
- Yao et al., ReAct: Synergizing Reasoning and Acting in Language Models (read abstract only): https://arxiv.org/abs/2210.03629

← [Concept Map](#/post/ai-map)

Related posts: [Tool Use](#/post/ai-tool-use) · [Subagents and Multi-agents](#/post/ai-subagent) · [Harness](#/post/ai-harness)