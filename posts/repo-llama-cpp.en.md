I traced the path from downloading llama.cpp (commit 785322d, 2026-11-01) until model files opened and tokens started appearing. It turned out to be three main components: the file format (GGUF), the computation library (ggml), and the llama code that loops over them on top. Quantization is not a separate feature attached to it, but rather the tensor format itself within the file.

## Starting with the Repository Structure

At the top level, there are `src/`, `ggml/`, `include/`, and `tools/`.

| Location | Function |
|---|---|
| `include/llama.h` | C API called from outside. Includes model loading, context creation, `llama_decode`, etc. |
| `src/` | Handles models, contexts, KV cache, tokenizer, and samplers. `llama-context.cpp` is about 4,800 lines. |
| `src/models/` | One file per model architecture (172 files). Contains code for building graphs. |
| `ggml/src/` | Tensor operations and backends. Folders are split into `ggml-cuda`, `ggml-metal`, `ggml-vulkan`, `ggml-cpu`, etc. |
| `tools/` | Executables like `cli`, `server`, `quantize`, `llama-bench`, `perplexity`. |
| `convert_hf_to_gguf.py` | Script to convert Hugging Face models to GGUF format. |

The README introduces it in one line: "LLM inference in C/C++". There is no training code; inference is the star. Supporting a single model architecture requires adding a file to `src/models/`, so when new models appear, this folder grows accordingly. [Details → Inference](#/post/ml-inference)

## GGUF: A Format That Packs Everything Into One File

The file structure is written verbatim in the top comment of `ggml/include/gguf.h`. The order is as follows:

1. Magic string `"GGUF"` (4 bytes), followed by the version (currently `GGUF_VERSION` 3)
2. Number of tensors, number of key-value pairs
3. Key-value pairs (metadata such as model architecture name, number of layers, tokenizer vocabulary, etc.)
4. Tensor information (name, dimensions, data type, data location)
5. Sorted blocks of tensor data

It contains not just weights, but also settings and the vocabulary in a single file. That's why running `llama-cli -hf ...` downloads and runs with just one file. The "data location" field exists within tensor information, and since the data is sorted, `llama-model-loader.cpp` can open the file using mmap. There was even an exception in the code using mmap stating: "Cannot use mmap if GGUF data sections are not sorted." Instead of reading and copying the entire file, this method lets the operating system load only the necessary parts into memory.

## Quantization is a Block-Based Structure

Block definitions for each format are defined in `ggml/src/ggml-common.h`. A representative example is Q4_0.

```c
#define QK4_0 32
typedef struct {
    ggml_half d;           // delta
    uint8_t qs[QK4_0 / 2]; // nibbles / quants
} block_q4_0;
```

Weights of 32 items are grouped into one block. Each block has one scale `d` (2 bytes) and 32 values of 4 bits each (16 bytes). With 18 bytes for 32 weights, each weight takes up 4.5 bits. If it were originally 16-bit, this is roughly 1/3.5th the size. Calculating similarly, Q8_0 has a block size of 34 bytes (8.5 bits), and Q4_K has 144 bytes across 256 super-blocks (2+2+12+128), also resulting in 4.5 bits per weight. Multiplying 7B parameters by 4.5 bits yields approximately 3.9GB. This number is calculated from the structure in the source code; actual file sizes differ slightly because one-dimensional tensors remain in other formats (`llama.h` also notes "except 1d tensors" in the Q4_0 description). [Details → Local Models](#/post/ml-local-models)

Reading `quantize_row_q4_0_ref` (`ggml-quants.c`) reveals a brief conversion process. Within a block, the value with the largest absolute magnitude is found to set `d = max / -8`, then each value is divided by `d`, added 8.5, and truncated to an integer between 0 and 15. The upper 16 bits and lower 16 bits are stored in the upper and lower nibbles of a single byte respectively. Translating this function to Python and running it on a random block of 32 items yielded 18 bytes, with a maximum error of 0.147 upon restoration. Since the scale `d` was 0.2986, the value fell within half a step (d/2 ≈ 0.149), meaning rounding error is less than half the scale.

<details>
<summary>Detailed explanation: Why is block-level error this low?</summary>

Since the largest value within a block determines the scale, if there is one outlier in the block, the resolution of the remaining values becomes coarser together. This explains why blocks are split into smaller chunks of 32 items; outliers' influence is contained within that block. However, storing a scale for each block increases bit usage (4-bit value + 0.5 bits from scale quotient = 4.5 bits).
</details>

The Q4_K block contains smaller blocks within 256 super-blocks, and their scales and minimum values (`scales`, 6 bits) are re-quantized at the super-block level (see comments in `ggml-common.h`: "scales and mins, quantized with 6 bits"). This structure involves quantizing the scale once more.

</details>

## How Computation Works

When performing matrix multiplication with quantized weights, the input (activations) are also converted to 8-bit blocks (`block_q8_0`) so that integer multiplication can be performed. The generic implementation is found in `ggml-cpu/quants.c`'s `ggml_vec_dot_q4_0_q8_0_generic`.

- For each block, a `sumi` is accumulated as an integer. 4-bit values are unpacked using `(qs & 0x0F) - 8` and then multiplied by the 8-bit value.
- Once a block finishes, `sumi × weight_scale × activation_scale` is added to the floating-point sum.

In other words, the structure is "perform large integer multiplications and multiply scales only once per block." The `_generic` suffix in the file name suggests that faster versions exist for specific CPU types (AVX, NEON, etc.), while this serves as the reference implementation.

The `ggml-backend` handles which device performs the computation. Since `llama_model_params` includes `n_gpu_layers` (number of layers to offload to VRAM; negative means all), it is possible to keep some layers on the GPU and run the rest on the CPU. This allows large models to run, albeit slowly, even on PCs with insufficient VRAM. [Read more → Transformers](#/post/ml-transformer)

## The Inference Loop: What Happens in One `llama_decode` Call

Reading from the top of `llama_context::decode` (`llama-context.cpp`), the flow is as follows:

1. If the token buffer is empty, it returns an error (-1).
2. It counts how many tokens need to be generated. In embedding mode, all are needed; in standard generation, only the last position is required.
3. `memory->init_batch(...)` splits the batch into smaller chunks (ubatches) and finds space in the KV cache. If no space is available, it clears the cache (`memory_update`) and retries; if that fails too, it returns 1.
4. For each ubatch, it calls `process_ubatch`.

Inside `process_ubatch`, if the previous graph can be reused, it is used as-is; otherwise, a new computation graph is created via `model.build_graph`. Next, values are filled into the input tensors (`set_inputs`), and execution occurs via `graph_compute`. If an ubatch fails, there is code to erase the locations of that chunk from memory and revert the state.

The batch size consists of two layers. In `llama.h`, `n_batch` is described as the logical maximum that can be passed to `llama_decode`, while `n_ubatch` is the physical maximum actually computed at once. If a long prompt is provided, it is processed in chunks of ubatches.

In the call `graph_compute(res->get_gf(), ubatch.n_tokens > 1)`, the second argument passes whether "there are two or more tokens." This appears to distinguish between prompt processing (multiple tokens) and generation (single token).

The graph is created by code in `src/models/` for each model. For example, with `llama.cpp` (model file name), the sequence builds up as: embedding input → `build_norm` per layer → `ggml_rope_ext` for Q·K positional encoding → `build_attn` → `build_ffn`. Selecting the next token is handled by `llama_sampler` (chain style), producing a single token after passing through the logits and sampler chain. The loop running this externally is executed by executables like `tools/cli` or `tools/server`. [Read more → Sampling](#/post/ai-sampling)

## Comparison with Ollama and vLLM

When reading about [Ollama](#/post/repo-ollama) earlier, it was noted that inference computation is handled by a separate process (`llama-server`). This repository focuses on that computation side. Ollama manages model storage and the upload/download points, while actual token generation originates here. Conversely, [vLLM](#/post/repo-vllm) was built to handle similar tasks but optimized for servers and multiple users, making structures like PagedAttention central. `llama.cpp` focuses on efficiently running a single file on one PC, whereas handling multiple requests concurrently was not covered in this reading. [Read more → AI Serving](#/post/infra-ai-serving)

## Common Misconceptions

- Quantization makes the model different from others: it only reduces the precision of weight values while keeping the structure identical. However, errors accumulate, so lower bit depths can lead to reduced quality.
- GGUF is a compressed file: distinct from standard zip compression. 4-bit values are stored directly in the file, and computations read and process this format directly.
- llama.cpp is dedicated to Llama models: despite the name causing confusion, there are 172 files organized by architecture in `src/models/`.
- It cannot run without a GPU: CPU backend is the default. GPUs can be added by selecting backends like `ggml-cuda` or `ggml-metal`.

## Reference Links

- llama.cpp repository: https://github.com/ggml-org/llama.cpp
- GGUF structure comments (gguf.h): https://github.com/ggml-org/llama.cpp/blob/master/ggml/include/gguf.h
- Block definitions (ggml-common.h): https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-common.h
- Quantization implementation (ggml-quants.c): https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-quants.c
- Integer multiplication (ggml-cpu/quants.c): https://github.com/ggml-org/llama.cpp/blob/master/ggml/src/ggml-cpu/quants.c
- Inference loop (llama-context.cpp): https://github.com/ggml-org/llama.cpp/blob/master/src/llama-context.cpp

← [Concept map](#/post/ai-map)

Related posts: [Inference](#/post/ml-inference) · [Local models](#/post/ml-local-models) · [Ollama](#/post/repo-ollama)