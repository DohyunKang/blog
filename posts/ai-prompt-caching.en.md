Prompt caching is a feature that processes the identical initial portion of a request once and reuses it for subsequent requests. Its core requirement is that "the beginning must be exactly the same."

## Definition

Every time a conversation continues, an LLM API resends the system prompt, tool definitions, and the entire conversation history so far ([see details → Context](#/post/ai-context)). A significant portion of this is identical every time. Prompt caching involves the server temporarily holding the processing result of that identical initial part; when the same beginning appears again, it retrieves the result instead of calculating from scratch.

The output remains unchanged. Both Anthropic and OpenAI documentation state that caching does not affect output generation. What changes is the time taken to process the input and the input cost.

## Principle: Prefix Matching

According to OpenAI documentation, what the server stores is not the token text itself but the KV state created while processing the initial part. I interpret this as intermediate values within the model's internal calculations. Since these intermediate values are determined by preceding tokens, they can only be reused when the beginning matches. (This structural explanation reflects my understanding; the documentation simply states that "the entire prompt prefix must match.")

Therefore, the rules are simple:

- Caching is valid only for segments where not a single token differs from the start.
- If one token differs in the middle, everything after it must be recalculated.
- Images are included in the content; an identical image must be placed in the exact same position.

Anthropic treats the concatenation of prompts in the order `tools` → `system` → `messages` as a single prefix. Since tool definitions come first, modifying even one tool invalidates everything that follows.

```text
[도구 정의][시스템 프롬프트][문서/예시][지난 대화......][이번 질문]
|<------------ 매번 같음 (캐시) ------------>|<-- 달라짐 -->|
```

## Cost and Latency Benefits

The multiplier (relative to the base input unit price) for Anthropic documentation is as follows:

| Item | Multiplier |
|---|---|
| 5-minute cache write | 1.25x |
| 1-hour cache write | 2x |
| Cache read (hit) | 0.1x base (some models offer 0.05x or 0.025x) |

Writing is slightly expensive, while reading is much cheaper. Let's calculate: suppose the initial part consists of 20,000 tokens and we make 10 requests with the same initial part. Setting the unit price to 1, the results are as follows:

| | Calculation | Input Cost (Tokens × Multiplier) |
|---|---|---|
| No cache | 20,000 × 10 | 200,000 |
| 5-minute cache | 20,000×1.25 + 20,000×0.1×9 | 43,000 (approx. 21.5%) |

From the second request onward, there is already a benefit. Even using it once to write and once to read costs 1.25 + 0.1 = 1.35x, which is cheaper than sending twice as-is at 2x. However, this calculation considers only the prefix part; costs for the rest of the query (like the current question) and output fees are excluded.

Regarding latency, the documentation states that "time to generate the first token decreases, and the effect is larger for longer documents." Specific figures on how many seconds were reduced are not provided in either document, so I will omit them. OpenAI's documentation also does not provide latency metrics.

One more point: according to Anthropic documentation, cache hits are exempt from rate limits. Conversely, OpenAI states that cached tokens are still subject to rate limits. Policies vary by company, so you must consult the relevant documentation for your provider.

The cost perspective is discussed further in [Cost Design](#/post/app-cost).

## Actions That Invalidate Cache

Since the beginning must match, invalidation occurs when this condition is broken:

- Inserting the current time or request ID at the top of the system prompt. Since these differ per request, everything after becomes invalid.
- Adding, removing, or reordering tool definitions per request. Tools come first.
- Summarizing or truncating past conversations and resending them. This changes the initial part. ([see details → Context Compaction](#/post/ai-compaction))
- Inserting or removing images in the middle. In Anthropic's table, adding or removing images invalidates both `tools` and `system` caches.
- Changing the `tool_choice` value. In the same table, this invalidates both `tools` and `system` caches.

OpenAI's advice follows the same direction: place unchanging content at the beginning and changing content (such as visual data or user-specific information) at the end. They also suggest using `tool_choice: "none"` or `allowed_tools` instead of removing tools.

## TTL: How Long Cache Lasts

Cache is not permanent. Anthropic defaults to 5 minutes, extending for free with each use. Specifying `ttl: "1h"` sets it to 1 hour, doubling the write cost. If requests arrive every 5 minutes, a 5-minute cache applies; if the interval exceeds 5 minutes but stays within 1 hour, a 1-hour cache is appropriate, as per the documentation's guidance.

OpenAI operates differently. According to the documentation, models after GPT-5.6 have a default minimum retention of 30 minutes, which can be extended up to 12 hours via `prompt_cache_options.ttl` (at the cost of additional write charges). For earlier models, options included `in_memory` (inactive for approximately 5–10 minutes) and `24h`. The rules vary by model generation, which is the most confusing aspect here.

## How to Use in API

Anthropic offers two approaches: an automatic method where a single `cache_control` is provided at the top level (the indicator moves forward as the conversation grows), and an explicit method where indicators are set directly for each block (up to 4 locations). Here is the Python example from the documentation, condensed:

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-opus-5-5",   # 문서 예시의 모델 이름
    max_tokens=1024,
    system=[
        {"type": "text", "text": "You are an AI assistant tasked with analyzing legal documents."},
        {
            "type": "text",
            "text": "Here is the full text of a complex legal agreement: [...]",
            "cache_control": {"type": "ephemeral"},  # 여기까지를 캐시
        },
    ],
    messages=[{"role": "user", "content": "What are the key terms and conditions in this agreement?"}],
)
print(response.usage)
```

This code translates the documentation example.

Cache hits are determined by checking the `usage` in the response:

- `cache_creation_input_tokens`: Tokens used this time for the cache
- `cache_read_input_tokens`: Tokens read from the cache
- `input_tokens`: Tokens not cached after the last indicator

The total input is the sum of these three values. If the first two are zero, caching failed; this usually happens because the length is shorter than the minimum required. In such cases, no error occurs—it simply fails to cache quietly. Therefore, it's necessary to check the `usage`.

OpenAI requires almost no code. It is enabled by default for supported models per the documentation, and hits are verified via `cached_tokens` in the response.

<details>
<summary>Detailed explanation: Minimum length and lookback window</summary>

Anthropic has different minimum cacheable lengths per model. According to the documentation table: 512 tokens (Opus 5.5, Sonnet 5.5, Haiku 5.5, etc.), 1,024 tokens (Sonnet 5, Sonnet 4.6, etc.), 2,048 tokens (Opus 4.7, etc.), and 4,096 tokens (Opus 4.6, Haiku 4.5, etc.). Since models change frequently, you must consult the table again when using them. OpenAI uses a standard of 1,024 tokens for models after GPT-5.6.

Anthropic only caches at breakpoints. When a request arrives, it checks the hash at that breakpoint; if not found, it looks back up to 20 positions forward to find items used by previous requests. If a conversation exceeds 20 blocks at once, there is guidance to place an additional indicator further ahead. Placing indicators on blocks that change with each request (e.g., timestamps) will result in hash mismatches, causing write charges every time.

Pre-warming is also available. Sending `max_tokens: 0` uses only the cache without output. It cannot be used alongside streaming, extended thinking, or structured outputs. I have not tried this feature.

The "thinking" block cannot have an indicator attached directly but is cached as part of a previous assistant turn. Some newer models retain the thinking block by default to continue caching, while older models invalidate from that point onward upon receiving specific user input, according to the documentation.
</details>

<details>
<summary>Detailed explanation: OpenAI's prompt_cache_key</summary>

For models before GPT-5.6, providing the same `prompt_cache_key` for requests sharing a common prefix helps achieve the same cache, though this is not guaranteed and affects routing to some extent. The documentation suggests around 15 requests per minute per key for busy groups and advises splitting keys if exceeded. After GPT-5.6, it is optional and used for per-user cache aggregation or preventing other users from peeking at cache hit information. I have not tried this directly.
</details>

## Common Misconceptions

- Caching reduces the context window: No. Only fees are reduced; the window remains unchanged. ([Read more → Context Window](#/post/ai-context-window))
- The same question returns the same answer via cache: No. What is stored is the input processing result, while answers are generated anew each time.
- Adding an indicator always works: If the length is shorter than the minimum, caching fails without error.
- Caching is permanent: Retention ranges from 5 minutes to 1 hour, up to several hours (per OpenAI documentation), and cannot be manually deleted.
- Write costs are free: Anthropic charges 1.25x or 2x. For one-time use on system prompts, it may actually be a loss.

This effect is significant for agents that continuously loop with the same tool list and instructions. How Haneus stacks prompts seems to determine hit rates. ([Read more → Haneus](#/post/ai-harness))

## Reference Links

- Anthropic documentation, Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- OpenAI documentation, Prompt caching: https://developers.openai.com/api/docs/guides/prompt-caching.md
- (Checked only in search results, not read the full text) OpenAI Cookbook, Prompt Caching 101: https://developers.openai.com/cookbook/examples/prompt_caching101

← [Concept map](#/post/ai-map)

Related posts: [Context and Context Engineering](#/post/ai-context) · [Context Window](#/post/ai-context-window) · [Context Compaction](#/post/ai-compaction)