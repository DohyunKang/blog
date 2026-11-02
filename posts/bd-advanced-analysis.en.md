Advanced analytics techniques are a unit that bundles four tools one step beyond basic statistics: multivariate analysis, time series analysis, nonparametric tests, and Bayesian inference. There are more questions asking "which technique to use for this situation" than those requiring direct calculation, so it's faster to memorize each technique paired with its application scenario. Check the exam schedule and registration fees on the official website. Basic statistics can be found in [Details → Exploratory Analysis and Basic Statistics](#/post/bd-eda-stats).

| Technique | When to Use It | Keywords |
|---|---|---|
| Multivariate Analysis | There are multiple variables that are interrelated | Principal component, factor, multidimensional scaling, clustering |
| Time Series Analysis | Observed values accumulate in chronological order | Stationarity, autocorrelation, AR·MA·ARIMA |
| Nonparametric Test | Normal distribution is questionable or sample size is small | Rank, median, Wilcoxon, Mann-Whitney |
| Bayesian | Want to update prior beliefs with data | Prior/posterior probability, likelihood |

## Multivariate Analysis

Methods that handle data with two or more variables at once are collectively called multivariate analysis. Exams often feature questions connecting the name and purpose of these methods.

| Name | What It Does |
|---|---|
| Principal Component Analysis (PCA) | Creates new orthogonal axes along directions of high variance to reduce the number of variables |
| Factor Analysis | Finds common factors hidden behind variables |
| Multidimensional Scaling (MDS) | Arranges entities in a 2D or 3D plane while preserving distances between them as much as possible |
| Cluster Analysis | Groups similar entities together |
| Discriminant Analysis | Classifies new entities into known groups |

According to the scikit-learn documentation, PCA is a transformation that sequentially extracts components explaining maximum variance. It centers data by subtracting the mean but does not adjust for scale (magnitude). This last sentence is crucial in practice: feeding variables with different units directly causes variables with larger values to dominate the components. This was verified using the iris dataset.

```python
from sklearn.datasets import load_iris
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

X = load_iris().data
print(PCA(2).fit(X).explained_variance_ratio_.round(3))
print(PCA(2).fit(StandardScaler().fit_transform(X)).explained_variance_ratio_.round(3))
```

```
[0.925 0.053]
[0.73  0.229]
```

