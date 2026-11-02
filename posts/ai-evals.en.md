Evals are a bundle of tests and grading methods to verify that LLM functions are working correctly. An eval consists of a set of input samples (evaluation dataset), the ground truth for correct answers, and the grading method. Every time you change the prompt or model, you re-solve the same test paper to compare scores.

## Why is it needed?

For general software, identical inputs yield identical outputs, so unit tests are sufficient. [LLMs](#/post/ai-llm) are not like that. OpenAI's evaluation guide explains that because generative AI is non-deterministic, traditional testing methods are insufficient; evals refer to structured tests that measure accuracy, performance, and reliability amidst this variability.

When enterprises integrate LLM features into services, many things change. A single line of [prompt](#/post/ai-prompt), a model version, [RAG](#/post/ai-rag) search settings, or the list of tools can all alter the answer. It is difficult to know whether fixing one issue improves question A but worsens question B just by eyeballing a few cases. OpenAI's guide also lists "vibe-based evals" (judging based on gut feeling) and adding evaluations only after launch as anti-patterns.

Therefore, evaluation should be placed at the front of development. Both guides view evaluation not as something done once and finished, but as an iterative process that continues to run.

## Overall Flow

Reducing OpenAI's guide to five steps looks like this:

```
목표 정의 → 데이터셋 수집 → 지표 정의 → 실행·비교 → 지속 평가
   │            │              │           │           │
 성공이 뭔가   입력+정답 모음   어떻게 채점  점수 비교   변경마다 재실행,
                                                       세트 키우기
```

Anthropic documents state that you must define success criteria first. Good criteria should be Specific, Measurable, Achievable, and Relevant (SMART). The document provides contrasting examples as follows:

| Bad Criteria | Good Criteria |
|---|---|
| Must perform sentiment classification well | F1 score ≥ 0.85 on a diverse set of 10k held-out tweets, improving by 5% over the current baseline |
| Must not produce harmful answers | Less than 0.1% of outputs flagged as harmful by content filters out of 10k attempts |

Since having only one criterion is rare, the document also notes that most use cases should evaluate multiple criteria (task fidelity, consistency, relevance, tone, privacy, context utilization, latency, cost, etc.) together.

## Evaluation Dataset

This corresponds to the test paper. There are a few principles shared by both documents:

- Mimic the input distribution that will actually enter production services. If constructed only from academic metrics or data unrelated to work, scores will diverge from actual quality (Anthropic: task-specific; OpenAI: datasets not matching production traffic are an anti-pattern).
- Mix common cases, edge cases, and adversarial inputs. Edge cases mentioned in Anthropic's document include irrelevant or non-existent inputs, excessively long inputs, inappropriate inputs, and ambiguous cases where even humans disagree.
- Mix sources. OpenAI's guide includes synthetic data, domain-specific data, human-created content, operational logs, and historical data. It is also said that keeping all logs can provide material for good evaluation cases later.
- For synthetically generated cases, experts are recommended to assign labels.
- Anthropic suggests that having many items graded automatically, even with a weaker signal, is better than having a few high-quality human gradings (volume over quality).

A single data row roughly looks like this. OpenAI's Evals document example also places the input (`ticket_text`) and the human-assigned correct answer (`correct_label`) in one item.

| id | Input | Ground Truth |
|---|---|---|
| refund-1 | "What is the refund period?" | The answer includes "7 days" |
| refund-2 | "Just refund everything" | No expression guaranteeing unconditional refund |
| edge-1 | (empty input) | Re-asks or refuses |

## Three Grading Methods

Anthropic documents state, "Choose the fastest, most trustworthy, and scalable method," presenting three options in order.

| Method | Pros | Cons | Example |
|---|---|---|---|
| Code-based checking | Fastest, highly reliable, easy to scale | Rigid for subtle judgments | Exact match, keyword presence |
| Human review | Most flexible and high quality | Slow and expensive | Expert scoring |
| LLM grading (LLM-as-judge) | Fast, flexible, capable of complex judgments | Reliability must be verified first | Tone score 1-5, yes/no for information leakage |

OpenAI's guide makes similar distinctions. Metric-based methods (exact match, ROUGE/BLEU, function call accuracy, text2sql verified by execution, etc.) are fast and suitable for regression tests but may miss nuances. Human evaluation offers the highest quality but is slow and subject to inter-rater disagreement. Model-based grading is cheaper and more scalable.

### Code-based checking

For parts where the answer is fixed, use code. This includes adhering to formats, mandatory phrases, prohibited phrases, and number ranges. If you have a feature for [structured output](#/post/ai-structured-output), checking whether the JSON matches the schema itself becomes the cheapest validation method. Below is a minimal example verified by running it directly:

```python
cases = [
    {"id": "refund-1", "output": "환불은 7일 이내 가능합니다.", "must": ["7일"], "banned": ["보장합니다"]},
    {"id": "refund-2", "output": "언제든 100% 환불을 보장합니다.", "must": ["7일"], "banned": ["보장합니다"]},
]
def check(c):
    return all(m in c["output"] for m in c["must"]) and not any(b in c["output"] for b in c["banned"])
res = {c["id"]: check(c) for c in cases}
print(res, sum(res.values()) / len(res))
# {'refund-1': True, 'refund-2': False} 0.5
```

### LLM Grading

Items that require human judgment (tone, faithfulness of summary, etc.) should be graded by another model. Anthropic's documentation offers three tips:

- Write rubrics specifically. Example: "The first sentence of the answer must contain 'Acme Inc.'; if absent, automatically mark as incorrect." Multiple rubrics may be needed for a single use case.
- Pin down the output. Use only 'correct'/'incorrect' or a 1–5 scale. Purely descriptive evaluations are difficult to review at scale quickly.
- Let the grading model reason first. The documentation notes that using a thinking-enabled grading model particularly improves evaluation performance in complex judgments.

A grading prompt for the same document looks like this:

```
Grade this answer based on the rubric:
<rubric>{rubric}</rubric>
<answer>{answer}</answer>
Output 'correct' or 'incorrect' in <result> tags.
```

Anthropic also states that it is generally good practice to use a different model to grade than the one that generated the output being evaluated.

<details>
<summary>Detailed explanation: OpenAI guide's recommendations for LLM grading</summary>

- Grading formats include pairwise comparison, single-answer grading, and reference-answer grading.
- Use the best-performing model possible for grading and require it to provide reasoning before assigning a score.
- If possible, convert questions into multiple-choice format. The guide reports that LLMs are better at distinguishing between options than writing open-ended text, recommending pairwise comparison, classification, or rubric-based grading.
- Use clear and detailed rubrics.
- Verify that the grading model consistently aligns with human labels before scaling up.
- The guide acknowledges there is no perfect strategy and that expert labeling is expensive.

</details>

## Where does human evaluation fit in?

Human evaluation is too expensive to handle everything. Instead, it serves as a reference point. OpenAI's guide recommends using human annotations as the ground truth and tuning the automated grader against them for validation and correction. Skipping this calibration step is also listed as an anti-pattern. Recommendations for conducting human evaluations include multiple reviews, providing examples at each scoring stage, setting pass/fail thresholds alongside numeric scores, and consensus voting among multiple reviewers.

In summary, roles are divided:

```
사람 검수   → 소수 샘플로 "정답 기준"을 만들고 채점기를 보정
LLM 채점    → 보정된 기준으로 대량 채점
코드 검사   → 형식·금지어처럼 확정적인 것은 항상 먼저
```

## Regression Testing

Regression occurs when something that previously worked stops working after a fix. Evaluation sets serve as the mechanism to catch this. OpenAI's Evals documentation states that evaluation is essential when deploying models or testing new ones to ensure performance remains at expected levels, advising continuous evaluation during deployment stages and expanding the evaluation set with each change.

The operational approach is simple:

| Timing | Action |
|---|---|
| Just before changing prompts, models, or search settings | Record current scores as a baseline |
| After changes | Re-run with the same set to compare scores |
| Failure cases discovered in production | Add those inputs to the evaluation set |

OpenAI's guide notes that metric-based evaluation is fast and suitable for regression testing. Therefore, it is natural to focus on code checks for every iteration and add LLM grading and human review only during major changes.

## When Structure Becomes Complex

OpenAI's guide states that non-determinism enters at each layer of structure, so evaluation should also be placed at those points.

| Structure | What to Evaluate |
|---|---|
| Single turn | Instruction following (including resistance to conflicting user prompts), functional accuracy |
| Workflow | Each step evaluated separately using the same criteria |
| Single agent | Whether tools were selected correctly and arguments passed accurately |
| Multi-agent | Whether handoffs are detected (handoff accuracy) |

If an [agent loop](#/post/ai-agent-loop) is involved, grading targets not just the final answer but also intermediate tool selections.

## Common Pitfalls

Here's what you can gather directly from both guides:

- Position bias in the grading model: Preferences may vary depending on the order responses are placed in pairwise comparisons. OpenAI's guide states that pairwise comparison or pass/fail formats improve reliability.
- Length bias in the grading model: Grading models tend to prefer longer responses, so response length should be controlled.
- Not aligning the grader with humans: Even high automated scores may diverge from human judgment.
- Relying solely on academic metrics: General metrics like perplexity or BLEU are insufficient for measuring quality in our specific tasks.
- Mismatched datasets and missing edge cases: Scores look good, but failures occur in production.
- Same model generates and grades: Anthropic recommends using a different model for grading.
- Late-stage evaluation: Adding evaluation after release means there is no baseline.

## Common Misconceptions

- High scores do not mean no hallucinations: This statement is only valid within the scope of the evaluation set. Inputs outside this set remain unchanged ([Hallucination](#/post/ai-hallucination)).
- Evaluations are conducted by model companies: Benchmarks (such as MMLU) are used for comparing models, while evaluations tailored to our service are created directly for specific tasks. The OpenAI guide distinguishes between these two.
- Evaluations do not need to be done once: Expand the set with every change and whenever failure cases accumulate.
- Evaluations can prevent issues: Evaluation is about measurement, not output blocking. Blocking during execution is the job of [Guardrails](#/post/ai-guardrails).
- Evaluations are separate from fine-tuning: The OpenAI guide suggests using data consistently collected through evaluation to improve performance, citing reinforcement fine-tuning as an example ([Fine-tuning](#/post/ai-finetuning)).

<details>
<summary>Note: OpenAI Evals Platform Announcement</summary>

OpenAI documentation includes an announcement regarding the discontinuation of the Evals platform. Existing users will have read-only access starting October 31, 2026, with the service scheduled to end on November 30. Datasets are recommended as an alternative. Although the tools may change, the underlying structure (data items, scoring criteria, and post-execution comparison) remains the same, so this does not affect conceptual understanding. The flow in Evals documentation involves defining data schemas and testing criteria, uploading JSONL files containing answer labels, creating runs using models and prompt templates, and viewing pass/fail counts for runs. The scorer used in examples is `string_check` (exact match `eq`, partial match `like`).

</details>

## Reference Links

- Anthropic, Define success criteria and build evaluations: https://platform.claude.com/docs/en/docs/test-and-evaluate/develop-tests
- OpenAI, Evaluation best practices: https://developers.openai.com/api/docs/guides/evaluation-best-practices
- OpenAI, Working with evals: https://developers.openai.com/api/docs/guides/evals

← [Concept Map](#/post/ai-map)

Related posts: [Guardrails](#/post/ai-guardrails) · [RAG](#/post/ai-rag) · [Hallucination](#/post/ai-hallucination)