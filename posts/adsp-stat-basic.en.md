The first part of ADsP covers how to draw a sample, what scale to use for values, how to summarize data with a single number, and how to estimate the population based on that. Hypothesis testing and regression, which come later, all build upon these foundations.

## Overview of the Flow

| Step | Question | Key Terms |
|---|---|---|
| Sampling | How do we select a part when we can't see the whole? | Simple, Systematic, Stratified, Cluster |
| Scale | What type of values are we dealing with? | Nominal, Ordinal, Interval, Ratio |
| Descriptive Statistics | How to summarize data with a few numbers? | Mean, Median, Variance, Quartiles |
| Probability Distribution | How are values scattered in shape? | Normal Distribution, Standardization |
| Estimation | How to describe the population using a sample? | Point Estimation, Interval Estimation, Standard Error |

## Sampling

Surveying the entire population is often too expensive or impossible, so we select a subset (sample). Exams frequently ask about the differences between the four methods.

| Method | How it works | Distinguishing Point |
|---|---|---|
| Simple Random | Every individual has an equal probability of being selected | Selected directly from the whole without grouping or ordering |
| Systematic | Arrange in order, start at a random point, then select every k-th item | Fixed interval |
| Stratified | Divide into groups (strata) and select from each stratum | All strata are represented in the sample |
| Cluster | Select entire groups (clusters) and survey within them | Selects groups rather than individual elements |

Stratified and cluster sampling both involve dividing into groups, which can be confusing. In stratified sampling, some individuals are selected from every group, whereas in cluster sampling, only a few groups are chosen and the entire contents of those groups are surveyed. Cluster sampling reduces survey costs but typically requires a larger sample size to achieve the same level of accuracy.

