Hypothesis testing is a procedure where you calculate how rare the current result would be if the null hypothesis were true, and then reject the null hypothesis if it is sufficiently rare. In ADsP, distinctions between terms, types of errors, and selecting tests for specific situations are repeatedly emphasized.

## First, Terminology

- **Null Hypothesis (H0)**: A claim that serves as the "default," such as "there is no difference" or "there is no effect." Testing revolves around this hypothesis.
- **Alternative Hypothesis (H1)**: The claim the researcher wants to demonstrate, such as "there is a difference" or "there is an effect."
- **Test Statistic**: A value calculated from the sample, including t-values, F-values, and chi-square values.
- **Significance Level (α)**: The upper bound of the probability of rejecting the null hypothesis even if it is true. Usually set at 0.05, though 0.1 and 0.01 are also used. This must be determined before running the test.
- **p-value**: The probability of obtaining a value as extreme as or more extreme than the observed one, assuming the null hypothesis is true.
- **Rejection Region**: The interval where, if the test statistic falls, the null hypothesis is rejected. The boundary values are critical values.

According to the NIST Handbook, α = 0.05 means there is a 5% chance of rejecting the null hypothesis when it is actually true; exceeding the critical value and having p < 0.05 lead to the same decision. Exams often ask questions connecting these two concepts.

## Decision Rules

| Situation | Decision |
|---|---|
| p-value < α | Reject null hypothesis, accept alternative hypothesis |
| p-value ≥ α | Cannot reject null hypothesis |
| Test statistic not in rejection region | Cannot reject null hypothesis |

"Cannot reject" is different from "proven true." It simply means there was insufficient evidence. If an option says "accept the null hypothesis," read the question wording more carefully.

Common misconceptions about p-values also appear in exams. The p-value is **not** the probability that the null hypothesis is true. Rather, it is the probability of observing data this extreme under the assumption that the null hypothesis is true. It does not indicate the magnitude of an effect; therefore, even if a difference is small, the p-value can be small if the sample size is very large.

## Type I and Type II Errors

| | Null Hypothesis is actually True | Null Hypothesis is actually False |
|---|---|---|
| Reject | Type I Error (α) | Correct Decision (Power) |
| Fail to Reject | Correct Decision | Type II Error (β) |

- **Type I Error**: Rejecting a true null hypothesis. The probability is the significance level α.
- **Type II Error**: Failing to reject a false null hypothesis. The probability is β.
- **Power**: 1 − β. The probability of detecting a difference when one actually exists.

A mnemonic for remembering this is: "Type I = saying there is something when there isn't (false alarm), Type II = saying there isn't something when there is (miss)." If you keep the sample size constant and reduce α, β increases. To reduce both simultaneously, you must increase the sample size. This relationship frequently appears in exam questions with varying options.

## One-Tailed vs. Two-Tailed Tests

If the alternative hypothesis states "different," it is a two-tailed test; if it specifies a direction like "greater than" or "less than," it is a one-tailed test. In a two-tailed test, α is split equally between both tails. For example, if α = 0.05 for a two-tailed test, each tail has 0.025. This assumes symmetric distributions (like the t-distribution) where the two-tailed p-value is twice the one-tailed p-value from the same data.

## Which Test to Use for Each Situation

The most frequently asked question in problems is "which test should be used for this situation." You can determine this based on variable types and the number of groups.

| Situation | Test |
|---|---|
| Is the mean of one group different from a reference value? | One-sample t-test |
| Comparing means of two different groups | Independent samples t-test |
| Before-and-after comparison for the same subjects (paired data) | Paired samples t-test |
| Comparing means of three or more groups | Analysis of Variance (ANOVA, F-test) |
| Are two categorical variables related? | Chi-square test of independence |
| Do observed frequencies match an expected distribution? | Chi-square goodness-of-fit test |

The core distinction is: comparing means uses t-tests and F-tests; comparing category frequencies uses chi-square tests. For two groups, use a t-test; for three or more, use ANOVA. If you have three groups and run multiple t-tests pairwise, Type I errors accumulate, so ANOVA is used instead.

