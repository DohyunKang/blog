vLLM 是一个推理引擎，用于在服务器上运行大语言模型（LLM）并批量处理多个请求。其核心在于精细划分 GPU 内存以管理 KV 缓存，以及为每个步骤的令牌分配资源的调度器。

## 这是什么产品

这是一个开源项目，接收模型文件并将其作为兼容 OpenAI API 的服务器启动。它并非专为单人单次运行设计，而是针对多人同时发送请求的场景进行了优化。[详情 → AI 服务](#/post/infra-ai-serving)

本文基于 2026-11-02 的 main 分支（提交 16d6673）进行浅层克隆阅读。由于代码更新迅速，文件位置和行号可能会很快发生变化。阅读的重点位于 `vllm/v1/` 目录下的调度器、KV 缓存管理和引擎循环部分，未涉及模型实现或 CUDA 内核。

## 问题：KV 缓存占用大量内存

LLM 是逐个生成令牌的。为了避免每次重新计算前面令牌的 key/value 值，这些值会被存储在 GPU 上，这就是 KV 缓存。由于每个请求的长度不同且无法预知回答何时结束，旧方法会预先预留连续的最大长度空间。vLLM 博客指出，这种旧系统因内存碎片化和过度预留导致内存浪费高达 60%~80%。这种浪费限制了单次可处理的请求数量（批处理大小），从而降低了吞吐量。

## 原理 1：PagedAttention，分块管理

这一理念类似于操作系统的虚拟内存。将单个请求的 KV 缓存切割成固定大小的块，这些块在 GPU 内存中可以不连续。每个请求维护一张“逻辑块 → 物理块”的映射表（block table），仅在生成新令牌时才获取新块。

| | 旧方法 | PagedAttention |
|---|---|---|
| 空间分配 | 预先预留最大长度的连续空间 | 按需逐个获取块 |
| 浪费 | 碎片化、过度预留 | 仅发生在请求的最后一个块内部 |
| 共享 | 困难 | 多个请求可指向同一个物理块 |

根据博客数据，内存浪费仅发生在最后一个块中，且低于 4%。论文摘要声称在相同延迟下，吞吐量是 FasterTransformer 和 Orca 的 2~4 倍。博客还指出与 HF Transformers 相比最高提升 24 倍，与 TGI 相比最高提升 3.5 倍，这些数值是基于 LLaMA-7B(A10G) 和 13B(A100 40GB) 使用 ShareGPT 长度分布测得的。由于这是 2023 年的对比数据，若将当前版本相互比较，结果可能会有所不同。

单个块的令牌数由配置值 `block_size` 决定，在代码 (`config/cache.py`) 中默认硬编码为 16。块池由 `v1/core/block_pool.py` 中的 `BlockPool` 负责管理。它预先生成块对象，通过队列管理空闲块，并单独维护一张哈希表用于查找块。

## 原理 2：前缀重用（prefix caching）

当大量请求以相同的系统提示符开始时，其前部分的 KV 值是相同的。系统会直接复用已生成的块，而无需重新计算。代码中的 `hash_block_tokens` 功能可概括为一行：块的哈希 = hash(前一个块的哈希，当前块的令牌，附加键)。由于混合了前一个块的哈希，因此只有当“从开头到当前位置的前缀完全相同”时，匹配才成立，而非仅仅当前块内的令牌相同。

我编写了一段模拟该结构的玩具代码（块大小为 4，使用 sha256，与真实代码不同）进行了测试：

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

结果如下，已执行验证：

```
a: ['dec0e9', 'cabceb']
b: ['dec0e9', '5785bf']   # 첫 블록 재사용, 둘째부터 다름
c: ['423961', 'd3738b']   # 첫 블록이 다르니 뒤도 전부 다름
```

结果显示，即使 c 的第二个块的令牌（索引 4~7）与 a 相同，哈希值却不同。这是因为前缀部分不同。因此，重用仅适用于“从开头延续的相同区间”。官方设计文档也指出，缓存仅保留完全填充的块，且只复用最长的匹配区间。

此外，即使整个提示符都在缓存中，最后一个令牌仍需重新计算，因为需要 logits 来选择下一个令牌。在 `kv_cache_manager.py` 的 `get_computed_blocks` 中有一条注释，限制了使用 `prompt_length - 1`。由于此限制，可能导致最后一个块被整体重新计算。

哈希算法的默认值是 sha256（见 `config/cache.py` 中的 `prefix_caching_hash_algo`）。文档提到 xxhash 系列更快，但由于存在碰撞风险，在多用户环境中需谨慎使用。如果为每个请求提供 cache salt，则仅共享相同 salt 之间的缓存。

驱逐策略采用 LRU（最近最少使用）。未使用的块会保留哈希值进入空闲块队列；当需要新块并从队列前端取出时，其哈希值会被清除，从而从重用候选列表中移除。请求结束后，块会从队列尾部返回。由于队列尾部的块再次被使用的可能性较低，因此优先将其驱逐（官方文档）。

## 原理 3：调度器，分配令牌预算

`v1/core/sched/scheduler.py` 中的 `Scheduler.schedule()` 方法决定了每个步骤为每个请求分配多少 token。这是一个超过 3,700 行的文件，顶部的注释很好地解释了其结构。总结如下：

- 不区分"decoding 阶段”和"prefill 阶段”。
- 每个请求仅有 `num_computed_tokens`（已计算的 token 数）和 `num_tokens_with_spec`（提示词 + 输出 + 推测 token）。
- 在每个步骤开始时，分配的 token 数量会追赶上后续所需的 token 数量。
- 仅凭这一规则即可处理 chunked prefill、prefix caching 和 speculative decoding。

步骤的总预算为 `max_num_scheduled_tokens`，配置中的 `max_num_batched_tokens` 默认值为 2048，`max_num_seqs` 默认值为 128（参见 `config/scheduler.py`）。流程解读如下：

1. 首先按顺序处理正在运行的请求（`running`），在预算内确定所需 token 数量，并通过 `allocate_slots` 获取 KV 块。
2. 若预算仍有剩余，则从等待队列（`waiting`）中取出请求，查询前缀缓存并继续执行 prefill。
3. 对于长提示词，不会一次性全部输入，而是按预算切分后分批输入（chunked prefill）。若 `enable_chunked_prefill` 已关闭且提示词长度超过剩余预算，则在此处停止。也可通过 `long_prefill_token_threshold` 限制单个请求在单步中使用的 prefill token 数量上限。

因此，即使一个长提示词进入，也能与正在运行的请求的后续 token 一同放入同一批次。直到新请求结束，其他请求也不会停滞。这被称为连续批处理（continuous batching）。[详情 → 模型推理](#/post/ml-inference)

### 若 KV 块不足

当 `allocate_slots` 返回 `None` 时，表示没有可用的 KV 块。此时将驱逐优先级最低的一个请求（`_preempt_request`）：若策略为 FCFS，则驱逐 `running[-1]`（最新进入的请求）；若为 PRIORITY 策略，则驱逐优先级值最大的请求。被驱逐的请求会归还其占用的块，并以 `num_computed_tokens = 0` 的状态回到 `waiting` 队列的最前端，即后续需从头重新计算。这是一种以牺牲部分计算效率为代价来节省内存的选择。被驱逐的次数累加在 `num_preemptions` 中。此处仅阅读了相关函数实现，尚未验证被驱逐请求能恢复多少前缀缓存。

### 引擎循环

`v1/engine/core.py` 中的 `step()` 是整个架构的核心骨架。按所读内容整理如下：

```
scheduler_output = scheduler.schedule()
future = model_executor.execute_model(scheduler_output, non_block=True)
...
model_output = future.result()   # 없으면 sample_tokens 호출
outputs = scheduler.update_from_output(scheduler_output, model_output)
```

流程为：调度 → GPU 执行 → 结果更新，该循环持续运行。在 `update_from_output` 中判断请求是否完成并归还块，这是从函数名称和流程中推断得出的，具体实现细节尚未完全阅读。

## 常见误解

- vLLM 是为了加速模型推理：它并未改变模型本身的计算方式，而是通过减少内存浪费，使更多请求能放入同一批次处理。若仅发送单个请求，其优势并不明显。
- 前缀缓存仅在词序完全相同时生效：如同前述示例所示，必须从头开始连续匹配；即使提示词中间存在相同片段，也无法利用缓存。
- 开启缓存会改变输出结果：官方文档指出，启用缓存并不会改变输出，仅减少重复计算。
- 内存不足会导致请求失败：在该代码中，系统会先驱逐其他请求并稍后重新计算，具体延迟取决于队列状况。

<details>
<summary>详细解析：按文件查看</summary>

| 文件 | 内容 |
|---|---|
| `v1/core/sched/scheduler.py` | `schedule()`、`_preempt_request()`、`update_from_output()` 的位置，以及 token 预算变量 |
| `v1/core/kv_cache_manager.py` | `get_computed_blocks`(缓存查询)、`allocate_slots`(块分配)、`free` |
| `v1/core/block_pool.py` | `BlockPool`、哈希→块表、空闲块队列、`free_blocks` 的驱逐顺序说明 |
| `v1/core/kv_cache_utils.py` | `hash_block_tokens`: (前序哈希、token、extra_keys) 进行哈希计算 |
| `v1/core/sched/request_queue.py` | FCFS 队列与优先级队列 |
| `v1/engine/core.py` | `step()` 循环 |
| `config/cache.py`, `config/scheduler.py` | 默认值 (block_size 16, 哈希 sha256, prefix caching 默认开启，batch tokens 2048, sequence 128) |

最新的 main 分支中混合了 Mamba 和滑动窗口模型、多个 KV 缓存组、外部连接器（将 KV 传递到其他位置）、推测解码等特性，这些内容分散在调度器的各个部分。因此，论文中的简单图示与代码存在较大差异。上述说明仅遵循了最基础的路径。

</details>

<details>
<summary>详细解析：推荐学习顺序</summary>

初次阅读时，按以下顺序理解负担较小：先查看 `core.py` 中的 `step()`，接着是 `schedule()` 顶部的注释，最后是 `block_pool.py` 中的类说明。由于文件较大，建议通过函数名进行搜索来查阅。

</details>

← [AI 概念图](#/post/ai-map)

相关文章：[Ollama 分析](#/post/repo-ollama) · [llama.cpp 分析](#/post/repo-llama-cpp) · [AI 服务](#/post/infra-ai-serving)

## 参考链接

- Kwon et al., Efficient Memory Management for Large Language Model Serving with PagedAttention: https://arxiv.org/abs/2309.06180
- vLLM 博客，vLLM: Easy, Fast, and Cheap LLM Serving with PagedAttention: https://vllm.ai/blog/2023-06-20-vllm
- vLLM 文档，Automatic Prefix Caching 设计：https://docs.vllm.ai/en/latest/design/prefix_caching/
- vLLM 源码 (2026-11-02, commit 16d6673): https://github.com/vllm-project/vllm