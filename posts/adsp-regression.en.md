Regression analysis is a unit where you establish an equation explaining the dependent variable (result variable) using input variables (independent variables), and verify how useful that equation is. It follows hypothesis testing in ADsP 3, and although there are many terms, the number of questions asked is fixed. Check the exam schedule and registration fee on the official website.

## Simple Regression and Multiple Regression

Simple regression has one independent variable. You draw a straight line $y = b_0 + b_1x$ and determine $b_0$ and $b_1$ such that the sum of squares of the distances points deviate from the line (residuals) is minimized. This is the method of least squares. Multiple regression has two or more independent variables, so it takes the form $y = b_0 + b_1x_1 + b_2x_2 + \dots$.

| | Simple Regression | Multiple Regression |
|---|---|---|
| Independent Variables | 1 | 2 or more |
| Equation | $y = b_0 + b_1x$ | $y = b_0 + b_1x_1 + b_2x_2 \dots$ |
| Additional Considerations | None | Multicollinearity (variables entangled), variable selection |

The regression coefficient $b_1$ is read as "when other variables remain constant, if $x$ increases by 1, $y$ changes on average by $b_1$." If asked to interpret a coefficient in a problem, simply plug the numbers into this sentence template. Whether a coefficient is zero or not is checked using a t-test, and whether the model as a whole is meaningful is checked using an F-test. The method for reading p-values is summarized in [Details → Hypothesis Testing](#/post/adsp-hypothesis).

## Basic Assumptions of Regression

There are four assumptions regarding errors (residuals). When memorizing, you can use the names as they are.

| Assumption | Meaning | What happens if violated |
|---|---|---|
| Linearity | Linear relationship between independent and dependent variables | If curved, transform or add terms |
| Independence | Errors are unrelated to each other | Often violated in time series data where past and future are linked |
| Homoscedasticity | Spread of errors is the same everywhere | Residual plot looks like a funnel shape |
| Normality | Errors follow a normal distribution | Q-Q plot deviates from the line |

The statsmodels documentation also defines OLS as the case where errors are independent and have equal variance, separately handling WLS if variances differ and GLS for arbitrary covariance. Exams often ask "which assumption is violated based on the residual plot." If residuals are evenly scattered around 0 without patterns, the assumptions are generally satisfied.

## Coefficient of Determination R²

$R^2$ shows how much of the variation in $y$ the model explains as a number between 0 and 1. The formulas are as follows:

- SST (Total Sum of Squares) = $\Sigma(y - \text{mean})^2$
- SSE (Sum of Squared Errors) = $\Sigma(y - \text{predicted value})^2$
- SSR (Regression Sum of Squares) = SST − SSE
- $R^2 = \text{SSR} / \text{SST} = 1 - \text{SSE} / \text{SST}$

In simple regression, $R^2$ equals the square of the correlation coefficient. There are two points frequently tested here:

- Adding variables does not decrease $R^2$. Even adding useless variables leaves it unchanged.
- Therefore, in multiple regression, we also look at the adjusted $R^2$, which penalizes for the number of variables. Adjusted $R^2$ cannot be larger than $R^2$ and only increases if the new variable improves explanatory power beyond chance.

<details>
<summary>Try calculating manually (x = 1~5, y = 2, 4, 5, 4, 5)</summary>

These are values checked by running a 5-number example in Python.

- Least squares result: $b_1 = 0.6$, $b_0 = 2.2$, equation is $y = 2.2 + 0.6x$
- SST = 6.0, SSE = 2.4, SSR = 3.6
- $R^2 = 3.6 / 6.0 = 0.6$ (square of correlation coefficient is also 0.6)
- Adjusted $R^2 = 1 - (1 - 0.6) \times (5 - 1) / (5 - 1 - 1) \approx 0.467$
- $F = (\text{SSR} / 1) / (\text{SSE} / 3) = 4.5$

```python
import numpy as np
x = np.array([1, 2, 3, 4, 5.]); y = np.array([2, 4, 5, 4, 5.])
n, p = len(x), 1
b1 = ((x - x.mean()) * (y - y.mean())).sum() / ((x - x.mean())**2).sum()
b0 = y.mean() - b1 * x.mean()
sse = ((y - (b0 + b1 * x))**2).sum()
sst = ((y - y.mean())**2).sum()
r2 = 1 - sse / sst
adj = 1 - (1 - r2) * (n - 1) / (n - p - 1)
F = ((sst - sse) / p) / (sse / (n - p - 1))
```

In exams, calculations usually involve being given two of SST or SSE and asking to find $R^2$ or F.
</details>

## Multicollinearity

If independent variables are strongly correlated with each other, it becomes impossible to determine which variable affects $y$, and coefficient estimates become unstable. This phenomenon is multicollinearity. A common signal is when $R^2$ is high but individual coefficient t-tests are not significant.

Diagnosis is done using the Variance Inflation Factor (VIF). If $R_i^2$ is the $R^2$ obtained by regressing one variable against the other independent variables, then $\text{VIF} = 1 / (1 - R_i^2)$. The standard threshold is usually considered severe if VIF is 10 or higher, though some use 5 as a benchmark. In exams, 10 is typically the correct answer. Some software displays tolerance, which is the reciprocal of VIF.

Solutions include removing one of the highly correlated variables, combining variables, or reducing variables using principal component analysis. Principal component analysis continues in [Details → Multivariate Analysis and Time Series](#/post/adsp-multivariate-ts).

<details>
<summary>Try calculating VIF directly</summary>

x1 = 1~6, x2 = 2.1, 3.9, 6.2, 8.1, 9.8, 12.1, creating two variables with an almost doubling relationship; regressing x1 on x2 yielded an R² of approximately 0.998 and a VIF of about 624. This indicates that the two variables essentially convey the same information, far exceeding the threshold of 10.
</details>

## Variable Selection

There are three methods for deciding which candidate variables to include when there are many options.

| Method | Start | Progression |
|---|---|---|
| Forward Selection | No variables | Add one variable at a time that most significantly improves the model; stop if no further improvement is observed |
| Backward Elimination | All variables | Remove one variable at a time with the smallest loss; stop if removal causes significant loss |
| Stepwise Selection | Either | Alternately review addition and removal at each step |

The Wikipedia article on stepwise regression also explains it in the same order, citing the F-test or t-test as decision criteria. A common point of comparison is that forward selection cannot remove variables once added, while backward elimination cannot bring back variables once removed. Stepwise selection complements both approaches.

## Common Patterns and How to Solve Them

- Coefficient interpretation: Write it as "When x1 increases by 1, y changes by b1 (holding other variables constant)," and consider the units together.
- R² vs Adjusted R²: If adding a variable increases R² but decreases Adjusted R², the added variable is unnecessary.
- p-value judgment: If a coefficient's p-value is less than the significance level, that variable is significant. If the F-test p-value is small, the entire model is significant.
- Assumption checking: Link residual plot patterns to assumption names; a funnel shape indicates homoscedasticity, while curved patterns indicate non-linearity.
- Multicollinearity: Suspect multicollinearity if R² is high but most t-tests are insignificant; use VIF 10 as the threshold for judgment.
- Variable selection: Memorize the starting points and progression directions of forward, backward, and stepwise methods using a table.

Practice problems do not reproduce the original text verbatim. When solving them, first classify which of the above six patterns applies.

## Common Misconceptions

- High R² means a good model: Adding variables always increases R². Always consider Adjusted R² and residuals together.
- Large regression coefficients imply large effects: Coefficients cannot be directly compared if variable units differ.
- Correlation implies causation: Regression expresses relationships mathematically but does not prove causality.

## Reference Links

- statsmodels, Linear Regression: https://www.statsmodels.org/stable/regression.html
- Wikipedia, Coefficient of determination: https://en.wikipedia.org/wiki/Coefficient_of_determination
- Wikipedia, Variance inflation factor: https://en.wikipedia.org/wiki/Variance_inflation_factor
- Wikipedia, Stepwise regression: https://en.wikipedia.org/wiki/Stepwise_regression

← Concept map ([ADsP map](#/post/adsp-map))

Related posts: [Basic Statistics Analysis](#/post/adsp-stat-basic) · [Hypothesis Testing](#/post/adsp-hypothesis) · [Structured Data Mining](#/post/adsp-datamining)