[For details → Introduction to Statistical Analysis](#/post/adsp-stat-basic), review probability distributions and estimation first to understand where the t-distribution, chi-square distribution, and F-distribution originate.

## t-test

The t-test compares means by substituting the sample standard deviation for the unknown population variance when the population variance is unknown. For independent samples, there are two approaches: assuming equal variances (equal variance assumption) and not assuming them (Welch's method). The SciPy documentation states that `ttest_ind` defaults to `equal_var=True` (equal variance assumption), and setting `equal_var=False` performs Welch's t-test, resulting in fractional degrees of freedom.

Exams typically ask about the following:

- Distinguishing between independent samples (two different groups) and paired samples (before-and-after for the same subjects).
- Normality assumption: Assume a normal distribution for small samples; use non-parametric tests if normality is questionable.
- Formulating the null hypothesis, e.g., "the means of two groups are equal (μ1 = μ2)."

## Analysis of Variance

Although named "Analysis of Variance," its purpose is comparing means. It evaluates how much larger the variation between groups is compared to the variation within groups using the F-value.

- Null hypothesis: The means of all groups are equal.
- Alternative hypothesis: At least one group mean is different.
- If the F-value is large and the p-value is small, reject the null hypothesis.

Note that even if you reject in ANOVA, you do not know "which group is different." That requires a post-hoc test. Also, writing the alternative hypothesis as "all group means are different from each other" is incorrect.

## Chi-Square Test

It compares observed frequencies with expected frequencies under the null hypothesis. The test statistic is the sum of (observed − expected)² / expected for all cells. For a test of independence, degrees of freedom equal (number of rows − 1) × (number of columns − 1). The null hypothesis states "the two variables are independent," and rejection implies the variables are associated.

<details>
<summary>Calculating Chi-Square by Hand</summary>

Suppose a 2×2 table for gender and product preference looks like this:

| | Prefer A | Prefer B | Total |
|---|---|---|---|
| Group 1 | 30 | 20 | 50 |
| Group 2 | 20 | 30 | 50 |
| Total | 50 | 50 | 100 |

Expected frequencies are calculated as (row total × column total) / grand total, so each cell is 50 × 50 / 100 = 25.

Test statistic = (30−25)²/25 + (20−25)²/25 + (20−25)²/25 + (30−25)²/25 = 1 + 1 + 1 + 1 = 4.0

Degrees of freedom = (2−1)(2−1) = 1. Running SciPy `chi2_contingency` without continuity correction (`correction=False`) yields a test statistic of 4.0 and a p-value of approximately 0.0455, matching the manual calculation. With α = 0.05, we reject.
</details>

## Try Running It Yourself

I ran this with small, made-up data in Python because the concept wasn't sticking. The values are arbitrary for illustration.

```python
import numpy as np
from scipy import stats

a = np.array([23, 25, 28, 30, 26, 24, 27, 29])
b = np.array([30, 32, 29, 35, 33, 31, 34, 36])

r = stats.ttest_ind(a, b)                    # 독립표본, 등분산 가정
print(r.statistic, r.pvalue)                 # -4.899, 0.000235

w = stats.ttest_ind(a, b, equal_var=False)   # Welch
print(w.statistic, w.pvalue)                 # -4.899, 0.000235

g1 = [20, 22, 19, 24, 25]
g2 = [28, 30, 27, 26, 29]
g3 = [33, 31, 35, 30, 32]
f = stats.f_oneway(g1, g2, g3)               # 분산분석
print(f.statistic, f.pvalue)                 # 31.04, 1.8e-05
```

Since the group sizes and variances were similar, the results from the equal-variance assumption and Welch's test were nearly identical. The p-value was much smaller than 0.05, making this an example of rejecting the null hypothesis. The code above reflects values verified by actually running it.

## Common Question Types and Solution Order

1. Problems asking to distinguish between the null and alternative hypotheses in a sentence. "No difference" is the null hypothesis.
2. Problems providing a results table and asking to compare the p-value with the significance level to draw a conclusion. If p-value < α, reject.
3. Types of errors. Rejecting a true statement = Type I error; failing to reject a false statement = Type II error.
4. Connecting scenarios to test names. Start by looking at the number of groups and variable types.
5. Selecting incorrect statements from options. Common traps include: "p-value is the probability that the null hypothesis is true," "failing to reject proves the null hypothesis," and "rejecting ANOVA means all groups are different."

The solution approach follows this order: first, determine whether the test target is a mean or a proportion/frequency, and count the number of groups. Next, compare the p-value with α to reach a conclusion. For terminology questions, visualize Type I/II error tables in your mind.

← [Concept Map](#/post/adsp-map)

Related posts: [Basic Statistical Analysis](#/post/adsp-stat-basic) · [Regression Analysis](#/post/adsp-regression) · [Multivariate Analysis and Time Series](#/post/adsp-multivariate-ts)

Check the official site for exam schedules and registration guidelines.

## Reference Links

- [NIST/SEMATECH e-Handbook, Basic Concepts of Hypothesis Testing](https://www.itl.nist.gov/div898/handbook/prc/section1/prc131.htm)
- [SciPy Documentation, scipy.stats.ttest_ind](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_ind.html)