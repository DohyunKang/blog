vLLM is an inference engine that runs LLMs on a server to handle multiple requests simultaneously. Its core lies in managing KV cache by finely partitioning GPU memory and using a scheduler that distributes tokens per step.

## What does it do?

This is open-source software that loads model files and spins up an OpenAI-compatible API server. It is designed for scenarios where multiple users send requests simultaneously, rather than running a single instance alone. [Read more → AI Serving](#/post/infra-ai-serving)

This article reflects a shallow clone of the main branch (commit 16d6673) as of 2026-11-02. Since the code changes rapidly, file locations and line numbers may differ quickly. The areas read were under `vllm/v1/`, specifically focusing on the scheduler, KV cache management, and engine loop. Model implementation or CUDA kernels were not examined.

## Problem: KV Cache Consumes All Memory

LLMs generate tokens one by one. To avoid recalculating key/value values for previous tokens every time, these are stored in GPU memory; this is called the KV cache. Since request lengths vary and it's unknown when responses will end, older methods pre-allocated contiguous space based on maximum length. The vLLM blog notes that such legacy systems waste 60–80% of memory due to fragmentation and over-allocation. This wasted capacity reduces the number of requests that can be batched at once and lowers throughput.

## Principle 1: PagedAttention, Partitioning into Blocks

This concept is similar to virtual memory in operating systems. The KV cache for a single request is sliced into fixed-size blocks, and these blocks can exist independently in GPU memory. For each request, a "logical block → physical block" mapping (block table) is maintained, and new blocks are allocated only when tokens are generated.

| | Legacy Approach | PagedAttention |
|---|---|---|
| Space Allocation | Pre-allocated contiguously up to max length | Allocates one block at a time as needed |
| Waste | Fragmentation & Over-allocation | Only within the last block of a request |
| Sharing | Difficult | Multiple requests can point to the same physical block |

According to blog figures, waste occurs only in the last block and is under 4%. The paper abstract claims 2–4x higher throughput compared to FasterTransformer and Orca at the same latency. The blog states up to 24x improvement over HF Transformers and up to 3.5x over TGI, based on measurements using LLaMA-7B (A10G) and 13B (A100 40GB) with ShareGPT length distributions. Since these comparisons are from 2023, results may differ when comparing current versions.

The number of tokens per block is set via the `block_size` parameter, which defaults to 16 in the code (`config/cache.py`). The block pool is managed by `BlockPool` in `v1/core/block_pool.py`. Pre-created block objects exist, empty blocks are managed via a queue, and a separate hash table is used to locate blocks.

## Principle 2: Prefix Caching (Reusing the Beginning)

When many requests start with the same system prompt, their KV cache prefixes are identical. Instead of recalculating, previously created blocks are reused. The function `hash_block_tokens` in the code can be summarized in one line: hash(block) = hash(hash(previous block), tokens in this block, additional keys). Because the previous block's hash is mixed, reuse only occurs when "the entire prefix up to here is identical," not merely when tokens in the current block match.

A toy code mimicking this structure was executed (block size 4, sha256, differing from actual code):

```python
import hashlib
B = 4
def chain(tokens):
    h = b"root"; out = []
    for i in range(0, len(tokens)//B*B, B):
        h = hashlib.sha256(h + bytes(tokens[i:i+B])).digest()
        out.append(h.hex()[:6])
    return out

a = list(range(10))                    # 0..9
b = list(range(4)) + [50,51,52,53,54,55]  # 첫 블록만 같음
c = [7] + list(range(1,10))            # 첫 토큰만 다름
```

The results were as follows:

```
a: ['dec0e9', 'cabceb']
b: ['dec0e9', '5785bf']   # 첫 블록 재사용, 둘째부터 다름
c: ['423961', 'd3738b']   # 첫 블록이 다르니 뒤도 전부 다름
```

In `c`, although the tokens in the second block (indices 4–7) are identical to those in `a`, the hashes differ because the prefixes differ. Thus, reuse is limited to "contiguous segments starting from the beginning." Official design documents also state that only fully matching blocks are cached and only the longest matching prefix is reused.

Additionally, even if the entire prompt exists in the cache, the last token is recalculated because logits for selecting the next token are required. A comment in `kv_cache_manager.py`'s `get_computed_blocks` restricts this to `prompt_length - 1`. Due to this restriction, comments indicate that one final block may be fully recalculated.

The default hash algorithm is sha256 (`config/cache.py`'s `prefix_caching_hash_algo`). The documentation mentions faster xxhash variants but warns of collision risks, advising caution in multi-user environments. Providing a cache salt per request ensures caching is shared only among requests with the same salt.

Eviction follows an LRU policy. Unused blocks remain in the empty block queue with their hashes intact until needed; when pulled from the front of the queue for reuse, their hash is cleared and they are removed from the reuse candidate set. Upon request completion, blocks return to the back of the queue. Blocks at the back have lower reuse probability, so they are evicted first (per official documentation).

## Principle 3: Scheduler Allocates Token Budgets

The `Scheduler.schedule()` method in `v1/core/sched/scheduler.py` determines how many tokens to allocate per step for each request. Although the file exceeds 3,700 lines, the comments at the top clearly explain its structure. In summary:

- It does not distinguish between "decoding" and "prefill" stages.
- For each request, only `num_computed_tokens` (already computed) and `num_tokens_with_spec` (prompt + output + speculative tokens) are tracked.
- Tokens are allocated at the beginning of each step to catch up with the subsequent count.
- This single rule handles chunked prefill, prefix caching, and speculative decoding.

The total budget per step is defined by `max_num_scheduled_tokens`, while the default values for `max_num_batched_tokens` in the configuration are 2048 and `max_num_seqs` are 128 (`config/scheduler.py`). The flow can be understood as follows:

1. First, iterate through running requests (`running`) in order, determining their required tokens within the budget and receiving KV blocks via `allocate_slots`.
2. If budget remains, dequeue waiting requests (`waiting`), check for prefix cache hits, and continue with prefill.
3. Long prompts are split and fed incrementally according to the available budget (chunked prefill). If `enable_chunked_prefill` is disabled and the prompt exceeds the remaining budget, processing halts at that point. Additionally, a request can be capped on how much prefill it uses per step using `long_prefill_token_threshold`.

Thanks to this design, even when a long prompt arrives, the next tokens for already-running requests are included in the same batch. Other requests do not wait until the new request finishes; this mechanism is known as continuous batching. [Learn more → Model Inference](#/post/ml-inference)

### When Blocks Are Insufficient

If `allocate_slots` returns `None`, it indicates that no KV blocks are available. In such cases, the lowest-priority request is preempted via `_preempt_request`. Under FCFS policy, this is `running[-1]` (the most recently arrived request); under PRIORITY policy, it's the one with the highest priority value. The preempted request returns its blocks and reverts to the front of the `waiting` queue with `num_computed_tokens = 0`, meaning it must be recomputed from scratch. This is a trade-off: saving memory at the cost of additional computation. The number of preemptions is accumulated in `num_preemptions`. I have reviewed this part of the function, but haven't tested how much prefix cache can still be reused by a preempted request upon resumption.

### Engine Loop

The `step()` method in `v1/engine/core.py` forms the core skeleton. Translating the logic directly yields:

```
scheduler_output = scheduler.schedule()
future = model_executor.execute_model(scheduler_output, non_block=True)
...
model_output = future.result()   # 없으면 sample_tokens 호출
outputs = scheduler.update_from_output(scheduler_output, model_output)
```

The sequence follows scheduling → GPU execution → result application, and this loop continues indefinitely. In `update_from_output`, it is determined whether a request has finished and blocks are released—this was inferred from the function name and flow, though the detailed implementation was not fully examined.

## Common Misconceptions

- vLLM speeds up model inference: It does not alter the model computation itself but reduces memory waste to allow more requests per batch. The benefit is minimal when sending only a single request.
- Prefix caching applies if words match: As in the toy example above, sequences must match from the beginning; matches occurring mid-sentence are not utilized.
- Enabling cache changes outputs: Official documentation states that caching reduces recomputation without altering outputs.
- Requests fail when memory is low: In this implementation, other requests are preempted first and recomputed later; delays may increase depending on queue dynamics.

<details>
<summary>Detailed breakdown: file-by-file analysis</summary>

| File | Key Concepts |
|---|---|
| `v1/core/sched/scheduler.py` | Locations of `schedule()`, `_preempt_request()`, and `update_from_output()`, plus token budget variables |
| `v1/core/kv_cache_manager.py` | `get_computed_blocks` (cache lookup), `allocate_slots` (block allocation), `free` |
| `v1/core/block_pool.py` | `BlockPool`, hash-to-block mapping, free block queue, eviction order for `free_blocks` |
| `v1/core/kv_cache_utils.py` | `hash_block_tokens`: hashes (previous hash, tokens, extra_keys) |
| `v1/core/sched/request_queue.py` | FCFS queue and priority queue |
| `v1/engine/core.py` | `step()` loop |
| `config/cache.py`, `config/scheduler.py` | Defaults (block_size 16, hash sha256, prefix caching enabled by default, batch tokens 2048, sequence 128) |

The latest main branch includes branches for hybrid models (Mamba, sliding window), multiple KV cache groups, external connectors (passing KV to other locations), speculative decoding, and more, which are scattered throughout the scheduler. Therefore, the code differs significantly from the simplified diagrams in the paper. The explanation above follows only the most basic path.

</details>

<details>
<summary>Detailed walkthrough: Recommended study order</summary>

For a first read, I found it least burdensome to start with `step()` in `core.py`, then the top comment of `schedule()`, and finally the class description in `block_pool.py`. Since the files are large, it's better to search by function names while reading.

</details>

← Concept map: [(AI concept map)](#/post/ai-map)

Related posts: [Ollama analysis](#/post/repo-ollama) · [llama.cpp analysis](#/post/repo-llama-cpp) · [AI serving](#/post/infra-ai-serving)

## Reference Links

- Kwon et al., Efficient Memory Management for Large Language Model Serving with PagedAttention: https://arxiv.org/abs/2309.06180
- vLLM Blog, vLLM: Easy, Fast, and Cheap LLM Serving with PagedAttention: https://vllm.ai/blog/2023-06-20-vllm
- vLLM Docs, Automatic Prefix Caching Design: https://docs.vllm.ai/en/latest/design/prefix_caching/
- vLLM Source (2026-11-02, commit 16d6673): https://github.com/vllm-project/vllm