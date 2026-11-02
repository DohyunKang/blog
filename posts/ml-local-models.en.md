Local models involve downloading model files to your PC and running them directly. Whether a model fits or not is mostly determined by a simple VRAM calculation.

## What does "running locally" mean?

Models used via API run on someone else's server. Running locally means keeping the model weights (files) on your own computer and performing calculations using your CPU and GPU. You don't need an internet connection, and there are no per-token fees. However, you can only run models that fit within your PC's capacity.

Models are essentially tables with a vast number of numbers (weights). If a model has 8B parameters, it contains 8 billion numbers. Storing these in 16-bit (2 bytes) format takes about 16GB, and for speed, they must be loaded into GPU memory (VRAM) during calculation. This is where the bottleneck occurs. That's why quantization—reducing the number of bits used to represent numbers—has become a core technology for local deployment.

Related concepts are covered in detail in [What is an LLM?](#/post/ai-llm), and server-side optimizations are discussed in [Inference Optimization](#/post/ml-inference).

## Quantization

Quantization involves converting weights from 16-bit to shorter integers like 8-bit or 4-bit for storage. The file size decreases almost proportionally to the number of bits, at the cost of a slight drop in accuracy.

The llama.cpp repository states that it supports integer quantization at 1.5·2·3·4·5·6·8 bits. As shown in an example table from the same documentation for Llama-3.1-8B:

| Type | Bits per Parameter | File Size |
|---|---|---|
| F16 | 16.00 | 14.96 GiB |
| Q8_0 | 8.50 | 7.95 GiB |
| Q6_K | 6.56 | 6.14 GiB |
| Q5_K_M | 5.70 | 5.33 GiB |
| Q4_K_M | 4.89 | 4.58 GiB |
| Q3_K_M | 4.00 | 3.74 GiB |
| Q2_K | 3.16 | 2.95 GiB |

There is a logic to the naming convention. The number after "Q" roughly indicates the bit count. "K" refers to the K-quants method, which uses separate scaling per block. The suffixes S/M/L denote small/medium/large scale. Even if a name includes "4-bit," it actually uses slightly more (e.g., 4.89 bits) due to additional information like scale values.

How about quality? The llama.cpp documentation mentions that quantization can lead to accuracy loss, typically measured via perplexity or KL divergence, but does not provide specific numbers. Therefore, this article does not include figures like "Q4 drops performance by X%." There are two key points from the documentation: first, re-quantizing an already quantized model can significantly degrade quality; second, using `imatrix` files can help reduce such losses.

<details>
<summary>Visualizing what quantization does with numbers</summary>

The simplest form works as follows: For each block (e.g., 32 numbers), determine a scale factor `s` based on the maximum absolute value in that block. Each number `w` is then stored as a 4-bit integer via `q = round(w / s)`, and during calculation, it's restored by multiplying `q × s`. Since each block has its own scale factor, the bits per parameter end up slightly higher than 4.

K-quants take this further by introducing sub-blocks within blocks in a more sophisticated manner.
</details>

## GGUF

GGUF is the model file format used by the llama.cpp family. According to the GGML repository documentation, a single file can contain an entire model, enabling fast loading while preserving compatibility with older models even when new metadata is added.

A GGUF file consists of four parts:

1. **Header**: Magic number, version, number of tensors, number of metadata entries
2. **Metadata**: Architecture, context length, attention and RoPE settings, tokenizer, chat template
3. **Tensor Info**: Name, dimensions, type, location
4. **Tensor Data**: Actual weights (including quantized versions)

Since the tokenizer and chat template are included in the file, execution is possible with just one file. Because tensor locations are aligned to fixed intervals (default 32 bytes), the file can also be used by directly mapping it into memory (`mmap`). File names follow a convention like `model-name-size-version-quantization.gguf`, and large models are split into parts such as `00001-of-00003`.

## VRAM Calculation Method

What occupies VRAM mainly consists of two components: weights and KV cache. Additionally, some extra space is used for the runtime working area.

Weights = Number of parameters × Bits per parameter ÷ 8.  
KV cache is memory that grows as conversations get longer, proportional to the context length. ([See details → Context Window and Tokens](#/post/ai-context-window))

```python
def weights_gib(params_b, bpw):
    return params_b*1e9*bpw/8/2**30

def kv_gib(layers, kv_heads, head_dim, ctx, bytes_per=2):
    return 2*layers*kv_heads*head_dim*ctx*bytes_per/2**30   # 2 = K와 V
```

This is a result from running Llama 3.1 8B (assuming ~8.03B parameters, 32 layers, 8 KV heads, and head dimension of 128). Note that the structural numbers are based on known values rather than reading the model card directly, so they may be slightly off; however, the weight sizes align with the table from the llama.cpp documentation (14.96 / 7.95 / 4.58 GiB).

| Item | Size |
|---|---|
| Weighted F16 | 14.96 GiB |
| Weighted Q8_0 | 7.95 GiB |
| Weighted Q4_K_M | 4.57 GiB |
| KV Cache, Context 4,096 (f16) | 0.50 GiB |
| KV Cache, Context 32,768 (f16) | 4.00 GiB |
| KV Cache, 32,768 (8-bit quantized) | 2.12 GiB |

So with Q4_K_M and a 4k context, it's around 5 GiB, which fits on an 8GB card; increasing the context to 32k adds another 4 GiB just for the KV cache. Even with smaller models, expanding the context can cause memory shortages. These figures were obtained by running calculations directly in Python. Actual usage will be slightly higher due to runtime workspace requirements.

KV cache can also be quantized. According to the Ollama FAQ, the default `OLLAMA_KV_CACHE_TYPE` is f16; q8_0 uses about half the memory, and q4_0 uses about a quarter. q8_0 has very little quality loss, while q4_0 may show noticeable degradation with large contexts. These settings apply when Flash Attention is enabled.

## When the Model Exceeds VRAM

llama.cpp supports hybrid inference using both CPU and GPU, as noted in some documentation. Some layers run on the GPU while others are processed by the CPU from system memory. While it works, the CPU-bound layers become a bottleneck, significantly slowing performance. In Ollama, you can check this via the "Processor" column in `ollama ps` output to see if it shows "100% GPU" or a split like "48%/52% CPU/GPU". If performance is slow, verify this first.

## Ollama and llama.cpp

Their relationship is covered separately in [detailed → Open Source Analysis: llama.cpp](#/post/repo-llama-cpp) and [detailed → Open Source Analysis: Ollama](#/post/repo-ollama). Here, we focus only on differences from the user's perspective.

| | llama.cpp | Ollama |
|---|---|---|
| Nature | C/C++ inference engine | Tool bundling model loading, execution, and server |
| Supported Hardware | CUDA, Metal, Vulkan, CPU, etc. | Uses GPU if backend and device support it |
| Configuration | Directly specify quantization, layer distribution, options | Adjusted via environment variables and model settings |
| Server | Provides OpenAI-compatible API server | Local API server |

The llama.cpp repository aims for inference anywhere with minimal setup and notes that Apple Silicon is optimized as a "first-class citizen." Common Ollama settings based on the FAQ are as follows:

- `OLLAMA_KEEP_ALIVE`: Duration to keep the model in memory. Default is 5 minutes; negative values keep it indefinitely, while 0 removes it immediately after response.
- `OLLAMA_NUM_PARALLEL`: Number of concurrent requests per model. Default is 1. Memory scales proportionally with this value × context length.
- `OLLAMA_CONTEXT_LENGTH`: Default context length of 4096 tokens

The default context length of 4096 tokens is easy to overlook and may cause truncation of long documents at the beginning. For serving as a service, see [detailed → AI Service Serving Architecture](#/post/infra-ai-serving).

## Speed vs. Quality Trade-offs

- Reducing bits makes files smaller, uses less memory, and usually improves speed, but at the cost of quality. The acceptable threshold varies by model and use case and should be determined through testing.
- With fixed VRAM, you choose between "larger model with lower bits" or "smaller model with higher bits".
- Increasing context expands KV cache; if it overflows GPU memory, performance drops significantly.
- Offloading layers to CPU allows operation but slows things down.

If you want to adapt a model to your data, applying LoRA on top of a quantized model is an option; see [detailed → Fine-tuning](#/post/ml-finetuning) for more.

## Common Misconceptions

- Quantization makes the model "dumb": There is some loss proportional to bit reduction, but losses are known to be small in higher-bit ranges (near 8 bits). Since this document does not include specific numerical values, we refrain from citing exact figures here.
- Matching only the model file size to VRAM is sufficient: KV cache and workspace memory are also required, especially with longer contexts.
- Further quantizing an already quantized file will help: This can significantly degrade quality; it's better to quantize directly from the original 16-bit version.
- If it doesn't fit on GPU, it won't run: It will just be slower and fall back to hybrid CPU/GPU execution.

## Reference Links

- GGUF format documentation: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md
- llama.cpp quantization tools README: https://github.com/ggml-org/llama.cpp/blob/master/tools/quantize/README.md
- llama.cpp repository: https://github.com/ggml-org/llama.cpp
- Ollama FAQ: https://docs.ollama.com/faq

← Concept map (#/post/ml-map)

Related posts: [Inference optimization](#/post/ml-inference) · [Fine-tuning](#/post/ml-finetuning) · [Open-source analysis: llama.cpp](#/post/repo-llama-cpp)