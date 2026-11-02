A harness refers to the code and environment that remains after removing the model—essentially, the loop that runs the model, connects tools, and manages records. However, since there is no single standardized definition, the scope varies slightly across sources.

## In Simple Terms First

Alone, a model can only accept text and return text. It cannot open files or execute commands; those tasks are handled by programs running alongside it. When the model says "read this file," the program reads it and feeds the result back to the model. This cycle repeats until completion. That program is the harness.

Literally meaning "horse tack"—equipment attached to a horse—the metaphor I use is: the horse (the model) retains its power, but the harness determines where and how it runs. This analogy is my own creation.

## How It's Used in Official Writings

I reviewed three Anthropic articles, each using the term slightly differently.

- **Managed Agents** article: Briefly defines "harness" in parentheses as "the loop that invokes Claude and routes Claude's tool calls to the appropriate infrastructure." The article divides an agent into three parts: brain (Claude and harness), hands (sandbox and tools), and session (event logs remaining outside).
- **Effective harnesses for long-running agents**: Offers no formal definition but refers to the Claude Agent SDK as a "general-purpose agent harness." It groups tools, context management (including compression), and surrounding setup under the term "harness." A footnote notes that while initialization and coding agents differ only in their startup prompts, they share the same system prompt and tools within the harness.
- **Harness design for long-term app development**: Encompasses orchestration around the model, role assignment, context processing, and prompt handling collectively as "harness," treating "harness design" as a single task.

Though using the same word, the first article focuses only on "loops and routing," while the latter two extend the scope to include "the entire surrounding design." This illustrates how definitions vary by source. I interpret the narrow meaning as the core concept and the broad meaning as what is actually implemented in practice.

For comparison, I also reviewed Anthropic's *Building effective agents* article, which describes an agent as "an LLM that uses tools while receiving feedback from its environment, running in a loop." However, this article does not use the term "harness," suggesting the terminology emerged later.

## What a Harness Does

Summarizing overlapping functions across the three articles:

| Task | Description |
|---|---|
| Loop | Repeats model invocation, tool execution, and result feedback until completion, including stop conditions like maximum iteration count. |
| Tools | Determines which tools to provide and how to describe them. Anthropic refers to this as the agent-computer interface (ACI), comparing it to a UI designed for humans. |
| Permissions | Defines what can be executed and where credentials are stored. The *Managed Agents* article places authentication information outside the sandbox. |
| Context | Involves truncating and summarizing logs, and writing notes to external files. |
| Verification | Does not trust the model's claim of completion; instead, confirms via testing. |
| Recovery | Ensures continuity even if a session or container dies. |

Permissions were specifically detailed only in the *Managed Agents* article among the three. Other permission approval methods likely vary by product.

## Relationship with Context Engineering and Agent Loops

The three terms form a single line:

- **Agent loop**: The action itself as it runs—repetition of model invocation, tool execution, and result feedback.
- **Harness**: The code and environment that actually execute the loop.
- **Context engineering**: Deciding what to present before the model's eyes on each turn of the loop; one of the harness's responsibilities.

