Fine-tuning involves retraining a pre-trained model on your own data, and the required GPU resources vary significantly depending on whether you train the entire model or only part of it.

## What is Fine-Tuning?

[LLMs](#/post/ai-llm) first undergo pre-training on vast amounts of text. At this stage, they learn about language in general, which is difficult for individuals to achieve alone. This covers the content summarized in [from Pre-training to RLHF](#/post/ml-pretraining). Fine-tuning is the second learning phase applied afterward. It teaches a model that already knows how to speak specific speech patterns, formats, or domain-specific problem-solving techniques.

To summarize:

| | Pre-training | Fine-tuning |
|---|---|---|
| Data | Vast general text | Hundreds to tens of thousands of purpose-specific data points |
| Goal | Foundation for language and knowledge | Specific behaviors, formats, or speech styles |
| Starting Point | Random weights | Already trained weights |
| Cost | Difficult for individuals | Varies depending on the model and method |

Data typically consists of "input and desired output" pairs, such as questions with answers or long documents with summaries. By showing these pairs to the model, we gradually adjust the weights. The learning method is the same [neural network training](#/post/ml-neural-net) as pre-training; the only differences are the data and the starting point.

## Why Full Fine-Tuning is Heavy

Full fine-tuning updates all of the model's weights. The issue lies in memory. To train, you must hold not just the weights but also gradients and optimizer states. Adam-family optimizers store two additional values per parameter. Consequently, the memory required for training can be several times larger than the model size itself.

To illustrate with a single number: loading a 7-billion parameter model using 16-bit (2-byte) precision alone requires about 14 GB for the weights. During training, gradients and optimizer states are added on top of this. The exact multiplier depends on precision and optimizer settings.

Another issue is duplication. Fine-tuning for different purposes creates separate full copies of the model for each use case. If one copy of a 7B model takes 14 GB, ten use cases would require 140 GB.

## The Idea Behind LoRA

LoRA (Low-Rank Adaptation) was introduced in a 2021 paper by Hu et al. It freezes the pre-trained weights and inserts small trainable matrices into each layer. The paper abstract states that for GPT-3 with 175B parameters, the number of parameters to train is reduced to about 1/10,000th, and GPU memory requirements drop to about 1/3rd. Performance on RoBERTa, DeBERTa, GPT-2, and GPT-3 was reported as similar to or better than full fine-tuning. The abstract also notes that there is no increase in inference latency.

The principle works as follows: instead of directly modifying a single weight (matrix W, size d×k), the change ΔW is expressed as the product of two small matrices.

```
W' = W + (alpha / r) * B @ A
     W: d x k (고정)
     B: d x r, A: r x k (이것만 학습, r은 d, k보다 훨씬 작다)
```

Here, r is the rank. If d=k=4096 and r=8, W has approximately 16.78 million elements, while A and B combined have about 65 thousand. Looking at just this matrix represents a reduction to 1/256th of the original size. The PEFT document explains that the number of training parameters is "determined by the rank r and the shape of the original matrix." As r becomes smaller, the matrices become smaller.

The initialization is also noteworthy. B is initialized to zero, while A starts with random values. Therefore, at the start of training, B@A equals zero, and the model behaves exactly like the original model before gradually diverging. I verified this directly using NumPy below.

<details>
<summary>Detailed explanation: Code verifying LoRA with NumPy</summary>

```python
import numpy as np
rng = np.random.default_rng(0)
d, k, r, alpha = 64, 64, 4, 8
W = rng.normal(size=(d, k))
A = rng.normal(size=(r, k)) * 0.01
B = np.zeros((d, r))
x = rng.normal(size=(k,))

# 1) B가 0이면 LoRA를 붙여도 출력이 그대로
print(np.allclose(W @ x, (W + (alpha / r) * B @ A) @ x))   # True

# 2) 학습 후라고 치고 B를 바꾸면, 따로 계산한 것과 합쳐서 계산한 것이 같다
B = rng.normal(size=(d, r)) * 0.1
y_split  = W @ x + (alpha / r) * (B @ (A @ x))
y_merged = (W + (alpha / r) * B @ A) @ x
print(np.allclose(y_split, y_merged))                       # True
print(W.size, A.size + B.size)                              # 4096 512
```

The execution results were True, True, 4096 512. The second check confirms that they are equivalent when combined. The discussion on merging follows here.

</details>

## Where to Attach and What to Select

According to the PEFT documentation, LoRA can be attached to any weight matrix, though in Transformers it is typically applied only to attention blocks. The query, key, and value projection matrices discussed in [Transformers and Attention](#/post/ml-transformer) are the targets. Which layers to apply LoRA to is selected via `target_modules`.

There are three common settings:

| Setting | Function |
|---|---|
| `r` | Rank. A smaller value means fewer parameters, while a larger value increases expressiveness. |
| `lora_alpha` | Scale. By default, it is multiplied by alpha / r. |
| `target_modules` | Layers where LoRA is attached. |

Which values are optimal depends on the model and data, and documentation does not prescribe specific values.

## Merging and Adapters

After training, B and A are saved as separate files with small sizes (adapters). There are two ways to use them:

- Adapters are stacked on top of the base model. By swapping adapters on a single base model, you don't need separate copies for each use case.
- `merge_and_unload()` merges into W to create a single ordinary model. As shown in the second numpy check above, the results are identical, so there is no additional latency after merging. This is why PEFT documentation states that "LoRA adds no inference latency."

The copy problem is also solved. Adapter files are much smaller than the base model, and their exact size depends on r and the target layers.

## QLoRA: Reducing Even the Base Model

While LoRA reduces trainable parameters, the base model still needs to be loaded in 16-bit precision into memory. QLoRA (Dettmers et al., 2023) quantizes the base model to 4 bits and loads it, then trains only the LoRA adapters on top. Gradients flow through the frozen 4-bit model to reach the adapters.

The techniques mentioned in the paper abstract are threefold:

- 4-bit NormalFloat (NF4): A 4-bit data type tailored for weights following a normal distribution
- Double quantization: Quantizing the constants used in quantization further reduces memory usage
- Paged optimizers: Manage memory spikes during training

The paper claims that a 65-billion parameter model can be fine-tuned on a single 48GB GPU while maintaining 16-bit fine-tuning performance. This comparison is based on results from the authors' experimental conditions. The Guanaco model series created with this method achieved the best performance among publicly available models at the time on the Vicuna benchmark, reaching 99.3% of ChatGPT's level with 24 hours of training on a single GPU. However, since this is based on a single benchmark, whether similar results hold for other tasks is a separate issue. Models quantized to 4 bits belong to the same family of ideas as those discussed in [running local models](#/post/ml-local-models).

## When is it Fine-tuning and When is it RAG?

They address different problems. [RAG](#/post/ai-rag) finds relevant documents for each query and appends them to the [prompt](#/post/ai-prompt) to supplement unknown information. Fine-tuning changes the model's behavior itself.

| | RAG | Fine-tuning |
|---|---|---|
| Suitable for | Latest/internal information, citing sources | Tone of voice, output format, specific task methods |
| If information changes | Only documents need updating | Requires retraining |
| Prerequisites | Documents and search environment | Input-output pair data and GPU |
| At inference time | Involves search costs and longer prompts | Prompts can be shorter |

Many cases attempt to use fine-tuning to inject knowledge into the model, but this decision should be made carefully. There is no guarantee that the model will remember what it learned exactly, nor does it indicate which document a statement came from. Issues like confidently stating incorrect information, known as [hallucination](#/post/ai-hallucination), remain unchanged.

Typically, the process starts by refining prompts; if information is insufficient, RAG is used; if format or tone still doesn't align, fine-tuning is considered. Combining both approaches is also common.

## Common Misconceptions

- LoRA makes models smaller: The base model size remains unchanged; only the trainable portion is small. Inference requires the base model. Techniques to reduce model size involve quantization.
- QLoRA performs worse than LoRA: While the paper claims maintained 16-bit fine-tuning performance, this is conditional on specific results and does not imply it always holds true.
- Fine-tuning adds new knowledge: It is certainly effective for teaching format and tone, but injecting knowledge is often more stable with RAG.
- More data is always better: Quality is frequently cited over quantity.

[Inference optimization](#/post/ml-inference) covers how to run merged models quickly.

## Reference Links

- Hu et al., LoRA: Low-Rank Adaptation of Large Language Models: https://arxiv.org/abs/2106.09685
- Dettmers et al., QLoRA: Efficient Finetuning of Quantized LLMs: https://arxiv.org/abs/2305.14314
- Hugging Face PEFT, LoRA conceptual guide: https://huggingface.co/docs/peft/main/en/conceptual_guides/lora

← [Concept map](#/post/ml-map)

Related articles: [From Pre-training to RLHF](#/post/ml-pretraining) · [RAG](#/post/ai-rag) · [Running Local Models](#/post/ml-local-models)