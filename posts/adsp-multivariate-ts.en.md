This unit consists of two parts: multivariate analysis (Principal Component Analysis, Multidimensional Scaling) for reducing information when there are many variables, and time series analysis (components, stationarity, ARIMA) for handling values accumulated over time. Check the exam schedule and fee on the official site.

## Multivariate Analysis: When There Are Many Variables

When you have ten or twenty variables, looking at a table alone won't reveal the structure. Multivariate analysis solves this by reducing variables or plotting the positional relationships of points. The two methods to know in this unit are Principal Component Analysis (PCA) and Multidimensional Scaling (MDS). The foundation for correlation and regression is found in [Details → Regression Analysis](#/post/adsp-regression).

### Principal Component Analysis (PCA)

According to scikit-learn documentation, PCA divides data into mutually orthogonal components, ensuring that earlier components explain as much variance as possible. To summarize:

| Item | Content |
|---|---|
| Purpose | Summarize many correlated variables into a small number of new variables (principal components) |
| Relationship between components | Mutually orthogonal, i.e., uncorrelated |
| Order | The first principal component explains the most variance, followed by the second |
| Usage | Dimensionality reduction, visualization, reducing multicollinearity |

There is one key point often tested in exams. According to the documentation, PCA only centers the data by subtracting the mean of each variable and does not adjust for scale (magnitude). Therefore, variables with larger variance pull the components toward them. When mixing variables with different units, standardization must be performed first (the documentation notes this separately as a general guideline).

I have an example where I ran it directly. I created three variables: the first two were given strong noise to make them highly similar, while the third was kept independent (using numpy for eigenvalue decomposition of the covariance matrix).

| Component | Eigenvalue | Explained Variance Ratio | Cumulative |
|---|---|---|---|
| PC1 | 4.771 | 0.933 | 0.933 |
| PC2 | 0.258 | 0.050 | 0.983 |
| PC3 | 0.087 | 0.017 | 1.000 |

When similar variables exist, the first component takes up most of the share. Therefore, the number of components to retain is determined by looking at the cumulative explained variance ratio. The eigenvalue represents the magnitude of variance explained by that component, and the ratio is the eigenvalue divided by the total sum.

<details>
<summary>Detailed explanation: Steps to calculate PCA using numpy</summary>

```python
import numpy as np
rng = np.random.default_rng(0)
n = 200
a = rng.normal(size=n)
X = np.c_[a + 0.3*rng.normal(size=n), 2*a + 0.3*rng.normal(size=n), 0.5*rng.normal(size=n)]
Xc = X - X.mean(0)                # 1) 평균을 빼서 중심 맞추기
cov = np.cov(Xc, rowvar=False)    # 2) 공분산 행렬
w, v = np.linalg.eigh(cov)        # 3) 고유값·고유벡터
w = np.sort(w)[::-1]
print((w / w.sum()).round(3))     # [0.933 0.05  0.017]
```

The eigenvector represents the direction of the component, and the eigenvalue represents the variance in that direction. Multiplying the data by the eigenvector yields the component scores.

</details>

### Multidimensional Scaling (MDS)

MDS takes a dissimilarity (distance) matrix between objects and plots points in a low dimension (usually 2D), arranging them so that the distances between points closely resemble the original distances. It is like placing cities on a map. The degree to which the original distances are not matched is called stress; the smaller the value, the better the fit.

- Metric MDS: Attempts to reproduce actual distance values.
- Non-metric MDS: Only needs to match the order of distances; close pairs must be placed closer than distant pairs.

The documentation also states that classical MDS, which uses Euclidean distance as input, yields results similar to PCA. Both reduce "high dimensions to low dimensions," but PCA starts from variable values, whereas MDS starts from a distance matrix.

| | PCA | MDS |
|---|---|---|
| Input | Table of variable values | Distance matrix between objects |
| Criterion | Maximize preservation of variance | Maximize preservation of distances (minimize stress) |
| Result | Principal components (combinations of variables) | Coordinates of objects |

## Time Series: Data with Time Order

Time series are values observed for the same subject in chronological order. While general regression assumes observations are independent, time series analysis starts from the premise that today's value is connected to yesterday's.

### Components

Time series are typically viewed as a mixture of four components.

| Component | Meaning |
|---|---|
| Trend | Long-term upward or downward direction |
| Seasonality | Repetition with a fixed period (monthly, by day of week, etc.) |
| Cyclical | Up and down movements without a fixed period |
| Irregular | The remainder that cannot be explained by the above three |

Distinguishing between seasonality and cyclicity can be confusing. Based on Hyndman's textbook, seasonality has a fixed and known period, whereas cyclicity does not have a fixed length, making it difficult to predict when peaks or troughs will occur.

### Stationarity

A stationary time series is one whose statistical properties do not change over time. Visually, the plot is generally horizontal with constant fluctuation width. If there is a trend or seasonality, it is not stationary. White noise is stationary. It was surprising that even if cyclicity exists, if the period is not fixed, it is treated as stationary.

There are two methods to check for stationarity.

