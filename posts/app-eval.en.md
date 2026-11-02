Evaluating LLM apps is not about feeling whether an answer is good; it involves predefining questions and scoring criteria to convert them into numbers, enabling consistent comparison every time fixes are made.

## Why Separate Evaluation is Necessary

Standard code produces the same output for the same input, so testing can often be done with a single line. LLM apps, however, produce slightly different answers each time, making the boundary between right and wrong blurry. This makes it easy to tweak a prompt a few times, run it again, and move on thinking "it's fine."

The problem arises when the improved version is better in some aspects but silently worse in others. Without evaluation, users are the first to notice these issues. Hamel Husain warns that neglecting evaluation while only tweaking prompts and models leads to a "whac-a-mole regression." Evaluation acts as the mechanism to make those moles visible.

## Define Success Criteria First

Anthropic documents state that success criteria should be established before creating evaluations. Good criteria are specific, measurable, achievable, and aligned with the app's purpose. Instead of saying "good performance," specify something like "accurate sentiment classification." Usually, a single metric is insufficient, so multiple dimensions are combined. Examples from the document include an F1 score of at least 0.85, harmless output at 99.5%, and 95% of responses within 200ms.

Much is determined at this stage. Without criteria, you cannot decide which questions to collect or which scoring models to use.

## The Golden Set

The golden set is a collection of problems pairing inputs with "correct answers or passing conditions." It forms the backbone of evaluation, where quality is largely determined here.

Anthropic documents outline three design principles:

- Tailor to the task. Mimic the actual usage distribution and include edge cases such as unexpected inputs, overly long inputs, ambiguous inputs, and harmful inputs.
- Make scoring automatic whenever possible.
- Prioritize quantity over quality. The stance is that having many problems that can be automatically scored, even with slightly weak signals, is better than having few problems requiring manual human scoring.

Regarding where to source problems, Hamel suggests using LLMs to synthesize inputs and continuously adding new ones as new failures are discovered. Transferring failed cases from actual logs into the golden set seems most valuable.

## Three Scoring Methods

| Method | How it works | Suitable for | Weaknesses |
|---|---|---|---|
| Code-based scoring | String matching, inclusion checks, regex, embedding similarity (e.g., ROUGE) | Classification, number/format verification | Verbose answers with diverse expressions |
| LLM-based scoring | Another LLM assigns scores or pass/fail status based on criteria | Tone, summary quality, descriptive answers | The scorer itself can be wrong |
| Human scoring | Humans read and judge directly | Setting criteria, validating scorers | Slow and expensive |

Five example evaluations from Anthropic documents fit neatly into this table. Tweet sentiment classification uses normalized string matching; FAQ consistency uses cosine similarity via SBERT embeddings; summarization uses ROUGE-L; customer service tone is scored by an LLM on a 1–5 scale; and medical chatbot personal health information detection has the LLM answer yes/no.

The order should start with the cheapest methods. Hamel also recommends starting with fast, cheap checks like unit tests before layering model-based evaluations on top. Starting with model evaluation is more expensive and slower while yielding less value.

## Running Small-Scale Tests

I directly implemented and ran code to see how golden sets and regression checks work using only code-based scoring. Model calls were deliberately replaced with fake functions, focusing solely on the structure of the evaluation framework.

```python
golden = [
    {"id": 1, "q": "환불 기한이 며칠이야?", "must": ["7일"], "must_not": ["30일"]},
    {"id": 2, "q": "배송비는 얼마야?", "must": ["3,000원"], "must_not": []},
    {"id": 3, "q": "오늘 날씨 어때?", "must": ["모르"], "must_not": []},
]

def check(case, out):
    return all(m in out for m in case["must"]) and not any(m in out for m in case["must_not"])

def run(app):
    res = {c["id"]: check(c, app(c["q"])) for c in golden}
    return res, sum(res.values()) / len(res)

r1, s1 = run(app_v1)   # 프롬프트 고치기 전
r2, s2 = run(app_v2)   # 고친 뒤
print("회귀:", [i for i in r1 if r1[i] and not r2[i]])
print("개선:", [i for i in r1 if not r1[i] and r2[i]])
```

Fake app v1 gives a fabricated answer ("It's sunny") to weather questions, while v2 claims not to know the weather but incorrectly states the refund deadline as 30 days. The execution results were as follows:

```
v1 {1: True, 2: True, 3: False} 0.67
v2 {1: False, 2: True, 3: True} 0.67
회귀: [1]
개선: [3]
```

Both versions scored identically at 0.67. Looking only at the average number suggests "no change," but in reality, one aspect was fixed while another broke. This reinforced the importance of not relying on a single score; instead, viewing problem-by-problem results side-by-side with the previous version and separately extracting regressions (things that were correct before but are now wrong) is crucial.

