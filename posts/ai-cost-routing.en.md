LLM API costs are calculated by multiplying the number of tokens used by the unit price. Therefore, methods to reduce costs involve manipulating both sides of this multiplication: using models with lower unit prices, taking advantage of discounts, or simply reducing the token count itself.

## How are fees calculated?

[LLM](#/post/ai-llm) APIs count input and output tokens separately. Unit prices are typically based on 1 million tokens (MTok), and output is more expensive than input. Below are the standard prices from the Anthropic official pricing page (values checked on 2026-11-04; prices may change).

| Model | Input | Output | Batched Input | Batched Output |
|---|---|---|---|---|
| Claude Opus 5.5 | $4 | $20 | $2 | $10 |
| Claude Sonnet 5.5 | $2 | $10 | $1 | $5 |
| Claude Haiku 5.5 (under 100k prompt tokens) | $0.10 | $0.50 | $0.05 | $0.25 |

Based on the same page, Opus and Haiku differ by a factor of 40 for both input and output. Changing just one model can result in a multiplier that moves from single digits to double digits. Specific characteristics of each model are summarized separately in the [AI Model Map](#/post/ai-models).

To get a sense of the calculation, I made an assumption: 1,000 requests per day, with 2,000 input tokens and 500 output tokens per request.

```
하루 입력 = 1,000 × 2,000 = 200만 토큰
하루 출력 = 1,000 × 500  =  50만 토큰
```

Multiplying these numbers by the table above yields the following results.

| Model | Daily Cost | 30 Days |
|---|---|---|
| Opus 5.5 | $8 + $10 = $18 | $540 |
| Sonnet 5.5 | $4 + $5 = $9 | $270 |
| Haiku 5.5 | $0.2 + $0.25 = $0.45 | $13.5 |

The number of input tokens is determined by how much [context](#/post/ai-context) you fill into the prompt. As conversations get longer and more documents are attached, the input per request increases. A larger [context window](#/post/ai-context-window) means you can add more content; it does not mean it's free.

## Model Routing

Requests vary in difficulty. Tasks like classification, short extraction, or format conversion can be handled by smaller models, while long reasoning or code generation requires larger models. Routing is the front-end component that decides which model to send a request to based on its incoming content.

```
요청 → [라우터: 난이도 판단] ─ 쉬움 → 작은 모델 (Haiku급)
                            └ 어려움 → 큰 모델 (Sonnet·Opus급)
```

Under the previous assumption, sending 80% of requests to Haiku and 20% to Sonnet results in the following daily cost:

```
0.8 × $0.45 + 0.2 × $9 = $0.36 + $1.80 = $2.16
```

Since the cost for all Sonnet requests was $9, this is one-quarter of that amount. It also shows that larger models account for the majority of costs. Even though only 20% were sent there, they account for 80% of the cost.

There are several ways to build a router:

- **Rules**: Divide based on input length, request type (classification vs. writing), user tier, etc. This is the simplest and easiest to debug.
- **Ask a small model to judge**: Have the small model respond with only "easy" or "hard." This call itself incurs cost, so it must be an extremely cheap model.
- **Small model first, large model on failure**: The small model answers first; if it fails format checks or reliability verification, the request is sent back to a larger model. A disadvantage is that the cost of failed attempts accumulates.

If the router incorrectly sends difficult requests to easy models, quality suffers. Relying solely on cost metrics won't catch this issue, so you must compare scores using an [evaluation set](#/post/ai-evals) every time you make changes.

## Caching

Prompt caching, which reuses results from repeated front-end processing, significantly lowers the input-side unit price. On the Sonnet 5.5 row of the pricing page, the cached hit price is $0.10/MTok, which is one-twentieth of the standard input price of $2. However, requests using the cache cost $2.50/MTok (based on a 5-minute cache), which is slightly more expensive than standard pricing. The principles and usage methods are summarized in the [Prompt Caching](#/post/ai-prompt-caching) article, so here I only note its role as a cost-saving measure. The effect is greater for large chunks that are attached to every request, such as system prompts or long documents.

For services where the same question is repeated verbatim, you can also store the answer itself. This incurs zero cost since it doesn't call the model. However, because the question must be identical, accuracy is low for services where user expressions vary from person to person.

## Batch API

Tasks that do not require an immediate response can be sent as batches. The "Batched" column in the table above refers to this, and the Anthropic page states a 50% discount on both input and output. The OpenAI batch guide also mentions a 50% cost discount compared to synchronous APIs, completion within 24 hours (often faster), and suitability for tasks like evaluation execution, bulk data classification, and content embedding.

This applies to jobs where humans do not wait, such as overnight classification, bulk document summarization, or running evaluation sets. It cannot be used for requests where users are waiting in front of the screen. The pricing page also notes that this discount may be applied in combination with other price adjustments like caching.

In Sonnet 5.5, batching reduces the cost from $9 per day to $4.5.

## Reducing Output

Output costs are five times higher than input costs (Sonnet 5.5: $10 vs. $2), so reducing one output token is more valuable than reducing one input token.

- Limit `max_tokens` appropriately for your use case.
- Enforce strict formatting in prompts, such as "classify in one word" or "output JSON only".
- Instruct the model not to include unnecessary introductions or summaries.

Simply shortening length can truncate answers; apply these techniques only where truncation is acceptable.

## Reducing Calls Itself

The cheapest way to save money is not to call the model at all.

- Do not offload tasks that can be handled by rules or standard code (regex, conditionals, DB queries) to the model.
- Cache and reuse results for identical inputs.
- Batch requests when possible; this reduces per-request charges on system prompts.
- Avoid agent loops ([AI Agent Loop](#/post/ai-agent-loop)), which invoke the model multiple times per request. Without a loop limit, costs can exceed expectations.
- Instead of attaching entire documents via [RAG](#/post/ai-rag), attach only necessary fragments to reduce input tokens.

## Running Open-Source Models Yourself

Running open-source models on your own GPU eliminates token-based fees but incurs fixed GPU costs. Cloud GPUs charge by the hour, while self-hosted hardware involves purchase price and electricity. Costs exist regardless of usage.

Therefore, comparisons look like this:

```
API 비용      = 월 토큰 수 × 단가            (쓴 만큼 늘어남)
자체 운영 비용 = GPU 월 비용 + 운영 인력·시간   (거의 고정)

손익분기 월 토큰 ≈ 자체 운영 월 비용 ÷ API 토큰당 단가
```

Once your monthly self-hosting cost is determined, divide it by the unit cost above to calculate how many tokens per month you must process before self-hosting becomes cheaper. However, there are often overlooked factors: idle GPU time, time spent configuring and fixing serving software, and the possibility that model performance lags behind larger API models. For usage around a few hundred requests per day, as shown in the table above, Haiku-level models might cost only $10–$20 monthly, failing to cover fixed GPU costs. Conversely, if traffic is high, steady, and small models suffice, self-hosting may be appropriate. The break-even point must be calculated by plugging in actual GPU rates and throughput.

<details>
<summary>Detailed breakdown: View the calculation at once</summary>

Assumptions: 1,000 requests/day, 2,000 input tokens/request, 500 output tokens/request, 30 days.

| Configuration | Daily | Monthly (30 days) |
|---|---|---|
| All Sonnet 5.5 | $9 | $270 |
| All Sonnet 5.5 batched | $4.5 | $135 |
| 80% Haiku + 20% Sonnet | $2.16 | $64.8 |
| All Haiku 5.5 | $0.45 | $13.5 |

Routing and batching can be combined: route requests, then batch only those that are async-compatible. Caching further lowers costs beyond the table by reducing input unit prices.

</details>

## Where to Start Cutting

A reasonable order is: first, log which requests consume the most tokens; next, reduce calls and output length; use caching if the request prefix is large; move non-interactive tasks to batching; finally, apply routing. Changing models has the biggest impact on quality, so do this only when you have an evaluation set.

## Common Misconceptions

- Cheaper models are always better: Small models may fail more often, increasing retries and re-requests, which erodes savings.
- Caching is always cheaper if used: Requests served from cache can be more expensive than standard ones, and uncached reads result in losses.
- Longer inputs cost the same: Input costs scale linearly with token count.
- Self-hosted GPUs are free: There are no per-token fees, but fixed costs remain.

## Reference Links

- Anthropic, Pricing: https://platform.claude.com/docs/en/about-claude/pricing
- OpenAI, Batch API guide: https://developers.openai.com/api/docs/guides/batch
- OpenAI, Pricing: https://developers.openai.com/api/docs/pricing

← [Concept Map](#/post/ai-map)

Related posts: [Prompt Caching](#/post/ai-prompt-caching) · [Context Window](#/post/ai-context-window) · [AI Model Map](#/post/ai-models)