- ACF plot: If the series is stationary, the autocorrelation (ACF) drops to near 0 quickly; if non-stationary, it decays slowly.
- Unit root test: The KPSS test used in Hyndman's textbook has "stationarity" as the null hypothesis. A small p-value (e.g., < 0.05) implies that differencing is required. Since the null hypotheses can be opposite for different tests, it is safer to memorize what the null hypothesis is for each test during exams. The structure of hypothesis testing was covered in [details → hypothesis testing](#/post/adsp-hypothesis).

Here is a direct verification example. I created a random walk (cumulative noise at each time point) and calculated its ACF.

| Lag | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Random Walk ACF | 0.98 | 0.97 | 0.95 | 0.93 | 0.91 |
| Differenced ACF (once) | 0.03 | -0.02 | 0.20 | 0.04 | 0.03 |

The original series decays slowly, while differencing brings it close to 0. This illustrates the transition from non-stationary to stationary.

### Transformation: Differencing

Differencing takes the difference between neighboring observations ($y_t - y_{t-1}$). It removes level changes to stabilize the mean and reduces trends and seasonality. Seasonal differencing uses the difference with the value from one period ago ($y_t - y_{t-m}$). For monthly data, $m=12$. Applying seasonal differencing to a sine wave with a period of 12 reduced the standard deviation from 3.59 to 0.41.

A point to note is that you should only difference as much as necessary. Over-differencing can introduce spurious autocorrelation. Log transformation stabilizes variance but does not remove trends.

## ARIMA

ARIMA(p, d, q) stands for AutoRegressive Integrated Moving Average, and the three numbers define its structure.

| Symbol | Meaning |
|---|---|
| p | Autoregressive (AR) order: How many past values are used |
| d | Differencing order: How many times to difference to achieve stationarity |
| q | Moving Average (MA) order: How many past forecast errors are used |

- AR(p): Regresses on its own past values. $y_t = c + \phi_1 \cdot y_{t-1} + \dots + \varepsilon_t$
- MA(q): A combination of past errors. $y_t = c + \varepsilon_t + \theta_1 \cdot \varepsilon_{t-1} + \dots$. This is a different concept from moving average smoothing used to extract trends, which can cause confusion due to the similar name.
- I(differencing): Indicates that the inverse operation of differencing (integration) is included. As noted in the textbook, $d$ rarely exceeds 2.

Common special cases are as follows:

| Model | Notation |
|---|---|
| White noise | ARIMA(0,0,0) |
| Random walk | ARIMA(0,1,0) |
| Random walk with drift | ARIMA(0,1,0) + constant |
| Autoregressive | ARIMA(p,0,0) |
| Moving average | ARIMA(0,0,q) |

ACF serves as a clue when selecting $p$ and $q$. I directly simulated these to verify against theory.

- AR(1), $\phi=0.7$: ACF decreased gradually: 0.69, 0.48, 0.32, 0.21, 0.15. This is similar to the theoretical values $0.7^k$ (0.70, 0.49, 0.34, 0.24, 0.17).
- MA(1), $\theta=0.8$: At lag 1 it was 0.49; thereafter it was near 0 (0.00, -0.02, …). This matches the theoretical value $\theta/(1+\theta^2) = 0.49$.

Thus, AR is summarized as ACF decaying slowly, while MA shows a sharp cutoff after lag $q$. Questions distinguishing these two are common in exams.

<details>
<summary>Detailed solution: ARIMA equation using the backshift operator</summary>

The backshift operator $B$ shifts values one time step backward ($B \cdot y_t = y_{t-1}$). First-order differencing is $(1 - B)y_t$, and $d$-th order differencing is $(1 - B)^d \cdot y_t$. Thus, $d$ is the exponent of $(1 - B)$. The full equation is as follows:

$(1 - \phi_1 B - \dots - \phi_p B^p)(1 - B)^d \cdot y_t = c + (1 + \theta_1 B + \dots + \theta_q B^q) \cdot \varepsilon_t$

The left side contains the AR polynomial and differencing, while the right side contains the MA polynomial.

</details>

## Common Misconceptions

- Principal components are just subsets of the original variables: Incorrect. They are new variables created as combinations of the original ones.
- PCA does not require attention to units: True. Since scaling is not applied, variables with larger magnitudes dominate if units differ.
- MDS always reproduces original distances exactly: False. Errors occur during dimensionality reduction, and the magnitude of these errors is measured as stress.
- Cyclical and seasonal are the same: Incorrect. Seasonal patterns have a fixed period, whereas cyclical patterns do not.
- Larger $d$ in ARIMA is better: False. You should difference only as much as necessary; over-differing creates spurious autocorrelation.

## Next Articles

- Required concepts: [details → Introduction to Statistical Analysis](#/post/adsp-stat-basic), [details → Regression Analysis](#/post/adsp-regression)
- Next module: [details → Structured Data Mining](#/post/adsp-datamining)
- ← Concept map ([#/post/adsp-map])

## Reference Links

- scikit-learn, Decomposing signals into components (PCA): https://scikit-learn.org/stable/modules/decomposition.html#pca
- scikit-learn, Manifold learning (MDS): https://scikit-learn.org/stable/modules/manifold.html#multidimensional-scaling
- Hyndman & Athanasopoulos, Forecasting: Principles and Practice, Stationarity and differencing: https://otexts.com/fpp3/stationarity.html
- Hyndman & Athanasopoulos, Non-seasonal ARIMA models: https://otexts.com/fpp3/arima.html