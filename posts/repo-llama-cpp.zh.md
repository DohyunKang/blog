下载 llama.cpp 源码（提交 785322d，2026-11-01），我追踪了从模型文件打开到输出 token 的整个过程。主要分为三大部分：文件格式（GGUF）、计算库（ggml），以及在其之上循环运行的 llama 相关代码。量化并非独立附加的功能，而是文件内部张量格式本身。

## 从仓库结构开始

顶层目录包含 `src/`、`ggml/`、`include/`、`tools/`。

| 位置 | 功能 |
|---|---|
| `include/llama.h` | 对外调用的 C API，涵盖模型加载、上下文创建、`llama_decode` 等 |
| `src/` | 包含模型、上下文、KV 缓存、分词器、采样器等模块。其中 `llama-context.cpp` 约有 4,800 行代码 |
| `src/models/` | 每种模型结构对应一个文件（共 172 个），用于构建计算图 |
| `ggml/src/` | 张量运算与后端实现，分为 `ggml-cuda`、`ggml-metal`、`ggml-vulkan`、`ggml-cpu` 等文件夹 |
| `tools/` | 包含可执行文件，如 `cli`、`server`、`quantize`、`llama-bench`、`perplexity` 等 |
| `convert_hf_to_gguf.py` | 将 Hugging Face 模型转换为 GGUF 格式的脚本 |

