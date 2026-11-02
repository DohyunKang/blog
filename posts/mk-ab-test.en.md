An A/B test is a method where you create two variations of the same thing, randomly split your audience to show them, and use numbers to reveal which one performs better. It turns gut feelings like "I think this thumbnail is better" into measurable data when choosing between thumbnails or copy.

## What it does

You create two versions: A is what you're currently using (the control group), and B is the variation you're testing. Visitors or viewers are randomly split in half, with one side seeing A and the other seeing B. Then, over the same period, you compare metrics like click-through rate (CTR) or sign-up rates.

Randomization is key. If you launch A on Monday and B on Friday and compare them, day-of-week differences will confound your results, making it impossible to tell why performance changed. To isolate the effect of the version change, both groups must be exposed simultaneously during the same time window.

## Experimental Design: Decisions Before Starting

Before starting, decide on four things:

| Item | Example | Note |
|---|---|---|
| Hypothesis | Adding numbers to titles increases CTR | Change only one element at a time |
| Primary Metric | Thumbnail click-through rate | Define only one primary metric |
| Minimum Detectable Effect | 3% → 3.6% | Differences smaller than this are not worth pursuing |
| Sample Size | ~14,000 exposures per group | Calculate before starting |

The instruction to change only one element at a time exists because changing both the thumbnail color and copy simultaneously would make it impossible to determine which change drove the result. If you want to test multiple factors at once, there's a separate method called multivariate testing, but it requires significantly larger sample sizes.

## Sample Size and Metrics

With small samples, one version may appear superior purely by chance. That's why you calculate beforehand "how many exposures are needed before results are trustworthy." There's an approximation formula from Evan Miller: n ≈ 16σ²/δ² per group, where δ is the minimum detectable difference, and for proportion metrics, σ² = p(1−p).

My intuition is this: if you halve the target difference, you need four times the sample size. To detect a 0.6 percentage point difference at a 3% click-through rate, the formula yields approximately 13,000 exposures per group. At the same baseline, detecting a 1.5 percentage point difference would require only a few thousand. Tests aiming to detect very small differences are practically impossible with low-traffic channels.

The following two values accompany every test:

- Significance level (α, typically 0.05): The upper bound of the probability of falsely claiming a difference exists when none actually does.
- Power (typically 0.8): The probability of correctly detecting a difference when one truly exists.

The p-value represents "the probability of observing a difference as large as this by chance, assuming both versions are actually equal." It is not the probability that B is better. This distinction is where most confusion arises.

## Automating the Process

In marketing automation, the typical workflow follows these steps:

