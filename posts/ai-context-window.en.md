# Context Window and Tokens

The context window is the upper limit of content a model can see at once when generating a response, and tokens are the unit used to measure this amount. Understanding these two concepts explains almost everything about "why conversations slow down and become more expensive as they get longer."

## What Are Tokens?

Tokens are the smallest pieces used by models to read and write text. They are neither individual characters nor whole words; they fall somewhere in between. According to Anthropic's glossary, tokens can correspond to words, subwords, characters, or even bytes. When a model receives text, it first converts it into a sequence of these pieces for processing.

Common sequences are grouped into a single token, while rare words are split into multiple fragments. A similar example appears in OpenAI's tiktoken documentation: "encoding" is split into "encod" + "ing". Grouping frequently used fragments into larger chunks allows the same text to be expressed with fewer tokens, improving efficiency, and because they can be split, even unseen words can be processed.

Roughly speaking, this is how it works. The tiktoken README states that on average, one token is about 4 bytes. In English terms, one token is roughly 3–4 characters. Anthropic's glossary also notes that based on previous models, one token was approximately 3.5 English characters, and since model version 4.7, a new tokenizer has been used, resulting in the same text requiring about 30% more tokens. Since the numbers vary by model generation, the documentation advises using the specific model's token counting tool for accurate values.

## Why Korean Uses More Tokens

Here, Korean is at a disadvantage. There are two reasons for this:

- A single Korean character takes 3 bytes in UTF-8, whereas an English alphabet letter takes only 1 byte. This puts Korean at a disadvantage from the start when splitting by bytes.
- If the tokenizer's vocabulary dictionary is primarily based on English, English words become a single token as a whole, while Korean is split into smaller units by syllable.

The first point is a general principle, but exactly how a tokenizer splits text varies by model. I found one measured example: a developer compared 285 blog posts in English, Korean, Japanese, and Chinese to count tokens.

