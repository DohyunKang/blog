Compaction is the process of replacing past turns in the conversation window with summaries, while memory involves writing information outside the window so it can be retrieved later even if omitted from the summary. Rather than competing, these two approaches work together closely.

## What is Compaction?

Models have a fixed capacity for how much they can see at once; this limit is defined by the [context window](#/post/ai-context-window). However, since models cannot retain state, every request must resend the entire conversation history so far ([see details → sessions and conversation history](#/post/ai-session)). As conversations grow longer, the amount of data to send increases, eventually filling up the window.

Compaction (compaction) is the method of replacing old turns with a single summary to free up space in the window. Anthropic documents describe compaction as "replacing old turns with summaries written by Claude on the server," emphasizing that there's no need to write summary code manually. The rationale is also explained: as conversations lengthen, response quality degrades, so it's essential to keep the active context small. Why quality drops is detailed in the [context article](#/post/ai-context).

In simple terms, it's similar to taking meeting minutes. Since you can't reread a three-hour meeting from start to finish, you write down only the key decisions on a single page and continue the meeting based on that summary.

## How Compaction Works

Anthropic documents outline three approaches:

| | Who determines the timing? | Characteristics |
|---|---|---|
| On-demand compaction | My app sends the request | Receives summary blocks to prepend to `messages`. Recent turns can remain in original form, and background processing is possible. |
| Token threshold compaction | API triggers when input tokens reach a set limit | Requires adding just one parameter to standard requests; summarization occurs within that request. |
| Custom summarizer | My code | I handle summary invocation, prompts, and rewriting history entirely myself. |

The documents recommend using on-demand compaction whenever possible. Both methods are marked as beta in the documentation. On-demand compaction uses the beta header `compact-2026-09-04` and the top-level `compaction` parameter. These identifiers may change, so always refer back to the documentation when implementing. There's also an option to write your own summary prompt, suggested for cases where default summaries omit necessary details later on.

## What to Keep in Summaries

Effective compaction isn't about writing shorter summaries—it's about selecting what to retain. Anthropic engineering notes state:

- **Keep**: Design decisions, unresolved bugs, implementation specifics. Claude Code also includes the five most recently opened files.
- **Discard**: Redundant tool outputs and messages. Original results from tools called long ago are rarely needed again.
- **Tuning order**: First maximize recall to avoid missing anything, then remove unnecessary content to improve precision.

The article mentions "tool result clearing" as the lightest form of compaction—removing old tool outputs based on rules without summarizing. The documentation treats this separately under a feature called [context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing), distinguishing it from compaction. This specific feature was not explored in this post.

## Memory: Writing Outside the Window

Once something is removed via compaction, it cannot be recovered. Therefore, critical information should be written outside the window entirely. Anthropic refers to this as structured note-taking (agent-style memory). Agents periodically write notes to external memory and retrieve them later when needed. Examples include Claude Code's todo lists, custom agent NOTES.md files, and cases where Claude continues training and strategy memory even after context resets while playing Pokémon.

Anthropic provides a memory tool that operates on a file-based system. The structure observed in the documentation is as follows:

- Claude creates, reads, modifies, and deletes files in the `/memories` directory. Commands include `view`, `create`, `str_replace`, `insert`, `delete`, and `rename`.
- As a client-side tool, Claude only makes requests; actual file handling is performed by my app. Storage location (disk, database, etc.) and retention policies are determined by me.
- When a memory tool exists, the API automatically injects instructions into the system prompt such as "check the memory directory before acting" and "assume context can reset at any time."
- Validation to prevent path traversal attacks (e.g., `../`) must be implemented directly by me, as warned in the documentation.

Memory documents are recommended to be used alongside Compaction. This division of labor involves Compaction keeping the active context small without client-side management, while Memory preserves information that must remain even after summarization.

This approach may seem similar to [RAG](#/post/ai-rag), but the underlying logic differs. RAG retrieves relevant chunks from external documents and injects them via [embedding](#/post/ai-embedding) search, whereas the memory described here refers to an agent writing down its own work for later reference. While it is possible to implement memory by storing it in a search database, the document we just read only confirmed the file-based approach.

## Trade-offs

| | Compaction | Memory (Notes) |
|---|---|---|
| Best suited for | Conversational tasks with frequent exchanges | Iterative development with milestones |
| Benefits | Maintains conversational flow | Persists long-term with minimal overhead |
| Risks | Overly aggressive summarization may lose subtle but important context | Requires management of what to write and how to organize outdated notes |

The engineering article itself does not separately list the disadvantages of the note-based approach.

For long-running tasks, these methods are often combined. One strategy is assigning narrow tasks to sub-agents and receiving only summaries ([see → Sub-agent](#/post/ai-subagent)). The loop involves iterating through this process, with [Harness](#/post/ai-harness) handling the actual execution of compaction points and reading/writing memory.

## Common Misconceptions

- **Compaction leaves the original somewhere:** After replacing content with summaries, you can delete the original text from your own records; the model will then see only the summary. Whether to store the original separately is determined by the application.
- **Memory is automatically accumulated by the model:** Memory tools require client-side implementation to function. Without a storage backend, there is no memory.
- **Large context eliminates the need for compaction:** Even with a larger window, issues related to quality and cost persist. [Prompt caching](#/post/ai-prompt-caching) reduces costs but does not free up space (see [Context article](#/post/ai-context)).
- **Compaction and context editing are the same thing:** The former involves summarization, while the latter uses rules to delete specific tool outputs or thought blocks.

<details>
<summary>Detailed explanation: Compaction flow on request</summary>

Based on the order of reading from the document's table of contents, the process is as follows: ① Request a summary ② Place the received summary block at the beginning of `messages` and replace the summarized message ③ Subsequent requests continue from that block. If the conversation becomes long again, you can summarize the dialogue starting from the compaction block once more ("compact again").

There is also an option to retain recent turns in their original form. In this approach, summarization handles only older parts, while the last few turns remain unchanged. Background compaction runs summary requests separately without stopping the conversation and inserts the block upon completion. When re-sending a thinking block, there are specific compatibility conditions with preserved thoughts.

The individual sub-pages (keep-recent-turns, background, thinking-blocks) were not opened this time; only the descriptions on the overview page were read.

</details>

← [Concept map](#/post/ai-map)

Related articles: [Sessions and conversation history](#/post/ai-session) · [Context and context engineering](#/post/ai-context) · [Harness](#/post/ai-harness)

## Reference Links

- Anthropic documentation, Compaction overview: https://platform.claude.com/docs/en/build-with-claude/compaction
- Anthropic, Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic documentation, Memory tool: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool