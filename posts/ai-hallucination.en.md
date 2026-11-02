Hallucination is a phenomenon where a model generates plausible-sounding content that is factually incorrect. I previously thought of it as "the model sometimes malfunctions," but after reading, it seems to be an inevitable outcome given its architecture.

## Definition

Anthropic documents state that hallucination occurs when a model produces text that is "inconsistent with reality or the provided context." Even the latest models are not exempt. While the name literally means "seeing ghosts," there is no intentional intent behind the model's behavior; it is distinct from lying. Instead, the model simply writes incorrect information as if it were correct.

## Why It Happens

### Next-Token Prediction Structure

[LLMs](#/post/ai-llm) calculate which token is most likely to follow based on preceding text and generate one token at a time. This process lacks a separate step to verify whether the sentence is factual. During training, the model learns to produce plausible continuations, not necessarily true ones. Consequently, a divergence occurs between natural-sounding sentences and factually correct ones.

For example, after generating "The author of ○○'s paper," the model appends tokens resembling a person's name even if it doesn't know the actual author. The sentence is completed, but the name is wrong.

### Limitations of Training Data

- Models cannot know facts not present in their training data, such as events occurring after the training cutoff, confidential documents, or extremely rare individuals.
- If the training data contains errors, the model learns those errors as well. The TruthfulQA paper suggests that because models mimic web content, they even adopt common misconceptions. The study found that larger models were actually less truthful, and authors concluded that simply increasing size does not resolve this issue. However, since this experiment was based on models from the GPT-3 era, its findings may not directly apply to current models.
- Rare information appearing only once is difficult for a model to solidify through learning.

### Evaluation Benchmarks Bias Models Toward Guessing

A 2025 paper by OpenAI and researchers titled "Why Language Models Hallucinate" was particularly interesting. It summarizes two key points: first, if a model cannot reliably distinguish true statements from false ones, statistical pressure during training alone can lead to hallucinations. Second, because benchmarks award points for guessing correctly rather than penalizing "I don't know" answers, models are trained to guess on uncertain questions—much like losing points in a multiple-choice test by leaving an answer blank. The paper argues that resolving this issue requires changing the scoring methods of major benchmarks used on leaderboards.

## Types

| Type | Manifestation | Example |
|---|---|---|
| Factual Error | Confidently stating incorrect facts | Non-existent years/numbers, inaccurate person descriptions |
| Fabricated Source | Creating seemingly credible sources | Non-existent paper titles, URLs, or case law |
| Context Drift | Answering differently from the provided document/instructions | Mixing content not in the document into a summary, contradicting prior statements |

This classification is my own synthesis of materials I've read and is not an official standard. In practice, these types often overlap. Fabricated sources are particularly dangerous because their format appears credible, making them hard to detect at a glance.

## Mitigation Strategies

### Explicitly Allow "I Don't Know"

This is the approach Anthropic documents place first. By instructing the prompt that it's acceptable to answer "I don't know" when uncertain, hallucinations can be significantly reduced. As discussed in the earlier paper, without such permission, models tend to guess rather than admit uncertainty.

### Provide Grounding via RAG and Citations

[RAG](#/post/ai-rag) involves first retrieving documents related to the question and inserting them into the [context](#/post/ai-context), then answering based solely on that context. The original paper (Lewis et al., 2020) reports that relying solely on knowledge stored within model parameters limits retrieval, updating, and citation capabilities; attaching external search memory resulted in more factual generation outputs. However, the term "hallucination" does not appear in that abstract—the conclusion that hallucinations decreased based on improved factual accuracy is my inference.

Anthropic documents also offer practical techniques for this: for long documents, first extract direct quotes from the original text and base analysis solely on those citations. After generating an answer, locate supporting citations for each claim; if a citation cannot be found, retract the claim.

### Incorporate Verification Steps

- Ask the same question multiple times to check for consistency in answers; suspect errors if responses vary each time (best-of-N, document introduction).
- Feed the generated answer back as input for self-correction (iterative refinement).
- Restrict the model from using knowledge outside the provided documents.

### Enable Tool Usage

Delegate calculations to calculators, latest information to search engines, and code execution results to running environments—so the model doesn't need to rely on memory alone. This item did not appear directly in the documents I read but is understood through principles similar to RAG.

### Lower Temperature

Lowering temperature restricts the model to selecting only high-probability tokens, resulting in less variable outputs. However, if the highest-probability token represents an incorrect fact, even setting temperature to zero may still produce wrong answers. This is my inference.

## Limitations

Anthropic documents clearly state that these techniques significantly reduce but do not eliminate hallucinations. They also emphasize the importance of human verification. RAG can still provide incorrect answers based on retrieved irrelevant documents, and even citation requirements can lead models to fabricate citations, so one must verify whether the citations actually exist in the source text.

## Evaluation Methods

- **TruthfulQA**: Composed of 817 questions across 38 domains, designed with questions where people commonly answer incorrectly due to misconceptions. At the time, the best model achieved 58%, while humans reached 94%.
- **FActScore**: Breaks down long texts into "atomic facts" and measures the proportion supported by reliable knowledge sources. In biography evaluations, ChatGPT scored around 58%. Since manual scoring is costly (estimated at approximately $26,000 per paper), an automatic estimator was developed alongside it.
- **Evaluation for My Service**: I create a question set with known correct answers and monitor both the accuracy rate and the "I don't know" ratio whenever I change the model or prompt. This is my personal approach; no source is cited.

<details>
<summary>Detailed explanation: Why does saying "I don't know" hurt the score?</summary>

Consider a 100-question exam where you leave 20 questions blank. If leaving them blank results in 0 points, guessing yields an expected value greater than 0. Without penalty for wrong answers, always guessing is advantageous. Many model evaluation benchmarks only check correctness, so models that handle "I don't know" well often rank lower on leaderboards. The paper's recommendation is not to add separate hallucination evaluations but rather to increase penalties for confidently incorrect answers and to recognize expressions of uncertainty within the scoring of these major benchmarks themselves. (I only checked at a high level and could not read specific design details like penalty ratios.)

</details>

## Common Misconceptions

- **Models lie**: They do so without intent; it is simply the result of generating text that seems plausible probabilistically.
- **Hallucinations disappear as models grow larger**: TruthfulQA shows that size alone is insufficient, though this conclusion is based on older model standards.
- **Adding RAG solves everything**: It reduces but does not eliminate hallucinations; retrieval quality directly determines answer quality.
- **Confident tone implies correctness**: There is a weak correlation between tone and accuracy; incorrect answers can still be delivered with the same confident tone.

## Reference Links

- Anthropic document, Reduce hallucinations: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations
- Kalai et al., Why Language Models Hallucinate: https://arxiv.org/abs/2509.04664
- Lewis et al., Retrieval-Augmented Generation: https://arxiv.org/abs/2005.11401
- Lin et al., TruthfulQA: https://arxiv.org/abs/2109.07958
- Min et al., FActScore: https://arxiv.org/abs/2305.14251

← Concept map (#/post/ai-map)

Related posts: [RAG](#/post/ai-rag) · [LLM](#/post/ai-llm) · [Context](#/post/ai-context)