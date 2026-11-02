Inference optimization is a collection of techniques designed to make the process of feeding questions into already-trained models and extracting answers faster and cheaper. In summary, KV caching, batching, streaming, and speculative decoding form an interconnected system.

## Definition First

Inference refers to the stage where a trained model is utilized. While training involves running through the data once and then concluding, inference continues every time a user interacts with it. From a service perspective, this represents ongoing costs. ([Learn more → Pre-training](#/post/ml-pretraining))

LLMs do not generate answers all at once. They create one token, append that token to the input, run the model again, and create another. This loop repeats until the final token is generated. Most of the slowness and cost stem from this iterative structure. ([Learn more → Transformer](#/post/ml-transformer))

## Two Stages of Inference

Processing a single request is divided into two stages.

| Stage | Task | Nature |
|---|---|---|
| Prefill | Process the entire input prompt at once | Tokens are calculated in parallel; high computational load |
| Decode | Generate tokens one by one | One token at a time; model weights and cache must be read from memory each time |

Prefill affects the time until the first character appears, while decode influences the speed of subsequent characters. Optimization techniques generally target one or the other, particularly bottlenecks in decoding. Decoding tends to spend more time reading data from memory than performing calculations.

## KV Cache

The attention mechanism in Transformers uses the key and value values of all preceding tokens when creating a new token. These values are determined per token and per layer and do not change for already-generated tokens. Therefore, they are stored and reused instead of being recalculated every time. This is the KV cache.

- Without caching, the entire preceding context must be recalculated for every token generated.
- With caching, only the computation for a single new token is performed, while the rest is read from memory.
- However, it occupies GPU memory. The size grows with longer conversations and higher numbers of concurrent requests.

([Learn more → Prompt Caching](#/post/ai-prompt-caching)) is a service-side feature that reuses this KV state across requests.

<details>
<summary>How large is the KV cache? (Calculation Example)</summary>

The size occupied by a single token is given by the following formula:

```text
2(key와 value) x 층 수 x 어텐션 헤드 수 x 헤드 차원 x 자료형 바이트
```

These are hypothetical values assumed for calculation purposes, not an actual model. With 32 layers, 32 heads, a head dimension of 128, and fp16 (2 bytes), one token takes up 524,288 bytes (0.5 MB). A conversation of 4,096 tokens would consume 2 GB. Handling 10 concurrent requests would require just the cache to occupy 20 GB. (I verified this with Python.)

Some recent models adopt structures that reduce the number of key/value heads to decrease this size.
</details>

## Batching and Continuous Batching

GPUs often have idle portions when processing a single request. Since decoding incurs high costs for reading weights from memory, efficiency improves by grouping multiple requests together to read them in one go. This is batching.

The problem lies in the fact that response lengths vary per request. If processed with fixed groupings, requests that finish early must wait while the longest request completes, and new requests queue until the batch finishes.

The Orca paper (OSDI 2022) solved this issue using iteration-level scheduling. The scheduler intervenes each time the model runs: finished requests are immediately outputted, and waiting new requests are placed into the freed slots. This approach is commonly referred to as continuous batching. The term does not appear in the original paper; I read it as having the same concept. The paper reports a throughput 36.9 times higher than NVIDIA's FasterTransformer at the same latency level for GPT-3 175B.

```text
고정 배치:   [요청A ████████████]
             [요청B ████░░░░░░░░]  <- 끝났지만 자리가 빈 채로 대기
연속 배치:   [요청A ████████████]
             [요청B ████][요청C ████████]  <- 빈자리에 바로 새 요청
```

## PagedAttention

To increase batch size, one must hold more KV cache, but it is impossible to predict in advance how large the cache will grow per request. Reserving space up to the maximum length wastes unused memory, and varying sizes lead to fragmentation.

The vLLM paper (SOSP 2023)'s PagedAttention borrows from operating system virtual memory and paging. It splits the cache into small blocks, allocating them one by one as needed, and removes the requirement for blocks to be contiguous in memory. Requests using the same prompt can also share blocks. The paper reports that this approach nearly eliminates waste and achieves 2–4 times higher throughput than existing systems (FasterTransformer, Orca) at the same latency level. Differences were most pronounced with long sequences, large models, and complex decoding. ([Learn more → vLLM](#/post/repo-vllm))

## Streaming

Streaming is not a technique to reduce total generation time, but rather to reduce perceived latency. Instead of waiting for the entire response to be generated, tokens are streamed as soon as they are produced. Since decoding inherently produces one token at a time, this approach is structurally natural.

- What users perceive is the time until the first token (TTFT). A longer prefill phase increases TTFT.
- The interval between subsequent tokens depends on the decoding speed.
- Even if the total time remains the same, streaming makes the response feel significantly faster.

## Speculative Decoding

Decoding is slow because it generates only one token at a time. Speculative decoding involves a small, fast model predicting multiple tokens in advance, which are then verified in parallel by a larger model. Tokens that match the predictions are accepted as a single pass through the large model, while mismatches trigger a restart using the large model's values from the point of divergence.

Papers such as Leviathan report that this approach achieves approximately 2–3x speedup over existing implementations on T5-XXL without requiring model retraining or structural changes, and with no change in output distribution. In other words, it is an approximation that gains speed without sacrificing quality—it obtains the same answer more quickly.

For good alignment, the small model must predict similarly to the large model. It tends to guess correctly on easier parts (structured sentences, repetitive code) and often errs on harder sections.

<details>
<summary>How many tokens are generated at once? (Calculation example)</summary>

Assuming a 0.8 probability that each guess is correct and that 4 tokens are guessed in parallel, the expected number of tokens obtained per large model pass is 1 + 0.8 + 0.8^2 + 0.8^3 + 0.8^4 ≈ 3.36 tokens. This is a theoretical value; since running the small model incurs additional time, actual speedup is lower than this. The exact rules for acceptance and rejection during verification are defined by formulas in the paper, which we do not expand upon here.
</details>

## Related Concepts Used in Serving

- Quantization: Stores weights in smaller numeric formats to reduce memory usage and read time, at the cost of slightly reduced precision. ([Learn more → Local Models](#/post/ml-local-models))
- Model Parallelism: Splits models that do not fit on a single GPU across multiple GPUs.
- Prefix Caching: Reuses KV cache for requests sharing the same prefix.

Further details on actual service configurations will be covered in a separate article. ([Learn more → AI Serving Infrastructure](#/post/infra-ai-serving))

## Common Misconceptions

- Streaming does not mean the model computes faster; it simply displays results generated at the same speed as soon as they are ready.
- Speculative decoding is not a shortcut that compromises answer quality; according to the paper, the output distribution remains unchanged.
- Increasing batch size is not always beneficial. While throughput increases, the wait time per request may also grow.
- KV cache consumes memory independently of model size. This explains why memory can run out during long conversations even after loading a large model.

## Reference Links

- Kwon et al., Efficient Memory Management for Large Language Model Serving with PagedAttention: https://arxiv.org/abs/2309.06180
- Leviathan et al., Fast Inference from Transformers via Speculative Decoding: https://arxiv.org/abs/2211.17192
- Yu et al., Orca: A Distributed Serving System for Transformer-Based Generative Models (OSDI 2022): https://www.usenix.org/conference/osdi22/presentation/yu

← Concept map (#/post/ml-map)

Related articles: [Learn more → Transformers](#/post/ml-transformer) · [Learn more → Local Models](#/post/ml-local-models) · [Learn more → Prompt Caching](#/post/ai-prompt-caching)