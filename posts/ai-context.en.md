Context is the entire text a model can see at once when generating an answer; it's not that more is always better—what you include determines quality and cost.

## What is Context?

A context window is the full text available for reference when the model generates an answer. Anthropic documents refer to this as the model's "working memory." This is distinct from the vast data used during training. Training data is already embedded within the model, whereas context is what gets sent along with your current request.

What fits into this window is more than you might expect: system prompts, all prior conversation turns, tool definitions, results returned by tools, attached images and documents, and even the model's own response (including thought tokens) occupy space in the window. Your single line of input is just a small part of it.

Size is measured in tokens. Most recent Claude models have a 1M token context window, while some earlier generations support 200k. However, these numbers vary by model and change frequently, so it's best to consult a model comparison table when using them.

## Why Does Longer Become a Problem?

The cost aspect is straightforward. APIs resend the entire conversation history with every turn. If you have ten turns of dialogue, the eleventh request must re-input all ten preceding turns as input. Thus, as length increases, the number of input tokens per request grows, leading to higher costs and latency. While prompt caching can reduce unit prices, the documentation notes that cached portions still occupy space in the window—the money spent changes, not the allocated space.

The quality side is more confusing. One might assume a larger window allows for more information, but that's not necessarily true. Anthropic documents state: "More context does not automatically mean better results. As tokens increase, accuracy and recall degrade—a phenomenon called *context rot*." Supporting research includes two notable studies:

- Liu et al.'s "Lost in the Middle" (2023): Performance is best when relevant information appears at the beginning or end of the input, but drops significantly if placed in the middle. The study also reports a general performance decline as input length increases.
- Chroma's "Context Rot" (2025): Comparing 18 models, they found that performance degraded unevenly as input length increased—even on simple tasks like word repetition.

However, both studies were conducted under specific experimental conditions. Metrics may shift with new model releases, and Chroma itself admits the underlying cause of "context rot" remains uncertain. Therefore, rather than concluding "longer is always worse," it's more accurate to say "longer can lead to instability."

Anthropic engineering articles explain this using the concept of an "attention budget"—a metaphor suggesting that each additional token slightly depletes a limited budget. This is illustrative but not proof of internal architecture.

## What is Context Engineering?

In the same article, context engineering emerges as a "natural next step" after prompt engineering. It's defined as strategies to select and maintain the most appropriate set of tokens for inference.

Here's how I understand the distinction:

| | Prompt Engineering | Context Engineering |
|---|---|---|
| Focus | How to phrase instructions | What should be in front of this model right now |
| Timing | One-time setup | Ongoing, per turn, within a loop |
| Scope | Sentences | Instructions, conversation history, tools, search results, notes, and everything else |

For a single chat session, crafting a good prompt is usually sufficient. However, when the model acts as an agent—calling tools and iterating through loops—new results accumulate each turn, making it essential to decide what to retain and what to discard. This distinction likely explains why a separate term emerged.

## Examples: Practical Applications

Anthropic suggests several approaches:

- **Compaction**: When the window is nearly full, summarize the conversation and continue with a fresh window, retaining key decisions and unresolved bugs while discarding redundant tool outputs.
- **External Memory**: Have the agent write notes (e.g., in `NOTES.md`) or maintain a to-do list outside the window, retrieving them as needed.
- **Sub-agents**: Delegate narrow tasks to sub-agents equipped with clean context windows, receiving only summarized results (typically around 1,000–2,000 tokens).
- **Just-in-Time Loading**: Instead of loading all files upfront, store identifiers like paths and retrieve them via tools when needed. This keeps the window lightweight at the cost of slower access. The article recommends a hybrid approach: pre-load for `CLAUDE.md`, load on-demand for others.

## Relationship with Harnesses

A harness refers to the code and environment that wrap around a model to manage loops—executing tool calls, feeding results back into the model, and trimming or summarizing logs. The earlier context engineering techniques (compaction, external memory, sub-agents) are ultimately implemented by the harness. Since a model can only see what's in its assigned window, the harness decides what fills that window. Thus, their relationship can be summarized as: "Context engineering is *what* you do; the harness is the *device* that does it."

Points to note: The Anthropic context engineering article mentioned above did not contain the word "harness." There is a separate link in the documentation titled "Effective harnesses for long-running agents," but the definition of harness used there reflects my own understanding.

## Common Misconceptions

- If the window is 1M, you can just put everything in: Being able to fit something in is different from using it well. The studies above illustrate this distinction.
- Context engineering replaces prompt engineering: It does not replace; it extends. Writing instructions remains necessary.
- Compression makes it safe: What's omitted in a summary doesn't come back. Deciding what to retain is the design itself.
- Caching eliminates window concerns: Caching reduces costs but does not reduce space usage.

<details>
<summary>Detailed explanation: How tokens accumulate</summary>

The flow of a single turn as described in the documentation is as follows. In the input stage, both the entire prior conversation and the current user message are included. The response generated in the output stage becomes the input for the next turn. When tools are used, tool requests and results accumulate in the same manner.

Thinking tokens are included within `max_tokens` and are billed as output tokens. Whether previous thinking blocks from earlier turns are retained varies by model. Latest models retain them by default (thus they are billed again as input and occupy space in the window), while some older models automatically discard them. Since the list of models continues to change, you must consult the model-specific table in the documentation when using them.

Some models have a "context-aware" feature that allows them to know their remaining token budget themselves; however, depending on the model, this may not be available, and instead, a task budget (beta) is used as documented.

</details>

## Reference Links

- Anthropic, Effective context engineering for AI agents: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Anthropic documentation, Context windows: https://platform.claude.com/docs/en/build-with-claude/context-windows
- Liu et al., Lost in the Middle: https://arxiv.org/abs/2307.03172
- Chroma, Context Rot: https://research.trychroma.com/context-rot