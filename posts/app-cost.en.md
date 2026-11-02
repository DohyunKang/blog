AI services operate on a token-based pricing structure, so you first calculate the cost per call and then multiply it by the number of calls and users to determine the total cost.

## Why Calculate Costs Separately?

For general web services, adding more users often doesn't require significantly more server capacity; serving an additional user costs almost nothing extra. LLM apps are different. Every question incurs an API fee. Consequently, as sales increase, so do costs. If the cost per user exceeds the price charged, selling more actually results in a loss.

There is only one metric to calculate: the AI cost per user per month.

```
월 원가 = 월 호출 수 × (입력 토큰 × 입력 단가 + 출력 토큰 × 출력 단가)
```

For what tokens are, see [Details → Save on Tokens](#/post/claude-tokens) separately; here we simply use them as multipliers for the unit price.

## How to Read Unit Prices

Anthropic's pricing table lists input and output unit prices per 1 million tokens (MTok) for each model. Here are some of the values checked (based on documentation from 2026-11-02).

| Model | Input | Output | Cache Read |
|---|---|---|---|
| Fable 5.1 | $10 | $50 | $0.25 |
| Opus 5.5 | $4 | $20 | $0.20 |
| Sonnet 5.5 | $2 | $10 | $0.10 |
| Haiku 5.5 (under 100k tokens prompt) | $0.10 | $0.50 | $0.01 |

A few notable points stand out:

- Output is more expensive than input. For all models in the table, the output unit price is five times the input unit price.
- The difference between large and small models is significant. The input unit price for Sonnet 5.5 and Haiku 5.5 differs by a factor of 20.
- For Haiku 5.5, if the prompt exceeds 100k tokens, the input price rises to $0.50 and output to $2.50. You must check this tier separately when processing long documents.
- Models after Claude 4.7 use a new tokenizer; documentation states that the same text yields about 30% more tokens. Even if unit prices are identical, costs based on character count can differ.

Unit prices change frequently. You must open the official pricing sheet again whenever you calculate costs.

## Calculating Monthly Cost per User

Let's make one assumption: a Q&A app where users ask 10 questions daily for 30 days a month. One call consists of 3,000 input tokens (2,000 system prompt + 1,000 question and context) and 500 output tokens. The model is Sonnet 5.5. These numbers are hypothetical assumptions for calculation, not actual service values.

- **One call:** 3,000 × $2/1M + 500 × $10/1M = $0.006 + $0.005 = $0.011
- **300 calls per month:** $3.30

If one user costs $3.30, there is little margin left when the monthly subscription fee is $5. We haven't even included payment processing fees, server costs, or labor. Conversely, with 100 users, it's $330, which feels negligible. However, with 50,000 users, it reaches $165,000. You must view how costs scale by multiplying them as the volume grows.

| Number of Users | Monthly AI Cost (Sonnet 5.5, based on above assumptions) |
|---|---|
| 1 user | $3.30 |
| 1,000 users | $3,300 |
| 50,000 users | $165,000 |

Usage is not uniform; a few heavy users can raise the average. You must look not only at the average but also at how much top users consume.

## Ways to Reduce Costs

It is correct to reduce costs before lowering prices. There are roughly four methods to do so.

**1. Prompt Caching.** If you send the same system prompt every time, cache that part. According to documentation, reading from cache costs 0.1 times the base input unit price (0.05 times for Opus 5.5 and Sonnet 5.5). Using a 5-minute cache is 1.25 times more expensive, and a 1-hour cache is twice as expensive; therefore, prompts used only once are actually counterproductive. The prefix must match exactly, and there is a minimum length per model (512 tokens for Sonnet 5.5). For details, see [Details → Prompt Caching](#/post/ai-prompt-caching).

In the above assumption, changing the 2,000 tokens to cache read reduces one call to $0.0072 and the monthly cost to $2.16. Even adding write costs (assuming a 5-minute expiration requiring rewriting 20 times), it remains around $2.26—a reduction of about 34%.

**2. Route to Smaller Models.** Classification, short extraction, and simple questions are often sufficient with smaller models. Sending the same call to Haiku 5.5 reduces one call to $0.00055 and the monthly cost to $0.165—one-twentieth of the original. Therefore, if you filter difficulty per request and send 80% to small models and only 20% to Sonnet (with caching applied), the monthly cost becomes about $0.56—one-sixth of the initial $3.30. However, you must separately verify whether smaller models truly deliver the same quality. How to verify is covered in [Details → LLM App Evaluation](#/post/app-eval). Criteria for choosing models are in [Details → AI Model Map](#/post/ai-models).

**3. Batch.** Tasks that do not require real-time processing (such as overnight summaries or bulk classification) should be sent via the Batch API. The documentation states a 50% discount applies to both input and output. It is noted that this discount stacks with cache multipliers. However, results are returned asynchronously.

**4. Reduce calls themselves.** Save query results for reuse, trim input documents to include only necessary sections, and limit output length. Since output costs five times more than input, setting `max_tokens` and using instructions like "answer briefly" directly saves money.

## Agents involve different calculations

Apps where the model invokes tools multiple times, such as those described in [See details → Agent Loop](#/post/ai-agent-loop), do not count as a single call. At each step, the entire conversation history up to that point is resent, causing input to accumulate ([See details → Context Window](#/post/ai-context-window)).

Under the same assumptions, if a task consists of 5 steps and the record grows by 800 tokens at each step, the total input sums to 23,000 tokens and output to 2,500 tokens. Using Sonnet 5.5 without caching costs $0.071. This is more than six times the cost of a simple single query ($0.011). As the number of steps increases, input grows nearly quadratically with the step count. In such cases, caching is not just an option but practically essential. For discussions on agent design, see [See details → Agent Design](#/post/app-agent-design).

## Common Misconceptions

- **Lower unit price means no worries:** Even if unit prices drop, total costs rise if usage increases faster.
- **Enabling caching always saves money:** Writing is more expensive, and there is no benefit if the prefix changes every time or if reuse does not occur within 5 minutes.
- **Calculating based on average usage is sufficient:** Top-tier users significantly skew the average upward.
- **Only input matters:** Output costs five times as much, and thinking tokens are also billed as output.
- **Fees are just the cost of goods sold (COGS):** This article covers only API fees. Running models directly on GPU servers involves different calculation methods ([See details → AI Serving Infrastructure](#/post/infra-ai-serving)).

<details>
<summary>Detailed breakdown: line-by-line calculations above</summary>

Sonnet 5.5 input $2/MTok, output $10/MTok, cache read $0.10/MTok, 5-minute cache write $2.50/MTok.

- **Base:** 3,000×2/1e6 = 0.006, 500×10/1e6 = 0.005, total 0.011. ×300 = 3.30
- **Cache read:** 2,000×0.10/1e6 = 0.0002, remaining input 1,000×2/1e6 = 0.002, output 0.005, total 0.0072. ×300 = 2.16
- **Cache write:** 20 times per month × 2,000 tokens × 2.50/1e6 = 0.10. Total 2.26
- **Haiku 5.5:** 3,000×0.10/1e6 + 500×0.50/1e6 = 0.00055. ×300 = 0.165
- **Routing:** 0.8×0.00055 + 0.2×0.0072 = 0.00188. ×300 = 0.564
- **Agent:** Input = Σ(2,000+1,000+800×k), k=0..4 = 23,000. 23,000×2/1e6 = 0.046, output 2,500×10/1e6 = 0.025, total 0.071

This calculation was verified by running it again in Python to ensure the values match.

</details>

<details>
<summary>Detailed breakdown: reading actual usage from responses</summary>

Instead of assumptions, you can sum the `usage` field from responses for actual values. Based on the cache documentation, `input_tokens` represents input after the last cache point, `cache_read_input_tokens` is what was read from the cache, and `cache_creation_input_tokens` is what was written to the cache. Total input is the sum of these three. If both are zero, caching did not occur; the most common cause is stated to be failing to meet the minimum length requirement.

Logging the user ID and these three values along with `output_tokens` for each call allows immediate monthly cost summation per user.

</details>

## Reference Links

- Anthropic Documentation, Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- Anthropic Documentation, Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching

← Concept map (#/post/app-map)

Related articles: [Prompt Caching](#/post/ai-prompt-caching) · [LLM App Evaluation](#/post/app-eval) · [How to Save Claude Tokens](#/post/claude-tokens)