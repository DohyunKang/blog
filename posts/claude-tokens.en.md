Claude usage is often higher than my own writing because it includes conversation history and tool results that are resent with every request; the main way to save costs is to keep this context lightweight.

This article summarizes findings from three official Anthropic documents (Claude Code cost management, Claude Code prompt caching, and API prompt caching). I did not include how I personally use them, only what was documented.

## Where Do Tokens Go?

The Claude Code documentation explains it like this: the model does not remember anything between requests, so every time a message is sent, the system prompt, project context (such as CLAUDE.md), all previous messages and tool results, and the new message are sent in full. [Read more → Context](#/post/ai-context)

Two things stood out here:

- Every time a tool is used, an additional request is made, and that request includes the entire history up to that point.
- Even if you ask just one question in a session left open all day, the usage for the entire conversation in that session is counted. While caching lowers the per-unit cost, it is not zero.

Therefore, token costs are closer to "how large the current context is × how many requests were made" rather than "how many characters I wrote." This is the conclusion when combining the document contents. [Read more → Context Window](#/post/ai-context-window)

If we summarize why usage increases in long sessions according to the documents using a table, it looks like this:

| Cause | Document Explanation |
|---|---|
| Long context | The entire conversation is sent with every request |
| Cache miss | If you wait longer than the cache lifetime before returning, the first message reprocesses the entire context |
| Scheduled tasks or messages from other sessions | Even if a session is idle, if a new turn occurs, the entire context is sent |
| Sub-agents | Since each sends its own requests separately, they are added on top of the main conversation |
| Compression | `/compact` must also read the conversation to summarize, so a large context means a large request |

The image in the documents comes from discussions about caching rather than cost. There are limits to the number and size of images and PDFs that can be included in a request; if exceeded, Claude Code removes them starting with the oldest ones in batches. Removing them requires reprocessing from that message onward, making that turn slower and more expensive.

## Prompt Caching

Caching is a feature where if the beginning part (prefix) of a request matches a previous request exactly, that portion is read at a lower rate without being recalculated. According to the API documentation, the prefix order is `tools → system → messages`, and the match must be 100% identical for both text and images. The output remains the same whether caching is used or not.

The per-unit cost varies by model, but based on the document table, the outline is as follows:

| Item | Compared to Basic Input |
|---|---|
| Cache read | 0.1x basic rate. For Opus 5.5 and Sonnet 5.5, it is 0.05x; for Fable 5.1 and Mythos 5.1, it is 0.025x; Haiku 5.5 has a fixed rate listed separately in the model table |
| 5-minute cache write | 1.25x |
| 1-hour cache write | 2x |

The document states that this multiplier applies cumulatively with other discounts like batch discounts. The 5-minute cache lifetime is extended for free each time it is used. Therefore, while working continuously, you read at a lower cost, but if you leave the seat for more than 5 minutes, you will have to pay again. According to the Claude Code documentation, subscription plans include usage with a 1-hour TTL for the main conversation, while API keys or cloud providers default to 5 minutes.

Claude Code handles this automatically, and my job is to know what actions break the cache. Here are the items pointed out by the document:

- Changing models via `/model`: Since each model has its own cache, the next request reads the entire context without caching.
- Changing effort level: This applies to most models. Opus 5.5, Sonnet 5.5, Haiku 5.5, and Fable 5.1 are noted as maintaining cache when used with API keys or subscriptions (with exceptions for some environments like Bedrock). Since the model list changes frequently, it is best to check the document again before using them.
- Connecting/removing MCP servers or denying tools entirely: Since tool definitions reside in the system layer, changing them breaks the cache. However, for models where tool search is enabled by default, tools are loaded lazily, so there is no impact.
- Compression: This changes the conversation layer. However, the system prompt and project context may remain in the cache.

Conversely, actions that preserve the cache also exist. File modifications, permission mode switches, skill calls, `/recap`, and `/rewind` append to the end of the conversation or return to a previously cached portion, so the cache is maintained. Modifying CLAUDE.md during a session does not break the cache, but changes are not reflected until the next `/clear`, `/compact`, or restart when reading.

One tip from the document: Set the model and effort level at the very beginning of the session, and use `/compact` for natural breaks between tasks.

## Using Models Separately

Cost documents suggest that Sonnet handles most coding tasks well while being cheaper than Opus, whereas Opus should be reserved for complex design decisions or multi-step reasoning. For simple sub-agent tasks, the document recommends specifying `model: haiku`. A common cause of "unexpectedly high spending" cited in the document is leaving sessions idle for too long and using Opus as the default model. [Read more → Model map](#/post/ai-models)

Be careful about points that contradict earlier sections. Changing models invalidates the cache, so it is less harmful to the cache to assign a specific model to sub-agents and divide work rather than switching back and forth mid-task. The document states that sub-agents have their own conversations and caches, which do not affect the parent's cache.

Thinking tokens also exist. Extended thinking is enabled by default and billed as output tokens, with a per-request budget potentially reaching tens of thousands of tokens. For simple tasks, you can lower the effort level using `/effort` or disable it via `/config`. However, the document notes that this cannot be disabled for certain models (Opus 5.5, Sonnet 5.5, Haiku 5.5, and the Fable family).

## Clearing, Compressing, and Splitting Sessions

- `/clear`: Use this when moving on to unrelated tasks. The document states that stale context wastes tokens in all subsequent messages. The cost is zero. To return later, use `/rename` before clearing and then `/resume`.
- `/compact`: Summarizes the conversation to reduce context. You can instruct what to keep, such as `Focus on code samples and API usage`, or add a "Compact instructions" section to CLAUDE.md. Note that compression itself is a large request. When the cache is warm (mid-task), reading from the beginning of the cache is cheaper; compressing an old session after a long break is the most expensive because there is no cache.
- `/rewind` (or press Esc twice): Undoes a wrong turn by cutting back to previously cached content, which the document says is more favorable to the cache than compression.
- **Plan mode** (Shift+Tab): Introduced as a method to get approval on direction before implementation to reduce wasted effort.

The document also advises writing requests specifically. Asking "Improve this codebase" invites broad exploration, whereas "Add input validation to the login function in auth.ts" involves reading fewer files. Providing tests or expected outputs is said to reduce back-and-forth loops by allowing the model to self-verify and fix issues.

## Reducing Large Files and Logs

The document cites a 10,000-line log file as an example. Instead of having Claude read it entirely, a hook that selects only `ERROR` lines can reduce context from hundreds of thousands of tokens to just hundreds. The document provides an example script using the PreToolUse hook to modify commands so that outputs from failed `npm test`, `pytest`, or `go test` are retained.

Another approach is using sub-agents. Tasks with large outputs, such as running tests, fetching documentation, or processing logs, can be delegated to sub-agents; the messy output remains in their context while only summaries return to the main session. However, requests from sub-agents also count against your usage. Therefore, the benefit of isolation is that "the main context becomes clean," not that it is "free." Specifying a smaller model reduces this burden. [Read more → Harness](#/post/ai-harness)

<details>
<summary>Detailed explanation: Agent team costs in the document</summary>

Agent teams have separate Claude Code instances and contexts for each member. The document states that when a team member is running in plan mode, they use approximately 7 times more tokens than a standard session. Ways to reduce this include using Sonnet for team members, keeping the team small, making the start prompt short, and having finished team members exit. Agent teams are off by default and must be enabled via environment variables. I have not tried using them directly.

</details>

## CLAUDE.md and MCP

CLAUDE.md is uploaded to context at session start; therefore, if specific task procedures (like PR reviews or database migrations) are written in detail there, those tokens are carried along even when doing unrelated work. The document offers two recommendations: keep CLAUDE.md to essentials under 200 lines and move task-specific instructions to skills. Skills are loaded only when called. Skills are also introduced as a way for Claude to save tokens by not having to read multiple files to understand the project structure. [Read more → Skills & Settings](#/post/claude-skills)

MCP loads tool definitions lazily by default, so only tool names and server instructions enter the context, with definitions fetched when actually used. Nevertheless, the document recommends two things:

- CLI tools like `gh`, `aws`, `gcloud`, and `sentry-cli` are more context-efficient than MCP because they do not add a list of tools per category.
- Turn off servers configured via `/mcp` that are not being used. Check what is occupying your context using `/context`.

Turning it off is also a change in tool definition, so as mentioned above, the cache breaks in environments where tool search is disabled. [Read more → MCP](#/post/ai-mcp)

## Common Misconceptions

- Using caching makes long sessions okay: While unit costs decrease, context size remains unchanged; if you wait 5 minutes or over an hour, the first message processes everything again.
- Compression always means cheaper: Compression itself can become a large request. Documents from older sessions that have rested are reportedly especially expensive.
- Frequently switching models saves money: Actually, not switching frequently saves more. The cache breaks every time you switch. Model sharing is better done at session start or in sub-agents. This conclusion combines insights from two documents (cost management and prompt caching).
- Sub-agents don't consume tokens: Context is separated, but requests still count against your usage.

<details>
<summary>Detailed explanation: How to check usage and average figures</summary>

`/usage` shows token usage per session, and for subscription plans, it also displays usage proportions by skill, sub-agent, plugin, and MCP server, along with recommendations on how to reduce them. Cost numbers are not for billing purposes for subscribers. Recent versions include a `Prompt cache (main)` row showing cache hit rate, miss count, and whether the cache is "warm." You can also continuously display context usage in the status bar.

Based on enterprise deployment standards, the average cost is approximately $13 per active day per developer, or $150–$250 per month, with 90% of cases staying under $30 per day, as documented. These are team-level figures and do not directly apply to individual subscriptions.

</details>

## Reference Links

- Claude Code, Manage costs effectively: https://code.claude.com/docs/en/costs
- Claude Code, How Claude Code uses prompt caching: https://code.claude.com/docs/en/prompt-caching
- Anthropic API documentation, Prompt caching (scaling, TTL, minimum length, rechecked on 2026-11-02): https://platform.claude.com/docs/en/build-with-claude/prompt-caching

← Back to concept map (#/post/ai-map)

Related articles: [Context and Context Engineering](#/post/ai-context) · [Best practices for Claude skills and settings](#/post/claude-skills) · [MCP](#/post/ai-mcp)