[See details → Data Preparation Methodology](#/post/adsp-methodology) for the data preparation steps discussed there, which follow logically from this section.

## Scale

Values are categorized into four levels. As you move down the list, more calculations become possible.

| Scale | Meaning | Example | Appropriate Statistics |
|---|---|---|---|
| Nominal | Only names exist; no order | Blood type, Gender | Mode |
| Ordinal | Order exists but intervals are unknown | Rank, Very agree ~ Very disagree | Median, Mode |
| Interval | Intervals are equal; no true zero | Celsius temperature, Year | Mean included |
| Ratio | Intervals are equal and there is a true zero | Weight, Length, Time | Mean included, ratios interpretable |

The distinction between interval and ratio scales lies in the meaning of zero. A temperature of 20°C is not twice as hot as 10°C because 0°C does not represent "absence" of heat. In contrast, weight has a true zero; thus, 20kg is indeed twice as heavy as 10kg.

Exams often provide examples and ask you to identify the scale level. If it's unclear whether something is ordinal or interval, first ask: "Can we assume equal intervals?" For example, in a 5-point satisfaction scale, there is no guarantee that the interval between "neutral" and "satisfied" is the same as between "dissatisfied" and "neutral"; therefore, it is considered ordinal.

## Descriptive Statistics

This involves summarizing collected data with numbers. It falls into two categories:

- Central tendency: Mean, Median, Mode
- Dispersion: Variance, Standard Deviation, Range, Interquartile Range (IQR)

The mean is influenced by outliers, whereas the median is less affected. Therefore, for right-skewed data like income, the mean tends to be larger than the median.

Standard deviation is the square root of variance, returning to the original units. The coefficient of variation (standard deviation / mean) is used to compare dispersion between datasets with different units.

Quartiles are values obtained by sorting data in ascending order and marking the 25%, 50%, and 75% points. IQR is calculated as Q3 − Q1. A box plot (box-and-whisker plot) visualizes these metrics; exams often ask that the line inside the box represents the median and that points outside the whiskers are potential outliers.

<details>
<summary>Try calculating directly with small data (verified with Python)</summary>

Calculated using 8 data points: `[2, 4, 4, 4, 5, 5, 7, 9]`. Population variance divides by n, while sample variance divides by n−1.

```python
import statistics as st, math
x = [2, 4, 4, 4, 5, 5, 7, 9]
print(st.mean(x), st.median(x), st.mode(x))
print(st.pvariance(x), st.pstdev(x))
print(st.variance(x), round(st.stdev(x), 3))
print(st.quantiles(x, n=4, method='inclusive'))
```

The execution results were as follows:

| Item | Value |
|---|---|
| Mean / Median / Mode | 5 / 4.5 / 4 |
| Population Variance / Population Std Dev | 4 / 2.0 |
| Sample Variance / Sample Std Dev | 4.571 / 2.138 |
| Q1 / Q2 / Q3 | 4.0 / 4.5 / 5.5 |

Even with the same data, variance differs depending on whether we divide by n or n−1: 4 versus 4.571. When estimating population variance from a sample, we use the sample variance divided by n−1.
</details>

## Probability Distribution

A probability distribution represents the probabilities associated with each value of a random variable. Variables are classified as discrete (countable values) or continuous (uncountable ranges).

- Discrete: Binomial distribution (number of successes in n trials), Poisson distribution (number of events occurring in a fixed interval)
- Continuous: Normal distribution, t-distribution, Chi-squared distribution, F-distribution

A normal distribution is bell-shaped and symmetric around the mean. Its shape is determined by two parameters: the mean and the standard deviation. A normal distribution with a mean of 0 and a standard deviation of 1 is called the standard normal distribution. Changing an arbitrary value $x$ to $z = (x - \text{mean}) / \text{standard deviation}$ is called standardization.

Calculations show that the probability between −1 and 1 in the standard normal distribution is 0.6827, and the boundary values leaving 5% on both sides combined are 1.96. The reason for memorizing "±1σ ≈ 68%, ±2σ ≈ 95%, ±3σ ≈ 99.7%" in exams lies in these numbers. In interval estimation, it is also used that the value to capture exactly 95% is 1.96, not 2.

The names and uses of the t-distribution, chi-square distribution, and F-distribution come in pairs. For details, see [Hypothesis Testing](#/post/adsp-hypothesis), where they are grouped by test method.

## Estimation

This is the process of estimating population values (parameters) using a sample.

| Type | Description | Example |
|---|---|---|
| Point estimation | Stated with a single value | Sample mean 5.2 |
| Interval estimation | Stated as a range | Population mean between 4.8 and 5.6 |

Conditions for a good estimator include unbiasedness (expected value equals the parameter), efficiency (small variance), consistency (approaches the parameter as sample size increases), and sufficiency. The reason for dividing by $n-1$ when calculating sample variance is to correct for bias.

The fluctuation of the sample mean is measured by the standard error. When the population standard deviation is $\sigma$, the standard error of the sample mean is $\sigma / \sqrt{n}$. It often appears in exams that quadrupling the sample size halves the standard error.

The Central Limit Theorem states that regardless of the population distribution, if the sample size is sufficiently large, the distribution of the sample mean approaches a normal distribution. This allows us to perform estimation and testing on the mean using a normal distribution even without knowing the population shape.

Interval estimation takes the form: $\text{sample mean} \pm (\text{critical value} \times \text{standard error})$. For a 95% confidence level, the critical value based on the normal distribution is 1.96. Increasing the confidence level widens the interval, while increasing the sample size narrows it. The phrase "95% confidence interval" means that if samples were repeatedly drawn in the same way, 95% of those intervals would contain the parameter; therefore, reading it as "there is a 95% probability the parameter lies in this specific interval" is incorrect.

<details>
<summary>Example calculation of standard error and confidence interval (Python verification)</summary>

Using the sample standard deviation of 2.138 from the data above, the standard error is calculated as $2.138 / \sqrt{8} = 0.756$. For a mean of 5, using the normal distribution critical value of 1.96 gives $5 \pm 1.96 \times 0.756$, approximately 3.52 to 6.48. When the sample size is small (e.g., 8), it is correct to use the t-distribution critical value instead of the normal distribution; this topic continues in [Hypothesis Testing](#/post/adsp-hypothesis).
</details>

## Common Question Types

- Distinguishing measurement scales given examples (nominal/ordinal/interval/ratio)
- Choosing between stratified sampling and cluster sampling
- Selecting the statistic least sensitive to outliers among mean, median, and mode
- Calculating standardized values ($z = (x - \text{mean}) / \text{standard deviation}$)
- Calculating standard error $\sigma / \sqrt{n}$ and observing changes with sample size
- Identifying incorrect statements in confidence interval interpretation

The original problem text is not included. For past exam questions, it is best to solve them directly using official sites and examination agency materials; also, check the official site for exam schedules and registration details.

## Reference Links

- [Level of measurement (Wikipedia)](https://en.wikipedia.org/wiki/Level_of_measurement)
- [Sampling (statistics) (Wikipedia)](https://en.wikipedia.org/wiki/Sampling_(statistics))
- [Central limit theorem (Wikipedia)](https://en.wikipedia.org/wiki/Central_limit_theorem)

← [Concept map (ADsP map)](#/post/adsp-map)

Related posts: [R Basics and Data Mart](#/post/adsp-r-datamart) · [Hypothesis Testing](#/post/adsp-hypothesis) · [Regression Analysis](#/post/adsp-regression)