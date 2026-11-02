Sampling is the method by which a model actually picks one word from the probability distribution it calculated, while temperature and top-p determine how conservative that selection process should be. However, recently Claude has stopped supporting these parameters entirely, so I've compiled both the concepts and the current state of affairs.

## In a single sentence

I asked the same question twice and received different answers. The model wasn't broken; it was designed this way from the start. [LLM](#/post/ai-llm) calculates a score for "how plausible each token is" at every step of writing text, converts those scores into probabilities, and then picks one based on that probability distribution. This final "picking" step is sampling.

Therefore, temperature, top-p, and top-k do not change the model's knowledge or intelligence. They only affect how we sample from the already-calculated probability distribution.

## Principle: From Scores to a Selected Word

The scores output by the model are called logits. Each word has one, and they are not yet probabilities. When these are passed through the softmax function, they become probabilities that sum to 1. The flow is as follows:

| Step | Action | Parameter Affected |
|---|---|---|
| 1 | Calculate scores (logits) for each word | Model itself |
| 2 | Divide scores by temperature | temperature |
| 3 | Create probability distribution using softmax | - |
| 4 | Discard low-probability candidates | top-k, top-p |
| 5 | Pick one from remaining candidates based on probability | - |

This process repeats for every token (not just individual characters). Since hundreds of sampling steps occur for a single response, even one different pick in the middle can change the entire subsequent sentence. This is why answers diverge for the same question.

## Temperature

Temperature is the value used in step 2 to divide the scores. A lower temperature widens the score differences, causing the top-ranked item to take almost all the probability, while a higher temperature narrows the differences and spreads the probability more evenly. Approaching 0 means almost always picking the top-ranked item (called greedy decoding).

I ran a simple Python script to verify the numbers directly (see below for details). I provided scores of `[3.0, 2.5, 1.5, 1.0, 0.5, -1.0]` for six candidates and only changed the temperature.

| Temperature | 1st Place | 2nd Place | 3rd Place | Sum of Others |
|---|---|---|---|---|
| 0.2 | 92.4% | 7.6% | 0.1% | 0% |
| 1.0 | 48.4% | 29.4% | 10.8% | 11.5% |
| 2.0 | 32.9% | 25.6% | 15.5% | 26.0% |

At temperature 0.2, the answer is practically fixed, whereas at 2.0, even the last-place candidate has a chance of being picked around 4.5%. Looking at this table, I finally understood why people say "higher temperature means more creative." It's not exactly about creativity; rather, it increases the opportunity to pick words with lower probabilities.

## top-k and top-p

When the temperature is high, nonsensical words sometimes get picked. Therefore, there are separate mechanisms to cut off the tail.

- **top-k**: Only keeps the top k items sorted by probability and discards the rest. If k=2, only the 1st and 2nd place remain in the example above. While simple, its weakness is that the count is fixed regardless of the situation. Even if the 1st place has 99% probability, k items are kept, and when candidates are closely matched, too many get cut off.
- **top-p (nucleus sampling)**: Adds up probabilities in descending order and keeps only those until the sum reaches p. The number of candidates varies depending on the situation. If the top item is highly confident, only one or two remain; if it's ambiguous, several remain.

top-p was proposed by Holtzman et al. in a 2019 paper. According to the paper, continuously picking only the highest probability results in boring and repetitive text, so they sample only from the "dynamic nucleus" of the probability distribution to cut off the low-confidence tail. The same paper also argues that decoding method alone can significantly change quality even with the same model.

In the example above (temperature 1.0), setting top-p to 0.9 leaves candidates up to 4th place because the sum of ranks 1–3 is 88.6%, which hasn't reached 0.9 yet, while 5th and 6th are discarded. The probabilities of the remaining candidates are renormalized so their sum equals 1 again.

<details>
<summary>Detailed explanation: Code I ran myself</summary>

```python
import math, random

def softmax(logits, T=1.0):
    z = [x / T for x in logits]
    m = max(z)                       # 오버플로 방지
    e = [math.exp(x - m) for x in z]
    s = sum(e)
    return [x / s for x in e]

def top_k(p, k):
    keep = set(sorted(range(len(p)), key=lambda i: -p[i])[:k])
    q = [p[i] if i in keep else 0 for i in range(len(p))]
    s = sum(q)
    return [x / s for x in q]

def top_p(p, P):
    order = sorted(range(len(p)), key=lambda i: -p[i])
    keep, c = set(), 0
    for i in order:
        keep.add(i)
        c += p[i]
        if c >= P:
            break
    q = [p[i] if i in keep else 0 for i in range(len(p))]
    s = sum(q)
    return [x / s for x in q]

logits = [3.0, 2.5, 1.5, 1.0, 0.5, -1.0]
p = softmax(logits, 1.0)
print(top_k(p, 2))      # [0.622, 0.378, 0, 0, 0, 0]
print(top_p(p, 0.9))    # [0.509, 0.309, 0.114, 0.069, 0, 0]
```

