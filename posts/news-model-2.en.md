Moonshot AI has uploaded the weights for Kimi K3 to Hugging Face. Reading the model card and license file directly reveals that the meaning of "open" is far more layered than initially thought. (Verification date: 2026-11-02)

## What kind of model is it?

Kimi K3 is a Mixture-of-Experts model that accepts both text and images. The model card introduces itself as an "open-weight, native multimodal agentic model." The numbers below are taken directly from the card.

| Item | Value |
|---|---|
| Total Parameters | 2.8T |
| Active Parameters per Token | 104B |
| Number of Layers | 93 (including 1 dense layer) |
| Experts | Selects 16 out of 896, with 2 shared |
| Context Length | 1,048,576 tokens |
| Vision Encoder | MoonViT-V2 (401M) |
| Vocabulary Size | 160K |

In a MoE architecture, not all parameters are used; instead, only some experts are activated per token. Since only 104 billion out of the total 2.8 trillion parameters are used per token, the computational load is closer to that of active parameters, while memory usage is closer to the full parameter count. This difference leads to the discussion on "can it be reversed" later. The basic concept can be found in detail at [What is an LLM?](#/post/ai-llm).

## Notable aspects of the architecture

The card and the GitHub repository convey the same information. Out of 93 layers, 69 use KDA (Kimi Delta Attention), while 24 use Gated MLA attention. The blog describes KDA as an "efficient foundation for scaling attention." Another new element, Attention Residuals (AttnRes), is explained as a method that selects and retrieves what is needed in the depth direction rather than accumulating representations uniformly across layers. The blog states that this structural change improves overall scaling efficiency by about 2.5 times compared to K2; however, this claim comes from Moonshot itself.

The costs and quality issues when actually using a 1 million token context are covered separately in [Context Window and Tokens](#/post/ai-context-window).

## Weight Format: Quantization is Standard

According to the card, QAT (Quantization-Aware Training) was performed starting from the SFT stage. The weights use MXFP4, while activations use MXFP8. Since the model was designed with low precision in mind from the start of training, reducing precision later differs from typical quantization approaches. The tensor types in the Hugging Face files are indicated as F32, BF16, and U8.

<details>
<summary>How much storage does MXFP4 roughly require (estimation)</summary>

If one parameter is 4 bits, it equals 0.5 bytes. 2.8 trillion × 0.5 bytes is approximately 1.4 TB. Actual storage will be larger due to scale values and some high-precision tensors. This is an estimation; the exact storage capacity must be checked via the repository's file listing.

Just because active parameters are 104B doesn't mean you only need memory for a 104B model. Since which experts are activated varies per token, all experts must reside in memory to run quickly. The general method for calculating VRAM requirements is covered in detail at [Running Local Models](#/post/ml-local-models).
</details>

## How to Run It

The card outlines four paths:

- **Hosted API**: Available at platform.kimi.ai with model name `kimi-k3`, compatible with OpenAI and Anthropic endpoints.
- **Self-hosting**: Recommends vLLM, SGLang, and TokenSpeed as engines.
- **Docker Model Runner**: Use `docker model run hf.co/moonshotai/Kimi-K3`.
- **GGUF Quantization for llama.cpp·Ollama·LM Studio**: Connected via the quantizations list in the card.

The principles behind how serving engines batch requests and manage KV cache are detailed in [Inference Optimization](#/post/ml-inference).

## Thinking Mode is Always On

This aspect stands out most when using the API. According to the card, Thinking is always enabled, and results are contained within `reasoning_content`. The `reasoning_effort` parameter accepts low, high, or max, with max as the default. When using tools across multiple turns, assistant messages must be resubmitted including not just `content`, but also `reasoning_content` and `tool_calls`. The impact of thinking tokens on output costs and latency is discussed in detail at [Reasoning Models and Thinking Tokens](#/post/ai-reasoning).

API pricing is listed in the blog. Input costs are $0.30 per 1 million tokens for cache hits and $3.00 for cache misses, with output at $15.00. Since cache hits are ten times cheaper, fixing prefixes becomes increasingly important for long conversations. This principle is covered in [Prompt Caching](#/post/ai-prompt-caching).

## Performance Numbers

Only a few entries are moved from the model card table (based on maximum inference strength).

| Benchmark | Score |
|---|---|
| GPQA Diamond | 93.5 |
| Terminal-Bench 2.1 | 88.3 |
| BrowseComp | 91.2 |
| OSWorld-Verified | 84.8 |
| MCPMark-Verified | 94.5 |
| HLE-Full (no tools / with tools) | 43.5 / 56.0 |

All figures are from Moonshot's own report published on the card. The blog post notes that compared to Claude Fable 5 and GPT 5.6 Sol, it "still trails," meaning it hasn't caught up yet, but consistently outperforms other evaluated models. Benchmark numbers need to be rechecked each time a new model is released, so I've collected them separately in [AI Model Map](#/post/ai-models).

<details>
<summary>Other scores on the card</summary>

DeepSWE 67.5, FrontierSWE 81.2, ProgramBench 77.8, SWE-Marathon 42.0, MCP-Atlas 84.2, Toolathlon-Verified 76.5, GDPval-AA v2 1686(Elo), OmniDocBench 91.1, Video-MME(with captions) 90.0, MMMU-Pro 81.6 / 83.4(no tools / with tools), MathVision 94.3 / 97.8. The reference date varies by item even within the card: some are based on July 23, 2026 (per Artificial Analysis), while FrontierSWE is based on July 16.
</details>

## License: Neither MIT nor Apache

The license name on the Hugging Face card is "Kimi K3 License" and applies to both the code and weights. The contents of the LICENSE file are as follows:

- Use, copy, modify, distribute, relicense, sell, run, deploy, fine-tune, and create derivatives are permitted free of charge.
- The conditions are to retain copyright notices and comply with applicable laws.
- "Model as a Service" businesses that provide inference or fine-tuning APIs to third parties require a separate agreement with Moonshot if combined revenue exceeds $20 million over 12 consecutive months.
- Products exceeding 100 million monthly active users or $20 million in monthly revenue must prominently display "Kimi K3" in the UI.
- Internal use and usage via official Moonshot products or certified inference partners are exempt from these MaaS and labeling obligations.

For individuals or small teams, there is little to worry about; restrictions mainly apply to those attempting significant API-based monetization with this model. Since the license text is a legal document, it should be read directly when using it in commercial services.

## Thoughts after reading

This model best illustrates that "open weights" does not necessarily mean "run on your own PC." While weights are available to everyone, few systems have enough memory to host full expert models. Thus, the card seems designed to guide users across multiple paths—APIs, serving engines, GGUF, and more. If using locally, it may be more practical to start with compatible APIs rather than local deployment. I also got the impression that the pricing is tuned for agent-like use cases involving repeated long-context interactions, given the low cache hit rate.

← [Concept Map](#/post/ai-map)

Related posts: [What is an LLM?](#/post/ai-llm) · [Running Local Models](#/post/ml-local-models) · [Inference Optimization](#/post/ml-inference)

## Source Links

- Hugging Face Model Card: https://huggingface.co/moonshotai/Kimi-K3
- Hugging Face License File: https://huggingface.co/moonshotai/Kimi-K3/blob/main/LICENSE
- GitHub Repository: https://github.com/MoonshotAI/Kimi-K3
- Moonshot Official Blog: https://www.kimi.com/blog/kimi-k3