1. Generate several copy and thumbnail candidates using an [LLM](#/post/ai-llm) or image generation model.
2. Upload candidates to the exposure system and randomly allocate impressions.
3. Accumulate click and conversion logs.
4. Once the pre-determined sample size is reached, run the statistical test once to select a winner.
5. Set the winner as the default and proceed to the next hypothesis.

Generating candidates is easy to automate. The challenging part is step 4: coding logic to enforce waiting until the predetermined sample size is reached. Aggregating results for a clear overview is covered in the [dashboard](#/post/mk-dashboard) article, while deciding which content to test connects with the [content calendar](#/post/mk-content-calendar) or [trend collection](#/post/mk-trend-collect).

YouTube is known to have dedicated thumbnail and title testing features, but official documentation for this hasn't been released yet.

## Common Mistakes

Peeking at results mid-experiment and stopping early is the most common error. Evan Miller notes that stopping early distorts the reported significance level when looking at it after the fact. He illustrates with an example: a value appearing as 1% after checking ten times actually corresponds to roughly 5%. I verified this myself by running 1,500 fake tests where both versions had identical actual conversion rates (3%), collecting 5,000 exposures each.

| Method | False Positive Rate ("Difference Exists") |
|---|---|
| Single test at the end | ~5% |
| Check every 1/10th of the way and stop if significant | ~21% |

Even with no real difference, one out of five such checks will falsely declare a winner. Methods like sequential testing or Bayesian approaches exist for when you can't wait. Miller also notes that if you pre-specify interim check points, stopping early is acceptable.

Other frequent pitfalls include...

- Comparing multiple variations at once: Testing 5 variations each with α=0.05 means there's a 1−0.95⁵ ≈ 23% chance that at least one will be falsely significant. According to Wikipedia's explanation of the multiple comparisons problem, the simplest correction is the Bonferroni method, which divides α by the number of tests (e.g., 0.01 for 5 tests). However, a less conservative and better alternative is the Holm correction.
- Choosing metrics after testing: If click-through rate isn't available, look at dwell time; if that's not available either, examine other metrics. This is also a form of multiple comparisons. The primary metric should be fixed before starting the test.
- Looking only at short periods: It is known that differences by day of week or time of day can occur, so running tests for at least one full week is considered safe. I was unable to verify this with official sources.
- Novelty effect: A new thumbnail may initially stand out, leading to a temporary spike in engagement before settling down.
- Interpreting small differences as meaningful: Statistical significance does not imply practical importance. With very large sample sizes, even a 0.01%p difference can be statistically significant.

## Common Misconceptions

- If the p-value is less than 0.05, B is definitely better: With a 5% significance level, you'll see such a result once in every 20 tests even when there's no real difference. A single test provides only one piece of evidence.
- Larger samples are always better: They take longer to collect, and during testing, half the traffic may be exposed to an inferior version, incurring costs.
- If not significant, the two options are identical: Not necessarily. The difference might simply be undetected due to insufficient sample size. Check whether your sample is adequate first.

<details>
<summary>Detailed explanation: Sample size calculation formula per group and Python code</summary>

This is the standard approximation formula for comparing two proportions, p1 and p2. The code was executed directly to confirm the numbers below.

```python
import math
from statistics import NormalDist
N = NormalDist()

def n_per_group(p1, p2, alpha=0.05, power=0.8):
    za = N.inv_cdf(1 - alpha / 2)
    zb = N.inv_cdf(power)
    pb = (p1 + p2) / 2
    n = (za * math.sqrt(2 * pb * (1 - pb))
         + zb * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p1 - p2) ** 2
    return math.ceil(n)

print(n_per_group(0.03, 0.036))  # 13914
print(n_per_group(0.03, 0.045))  # 2518
```

To detect a change from 3% → 3.6%, you need 13,914 users per group; for 3% → 4.5%, the required sample size is 2,518. Miller's rule of thumb (16σ²/δ²) yields approximately 12,933 under the same conditions, differing by about 7% from the exact formula. The rule of thumb is useful for getting a rough estimate.

Result interpretation uses a two-proportion z-test.

```python
def ztest(c1, n1, c2, n2):
    p = (c1 + c2) / (n1 + n2)
    se = math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2))
    z = (c2 / n2 - c1 / n1) / se
    return 2 * (1 - N.cdf(abs(z)))

print(ztest(150, 5000, 185, 5000))  # 약 0.052
```

Showing 5,000 users each resulted in A with 150 clicks (3.0%) and B with 185 clicks (3.7%), but the p-value was 0.052—just missing the 5% threshold. This test is ambiguous for concluding "B is better," and additional samples should have been planned from the start.

The peeking simulation sampled 5,000 users each from two groups both at 3%, performed 10 tests in increments of 500 users, and counted a "winner exists" if p<0.05 occurred at least once. After repeating this 1,500 times, the rate was approximately 21%; performing only one test at the end yielded about 5%. The percentage varies depending on the seed and number of repetitions.

</details>

← [Concept map](#/post/ai-map)

Related posts: [Building a dashboard](#/post/mk-dashboard), [Automating content calendars](#/post/mk-content-calendar), [Automating trend collection](#/post/mk-trend-collect)

## Reference Links

- Evan Miller, How Not To Run an A/B Test: https://www.evanmiller.org/how-not-to-run-an-ab-test.html
- Wikipedia, Multiple comparisons problem: https://en.wikipedia.org/wiki/Multiple_comparisons_problem