Exploratory Data Analysis (EDA) is the step of examining what the data looks like using numbers and graphs before building a model; in exams, basic statistical concepts underlying this often appear as calculation and interpretation problems. You can check the exam schedule and fees on the official website.

## What EDA Does

When receiving data, do not run models immediately; examine it first. Check how many variables there are and their types, where values cluster, if there are outliers, and whether variables move together. Based on this, decide how to handle missing values and what transformations are needed. Preprocessing is covered separately in [Details → Data Preprocessing](#/post/bd-preprocessing).

There are mainly two tools used in EDA.

| Tool | What it examines | Examples |
|---|---|---|
| Descriptive Statistics | Center, spread, and shape of a single variable | Mean, Median, Standard Deviation, Quartiles |
| Correlation Analysis | The degree to which two variables move together | Pearson, Spearman correlation coefficients |

Basic plots include histograms, boxplots, and scatter plots. For details on when to use which plot, see [Details → Visualization and Result Interpretation](#/post/bd-visualization).

## Descriptive Statistics

Measures of central tendency are mean, median, and mode. If outliers exist, the mean gets pulled toward them while the median remains stable; this difference frequently appears in exams. For the value list `[2, 4, 4, 4, 5, 5, 7, 9, 30]`, direct calculation yields:

```python
import pandas as pd
s = pd.Series([2, 4, 4, 4, 5, 5, 7, 9, 30])
print(s.mean(), s.median(), s.mode().tolist())
# 7.777777777777778 5.0 [4]
```

Due to the single value of 30, the mean becomes 7.78 while the median is 5. When the mean is larger than the median, it indicates a right-skewed distribution (positive skewness); pandas' `skew()` returned approximately 2.70 for this data.

Spread measures include variance, standard deviation, range, and interquartile range (IQR). One point of confusion here is that sample variance divides by n-1 rather than n. Both pandas' `var()` and `std()` default to n-1, whereas numpy defaults to n.

```python
print(s.var(), s.var(ddof=0))
# 73.44444444444444 65.28395061728395
```

From the same data, values of 73.44 and 65.28 are obtained. You must first check whether an exam question asks for sample variance or population variance.

The outlier criterion in boxplots is below Q1 - 1.5×IQR or above Q3 + 1.5×IQR. For the given data, with Q1=4, Q3=7, and IQR=3, the fences are at -0.5 and 11.5, leaving only 30 outside.

```python
q1, q3 = s.quantile([.25, .75]); iqr = q3 - q1
print(s[(s < q1 - 1.5*iqr) | (s > q3 + 1.5*iqr)].tolist())
# [30]
```

<details>
<summary>Brief notes on skewness, kurtosis, and coefficient of variation</summary>

- Skewness: 0 indicates symmetry; positive means a long right tail; negative means a long left tail.
- Kurtosis: Measures the peakedness of a distribution. Since values are often adjusted by subtracting 3 based on the reference distribution (normal), check what baseline is used in the problem.
- Coefficient of variation: Standard deviation ÷ mean. Used to compare spread between variables with different units.
- Unlike arithmetic mean, geometric mean is used for values that change multiplicatively, such as growth rates.
</details>

## Correlation Analysis

Correlation coefficients range from -1 to 1; the sign indicates direction and the absolute value indicates strength. Pearson examines linear relationships and is sensitive to outliers. Spearman converts values to ranks to assess monotonic relationships and is used for ordinal data or when outliers are present.

```python
import numpy as np
from scipy import stats
x = np.array([1,2,3,4,5,6,7,8]); y = np.array([2,1,4,3,7,8,6,9])
print(stats.pearsonr(x, y))   # 상관계수 약 0.896, p 약 0.0026
print(stats.spearmanr(x, y))  # 상관계수 약 0.881, p 약 0.0039
```

In pandas, `df.corr(method="pearson")` is the default, with options for `"spearman"` and `"kendall"`. If missing values exist, calculations are performed only on rows where both columns have values, computing pairwise. High correlation does not imply causation; cases where a third variable drives both (spurious correlation) are common distractors in exams. Even if correlation is near zero, a curved relationship may still exist. Methods for handling highly correlated variables continue in [Details → Feature Selection and Dimensionality Reduction](#/post/bd-feature-select).

## Probability Distributions

The distributions to memorize for exams are fixed.

| Distribution | Usage | Key Point |
|---|---|---|
| Normal Distribution | Continuous, bell-shaped | Mean ±1σ ≈ 68%, ±1.96σ ≈ 95% |
| Binomial Distribution | Number of successes in n trials | Trials are independent; success probability is constant |
| Poisson Distribution | Number of events per unit time/space | Mean = Variance |
| t-Distribution | Estimation and testing of mean when population variance is unknown | Approaches normal distribution as degrees of freedom increase |
| Chi-Square Distribution | Variance testing, independence/goodness-of-fit for categorical data | Non-negative; right-skewed tail |
| F-Distribution | Comparing variances, ANOVA | Involves two degrees of freedom |

Memorizing standard normal distribution values is helpful. Checking with scipy yields:

```python
print(stats.norm.cdf(1.96), stats.norm.ppf(.975))
# 0.9750021048517795 1.959963984540054
print(stats.t.ppf(.975, 9), stats.chi2.ppf(.95, 3))
# 2.262157162798205 7.814727903251179
```

For a t-distribution with 9 degrees of freedom, the two-tailed 5% critical value is 2.262, which is larger than the normal distribution's 1.96. This occurs because smaller samples result in heavier tails.

The Central Limit Theorem also frequently appears: even if the population is not normally distributed, the sampling distribution of the sample mean approaches normality when the sample size is sufficiently large. The standard error of the sample mean is σ/√n; thus, quadrupling the sample size halves the standard error.

## Estimation

Point estimation refers to a single value, while interval estimation refers to a range for a parameter. For a normal population with unknown population variance, the 95% confidence interval for the mean is: sample mean ± t(0.975, n-1) × s/√n.

```python
a = np.array([12.1,11.8,12.5,12.9,11.5,12.2,12.7,12.0,11.9,12.4])
m, se = a.mean(), stats.sem(a)
print(m, se, stats.t.interval(.95, len(a)-1, loc=m, scale=se))
# 12.2 0.1358... (11.8928, 12.5072)
```

In a 95% confidence level interpretation, it is often misunderstood. It does not mean "there is a 95% probability that the population mean lies in this interval," but rather that if we repeatedly draw samples and construct intervals in the same way, approximately 95% of those intervals will contain the population mean. Increasing the confidence level widens the interval, while increasing the sample size narrows it.

## Hypothesis Testing

The procedure is always the same: state the null hypothesis (H0) and the alternative hypothesis (H1), set the significance level (usually 0.05), calculate the test statistic and p-value, and reject H0 if the p-value is less than the significance level.

- Type I error: Rejecting H0 when it is true. The probability is the significance level α.
- Type II error: Failing to reject H0 when it is false. The probability is β, and the power of the test is 1-β.
- The p-value is the probability of obtaining a result as extreme or more extreme than the current one, assuming H0 is true. It is not the probability that H0 is true.

The choice of test depends on the data format.

| Situation | Test |
|---|---|
| Comparing a single group mean to a reference value | One-sample t-test |
| Comparing means of two independent groups | Independent samples t-test |
| Before-and-after comparison of the same subjects | Paired samples t-test |
| Comparing means of three or more groups | Analysis of variance (ANOVA, F-test) |
| Independence of two categorical variables | Chi-square test |
| Checking normality | Shapiro-Wilk, etc. |

```python
print(stats.ttest_1samp(a, 12.0))
# 통계량 1.4726, p 0.1749, df 9  -> 평균이 12라는 H0를 기각 못 함

b = np.array([12.8,13.1,12.6,13.4,12.9,13.0,12.7,13.3,12.5,13.2])
print(stats.ttest_ind(a, b, equal_var=False))
# 통계량 -4.5136, p 0.000345, df 약 16.17  -> 두 평균이 같다는 H0 기각
```

According to the scipy documentation, `ttest_ind` tests the null hypothesis that the means of two independent samples are equal, and `equal_var=True` is the default, assuming equal variances. Setting it to `False` performs Welch's t-test, which does not assume equal variances. The fractional degrees of freedom (16.17) in the above result is a characteristic of Welch's test.

The chi-square test for independence compares observed frequencies with expected frequencies.

```python
table = np.array([[30,20],[20,30]])
chi2, p, dof = stats.chi2_contingency(table, correction=False)[:3]
print(chi2, p, dof)
# 4.0 0.0455... 1
```

Expected frequency is calculated as (row total × column total) ÷ grand total; in this table, every cell has an expected frequency of 25. The degrees of freedom are (number of rows - 1) × (number of columns - 1), which equals 1. With a test statistic of 4.0 and a p-value of approximately 0.0455, we reject the null hypothesis of independence at the 5% significance level. The reason for setting `correction=False` is that scipy applies Yates' continuity correction by default for 2×2 tables, but I turned it off to match manual calculations typically found in exam solutions.

<details>
<summary>When normality assumptions are violated</summary>

t-tests and ANOVA assume normality. If the sample size is small and normality is questionable, use non-parametric tests based on ranks (e.g., Wilcoxon rank-sum test, Kruskal-Wallis test). Non-parametric tests will be covered in detail in [Advanced Analysis Techniques](#/post/bd-advanced-analysis).

```python
print(stats.shapiro(a))
# 통계량 0.9885, p 0.9947 -> 정규성을 기각할 근거 없음
```

The null hypothesis of the Shapiro-Wilk test is "the data follows a normal distribution." Therefore, a large p-value means we cannot reject the assumption of normality. It does not mean that normality has been proven.
</details>

## Problem Types and Solution Approaches

- Comparing positions of mean, median, and mode: Start from the tail direction to immediately determine the order relationships.
- Calculating sample variance: Check whether division by n-1 is used.
- Interpreting boxplots: Calculate fences using Q1, Q3, and IQR to count outliers.
- Interpreting correlation coefficients: Consider sign and magnitude, and disregard causal claims in options.
- Selecting a test: Ask in order whether the data are continuous or categorical, how many groups there are, and whether they are independent or paired.
- Comparing p-value and significance level: If rejected, "there is a difference"; if not rejected, "there is insufficient evidence to claim a difference."

In practical exams, calculations are performed using Python. The workflow is summarized in [Practical Python Key Points](#/post/bd-practical-python).

← Concept map ([#/post/bd-map])

Related posts: [Data Preprocessing](#/post/bd-preprocessing) · [Feature Selection and Dimensionality Reduction](#/post/bd-feature-select) · [Advanced Analysis Techniques](#/post/bd-advanced-analysis)

## Reference Links
- [scipy.stats.ttest_ind](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_ind.html)
- [pandas.DataFrame.corr](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.corr.html)