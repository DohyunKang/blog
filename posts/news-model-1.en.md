On October 7, Anthropic released Claude Haiku 5.5. Haiku is the smallest and fastest model in the Claude lineup, and the announcement introduces it as "the cheapest, fastest, and smartest small model ever released." Looking at the numbers one by one, the pricing stood out the most.

## What is this model for?

The uses highlighted in the announcement are tasks that require high volume but low cost per item, such as summarization, compaction, database queries, and classification. In coding agents, Opus 5.5 or Sonnet 5.5 make major decisions, while Haiku 5.5 works alongside them as a sub-agent. The announcement also mentions scenarios where response speed is critical, such as real-time customer support or browser manipulation.

The one-line description in the model overview document is similar: tasks that are high-volume and latency-sensitive, such as classification, extraction, and routing. Conversely, the announcement explicitly states that complex agent coding is better suited for Sonnet 5.5 or Opus 5.5.

There is a separate article organizing related concepts. Compaction is explained in [more detail → Compaction and Memory](#/post/ai-compaction), and sub-agents are covered in [more detail → Sub-agents and Multi-agent](#/post/ai-subagent).

## Specifications

These values are from the model overview document. Since the document can change, this is based on the version as of November 2, 2026.

| Item | Claude Haiku 5.5 |
|---|---|
| API Model ID | claude-haiku-5-5 |
| Context Window | 1M tokens |
| Max Output | 128K tokens |
| Knowledge Cutoff | June 2026 |
| Thinking | Adaptive |
| Default Effort | medium |
| Providers | Claude Platform, AWS, Google Cloud, Microsoft Azure |

The announcement notes that having effect adjustment levels is a first for Haiku. Based on the announcement, there are five levels: Low, Med, High, Xhigh, and Max. This means even small models can now determine "how long to think." For what thinking tokens are, see [more detail → Reasoning Models and Thinking Tokens](#/post/ai-reasoning), and for context window size discussions, see [more detail → Context Windows and Tokens](#/post/ai-context-window).

## Pricing

Here is the table from the announcement, converted to a per-million-token basis. Haiku 5.5 has different unit prices depending on whether the request length is under or over 100K tokens.

| Category | Haiku 5.5 (≤100K) | Haiku 5.5 (>100K) | Haiku 4.5 | Sonnet 5.5 |
|---|---|---|---|---|
| Input | $0.10 | $0.50 | $1.00 | $2.00 |
| Output | $0.50 | $2.50 | $5.00 | $10.00 |
| Cache Read | $0.01 | $0.05 | $0.10 | $0.10 |
| Cache Write | $0.125 | $0.625 | $1.25 | $2.50 |

The announcement states that Haiku 5.5 costs about 75% less on average than Haiku 4.5. A footnote mentions that requests under 100K tokens are 90% cheaper, while those over are 50% cheaper. It also notes that due to the new tokenizer, slightly more tokens may be used for the same task. Therefore, comparing only the unit prices in the table gives an overly optimistic view compared to actual bills.

Batch API requests receive a 50% discount, and cache reads cost 10% of the base input price, according to the model overview document. How caching works is covered separately in [more detail → Prompt Caching](#/post/ai-prompt-caching).

<details>
<summary>Simple Calculation Example</summary>

Assume 10K requests, with 2,000 tokens input and 300 tokens output per request. All fall within the ≤100K range, and neither caching nor batching is used. This is a simple calculation ignoring tokenizer differences.

- Total Input: 20M tokens
- Total Output: 3M tokens
- Haiku 5.5: 20 × $0.10 + 3 × $0.50 = $3.50
- Haiku 4.5: 20 × $1.00 + 3 × $5.00 = $35
- Sonnet 5.5: 20 × $2.00 + 3 × $10.00 = $70

If a service currently uses Sonnet for tasks like classification or summarization, switching just those stages to Haiku would reduce costs in that segment to one-twentieth based on unit prices. Of course, this only makes sense if quality is maintained.

</details>

## Performance Numbers

The benchmarks from the announcement are presented alongside Haiku 4.5, GPT-6 Luna, and Sonnet 5.5. All values were released by Anthropic.

| Benchmark | Haiku 5.5 | Haiku 4.5 | GPT-6 Luna | Sonnet 5.5 |
|---|---|---|---|---|
| OSWorld 2.1 (offline subset) | 72.4% | 15.7% | 48.9% | 83.9% |
| Humanity's Last Exam (no tools) | 45.9% | 10.2% | - | 56.9% |
| Humanity's Last Exam (with tools) | 57.4% | 18.7% | - | 64.5% |
| Terminal-Bench 4.0 | 39.2% | 0.0% | 16.4% | 70.6% |
| FrontierCode 1.1 (Main) | 46.4% | - | 42.4% | 52.1% (Xhigh) |

The generational gap is significant. The computer manipulation benchmark, OSWorld, jumped from 15.7% to 72.4%, and Terminal-Bench improved from 0.0% in version 4.5 to 39.2%. However, there is still a considerable distance between these results and Sonnet 5.5's 70.6% for terminal tasks. The reason Anthropic suggests entrusting complex agent coding to larger models becomes evident in this column.

<details>
<summary>Numbers from customer case studies</summary>

These are the results published by customers. Since each was measured in their own evaluation environment, direct comparison is difficult.

- Asana: Task completion delays reduced by over 30%, and agent inference per turn sped up by up to 2.5x.
- HubSpot: Achieved an average of 92.8% across three runs in their proprietary CRM evaluation.
- AlphaSense: Scored 0.84 on 400 queries, compared to Haiku 4.5's 0.76.
- Box: Scored 11 points higher than Haiku 4.5 with roughly half the latency.
- Cognition: Achieved 66.2 on FrontierCode when used as a helper model in Devin Fusion.

</details>

## Also Announced

The cost to read Sonnet 5.5's cache dropped from $0.20 to $0.10 per million tokens, which Anthropic explains reduces costs by about 20% for most agent tasks. Max, Ultra, and Team subscribers receive monthly API credits (Max $100, Ultra $200, and Team up to a combined $500). Additionally, Python and TypeScript SDKs now include beta support for computer use and browser use.

## Safety Updates

The announcement notes that Haiku 4.5 exhibits significantly fewer out-of-order behaviors and is less likely to comply with misuse requests compared to its predecessor. Cybersecurity safety measures are stricter than those of Haiku 4.5 but more lenient than Sonnet 5.5; however, attacker-perspective techniques such as penetration tests remain blocked. Biological capabilities are on par with Sonnet 5, Sonnet 5.5, and Opus 5. Organizations requiring broader access may apply to the Life Sciences or Cyber Verification programs.

## Thoughts After Reading

What stood out more than smaller models being cheaper was the clear introduction of small models for roles like "sub-agent," "compaction," and "classification." This signals a shift from using a single large model for everything to dividing tasks across different models at each stage. If you want to understand what these models actually do, see [Details → What is an LLM](#/post/ai-llm).

However, whether quality is sufficient for your specific work can only be determined by running it yourself; benchmarks are curated by the publishers.

← [Concept map](#/post/ai-map)

Related posts: [AI Model Map](#/post/ai-models), [Prompt Caching](#/post/ai-prompt-caching), [Sub-agents and Multi-agents](#/post/ai-subagent)

## Source Links

- [Introducing Claude Haiku 5.5 (Anthropic)](https://www.anthropic.com/news/claude-haiku-5-5)
- [Anthropic Newsroom](https://www.anthropic.com/news)
- [Models overview (Claude docs)](https://platform.claude.com/docs/en/about-claude/models/overview)