Techniques such as compression, notes, and sub-agents introduced in [Details → Context Engineering](#/post/ai-context) are ultimately implemented within harness code. While a harness handles more than just context—also including tools, permissions, verification, and recovery—it is broader in scope. However, some articles treat context management as part of the harness, while others separate it; boundaries depend on the author.

For input received by the model itself, refer to [Details → Context Window](#/post/ai-context-window) and [Details → LLM](#/post/ai-llm). Tool connection specifications are covered separately in [Details → MCP](#/post/ai-mcp).

## Example: Harness in Long-Running Tasks

The example from the *Effective harnesses* article was particularly concrete. When a session changes, the model cannot recall prior tasks. Therefore, two approaches were taken:

The first session is for initialization: it expands user requests into a list of features in JSON format, launches the development server via `init.sh`, creates a progress log file, and makes the initial git commit. Subsequent sessions implement one feature at a time, commit, and record progress. New sessions read the git log and records upon startup, verify basic behavior first, then proceed with work.

Each item in the feature list starts in a failed state, and the coding agent can only modify the pass/fail field. The text explains that JSON was used because it is less likely for the model to recklessly alter or overwrite compared to Markdown. Additionally, issues previously resolved with unit tests or curl alone have significantly improved by automating browser interactions to test like a human.

Looking at it, the model remains unchanged; only the outer structure has been modified to reduce failures (such as attempting too much or prematurely declaring completion). This is what "harness engineering" refers to.

## Harness Engineering

The work of designing and fixing harnesses is called harness engineering. This term seems to have become widely used following an article by OpenAI in February 2026 titled "Harness engineering: leveraging Codex in an agent-first world." Based on search result excerpts, the initial slow progress was due to an underdeveloped environment rather than the model itself; consequently, the team's focus shifted toward building an environment usable by agents. Secondary sources summarize this as designing constraints, tools, feedback loops, documentation, and verification systems.

Anthropic articles share a similar sentiment. All components of a harness embody the assumption that "the model cannot do it alone," and as the model improves, these assumptions become outdated. For example, context resets that were helpful in Sonnet 4.5 are no longer necessary in Opus 4.5. Thus, a harness is not a one-and-done product; rather, components must be pruned each time the model changes.

## Common Misconceptions

- Harness is a framework name: It does not refer to a specific library. Whether using LangChain or writing your own loop, iterating outside the model constitutes a harness.
- If a harness is good, the model doesn't matter: The same texts argue the opposite. As the model improves, the harness becomes simpler. However, this does not mean the need for harnesses in complex tasks disappears entirely; there was also a note that the space of interesting combinations does not shrink.
- Harness is a prompt: A prompt is only part of a harness. Tool execution, record keeping, and verification code are separate.
- The definition is fixed: As seen above, it is used both narrowly and broadly. It is advisable to check the scope before reading an article.

<details>
<summary>Detailed explanation: Separation of brain, hand, and session</summary>

In the Managed Agents article, a harness does not reside inside a container. A harness invokes sandboxes and tools via a single interface: `execute(name, input) → string`. If a container dies, the harness treats it as a tool call error, returns it to Claude, and allows Claude to create a new container. Sessions are additional dedicated event logs remaining outside the harness and sandbox; even if the harness dies, one can restart from the last event. Credentials are also kept outside the sandbox.

The reason for placing the harness behind hosting services is understood to be that harness implementation may change with model updates. While the text does not explicitly state this directly, it is inferred from summaries rather than making a definitive claim.

</details>

<details>
<Detailed explanation: Planning, Generation, and Evaluation roles>

The structure of long-term app development articles consists of three roles. The planner expands short requests into product specifications without over-specifying technical details, aiming to prevent early errors from propagating downward. The generator implements features one by one. The evaluator simulates a user by clicking through the running app with Playwright, scoring based on criteria and thresholds, and logging bugs. Before each sprint, the generator and evaluator agree on testable contracts.

A simplified version removes the sprint structure and runs the evaluator only once at the end. It is stated that the evaluator provides value only for tasks beyond the range where the model can operate stably alone. Costs related to orchestration complexity, tokens, and latency are also mentioned in the text.

</details>

## Reference Links

- Anthropic, Effective harnesses for long-running agents: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Anthropic, Managed Agents (Brain·Hand·Session): https://anthropic.com/engineering/managed-agents
- Anthropic, Harness design for long-running application development: https://www.anthropic.com/engineering/harness-design-long-running-apps
- Anthropic, Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- (Unable to read original text, excerpt from search) OpenAI, Harness engineering: https://openai.com/index/harness-engineering/

← [Concept map](#/post/ai-map)

Related posts: [Context Engineering](#/post/ai-context) · [MCP](#/post/ai-mcp) · [Context Window](#/post/ai-context-window)