Sub-agents are structured so that the main agent delegates certain tasks to run in a separate context and receives only a summary of the results. This approach is beneficial only when work can be split in parallel and the summarized results are sufficient.

## In Simple Terms First

When a single agent works alone, all read files, search results, and logs accumulate in its own conversation history. The [context](#/post/ai-context) quickly becomes heavy. That's why the approach emerged: "Let another agent investigate this part and just tell me the conclusion." The agent receiving the task is called a sub-agent, and the entire structure where multiple agents collaborate is referred to as multi-agent systems. To use an analogy with human teams, it's similar to a team leader assigning research tasks to team members and receiving only one report. However, this is just an analogy; in reality, it involves one additional model call.

If an [agent loop](#/post/ai-agent-loop) refers to a structure that calls tools to iterate, sub-agents are often used like "tools that start another loop within that loop." Tool calling itself is documented separately in the [tool use](#/post/ai-tool-use) post.

## Principle: Splitting Context

The sub-agents described in the Claude Code documentation work as follows:

- Each has its own context window, system prompt, tool permissions, and permission settings.
- They cannot see the history of the main conversation. The main agent passes over only a delegated message summarizing the work done.
- Upon completion, only the final result returns to the main agent. Intermediate content such as read files or search results does not enter the main context.
- Usage limits are shared with the main conversation; there is no free allowance separate from it.

The core lies in the last two points: messy intermediate processes end within the sub-agent's window, and the main agent receives only conclusions. Thus, the [context window](#/post/ai-context-window) fills up less. This shares the same purpose as [compaction](#/post/ai-compaction) but differs in method. Compaction reduces what has already accumulated, whereas sub-agents prevent accumulation in the main context from the start.

The Anthropic context engineering post also notes that sub-agent results are received as summaries of about 1,000–2,000 tokens, which aligns with this perspective. This figure was read from a previous post.

## Parallelization and Orchestrator-Worker

Anthropic's "Building effective agents" distinguishes two seemingly similar patterns:

| | Parallelization | Orchestrator-Worker |
|---|---|---|
| Who divides the work | Code pre-defines it | Central model decides based on input at runtime |
| Sub-tasks | Pre-defined (e.g., splitting sections, repeating same tasks with voting) | Hard to predict in advance |
| Suitable tasks | Independent fragments, speed-focused | Tasks like fixing multiple files in coding |

The sub-agent structure mostly fits the right side. An orchestrator (lead) breaks down work and assigns it to workers (sub-agents). Running workers simultaneously also yields parallelization benefits.

Specific metrics appear in Anthropic's multi-agent research system paper. The lead agent was configured with Claude Opus 4, while sub-agents used Claude Sonnet 4. In the same internal research evaluation, this setup outperformed standalone Opus 4 by 90.2%. The gains were particularly significant for questions requiring broad exploration (breadth-first). By having the lead spawn 3–5 sub-agents simultaneously and each sub-agent call 3+ tools concurrently, investigation time for complex queries was reduced by up to 90%. Both evaluations are internal to Anthropic, so I have not reproduced them.

## Cost: This Was Most Important

The token counts from the same paper are as follows:

| Structure | Tokens vs Chat |
|---|---|
| Agent | ~4x |
| Multi-agent | ~15x |

In the BrowseComp evaluation, it was stated that token usage alone explained 80% of performance differences. Including tool call count and model selection brings this to 95%. Reading this in reverse suggests that a large part of why multi-agents improve may simply be "because they use more tokens." The improvement might not stem from the structure being smarter, but from reading more and trying more. This is speculation I made while reading, not the paper's conclusion. The paper also notes that the value of work must justify the increased token costs.

From an [AI cost](#/post/app-cost) perspective, this is summarized as follows: spawning an additional sub-agent means all its input and output tokens become a charge. Savings come from reducing the main context size, not from writing less overall. This point was also highlighted in the [token-saving tips](#/post/claude-tokens) post. However, since different models can be assigned to each sub-agent (per Claude Code documentation, the `model` field supports sonnet, opus, haiku, fable, full model IDs, or inherit), savings are possible by assigning smaller models to simple research tasks.

## When Not to Use It

When Anthropic's approach isn't suitable, I'll write directly about it. Not all agents require the same context or have heavy interdependencies. Coding has fewer parts that can be parallelized compared to research, and agents coordinating in real-time are still considered immature.

I've also read the opposing viewpoint. Cognition's "Don't Build Multi-Agents" outlines two principles:

- Share context: Use the entire agent trace rather than individual messages.
- Actions contain implicit decisions: Conflicting decisions lead to poor outcomes.

The example given is a Flappy Bird clone. One sub-agent creates a Super Mario-style background, while another designs a bird that doesn't fit the game. The final agent must reconcile these two. It's stated that even providing both with the original task description doesn't fully solve the problem, because real conversations involve multiple turns and tool calls change interpretations. Alternatives include a single-threaded agent (where context continues), a separate compression model to reduce history, and limited sub-agents. This article evaluates Claude Code's sub-agents as having fewer conflicts because they primarily answer clear questions and don't write code in parallel.

The two articles aren't saying the same thing. Anthropic argues that multi-agents are significantly better for suitable tasks (research), while Cognition advises caution for tasks involving writing and decision-making. I interpreted this as "divide reading and research, but keep writing and decisions in one place." This is my own summary after reading both articles.

The selection criteria outlined in the documents are also similar:

- Sub-agents: When you don't want long outputs in the main thread, when you want to limit tool permissions, when tasks are independent and can be summarized.
- Main conversation: When frequent back-and-forth refinement is needed, when multiple steps share significant context, for quick small edits, or when latency matters (sub-agents start empty, so time is needed to gather context).

## Challenges When Using Them

Poor delegation instructions lead to overlapping work. Anthropic's article cites such cases: one sub-agent investigates the 2021 automotive semiconductor crisis, while two others investigate the 2025 supply chain in exactly the same way. The conclusion is that you must clearly specify goals, output formats, source guidelines, and task boundaries for each sub-agent. This means the prompt passed to a sub-agent is effectively everything it knows, because sub-agents cannot see the main conversation.

Another issue is scaling. Early versions reportedly spawned 50 sub-agents even for simple questions. The solution was embedding rules directly into the prompt: simple fact-finding uses one agent with 3–10 tool calls; direct comparison uses 2–4 sub-agents with 10–15 calls each; complex investigations can use 10 or more.

## Common Misconceptions

- Using sub-agents reduces tokens: While the main context shrinks, total tokens often increase (e.g., a 15x multiplier).
- More agents mean smarter results: If tasks are interdependent, conflicts actually increase.
- Sub-agents know my conversation: General sub-agents do not. Forking inherits the parent conversation; the document states only that forks inherit the parent dialogue.
- Sub-agents nest infinitely: The default limit is three levels below the main agent, adjustable via environment variables. The default concurrency cap is 20 agents.

<details>
<summary>Detailed explanation: Claude Code sub-agent file structure</summary>

The sub-agents mentioned in the document are Markdown files with YAML frontmatter, where the body becomes the system prompt. The only required fields are `name` and `description`. Claude determines when to delegate based on the `description`. You can mention an agent by name or using `@`, or run the entire session with that agent via `claude --agent <name>`.

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices. Use proactively after code changes.
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

The example above is a direct copy from the document; I haven't executed it myself.

Tool restrictions are managed via `tools` (allowlist) and `disallowedTools` (blocklist). The blocklist applies first, and any tool listed in both is removed. Built-in sub-agents include Explore (read-only, code search), Plan (read-only, planning mode investigation), and general-purpose (all tools). If storage locations overlap, priority order is: Organization settings > `--agents` flag > project `.claude/agents/` > user `~/.claude/agents/` > plugins. The model is determined in this order: value specified at call time, file's `model`, environment variable `CLAUDE_CODE_SUBAGENT_MODEL`, and finally the main model.

A new instance is created for each sub-agent. To continue a task, specify the agent ID or name via `SendMessage` to resume. Resumed agents retain the full history. The document states that Explore and Plan are single-use and cannot be resumed.

From the [harness](#/post/ai-harness) perspective, spawning subagents, receiving their results, and adhering to limits is not the model's responsibility but rather a task for the code outside of it. This connection is my own interpretation.

</details>

← [Concept map](#/post/ai-map)

Related posts: [Agent loop](#/post/ai-agent-loop) · [Context and context engineering](#/post/ai-context) · [Prompt caching](#/post/ai-prompt-caching)

## Reference links

- Anthropic, How we built our multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system
- Claude Code documentation, Subagents: https://code.claude.com/docs/en/sub-agents
- Anthropic, Building effective agents: https://www.anthropic.com/engineering/building-effective-agents
- Cognition, Don't Build Multi-Agents: https://cognition.com/blog/dont-build-multi-agents