| Ratio of Korean Tokens Compared to English | Multiplier |
|---|---|
| o200k (OpenAI's latest tokenizer) | 1.38x |
| cl100k (OpenAI's previous tokenizer) | 1.82x |
| Claude Tokenizer (public version) | 1.88x |

Looking at a single sentence, "I refactored the agent loop to cut token usage." is 12 tokens, while the Korean equivalent "토큰 사용량을 줄이려고 에이전트 루프를 다시 짰다." was 20 tokens with o200k and 32 tokens with the Claude tokenizer. The word "에이전트" (agent) is split into four tokens in o200k, whereas the English word "agent" is just one token.

These numbers should be viewed cautiously. The author noted that their target content was a technical blog heavy on English code and terminology, so the gap might be even larger for general Korean prose. They also clarified that token count does not directly equal cost, as Korean can express the same meaning with fewer characters.

In summary: "Korean generally uses more tokens than English. The exact ratio varies from 1.4x to higher depending on the tokenizer and text type." As seen in the table above, newer tokenizers tend to reduce this gap (Korean usage dropped by 24.7% when moving from cl100k to o200k).

## Meaning of Window Size

The window refers to "the total number of tokens that can be included in a single request." This is different from the entire training dataset; using Anthropic's terminology, it represents the model's "working memory." The model counts only what is carried in the current request, not the knowledge embedded within it. The concept itself is explained separately in [Details → Context](#/post/ai-context).

The size varies by model. According to this document, Claude's latest models (Opus 5.5, Sonnet 5.5, Haiku 5.5, etc.) have a 1 million token window, and the maximum output per request is 128,000 tokens. Some earlier models had a 200,000 token limit. These numbers change frequently. If you read this article a few months later, it would be appropriate to check an updated model comparison table.

## Input and Output Count Together

This was initially confusing: the window does not count only input. The document states that the window includes "the text the model can reference, including the response itself." Everything goes in: system prompts, all messages in `messages` (including tool results, images, documents), tool definitions, and the model's generated answer and thinking process.

Therefore, if the input fills up the window, there is no room for output. According to the document, exceeding the window with input alone triggers a 400 error ("prompt is too long"), while Claude models 4.5 and later accept the request even if `input + max_tokens` is exceeded but stop generation upon reaching the limit with an error `model_context_window_exceeded`.

```
[ 시스템 프롬프트 | 도구 정의 | 지난 대화 | 이번 질문 | 모델이 쓰는 답 ]
 └──────────────── 전부 합쳐서 윈도우 하나 ────────────────┘
```

## Everything Resets on Every Call

This is the most important point to remember from this article. Conversations may appear continuous, but APIs do not retain memory. As documented, each turn's input consists of "the entire previous conversation + the current user message," and the model's response becomes the input for the next turn. Every time I type a line, the entire prior conversation is resent.

I made some assumptions to get a sense of the scale (these are simple estimates, not actual measurements).

- Each turn increases the conversation by 1,000 tokens, and we make 20 turns.
- The input for the nth call is approximately n × 1,000 tokens.
- The input for the 20th call is about 20,000 tokens.
- Summing up all inputs across 20 calls: 1+2+…+20 = 210, totaling roughly 210,000 tokens.

The conversation length is 20,000 tokens, yet the total input sent is 210,000 tokens. As turns increase, the cumulative total grows nearly quadratically with the number of turns. Doubling the turns (to 40) results in a total of about 820,000 tokens—roughly four times larger. The longer you drag it out, the more the "value of asking one more time" increases.

## Longer Context: Cost, Speed, and Quality

- **Cost**: APIs charge based on input and output tokens. Since input accumulates with each call and is resent, costs per call rise as conversations get longer. Prompt caching helps. According to documentation, reading from a cache costs 0.1 times the base input price (some models offer 0.05 or even 0.025 times), while writing incurs a penalty: 5-minute caches cost 1.25 times and 1-hour caches cost 2 times the base rate. The default cache lifetime is 5 minutes, so if you wait too long before returning, the cache expires.
- **Speed**: Longer inputs tend to increase latency until the first token appears. Documentation notes that caching typically improves time-to-first-token for longer documents.
- **Quality**: This is often overlooked. Anthropic's documentation states: "More context does not automatically mean better performance. As tokens increase, accuracy and recall drop—a phenomenon called 'context rot'."

Research has explored quality issues as well.

- Liu et al., "Lost in the Middle": Performance is best when relevant information appears at the beginning or end of the input; it drops significantly if placed in the middle—even with models designed for long contexts.
- Chroma, "Context Rot": Compared 18 models and found that even with fixed task difficulty, performance declines as input length increases. When similar but incorrect distracting passages are present, longer inputs lead to greater instability. Comparing a short input of ~300 tokens within the same conversation against a full input of ~113,000 tokens showed the shorter version performed far better.

Both studies represent specific experiments. Chroma itself admitted it did not explain the underlying causes, and findings on positional effects are mixed: "Lost in the Middle" suggests strong positional effects, while Chroma's needle experiment found no noticeable positional effect. Therefore, we should interpret this not as "longer is always worse," but rather "performance can become increasingly unstable as length grows."

## Compaction (Compression)

When the context window fills up, there are generally three options: start a new conversation, truncate older parts, or summarize and continue. Compaction refers to the third approach. According to Anthropic's documentation, compaction replaces older turns with summaries generated by Claude on the server, keeping the conversation within the window. It also claims to help maintain a smaller active context, which improves quality as conversations grow longer.

The methods described in documentation fall into two main categories:

| | Direct via Request | Automatic within Token Limit |
|---|---|---|
| Who decides the trigger point? | My application | API triggers when input reaches a threshold |
| Preserve original recent turns | Yes | Paused and reinserted later |
| Runs in background | Yes | No (executed within that request) |

Both are marked as beta. Since I haven't used them directly, my understanding is based solely on documentation descriptions. You can also use your own summarizer on the client side.

The principle is simple, and the trade-off is clear: anything omitted in a summary cannot be recovered. Therefore, documentation advises writing custom summary prompts if the default summary misses information needed for later turns. What you choose to keep becomes part of the design. This is often handled by Haneus (Harness), which is discussed in detail [here → Harness](#/post/ai-harness).

## Common Misconceptions

- "The window is 1M tokens, so I can fit everything": Just because it fits doesn't mean it will work well. Context rot research demonstrates this difference.
- "The window refers only to input size": It includes output tokens and thinking tokens as well.
- "The model remembers earlier conversations": It doesn't remember; it receives the prior conversation anew each time. Chat apps merely hide this mechanism from users.
- "Caching eliminates window concerns": Cached prompts still occupy the window, per documentation. Caching affects cost, not available space.
- "Korean takes N times more tokens than English": Tokenization varies by model. The only accurate way is to measure directly using your own text and models.

<details>
<summary>Detailed explanation: thinking tokens and context windows</summary>

Thought tokens are part of `max_tokens`, billed as output tokens, and included in the window. Whether a model retains thoughts from previous turns for subsequent requests varies by model. According to the documentation, Opus 4.5+, Sonnet 4.6+, Haiku 5.5+, and others default to retaining previous thought blocks, treating them like regular input in the window and billing them again as input upon re-entry. For earlier versions of Opus, Sonnet, and Haiku up to 4.5, the API automatically strips them out. Thought tokens are billed once as output when generated; for models that retain them, they are billed again as input in subsequent requests.

When using tools, tool requests and results accumulate in the same manner. Since the tool definition itself occupies window space, the documentation provides separate guidance on reducing tool definitions or loading them later.

</details>

<details>
<summary>Detailed explanation: Does the model know about remaining tokens?</summary>

According to the documentation, Sonnet 5, Sonnet 4.6, Haiku 4.5, and others have a "context awareness" feature that injects the entire budget into the system prompt and informs the model of the remaining amount after tool calls. For Opus 4.7+ and Sonnet 5.5+, it is stated that they do not receive this tag but instead can allocate budgets via task budget (beta).

</details>

## Reference Links

- Anthropic documentation, Context windows: https://platform.claude.com/docs/en/build-with-claude/context-windows
- Anthropic documentation, Compaction overview: https://platform.claude.com/docs/en/build-with-claude/compaction
- Anthropic documentation, Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Anthropic documentation, Glossary(Tokens): https://platform.claude.com/docs/en/about-claude/glossary
- OpenAI tiktoken: https://github.com/openai/tiktoken
- Liu et al., Lost in the Middle: https://arxiv.org/abs/2307.03172
- Chroma, Context Rot: https://www.trychroma.com/research/context-rot
- jangwook.net, Measuring token tax for non-English (personal blog, secondary source): https://jangwook.net/en/blog/en/multilingual-llm-token-tax-experiment/

← [Concept map](#/post/ai-map)

Related posts: [Context and Context Engineering](#/post/ai-context) · [LLM](#/post/ai-llm) · [Harness](#/post/ai-harness)