README 仅用一句话介绍："LLM inference in C/C++"。项目中没有训练代码，推理才是主角。若要支持一种新的模型结构，只需在 `src/models/` 下添加一个文件即可，因此每当有新模型出现时，该文件夹便会随之扩展。[详情 → 推理](#/post/ml-inference)

## GGUF：将所有内容封装在一个文件中

在 `ggml/include/gguf.h` 文件顶部的注释中直接记录了文件格式结构，顺序如下：

1. 魔数 `"GGUF"`（4 字节）及版本号（当前为 `GGUF_VERSION` 3）
2. 张量数量、键值对数量
3. 键值对列表（包含模型结构名称、层数、分词器词表等元数据）
4. 张量信息（名称、维度、数据类型、数据位置）
5. 按顺序排列的张量数据块

文件中不仅包含权重，还集成了配置和词表。因此，仅凭 `llama-cli -hf ...` 一行命令即可下载单个文件并运行。由于张量信息中包含“数据位置”且数据已排序，`llama-model-loader.cpp` 可以利用 mmap 打开文件。在实现 mmap 的代码中甚至存在一个异常处理：“如果 GGUF 数据段未排序，则无法使用 mmap"。这种方式避免了将整个文件读入并复制，而是由操作系统仅将所需部分加载到内存中。

## 量化是块状结构体

在 `ggml/src/ggml-common.h` 中定义了各类块的格式，典型代表为 Q4_0。

```c
#define QK4_0 32
typedef struct {
    ggml_half d;           // delta
    uint8_t qs[QK4_0 / 2]; // nibbles / quants
} block_q4_0;
```

该结构将 32 个权重打包为一个块，每个块包含一个标量 `d`（2 字节）和 32 个 4 位值（共 16 字节）。总计 18 字节存储 32 个权重，平均每个权重占用 4.5 位。若原始精度为 16 位，则压缩率约为原来的 3.5 分之一。按同样方式计算，Q8_0 的块大小为 34 字节（即 8.5 位/权重），Q4_K 则由 256 个超级块组成，其中包含 144 字节（2+2+12+128），平均仍为 4.5 位/权重。对于 7B 参数模型，乘以 4.5 位后约为 3.9GB。此数值基于源码中的结构体计算得出，实际文件大小会因一维张量等以其他格式保留而略有差异（`llama.h` 中关于 Q4_0 的说明也注明了“except 1d tensors"）。[详情 → 本地模型](#/post/ml-local-models)

阅读 `quantize_row_q4_0_ref`（位于 `ggml-quants.c`）可知转换过程十分简洁：在块内找到绝对值最大的元素，将其设为 `d = max / -8`，然后将每个元素除以 `d` 并加上 8.5，最后截断为 0~15 的整数。将高 16 位和低 16 位分别存入一个字节的高半字节和低半字节中。将该函数移植到 Python 并对随机生成的 32 元素块进行测试，得到 18 字节的输出；还原后最大误差为 0.147。由于标量 `d` 为 0.2986，该误差位于半个刻度（d/2 ≈ 0.149）之内，表明舍入误差未超过标量的一半。

<details>
<summary>详细解析：为何块级误差会如此小</summary>

由于块内最大值决定了整个块的缩放比例，若块中存在异常值（outlier），其余值的分辨率也会随之变粗。将块划分为 32 个较小单元的目的即在于此：异常值的影响被限制在当前块内。代价是每个块都需要存储一个标量，从而增加了位数开销（4 位量化值 + 0.5 位缩放比例 = 4.5 位）。
</details>

Q4_K 格式在 256 个超级块内包含小块，并再次以超级块为单位对尺度（`scales`，6 位）和最小值进行量化（参见 `ggml-common.h` 中的注释："scales and mins, quantized with 6 bits"）。这是一种对尺度进行二次量化的结构。

</details>

## 计算是如何进行的

在对量化权重执行矩阵乘法时，输入（激活值）一侧也会被转换为 8 位块（`block_q8_0`），然后以整数形式相乘。`ggml-cpu/quants.c`中的 `ggml_vec_dot_q4_0_q8_0_generic`即为其通用（基础）实现。

- 在每个块中，以整数形式累加 `sumi`。4 位值通过 `(qs & 0x0F) - 8` 解码，并与 8 位值相乘。
- 当块结束时，将 `sumi × 权重尺度 × 激活值尺度` 累加到浮点总和中。

即采用“放大整数乘法，每个块仅乘以一次尺度”的结构。从文件名后缀 `_generic` 可以看出，针对不同的 CPU 架构（如 AVX、NEON 等）存在专门的快速版本，而此版本应为基准实现。

运算在哪个设备上执行由 `ggml-backend` 负责。`llama_model_params`中包含 `n_gpu_layers`（需上传至显存的层数，负数表示全部），因此可以将部分层保留在 GPU 上，其余在 CPU 上运行。正因如此，即使在显存不足的 PC 上也能运行大模型，尽管速度较慢。[详情 → Transformer](#/post/ml-transformer)

## 推理循环：llama_decode 中发生的一切

从上方阅读了 `llama_context::decode`（位于 `llama-context.cpp`）。其流程如下：

1. 若令牌为空，则返回错误码 (-1)。
2. 统计需要输出的令牌数量。若是嵌入模式则全部需要，若是普通生成则仅需最后一个位置。
3. 通过 `memory->init_batch(...)` 将批次划分为小块（ubatch），并在 KV 缓存中查找位置。若无空间，则清理缓存 (`memory_update`) 后再次尝试；若仍失败，则返回 1。
4. 对每个 ubatch 调用 `process_ubatch`。

在 `process_ubatch` 内部，若能复用上一轮的图则直接使用，否则通过 `model.build_graph` 重新构建计算图。随后填充输入张量的值 (`set_inputs`)，并通过 `graph_compute` 执行。若某个 ubatch 失败，代码中还存在从内存中擦除该片段位置并恢复状态的逻辑。

批次大小由两层组成。在 `llama.h` 中说明：`n_batch` 是传入 `llama_decode` 的逻辑最大值，而 `n_ubatch` 是实际一次性计算的物理最大值。若输入提示较长，则会按 ubatch 单位进行分割处理。

在调用 `graph_compute(res->get_gf(), ubatch.n_tokens > 1)` 时，第二个参数传递的是“令牌数量是否大于等于 2"。这似乎是为了区分提示处理（多个令牌）和生成（单个令牌）。

图是由模型特定的代码生成的，位于 `src/models/` 目录下。例如 `llama.cpp`（模型文件名）的处理顺序为：嵌入输入 → 每层 `build_norm` → `ggml_rope_ext` 对 Q·K 添加位置信息 → `build_attn` → `build_ffn`。选择下一个令牌由 `llama_sampler`（链式方式）完成，从 logits 经过采样器链条后输出一个令牌。直接在外层循环此过程的是如 `tools/cli` 或 `tools/server` 等可执行文件。[详情 → 采样](#/post/ai-sampling)

## 与 Ollama·vLLM 对比来看

此前阅读 [Ollama](#/post/repo-ollama) 时了解到，推理计算由独立进程（llama-server）负责。该仓库即专注于此计算部分。Ollama 负责模型管理与上传下载，而实际的令牌计算则在此处完成。相反，[vLLM](#/post/repo-vllm) 则是针对服务器及多用户场景设计的同类任务，其核心在于 PagedAttention 等结构。llama.cpp 侧重于在单台 PC 上高效运行单个文件，而本次未涉及批量处理多个请求的部分。[详情 → AI 服务](#/post/infra-ai-serving)

## 常见误解

- 量化后模型会变成另一个模型：仅降低权重的精度，结构保持不变。但由于误差累积，位数越低质量可能越差。
- GGUF 是压缩文件：不同于 zip 压缩。4 位数值直接存储在文件中，计算也直接读取该格式进行。
- llama.cpp 专为 Llama 模型设计：虽因名称易混淆，但 `src/models/` 目录下共有 172 个按结构分类的文件。
- 若无 GPU 则无法运行：CPU 后端为默认选项。GPU 可通过选择如 `ggml-cuda`、`ggml-metal` 等后端进行叠加。

## 参考链接

- llama.cpp 仓库：https://github.com/ggml-org/llama.cpp
- GGUF 结构注释 (gguf.h)：https://github.com/ggml-org/llama.cpp/blob/master/ggml/include/gguf.h
- 块定义 (ggml-common.h)：https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-common.h
- 量化实现 (ggml-quants.c)：https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-quants.c
- 整数内积 (ggml-cpu/quants.c)：https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-cpu/quants.c
- 推理循环 (llama-context.cpp)：https://github.com/ggml-org/llama.cpp/blob/master/src/llama-context.cpp

← [概念地图](#/post/ai-map)

相关文章：[推理](#/post/ml-inference) · [本地模型](#/post/ml-local-models) · [Ollama](#/post/repo-ollama)