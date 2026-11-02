Services that use the LLM API to provide answers differ from standard web services in several ways: requests take several seconds, sometimes fail, and incur costs per call. Consequently, the architecture involves adding layers for queuing, caching, streaming, timeouts, and cost limits along the request path.

## How is it different from a regular API?

As seen in [the journey of a single request](#/post/infra-request-journey), a typical web request passes through DNS, CDN, load balancer, server, and database, completing in tens of milliseconds. When an LLM is involved, the server must wait for one additional external API call. This waiting period is significantly longer than other stages because the answer isn't generated all at once but rather token by token.

The differences can be summarized in a table:

| | Typical API | LLM Call |
|---|---|---|
| Latency | Tens of ms | Seconds to minutes |
| Response size | Nearly fixed | Varies based on tokens generated |
| Same input | Same output | Usually slightly different each time |
| Cost | Nearly zero | Charged per input/output token |
| Limits | Server specs | Vendor-defined requests and tokens per minute limits |

As discussed in [What is an LLM?](#/post/ai-llm), the model appends the next token continuously, so response time scales with output length. From the server's perspective, this is a request that holds a connection for an extended period.

## The Architecture in One Layer

Here is the typical layered structure used by services:

```
사용자
  │  (스트리밍으로 받음)
  ▼
[ 우리 서버 ]
  ├─ 1. 인증·사용자별 한도 확인      ← 내 서비스의 레이트 리밋
  ├─ 2. 캐시 조회                    ← 같은 질문이면 여기서 끝
  ├─ 3. 큐 / 동시 호출 제한          ← 업스트림을 한 번에 너무 못 부르게
  ├─ 4. LLM API 호출                 ← 타임아웃·재시도·스트리밍
  └─ 5. 사용량 기록                  ← 토큰 수, 비용, 요청 ID
```

Each layer addresses different issues. Let's examine them one by one starting from the bottom.

## 1. Limits: Vendor Limits and My Own Limits

Based on Anthropic documentation, Messages API limits are defined per model in terms of requests per minute (RPM), input tokens per minute (ITPM), and output tokens per minute (OTPM). Exceeding any limit results in a 429 error; if the response includes a `retry-after` header, you must wait that many seconds before retrying. Unlike token buckets that reset at fixed intervals, these limits function as a continuously refilling bucket. The rate limiting algorithm itself is documented in [Rate Limiting and Traffic Control](#/post/infra-rate-limit).

A few notable points:

- Limits vary by organization usage tier. While documentation provides tables for each tier, the numbers change per model and over time, so they are not included here.
- For most models, input tokens read from cache do not count toward ITPM. Thus, using cache allows processing more within the same limit.
- Not all 429 errors are temporary. If you hit your monthly spend cap, you receive a 429 `rate_limit_error` without a `retry-after` header, causing continuous failures until the start of the next month. Automatic retries in SDKs are ineffective. According to documentation, distinguish this by checking if `error.details.error_code` is `enforced_spend_limit_reached`.
- If you hit your own configured spend cap, you receive a 400 error instead of 429.

Therefore, services need two types of limits: one to avoid exceeding vendor-imposed limits, and another to prevent a single user from exhausting the entire quota alone—the latter is not handled by the vendor.

## 2. Cache: Don't Call Again for the Same Question

The cheapest call is no call at all. Response caching uses a hash of the question (along with model and settings) as a key to store results. This follows the approach from [Cache and Redis](#/post/db-cache-redis), but with specific conditions for LLMs:

- Since the same input can yield different outputs, caching is only used for questions where identical answers are acceptable, such as FAQs, translation, or classification.
- Responses containing user personal information either include the user in the cache key or are not cached at all.

There is another concept with a similar name but different purpose: prompt caching provided by vendors. Instead of storing responses, it reuses processing results from the beginning of long prompts. Based on documentation, the default lifespan is 5 minutes and refreshes on every hit. Many models charge 0.1x the base input rate for reads and 1.25x for writes within a 5-minute window. A prefix match must be exact at the character level to hit the cache. Details are available in [Prompt Caching](#/post/ai-prompt-caching).

| | Response Cache (My Server) | Prompt Caching (Vendor) |
|---|---|---|
| Stored Content | Completed answer | Processing result of prompt prefix |
| On Hit | LLM not called at all | Call made but input rate and limits reduced |
| Condition | Same question | Prefix matches exactly character-by-character |

## 3. Queues and Concurrency Limits

When users send requests all at once, the upstream receives a burst of traffic and hits its limits. Therefore, services limit the number of concurrent outgoing calls. Simple approaches include semaphores; larger-scale solutions involve message queues and workers. This is a structure discussed in [Asynchronous Processing and Message Queues](#/post/be-async-queue), but there's an additional reason specific to LLMs. For tasks that take a long time to complete, it's better not to try finishing them within the request context; instead, queue the work and show the user "Processing". This makes connection management easier.

Anthropic also offers a Message Batches API for this purpose. The documentation introduces it as a way to reduce the risk of connections dropping during long requests, with results fetched via polling. This approach is suitable for bulk tasks that don't require real-time responses.

## 4. Streaming and Timeouts

LLM responses can be lengthy; waiting until they are fully generated leaves the user staring at a blank screen. Therefore, use `stream: true` to receive Server-Sent Events (SSE) and stream the output as it is generated. The flow described in the documentation follows the sequence of `message_start`, multiple `content_block_delta`s, and finally `message_stop`, with `ping` events potentially interspersed in between.

Streaming is not just about perceived speed. The documentation advises against sending requests without streaming for those exceeding 10 minutes or having a large `max_tokens`. This is because networks may drop idle connections. Official SDKs block requests that appear to exceed 10 minutes during the validation phase if they are not streamed.

One more point: errors can occur even after receiving an HTTP 200 status. An example from the documentation is an `overloaded_error` appearing within the event stream. In such cases, standard error handling based on status codes won't work; the code reading the stream must handle `error` events directly.

Timeouts should be considered in two ways: the time taken to establish a connection and the total time until the full response is received. With streaming, "how long to wait for the next chunk" becomes a more useful metric. Specific values vary by service, so no specific numbers are provided here.

## 5. Retry and Failure Handling

Among the error codes in the documentation, 429, 500, 504, and 529 indicate cases where the server temporarily cannot accept requests. Code 529 indicates that the API is overloaded overall; 500 indicates an internal Anthropic error, for which exponential backoff retries are recommended. Conversely, 400, 401, 403, and 413 indicate issues with the request itself, so resending will yield the same result. It is essential to distinguish between errors that warrant retries and those that do not.

Official SDKs retry connection errors, 429, and 5xx errors by default twice using exponential backoff, adhering to the `retry-after` value if present. This can be adjusted via `max_retries`. If implementing this logic manually, follow these rules; however, be cautious when wrapping retries in your own code while using an SDK, as this can lead to compounded retry counts.

<details>
<summary>Detailed Explanation: Small Example Combining Concurrency Limits + Caching + Retries</summary>

This example uses a fake function that fails with 40% probability (simulating the role of 529) instead of a real API. It limits concurrent calls to three using a semaphore, implements response caching, and includes exponential backoff retries. I executed this code directly.

```python
import asyncio, random, hashlib

class Busy(Exception): pass

calls = 0
async def fake_llm(prompt):
    """진짜 API 대신 쓰는 가짜. 40%는 과부하, 가끔 느림."""
    global calls
    calls += 1
    await asyncio.sleep(random.choice([0.05, 0.05, 0.05, 0.3]))
    if random.random() < 0.4:
        raise Busy("529")
    return f"answer({prompt})"

cache = {}
sem = asyncio.Semaphore(3)  # 동시에 3개까지만 업스트림으로

async def ask(prompt, retries=4, timeout=0.2):
    key = hashlib.sha256(prompt.encode()).hexdigest()
    if key in cache:
        return cache[key]
    async with sem:
        for n in range(retries + 1):
            try:
                out = await asyncio.wait_for(fake_llm(prompt), timeout)
                cache[key] = out
                return out
            except (Busy, asyncio.TimeoutError):
                if n == retries:
                    return "잠시 후 다시 시도해 주세요"
                await asyncio.sleep(min(2 ** n * 0.05, 1) * random.random())

async def main():
    random.seed(1)
    prompts = ["a", "b", "a", "c", "a", "b"] * 3
    res = await asyncio.gather(*(ask(p) for p in prompts))
    print(len(prompts), "요청 / 업스트림 호출", calls, "/ 캐시 항목", len(cache))
    print(sorted(set(res)))
asyncio.run(main())
```

The execution results were as follows:

```
18 요청 / 업스트림 호출 40 / 캐시 항목 3
['answer(a)', 'answer(b)', 'answer(c)', '잠시 후 다시 시도해 주세요']
```

Out of 18 requests, there were only 3 distinct questions, yet there were 40 upstream calls. There are two reasons for this: the fake function failed frequently, triggering retries; and when multiple identical questions arrived simultaneously, no cached value existed yet, so all were sent to the upstream. This phenomenon is called cache stampede. This code does not prevent it; preventing it requires a mechanism to merge ongoing calls with the same key. Additionally, requests that have exhausted their retries return guidance messages, which also appear mixed into the result set. In actual services, these should not be cached (the code above caches only successes).

Latency and probability are fake values unrelated to actual API behavior; this is for observing how the structure works.

</details>

<details>
<summary>Detailed Explanation: Error Code Table</summary>

A summary translated from Anthropic's error documentation.

| Code | Meaning | Resending Helps? |
|---|---|---|
| 400 | Request format/content issue (including reaching a spending cap I set) | No |
| 401 / 403 | Key issue / Unauthorized | No |
| 413 | Request too large | No |
| 429 | Rate limit exceeded or monthly spending cap reached | Wait for `retry-after` if present; otherwise, likely no help |
| 500 | Anthropic internal error | Retry with exponential backoff |
| 504 | Processing timeout | Consider using streaming |
| 529 | API overload | Retry after a short wait |

Every response includes a `request-id` header, and the error body also contains `request_id`. It's recommended to keep this in your logs for reference when contacting support.

</details>

## 6. Cost Control and Logging

Since tokens per request equate to cost, merely logging the number of requests is insufficient. You must track the input and output token counts used in each response by user and feature to understand where costs are incurred. As documented, cache hit status can be determined by checking whether `cache_creation_input_tokens` or `cache_read_input_tokens` in the response are non-zero.

Control mechanisms include:

- Setting daily token limits per user and plan directly within the service.
- Routing simple queries to smaller models and complex queries to larger models.
- Manually lowering spending caps in the console (a safety mechanism to prevent exceeding monthly limits).
- Running batch jobs for tasks that do not require real-time processing.

Details on how to calculate costs are available in [AI Service Cost Structure](#/post/app-cost). While bottlenecks can be resolved by scaling servers as covered in [Auto-scaling and Expansion](#/post/infra-autoscaling), LLM calls are constrained by provider limits, meaning server count and throughput do not scale proportionally. This distinction is what I found most different from typical services.

## Common Misconceptions

- If you receive a 429 error, waiting and retrying will always work: A 429 caused by hitting your monthly spending cap lacks a `retry-after` header and will continue to fail.
- Streaming means errors are indicated only by status codes: You can still encounter error events within the stream even after receiving a 200 status code.
- Using prompt caching makes response caching unnecessary: They serve different purposes; one reduces input costs, while the other reduces the number of calls.
- Increasing server count increases throughput: If the bottleneck is provider limits, adding more servers has no effect.
- Setting a large `max_tokens` value consumes more of your limit: According to documentation, OTPM counts only actually generated tokens. However, using a large value without streaming may lead to connection issues.

## Reference Links

- Anthropic Documentation, Errors: https://platform.claude.com/docs/en/api/errors
- Anthropic Documentation, Rate limits: https://platform.claude.com/docs/en/api/rate-limits
- Anthropic Documentation, Streaming messages: https://platform.claude.com/docs/en/build-with-claude/streaming
- Anthropic Documentation, Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching

← Concept map (#/post/infra-map)

Related posts: [Rate Limits and Traffic Control](#/post/infra-rate-limit) · [Prompt Caching](#/post/ai-prompt-caching) · [AI Service Cost Structure](#/post/app-cost)