## LLM-as-Judge

Since string matching cannot evaluate descriptive answers, another common approach is delegating scoring to a different LLM. This is called LLM-as-judge. Papers by Zheng et al. (MT-Bench, Chatbot Arena) report that strong models like GPT-4 align with human preferences over 80%, which is similar to agreement rates between humans. The abstract of the same paper mentions limitations such as location bias, verbosity bias, and self-reinforcement bias by name only.

Practical guidelines tend to overlap across documents.

- Evaluate the generated model using a different model (Anthropic).
- Constrain the evaluator's output narrowly. Ask for only numbers or yes/no responses, and wrap the answer to be evaluated in tags like `<response>` (Anthropic).
- Use the highest-performing models available as evaluators (Hamel).
- Calibrate the evaluator by comparing it against human judgment and review it periodically. The evaluator is a system that must be managed on its own (Hamel).

<details>
<summary>Detailed explanation: Structure of evaluation prompts</summary>

Following examples from Anthropic documentation, you can use roughly this template:

```
아래 <response>가 다음 기준을 만족하는지 판단해라.
기준: 환불 기한을 정확히 말하고, 정책에 없는 약속을 하지 않는다.
<response>
{{답변}}
</response>
yes 또는 no만 출력해라.
```

Starting with binary outputs like yes/no makes management easier. Hamel also notes that starting with simple good/bad labels and handling fine-grained scores is difficult. Using a 5-point scale causes ambiguity between 3 and 4, leading to disagreements even among evaluators and humans.

To verify if the evaluator is correct, run it on a small set of cases labeled by humans for comparison. Hamel suggests that in imbalanced data, simple accuracy or match rates can mask failures of the minority class; therefore, precision and recall should be reported. For example, if only 5% of answers are bad, labeling everything as "good" would still yield 95% accuracy.

</details>

## Running Evaluations

Evaluation is not a one-time setup; it must be rerun whenever changes occur. Rerun evaluations when the prompt, model version, search settings (such as chunk size or top-k when building [RAG](#/post/app-rag-build) directly), or tool definitions change. This iteration constitutes regression testing. It is practical to separate parts that can run automatically with every code change (like format validation and forbidden word checks) from parts that take time and should only run before deployment (LLM evaluation and human review).

Model-based evaluations incur costs per call, so as the golden set grows, evaluation costs become a line item in the app's cost of goods sold. This topic continues in [AI Service Cost](#/post/app-cost).

## What to Evaluate

| Metric | Example Evaluation Method |
|---|---|
| Tasks with fixed correct answers (classification, extraction) | Accuracy, F1, Exact Match |
| Format | JSON parsing success rate, Schema pass rate ([see Structured Output](#/post/ai-structured-output)) |
| Generation | Ratio of claims not supported by source documents ([see Hallucination](#/post/ai-hallucination)) |
| Safety | Rejection rate for inputs requiring refusal, Rate of blocking leakage attempts ([see Guardrails](#/post/app-guardrails)) |
| Response Speed | Latency distribution |
| Cost | Tokens per request, Cost per request |

Do not aggregate everything into a single number; analyze metrics by category separately. This is because averages can obscure specific issues, as shown in the experiment above.

## Common Pitfalls and Misconceptions

- Relying solely on intuition for verification. Hamel cites this as the primary pitfall.
- Relying on generic evaluation tools and scores that are unrelated to your product's failure modes (same article).
- The belief that automated evaluation replaces human review. Hamel advises skepticism toward claims of eliminating humans and recommends continuing to read data. Reading until there is nothing new to learn defines the stopping criterion.
- Believing a 100% pass rate is the goal. The acceptable failure rate is determined by the product itself.
- Assuming the golden set contains only easy problems. High scores may not reflect actual usage, where errors persist.
- Including evaluation questions directly in prompt examples. This turns evaluation into a test leak, rendering scores meaningless.
- Treating evaluation as a game to inflate metric numbers. If user dissatisfaction remains high despite rising numbers, the golden set does not reflect reality.

Attack cases like [Prompt Injection](#/post/sec-prompt-injection) should be collected separately in evaluation questions so you can immediately detect if defenses have failed.

← [Concept Map](#/post/ai-map) · [LLM App Building Map](#/post/app-map)

Related articles: [Guardrails and Safety Mechanisms](#/post/app-guardrails) · [AI Service Cost](#/post/app-cost) · [Hallucination](#/post/ai-hallucination)

## Reference Links

- Anthropic documentation, Define success criteria and build evaluations: https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
- Zheng et al., Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena: https://arxiv.org/abs/2306.05685
- Hamel Husain, Your AI Product Needs Evals: https://hamel.dev/blog/posts/evals/