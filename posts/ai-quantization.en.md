To run a large model on your PC, it must first fit into memory. Therefore, there are two main approaches to reduce its size: quantization and distillation. Quantization stores the same model's numbers using fewer bits, while distillation teaches a small model how to behave like a large one. The names sound similar, which often causes confusion, but they target different aspects of reduction.

## How much memory does a model consume?

The size of an [LLM](#/post/ai-llm) is defined by the number of parameters (weights). For example, "8B" means 8 billion parameters. The memory footprint of each parameter depends on its precision.

```
가중치 메모리 ≈ 파라미터 수 × 숫자 하나의 바이트 수
```

| Precision | Size per Number | 8B Model | 70B Model |
|---|---|---|---|
| FP16 / bf16 | 2 bytes | ~16GB | ~140GB |
| 8-bit | 1 byte | ~8GB | ~70GB |
| 4-bit | 0.5 bytes | ~4GB | ~35GB |

The Hugging Face quantization documentation also states that an 8B model requires approximately 16GB in bf16, 8GB in 8-bit, and 4–5GB in 4-bit. The reason 4-bit is listed as 4–5GB rather than exactly 4GB is likely due to additional metadata such as scale values attached to the data (the value in the 70B column of the table above is calculated directly using the formula).

## Quantization: Storing Numbers Coarsely

Quantization reduces memory usage by storing weights with fewer bits. According to documentation, this involves storing both weights and, in some cases, activation values using fewer bits to reduce the model's memory requirements. However, reducing bit depth slightly lowers accuracy, and different methods offer varying balances between memory, speed, and accuracy.

A simple analogy is reducing photo file size. By rounding fine-grained original values to nearby tick marks for storage, you save space; however, the coarser the tick marks, the greater the difference from the original, which constitutes quality loss.

<details>
<summary>Detailed explanation: Rounding tick mark example (simple custom illustration)</summary>

Suppose a single weight is 0.37. Storing it with 8 bits means choosing one of 256 available tick marks close to the value. With only 16 tick marks available in 4-bit, the value must be rounded to a more distant mark. Actual implementations are more sophisticated; they attach a scale (interval between ticks) to groups of values rather than using a fixed grid. Details on how to determine group sizes for scales can be found in Hugging Face's quantization concept guide.

</details>

### What do the names mean?

When reading about quantization, you encounter terms like GGUF, GPTQ, and AWQ. These are not all at the same level; they are mixed concepts.

| Name | Identity |
|---|---|
| GGUF | File format. Stores weights, settings, and tokenizer in a single file (per HF documentation). Used by llama.cpp family. |
| GPTQ | Quantization method (paper). Approximates second-order information to maintain accuracy while quantizing in one pass. |
| AWQ | Quantization method (paper). A low-bit approach that reduces only weights and protects approximately 1% of the most important weights. |
| bitsandbytes | Library that converts data to 4-bit or 8-bit upon loading. Appears in HF documentation examples. |
| Q4_K_M-like names | Indicators of quantization type appended to GGUF file names. Found in HF documentation example filenames. |

So, "GGUF vs. GPTQ" is not a completely equivalent choice. GGUF is the container, while GPTQ and AWQ are algorithm names for the reduction process.

### What GPTQ and AWQ Do

The GPTQ paper (Frantar et al., 2022, arXiv 2210.17323) describes a method to quantize GPT-family models in one pass. According to the abstract, reducing weights to 3–4 bits results in almost no accuracy drop compared to the original. The authors quantized a 17.5 billion parameter model in about 4 GPU hours and enabled generation inference on a single GPU. Speed improvements over FP16 are reported as approximately 3.25x on A100 and 4.5x on A6000.

The observation from the AWQ paper (Lin et al., 2023, arXiv 2306.00978) is that not all weights are equally important. Protecting approximately 1% of the most critical channels significantly reduces quantization error. The abstract notes that importance is determined by activation value statistics rather than weight magnitude, and neither backpropagation nor reconstruction is required.

Both methods address "how to round values to minimize loss." According to HF documentation, GPTQ requires a calibration dataset during loading, while most other methods do not.

### How Much Quality Loss?

This varies depending on the method, model, and bit depth. The GPTQ paper stated that there is almost no degradation at 3–4 bits and showed usable accuracy even at 2-bit or ternary levels, but this does not apply to all models. If you have a specific model in mind, it's best to compare directly through your own experiments. You can find benchmarks for performance comparisons on resources like the [AI Model Map](#/post/ai-models).

## Distillation: A Large Model Teaches a Small One

Distillation is a different approach to reducing model size. Instead of coarsely quantizing numbers, it involves training a smaller model to learn from the outputs of a larger one. The larger model is referred to as the teacher, and the smaller one as the student.

The abstract of Hinton et al.'s paper "Distilling the Knowledge in a Neural Network" (2015, arXiv 1503.02531) begins as follows: Ensembling multiple models trained on the same data by averaging their predictions is an easy way to improve performance, but it is heavy and expensive for deployment. This paper introduces a method to compress the knowledge of such an ensemble into a single model. The terms "teacher" and "student" do not appear in the abstract; they are terminology used in this article.

The resulting model has fewer parameters from the start. Therefore, its weights differ from those of the original model, and it is given a separate name. While seeing that large and small model families are released together might suggest some were created using distillation, one must check each model's public documentation to determine if it was distilled.

## Quantization vs. Distillation

| | Quantization | Distillation |
|---|---|---|
| What it does | Stores the numbers of the same model using fewer bits | Trains a small model using the outputs of a large model |
| Model structure | Remains unchanged | Creates a new, smaller structure |
| Additional training | Almost none (GPTQ uses calibration data) | Required |
| What is reduced | Bits per number | Number of parameters |
| Loss source | Rounding error | Parts the student cannot replicate |
| Who does it | Often involves using already quantized files | Usually done by the model provider |

Both can be used together. Quantizing a model made smaller via distillation to 4 bits combines both effects.

This is different from fine-tuning methods like LoRA ([fine-tuning](#/post/ai-finetuning)), which changes behavior, whereas quantization and distillation reduce size.

## Tools for Running Locally

- **llama.cpp**: An open-source inference project written in C/C++. The README states it supports integer quantization from 1.5-bit to 8-bit, can mix CPU and GPU to partially accelerate models larger than available VRAM, and supports multiple backends including CUDA, Metal, Vulkan, and HIP. It claims to load Hugging Face models directly via the `-hf` option and run an OpenAI-compatible API server.
- **Ollama**: Accepts a model with a single command (`ollama run <model>`) for chat and exposes a REST API at `localhost:11434`. It uses llama.cpp as its backend.
- **Hugging Face Transformers**: Passing quantization settings to `from_pretrained` loads the model in a quantized state; already quantized checkpoints are automatically loaded based on the method specified in the configuration. According to this document, over 20 methods are handled with the same code. However, GGUF models are typically dequantized back to their original precision during loading, so the document notes there is no memory benefit; thus, GGUF is more naturally used within the llama.cpp ecosystem.

<details>
<summary>Detailed explanation: Transformers load example (copied from documentation)</summary>

This is an example copied from the Hugging Face documentation, not code that has been executed. It shows loading an 8B model using bitsandbytes at 4-bit precision.

```python
import torch
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
)
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.1-8B-Instruct",
    quantization_config=quantization_config,
    device_map="auto",
)
```

</details>

## Checking if it Fits on Your GPU

The process is straightforward:

1. Check the number of model parameters (often indicated in the name, e.g., 8B, 70B).
2. Multiply by the bit count: approximately × 0.5GB for 4-bit, × 1GB for 8-bit, and × 2GB for FP16.
3. Verify if this value is sufficiently smaller than your available VRAM.

For example, an 8B model at 4-bit takes about 4–5GB, making it a viable candidate even on an 8GB VRAM card. A 70B model at 4-bit still requires about 35GB, which exceeds the capacity of a single 24GB GPU for weights alone. In such cases, llama.cpp's CPU+GPU mixed execution becomes an option; however, the documentation only mentions partial acceleration without specifying speed improvements.

It is important to leave some margin because memory usage extends beyond just the weights. The Hugging Face documentation separately mentions quantization cache options that save KV cache memory during long generation sequences. As conversations grow longer, the cache expands up to the size of the [context window](#/post/ai-context-window). Therefore, it is safer to choose a model or bit precision one step smaller than what exactly fits your VRAM. The same document also links to a quantization selection space showing how much memory models consume per precision level on hardware.

## Common Misconceptions

- Quantization makes the model smarter: No, it actually reduces accuracy. The documentation also notes that there is an accuracy-cost trade-off when reducing bits.
- 4-bit means quality is halved: The GPTQ paper abstract states that degradation is almost non-existent at 3–4 bits. However, this depends on the model and task, so it's best to verify directly.
- GGUF is a quantization method: It's actually a file format. Parts of the filename like Q4_K_M indicate the type of quantization used.
- Quantization and distillation are the same thing: No, they differ in what is being reduced, as shown in the table above.
- Quantized models cannot be fine-tuned: The HF documentation mentions a comparison table regarding fine-tuning support for each method. Support varies by method.
- Large models running locally are always slow: Speed depends on both hardware and the quantization method. The GPTQ paper reports cases where performance improved by more than 3x compared to FP16, but this result is from a GPU environment.

## Reference Links

- Frantar et al., GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers: https://arxiv.org/abs/2210.17323
- Lin et al., AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration: https://arxiv.org/abs/2306.00978
- Hinton et al., Distilling the Knowledge in a Neural Network: https://arxiv.org/abs/1503.02531
- llama.cpp repository README: https://github.com/ggml-org/llama.cpp
- Ollama repository README: https://github.com/ollama/ollama
- Hugging Face Transformers, Quantization overview: https://huggingface.co/docs/transformers/main/en/quantization/overview

← [Concept Map](#/post/ai-map)

Related posts: [LLM](#/post/ai-llm) · [Fine-tuning and LoRA](#/post/ai-finetuning) · [AI Model Guide](#/post/ai-models)