Before standardization, the first component explains 92.5% of the variance; after standardization, it drops to 73.0%, while the second component rises to 22.9%. These two lines demonstrate how variable scales affect results. The discussion on PCA and feature selection continues in [Details → Feature Selection and Dimensionality Reduction](#/post/bd-feature-select). Clustering is covered separately in [Details → Unsupervised Learning Models](#/post/bd-unsupervised).

<details>
<summary>Confusing PCA and Factor Analysis</summary>

Both are used to reduce variables, but they start from different points. PCA aims to create new axes that capture maximum variance of the original variables, whereas factor analysis assumes latent factors that variables commonly follow and estimates them. If the problem statement mentions "latent factors" or "common factors," it refers to factor analysis; if it mentions "maximizing variance preservation" or "dimensionality reduction," it refers to PCA.

</details>

## Time Series Analysis

Time series data consists of observed values accumulated in chronological order. The NIST Handbook states that such data may have an "internal structure," citing autocorrelation as an example. Since adjacent values influence each other, general tests assuming independent samples cannot be applied directly.

Common concepts appearing frequently in exams are as follows:

| Concept | Meaning |
|---|---|
| Stationarity | Mean and variance do not change over time, and autocovariance depends only on the lag |
| Differencing | A transformation that removes trends by subtracting the previous value from the current one |
| Seasonal Differencing | The difference between values separated by a seasonal period |
| AR(p) | Explains the current value using p past values of itself |
| MA(q) | Explains the current value using q past shocks (errors) |
| ARIMA(p,d,q) | A model combining AR and MA after differencing a non-stationary time series d times ("I" stands for integrated) |

The NIST Handbook notes that the Box-Jenkins model assumes stationarity; if the series is not stationary, it must be differenced one or more times to create an ARIMA model (where "I" is integrated). The order of using a model is identification, estimation, and validation.

I directly tested why differencing works. A trend-type series created by accumulating random numbers (random walk) has an autocorrelation of nearly 1 at the next lag. After differencing, it drops to nearly 0.

```python
import numpy as np, pandas as pd
rng = np.random.default_rng(0)
y = pd.Series(np.cumsum(rng.normal(size=200)))
print(round(y.autocorr(1), 3), round(y.diff().dropna().autocorr(1), 3))
```

```
0.977 0.039
```

AR and MA exhibit different patterns in how autocorrelation decreases. I generated 500 samples each with AR(1) coefficient 0.7 and MA(1) coefficient 0.8 and examined autocorrelation by lag.

```python
e = rng.normal(size=500)
ar = np.zeros(500)
for t in range(1, 500):
    ar[t] = 0.7 * ar[t-1] + e[t]
s = pd.Series(ar)
print([round(s.autocorr(k), 2) for k in (1, 2, 3, 4)])
m = pd.Series(e[1:] + 0.8 * e[:-1])
print([round(m.autocorr(k), 2) for k in (1, 2, 3)])
```

```
[0.65, 0.41, 0.25, 0.15]
[0.46, -0.07, -0.05]
```

AR shows a gradual decline, while MA(1) drops off sharply after lag 1. The exam rule "ACF decreases exponentially for AR and cuts off after lag q for MA" corresponds to this pattern. Conversely, partial autocorrelation (PACF) is remembered as "cut off for AR and decreasing for MA."

<details>
<summary>Time Series Decomposition and Moving Average</summary>

Decomposition into trend, seasonal, cyclical, and irregular components is also a common approach. The moving average method smooths out irregular fluctuations by averaging recent values to identify trends, while exponential smoothing assigns greater weight to more recent values. You can simply pair each name with a one-line description.

</details>

## Nonparametric Tests

Parametric tests (such as the t-test) assume that data follows a specific distribution (primarily normal) and compare parameters like the mean. Nonparametric tests do not assume a distribution shape and instead use ranks or signs. They are chosen when sample sizes are small, normality is questionable, or the data is ordinal.

| Situation | Parametric Test | Nonparametric Equivalent |
|---|---|---|
| Two Independent Groups | Independent Samples t-test | Mann-Whitney U (Wilcoxon Rank Sum) |
| Two Paired Groups | Paired Samples t-test | Wilcoxon Signed-Rank |
| Three or More Groups | One-way ANOVA | Kruskal-Wallis |
| Correlation | Pearson | Spearman Rank Correlation |

The SciPy documentation describes the Mann-Whitney U as the nonparametric equivalent of the independent samples t-test. The null hypothesis is that the underlying distributions of the two samples are identical, and the samples must be independent. For paired samples, it recommends using the Wilcoxon test. I ran both the t-test and Mann-Whitney on the same data.

```python
import numpy as np
from scipy import stats
a = np.array([12,15,14,10,18,20,11,13])
b = np.array([22,19,25,17,30,21,24,16])
print(stats.mannwhitneyu(a, b, alternative='two-sided').pvalue)
print(stats.ttest_ind(a, b).pvalue)
before = np.array([70,65,80,72,68,75,90,66])
after  = np.array([68,60,79,65,66,70,85,67])
print(stats.wilcoxon(before, after).pvalue)
print(stats.kruskal([5,7,6,9,8],[12,14,11,15,13],[20,18,22,19,21]).pvalue)
```

```
0.00295   (만-휘트니)
0.00211   (t검정)
0.0234    (윌콕슨 부호순위)
0.00193   (크러스칼-왈리스)
```

For data with acceptable normality, both tests yield similar conclusions. When solving problems, selecting the appropriate test name is the first step. If terms like "paired," "multiple groups," or "rank" appear, locate the corresponding cell in the table above. The method for reading p-values and interpreting the null hypothesis is covered in [detailed → Exploratory Analysis and Basic Statistics](#/post/bd-eda-stats).

<details>
<summary>Other Nonparametric Tests</summary>

The sign test only considers whether the difference between paired values is positive or negative. The run test examines whether data is randomly arranged by counting the number of consecutive runs (+, -) in the sequence. The Kolmogorov-Smirnov test checks whether a sample follows a specific distribution or whether two samples come from the same distribution. Just connect the name with its purpose.

</details>

## Bayesian Inference

Frequentism treats parameters as fixed values and infers based on data probability. Bayesian inference places a probability distribution over parameters and updates it as data is observed.

Posterior probability is proportional to the product of likelihood and prior probability:

P(A|B) = P(B|A) × P(A) / P(B)

Exams often include problems requiring numerical calculation using this formula. For example, given a disease prevalence of 1%, a test sensitivity of 95%, and a false positive rate of 5% for healthy individuals, I calculated the probability that a person with a positive result is actually a patient.

```python
p, sens, fp = 0.01, 0.95, 0.05
print(sens * p / (sens * p + fp * (1 - p)))
```

```
0.161
```

The probability of being a patient given a positive result is approximately 16%. Even if the test appears accurate at 95%, a low prior probability (1%) results in a low posterior probability. This structure is designed to confuse people between "sensitivity" and "posterior probability."

Starting with a prior distribution Beta(1,1), observing 7 successes and 3 failures yields a posterior distribution of Beta(1+7, 1+3) = Beta(8,4), with a mean of 8/12 ≈ 0.667. The pair consisting of the prior and posterior distributions from the same family is called a conjugate prior, and for binomial data, the beta distribution serves as this conjugate pair.

<details>
<summary>Relationship to Naive Bayes</summary>

Naive Bayes, a classification model, applies the simplification that "variables are independent given the class" to Bayes' theorem. For supervised learning explanations, see [detailed → Model Design](#/post/bd-model-design).

</details>

## Order When Solving Problems

If technique names appear in the problem description, first examine the data characteristics: multivariate if there are many variables, time series if there is temporal ordering, nonparametric if normality or sample size is an issue, and Bayesian if prior probability is mentioned. Then select the specific test name from the table. The overall chapter guide is available at [detailed → Big Data Analyst Map](#/post/bd-map).

## Reference Links

- scikit-learn, decomposition methods (PCA): https://scikit-learn.org/stable/modules/decomposition.html#pca
- SciPy, scipy.stats.mannwhitneyu: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mannwhitneyu.html
- NIST e-Handbook, Time Series Analysis Overview: https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc4.htm
- NIST e-Handbook, Box-Jenkins Model: https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc445.htm

← Concept Map at [(#/post/bd-map)](#/post/bd-map)

Related articles: [Feature Selection and Dimensionality Reduction](#/post/bd-feature-select) · [Exploratory Analysis and Basic Statistics](#/post/bd-eda-stats) · [Unsupervised Learning Models](#/post/bd-unsupervised)