The execution results showed probabilities per temperature as `[0.924, 0.076, 0.001, 0, 0, 0]` for T=0.2, `[0.484, 0.294, 0.108, 0.066, 0.04, 0.009]` for T=1.0, and `[0.329, 0.256, 0.155, 0.121, 0.094, 0.045]` for T=2.0. First lowering the temperature to 0.7 and then applying top-p of 0.9 yielded `[0.622, 0.305, 0.073, 0, 0, 0]`. In other words, using temperature and top-p together has a compounding effect.

The code above is a toy example created to illustrate the concept.

</details>

## When and how to adjust

The OpenAI API reference (Chat Completions) describes `temperature` as a value between 0 and 2. It states that higher values like 0.8 make the output more random, while lower values like 0.2 make it more focused and deterministic. `top_p` is an alternative to temperature; if set to 0.1, it considers only tokens in the top 10% of probability mass. It recommends changing one or the other but not both. My understanding is that this is because they produce effects in the same direction and overlap (though this reasoning itself is not present in the documentation).

A common rule of thumb is as follows. Note that this section was not verified against official documentation but reflects generally known practices.

| Task | Low | High |
|---|---|---|
| Summarization, extraction, classification, coding | O | |
| Brainstorming, naming, writing | | O |
| Tests requiring identical output for identical input | O | |

## Common Misconceptions

Does temperature 0 always yield the same answer? Almost, but not guaranteed. I have not directly verified this myself. While many claim that server-side calculations (floating-point ordering, batch processing, etc.) might prevent perfect consistency, I did not check sources for this specific claim in this article.

Does lowering temperature reduce hallucinations? No. Temperature only changes how the probability distribution is sampled; it does not make the model know things it doesn't. If the top-ranked candidate is wrong, a lower temperature will output that wrong answer more confidently.

Does higher temperature mean smarter? No. It just increases diversity. Furthermore, in models that undergo long reasoning processes like [reasoning models](#/post/ai-reasoning), how these values work varies by model.

## Claude is Removing These Values

This was surprising to me. I assumed adjusting sampling parameters was standard practice, but when I opened the Anthropic documentation's model support deprecation page (API parameter deprecations), it stated that `temperature`, `top_p`, and `top_k` are being removed in API version `2026-10-21`. Requests sent to this version will result in a 400 error immediately upon sending these values. The alternative method recommended by the documentation is to "remove them and guide model behavior via prompts."

To summarize:

| Situation | Action (per documentation) |
|---|---|
| API version 2026-10-21 | All three values removed; sending them results in a 400 error |
| Previous versions + Claude 4.7 and later models | Sending non-default values results in a 400 error |
| Previous versions + other models | Not explicitly mentioned in this document |

One blog (Enjoy Agentic Industries) notes that the previous version continues to function and no end-of-life date has been announced. Since this is secondary documentation rather than an official statement, I used it for reference only. The same blog recommends keeping code that stabilizes results with lower temperatures on older versions like Claude Sonnet 4.6, as these effects are lost in the new version.

My understanding is that requests for "consistent answers" should now be addressed via prompts or [structured output](#/post/ai-structured-output) rather than temperature. Other providers (such as OpenAI) still retain these values in their documentation as noted above. Since support varies by model and provider, it is best to check the specific model documentation before use. Differences between models can be seen further in the [AI model map](#/post/ai-models). Information on other limits, such as input size, is available in the [context window](#/post/ai-context-window) article.

## Reference Links

- Holtzman et al., The Curious Case of Neural Text Degeneration (nucleus sampling): https://arxiv.org/abs/1904.09751
- Anthropic documentation, Model deprecations (API parameter deprecations table): https://platform.claude.com/docs/en/about-claude/model-deprecations
- OpenAI Python SDK source (temperature, top_p parameter descriptions): https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/chat/completion_create_params.py
- Enjoy Agentic Industries, Claude API version 2026-10-21 (secondary commentary): https://enjoy.dev/blog/claude-api-2026-10-21/

← Concept map (#/post/ai-map)

Related articles: [What is an LLM?](#/post/ai-llm) · [Hallucination](#/post/ai-hallucination) · [Structured Output](#/post/ai-structured-output)