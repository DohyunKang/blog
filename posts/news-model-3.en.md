When a new model is released, release papers always come with scorecards. Names like SWE-bench, HLE, and OSWorld appear one after another, and we compare how many points each model scored. However, this autumn, the news was about the scorecards themselves rather than the scores. Epoch AI launched "Benchmark Reviews," auditing benchmarks themselves, and several widely used tests have already been judged as "Flawed." The content below is from checking the Epoch page on November 2, 2026.

## What Project Is This?

Benchmark Reviews is a list that reviews each benchmark individually and assigns a verdict. There are three possible verdicts:

| Verdict | Meaning |
|---|---|
| Verified | Reviewed and no major issues found |
| Flawed | Errors significantly affecting the score (≥20%) |
| Not enough info | Insufficient public information to judge |

The criterion for "Flawed" is when grading errors affect the score by 20% or more. Epoch noted that benchmarks they created themselves are not reviewed due to conflicts of interest. Review priority is based on three factors: impact, citation frequency, and whether the capability has already been addressed.

## Current List

As of the check date (2026-11-02), 24 entries are listed, with the first review dated August 10. Among these, here are the well-known names:

| Benchmark | Verdict | Review Date |
|---|---|---|
| Humanity's Last Exam | Flawed | August 11 |
| SWE-bench Verified | Flawed | September 3 |
| SWE-Bench Pro | Flawed | September 1 |
| Terminal-Bench 4.0.0 | Flawed | September 4 |
| Berkeley Function Calling Leaderboard v4 | Flawed | September 10 |
| SimpleQA Verified | Verified | September 10 |
| OSWorld 2.1 | Flawed | September 28 |
| GraphWalks | Verified | September 29 |

Overall, "Flawed" verdicts are the majority, "Verified" are few, and the rest have insufficient information. The "Not enough info" category refers to cases where judgment was deferred due to lack of publicly available data.

## What Does a Flawed Benchmark Look Like?

We examined three examples; their error types differ, making them easier to understand when viewed together.

HLE randomly selected 48 problems for human verification. Errors warranting score changes were found in 22 (46%) of them. Twelve problems were fundamentally invalid—for example, asking for a "4-point DFT" while the provided sequence had only 8 elements. The rest involved incorrect answer keys, where correct answers were marked wrong or incorrect answers marked right. Since the sample size was 48, the review did not estimate how model rankings might have changed.

SWE-bench Verified was not sampled directly by Epoch; instead, it relied on an audit report released by OpenAI in February. That audit examined 27.6% of the dataset and found that 59.4% of those contained tests that suppressed functionally correct solutions. Multiplying these gives a minimum of 16.4% of the entire set being broken. Compounding this is contamination: by September 3, problems and answers were 100% public, and OpenAI concluded that the leading models tested had seen some problems and solutions during training. Consequently, Epoch judged it as "no longer possible to measure the intended capability."

OSWorld 2.1 selected 50 out of 108 computer manipulation tasks for review. Errors were found in 40 cases across 36 tasks, categorized into three types:

- Impossible tasks: The grading system expects a feature (e.g., a 6-month subscription setting) that does not exist in the UI.
- False positives: Submitting all 130 documents yields full marks without going through the selection process.
- False negatives: The answer is "Salesforce License renewal," but the key is "Salesforce License," resulting in zero points.

The audit noted a maximum impact of 50.4% based on full-score standards within the audited scope, emphasizing this as an upper bound rather than measured loss. For the GPT-6 Astra model in this benchmark, it was calculated that approximately 20.8% of its score was lost on tasks affected by flawed grading.

<details>
<summary>Summary of False Positives and False Negatives</summary>

The grader's job is to determine "Is this answer correct?", so there are two directions in which it can fail:

- **False negative**: Declaring a correct answer wrong, leading to lower-than-actual model scores. This includes SWE-bench's strict tests and OSWorld's string mismatches.
- **False positive**: Accepting an incorrect answer or a shortcut as correct, leading to higher-than-actual scores. Examples include submitting all documents in OSWorld and the full-score shortcuts reported in SWE-bench.
- **Impossible problems**: Conditions are contradictory or missing, making it impossible for anyone to answer correctly, thereby lowering the score ceiling below 100%.

</details>

Mixing both directions may appear to cancel each other out and look acceptable, but since different models are more susceptible to errors on one side or the other, rankings can still fluctuate.

</details>

## Notable Aspects of the Review Methodology

Both HLE and OSWorld reviews first run AI evaluations to filter out suspicious issues, followed by human verification for final confirmation. In OSWorld, it is noted that a sub-agent was attached to each task one by one for review. The structure where an agent selects candidates and humans make the final decision resembles the parallel processing method outlined in the [sub-agent](#/post/ai-subagent) article. However, points failing to meet evidence standards were discarded.

Another key aspect is that reviews are partial. Once a benchmark exceeds the "Flawed" threshold, further review stops. Consequently, benchmarks marked as Flawed remain unassessed for subsequent items (such as evaluation environment bias). Links to developer responses are still pending on both the HLE and SWE-bench pages.

## Changes When Viewing Scorecards

When comparing model release scorecards, you will now check whether an Epoch judgment appears next to the benchmark name. A "Flawed" label does not render a score meaningless. The 20% threshold is set by Epoch; if similar errors affect all models uniformly, rankings may generally remain stable. However, when the difference in points gained is small, it could fall within the range of exam paper errors.

This mirrors the discussion on golden sets and grading script checks in [LLM app evaluation](#/post/app-eval). As trust in public benchmarks wanes, smaller evaluation sets run directly within your own apps become more useful. For model selection itself, you can view families by category in the [AI model map](#/post/ai-models).

## Reference Links

- Epoch AI, Benchmark Reviews list and documentation: https://epoch.ai/data/benchmark-reviews-documentation/included-benchmarks
- Epoch AI, Humanity's Last Exam review: https://epoch.ai/benchmarks/hle/review
- Epoch AI, SWE-bench Verified review: https://epoch.ai/benchmarks/swe-bench-verified/review
- Epoch AI, OSWorld 2.1 review: https://epoch.ai/benchmarks/osworld-2-1/review
- Epoch AI, FrontierMath Tiers 1-3 (v2): https://epoch.ai/benchmarks/frontiermath-tiers-1-3-v2

← Concept map (#/post/ai-map)

Related articles: [AI model map](#/post/ai-models) · [LLM app evaluation](#/post/app-eval) · [hallucination](#/post/ai-hallucination)