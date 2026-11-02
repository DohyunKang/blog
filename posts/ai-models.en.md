Model names change every few months, so memorizing them is futile; instead, categorizing by company, size, and whether the model is open or closed allows you to find your way even when new names are introduced. The names, prices, and figures below were recorded solely from each company's official pages as of 2026-11-02.

## What is a Model?

Here, "model" refers to a large neural network capable of reading and writing text, similar to an [LLM](#/post/ai-llm). Even within the same company, multiple models of different sizes are released. Larger models excel at difficult tasks but are slower and more expensive, while smaller models are faster and cheaper but struggle with complex work. Consequently, it is often more important to ask "which size fits my needs" rather than "which company is best."

## What's Available by Company

The following table summarizes what was found on the official model pages. Prices are listed per 1 million tokens (MTok) for input/output in USD.

| Company | Model (API Name) | Input/Output Price | Context Window | Notes |
|---|---|---|---|---|
| Anthropic | Claude Fable 5.1 (`claude-fable-5-1`) | $10 / $50 | 1M | For the most difficult reasoning and long agent tasks; relatively slow |
| Anthropic | Claude Opus 5.5 (`claude-opus-5-5`) | $4 / $20 | 1M | Recommended starting point for most tasks, as per documentation |
| Anthropic | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | $2 / $10 | 1M | Balance between speed and performance |
| Anthropic | Claude Haiku 5.5 (`claude-haiku-5-5`) | $0.10~ / $0.50~ | 1M | Fastest and cheapest; suitable for classification and extraction |
| OpenAI | GPT-6 Astra (`gpt-6-astra`) | $10 / $50 | 1.05M | For difficult reasoning and coding |
| OpenAI | GPT-6.1 Sol (`gpt-6.1-sol`) | $2 / $10 | 1.05M | Performance close to Astra at a lower price |
| OpenAI | GPT-6.1 Terra (`gpt-6.1-terra`) | $1 / $5 | 1.05M | Fast and efficient; suitable for computer use and writing |
| OpenAI | GPT-6 Luna (`gpt-6-luna`) | $0.10 / $0.50 | 1.05M | For simple and high-volume tasks |
| Google | Gemini 4 Argon (`gemini-4-argon`) | $2 / $10 (until 11/30, then $4 / $20 from 12/1) | 1M | Primary reasoning model |
| Google | Gemini 3.8 Flash (`gemini-3.8-flash`) | $0.75 / $3.75 (until 12/31, then $1.5 / $7.5) | - | Flash variant for long coding and agent tasks |
| Google | Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`) | $0.30 / $2.50 | - | The cheapest and fastest in the 3.5 series |
| DeepSeek | deepseek-v4-pro | $0.66 / $1.98 (peak rate, excluding cache misses) | 1M | Maximum output 384K |
| DeepSeek | deepseek-flash | $0.15 / $0.6 (peak rate, excluding cache misses) | 1M | Maximum output 384K |

A few observations stand out while reading:

- The flagship models of all three companies (Anthropic, OpenAI, and Google) have a context window of approximately 1M tokens. Context window size alone is no longer the deciding factor; having a larger window does not guarantee better performance, as noted in the [context window](#/post/ai-context-window) article.
- Naming conventions differ by company. For Claude, names like Fable, Opus, Sonnet, and Haiku denote model size. For OpenAI, names such as Astra, Sol, Terra, and Luna indicate tier levels. For Google, terms like Pro, Flash, and Flash-Lite refer to model capabilities or sizes. One must consult the pricing table alongside the names to determine the specific tier.
- DeepSeek prices vary by up to a factor of two depending on the time of day. On weekdays, UTC 01–04 and 06–10 are peak hours, while other times are half price.

## Open Models vs. Closed Models

Closed models can only be used via API; you cannot receive the weights (the collection of learned numbers). Open-weight models allow you to download the weights and run them on your own computer or server. This does not mean the entire source code is open, as licensing conditions vary by model, so commercial usage eligibility must be checked separately for each model.

| Company | Models Verified in Open Listings | License | Size |
|---|---|---|---|
| Qwen (Alibaba) | Qwen3.8-27B | Apache-2.0 | 27B dense, image/video understanding |
| Qwen (Alibaba) | Qwen3.8-Flash-Next, Qwen3.8-2.4T-A95B | - | 180B / 2.4T (sizes shown in Hugging Face listings) |
| DeepSeek | V4.1-Flash, V4-Pro-0813, etc. | Mistral documents list V4.1 Flash as MIT | 763B / 1.7T per Hugging Face listing |
| Mistral | Mistral Large 4 | Mistral Ecosystem Open Weight License | - |
| Mistral | Mistral Small 4, Ministral 3 (3B/8B/14B) | Apache 2.0 | Smaller variants |
| Meta | Llama 4 Scout/Maverick | - | Hugging Face listing: 109B / 402B (no updates since May 2025) |

Meta's information is less organized. The latest Llama model found in the official Hugging Face listings is Llama 4 (updated in May 2025). Search results mention an article about Meta releasing open weights for a model named "Muse" in 2026, but there are only one or two sources for this.

OpenAI did not list any open models like gpt-oss on the model pages read during this review. This does not mean they don't exist; it simply means those pages do not cover them.

[Read more → LLM](#/post/ai-llm)

## Size Tiers: Large, Medium, Small

The table shows that companies tend to categorize models into similar size groups.

| Tier | Examples | Suitable Tasks | Typical Cost |
|---|---|---|---|
| Large | Fable 5.1, GPT-6 Astra, Gemini 4 Argon | Complex reasoning, multi-hour agents | $10+ per input |
| Medium | Opus 5.5, Sonnet 5.5, GPT-6.1 Sol/Terra, Gemini 3.8 Flash | Coding, document processing, general tasks | $0.75 ~ $4 |
| Small | Haiku 5.5, GPT-6 Luna, Gemini 3.5 Flash-Lite | Classification, extraction, routing, batch processing | $0.10 ~ $0.30 |

Anthropic's documentation initially starts with the cheapest model, Haiku, and describes methods for scaling up only when needed, as well as starting with the most powerful model and scaling down. It recommends evaluating models using your own data regardless of the approach chosen.

## Reasoning Models

Reasoning models are those that use thought tokens before generating an answer. Currently, it seems more practical to adjust the amount of reasoning within a single model rather than selecting a separate "reasoning model."

- **Claude**: All four models reviewed exhibit adaptive thinking; Fable and Opus have reasoning always enabled. Depth is controlled via an `effort` parameter. The documentation notes that adjusting effort is often preferable to switching models for document tasks.
- **OpenAI**: The table includes a "reasoning step" field. Astra and Sol range from low to max, while Terra and Luna range from none to max.
- **DeepSeek**: Supports both thinking and non-thinking modes, with thinking mode as the default.
- **Qwen3.8-27B**: Thinking mode is enabled by default and can be disabled per request.

Increasing reasoning leads to more output tokens, which proportionally increases cost and time consumption. This reflects a general architectural principle.

## Multimodal Capabilities

Multimodal refers to handling not just text but also images, audio, and video. According to Claude's documentation, current models support text and image input along with text output. OpenAI's latest models similarly support text and image input with text output. Separate models are used for generating images, audio, or video. OpenAI offers GPT-Image-2.5 and the real-time voice series (GPT-Live, GPT-Realtime), while Google provides Nano Banana (images), Gemini Omni Flash (video), Lyria (music), and TTS series as distinct offerings. In the open-source space, Qwen3.8-27B supports image and video understanding, and DeepSeek V4.1 Flash is listed with image-text input capabilities.

<details>
<summary>Detailed breakdown: Five criteria for selection</summary>

1. Performance: I did not check the benchmark rankings separately this time. As the official documentation states, running an evaluation suite that reflects your own work is the most reliable approach.
2. Pricing: Input and output costs differ, with outputs typically being more expensive. Reading from cache costs a fraction of the input price (Claude lists 2.5–10% in the docs), and the Claude batch API offers a 50% discount. Inference models are billed for thinking tokens as output (indicated as "incl. thinking" on Gemini's pricing page).
3. Speed: According to the Claude documentation, relative latency is slowest for Fable, average for Opus, fast for Sonnet, and fastest for Haiku.
4. Context: Most representative models reviewed this time have a 1M context window. However, quality is independent of this.
5. Local Deployment: Only open-weight models can be run locally; the weight size directly determines the required memory. Qwen3.8-27B, at 27B parameters, is small enough to try running on a personal GPU after quantization. I suspect DeepSeek V4 (hundreds of B to 1.7T) and Qwen 2.4T are too large for personal hardware.

</details>

## Common Misconceptions

- Expensive models are always better: Documentation advises starting with smaller models for bulk tasks like classification and extraction, reserving larger models for difficult tasks only.
- Open models are free: While weights can be downloaded, running them requires GPU resources, electricity, and operational overhead. If used as a service, these costs must be factored in. When building AI features, it's appropriate to calculate token usage costs per user per month first.
- A 1M context window means equal capability: Having the same window size does not guarantee equivalent performance levels.
- Open source and open weights are the same: Often only weights are released while training data and code remain closed. Licenses also vary from Apache 2.0 to company-specific licenses. Mistral Large 4 in the table above is an example of this.
- Larger numbers in names mean newer models: Claude Fable 5.1 and Opus 5.5 are both current versions; numbers should only be compared within their respective families.

← Concept map (#/post/ai-map)

Related posts: [LLM](#/post/ai-llm) · [Context Window](#/post/ai-context-window) · [Hallucination](#/post/ai-hallucination)

## Reference Links (read on 2026-11-02)

- Anthropic, Models overview: https://platform.claude.com/docs/en/about-claude/models/overview
- Anthropic, Choosing the right model: https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
- OpenAI, Models: https://developers.openai.com/api/docs/models
- Google, Gemini API models: https://ai.google.dev/gemini-api/docs/models
- Google, Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- DeepSeek, Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing
- Mistral, Models overview: https://docs.mistral.ai/getting-started/models/models_overview/
- Qwen3.8-27B model card: https://huggingface.co/Qwen/Qwen3.8-27B
- Qwen Hugging Face organization: https://huggingface.co/Qwen
- DeepSeek Hugging Face organization: https://huggingface.co/deepseek-ai
- Meta Llama Hugging Face organization: https://huggingface.co/meta-llama