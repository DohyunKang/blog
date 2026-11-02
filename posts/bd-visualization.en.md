The latter part of the Big Data Analysis Engineer written exam (Subject 4) focuses on how to present and interpret results. There are almost no calculation problems; instead, the core consists of questions about matching graphs to specific situations and reading metrics/results to draw conclusions. The model evaluation metrics themselves are summarized separately in [Details → Model Evaluation](#/post/bd-evaluation), and here we focus on how to interpret and communicate those numbers.

You can check the exam schedule and registration fee on the official website. This article covers only the core topics of each unit and frequently asked question types.

## Choosing Visualizations Based on Questions

Once the relationship you want to show is determined, the choice of graph is almost fixed.

| What to Show | Representative Graph | Notes |
|---|---|---|
| Distribution of a single variable | Histogram, Box plot | A box plot shows median, quartiles, and outliers at once |
| Relationship between two numerical variables | Scatter plot | First check for correlation and outliers |
| Correlation among multiple variables | Correlation heatmap | Read the magnitude of the correlation coefficient by color intensity |
| Comparison of sizes by category | Bar chart | If categories have no order, sorting by size makes it easier to read |
| Changes over time | Line chart | Time series is basic |
| Composition relative to total | Pie chart, Stacked bar chart | Use bars if there are many items |
| Classification results | Confusion matrix, ROC curve | Observe changes based on thresholds |

Exams often ask in the form of "Which graph fits this purpose?" Grouping distributions as histograms/box plots, relationships as scatter plots, and trends as line charts will filter out most cases.

One more thing: visualizations must show data honestly. Cutting off axes in the middle exaggerates small differences, and having too many slices in a pie chart makes comparison impossible. For report graphs, including titles, axis labels, and units is basic.

## Three Distinctions in Interpretation

Interpretation questions usually ask whether you can distinguish between concepts that look similar to each other.

### 1. Variable Importance (What matters most to the model?)

Tree-based models provide importance based on how much they reduce impurity during learning. Below are results from training a Random Forest directly using breast cancer diagnosis data (built into scikit-learn).

<details>
<summary>Execution code and results (run with pandas, scikit-learn)</summary>

```python
import pandas as pd, numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance

d = load_breast_cancer(as_frame=True)
X, y = d.data, d.target
Xtr, Xte, ytr, yte = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)

rf = RandomForestClassifier(n_estimators=200, random_state=42).fit(Xtr, ytr)

# 트리 불순도 기반 중요도
imp = pd.Series(rf.feature_importances_, index=X.columns)
print(imp.sort_values(ascending=False).head(5).round(3))

# 순열 중요도 (시험 데이터에서)
pi = permutation_importance(rf, Xte, yte, n_repeats=10, random_state=42)
print(pd.Series(pi.importances_mean, index=X.columns)
        .sort_values(ascending=False).head(5).round(3))
```

Top 5 based on impurity

```
worst perimeter         0.141
worst area              0.132
worst concave points    0.122
worst radius            0.085
mean concave points     0.077
```

Top 5 based on permutation importance

```
worst texture      0.011
mean texture       0.005
concavity error    0.005
symmetry error     0.005
perimeter error    0.005
```
</details>

Even for the same model, the two rankings are completely different. In the impurity-based ranking, size-related features (perimeter, area, radius) appear at the top, while in permutation importance, all scores are very small (0.01 or less). This is because the dataset contains many variables that hold nearly identical information, such as radius, circumference, and area. The scikit-learn documentation also explains that if highly correlated variables exist, mixing one can allow recovery of information from the others, resulting in low importance for both. Therefore, it is recommended to group highly correlated variables and keep only one representative.

In summary:

| Distinction | Impurity-based (built into trees) | Permutation Importance |
|---|---|---|
| Calculation | Sum of impurity reduction during training | How much the score drops when one variable is shuffled |
| Applicable models | Tree-based models | Any model |
| Weakness | Biased towards numerical variables with many unique values | Both scores become low if highly correlated variables exist |
| Data basis | Based on training data | Can be calculated using test (validation) data |

Both merely show how much the model relies on a variable and do not indicate the variable's predictive power or causality. This part is frequently transformed into multiple-choice options in exams.

### 2. Direction of Variable Effect (In which direction does it influence?)

Importance only indicates magnitude, not direction. The method for reading direction varies by model.

- Linear and logistic regression are read using the sign and magnitude of coefficients. Logistic regression coefficients represent log odds changes, and `exp(coefficient)` is the odds ratio.
- Tree-based models are viewed via Partial Dependence Plots (PDP). This plots how predictions change when one variable's value is varied while averaging over others.

<details>
<summary>Logistic coefficients and partial dependence values (run directly)</summary>

```python
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.inspection import partial_dependence

lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
lr.fit(Xtr, ytr)
coef = pd.Series(lr[-1].coef_[0], index=X.columns).sort_values()
print(coef.head(3).round(2))
print(np.exp(coef.head(1)).round(3).to_dict())

pdp = partial_dependence(rf, Xte, ["worst radius"], grid_resolution=5)
print(pdp["grid_values"][0].round(1))
print(pdp["average"][0].round(3))
```

Results

```
worst texture          -1.23
worst concave points   -1.00
worst area             -0.95
{'worst texture': 0.293}

[10.4 14.1 17.7 21.4 25.1]
[0.662 0.656 0.527 0.524 0.524]
```
</details>

Since the model was trained on standardized data, a `worst texture` coefficient of -1.23 means that when this variable increases by one standard deviation, the log odds decrease by 1.23. In terms of odds ratio, this is approximately 0.293, or about 0.29 times. In this dataset, target 1 represents benign (positive class), so a negative coefficient indicates a direction that lowers the probability of the positive class.

Partial dependence values show that as the `worst radius` increases, the average probability of a positive outcome drops from 0.66 to 0.52. The curve bends most sharply in the middle and flattens at both ends; looking only at the average line can easily cause one to miss these segmental differences. According to the documentation, plotting ICE plots for each individual sample reveals the heterogeneous effects hidden within the average. Additionally, since PDP and ICE assume that the variable of interest is independent of the others, the presence of highly correlated variables can mix unrealistic data points and distort the curve.

### 3. Thresholds and Prediction Results (Where to Cut)

Classification models output probabilities, while humans decide where to cut for a positive prediction. I experimented with changing only the threshold within the same model to observe how the confusion matrix changes.

<details>
<summary>Confusion Matrix by Threshold (Run Directly)</summary>

```python
from sklearn.metrics import confusion_matrix, roc_auc_score
pp = rf.predict_proba(Xte)[:, 1]
print("auc", round(roc_auc_score(yte, pp), 3))
for t in (0.5, 0.8, 0.95):
    tn, fp, fn, tp = confusion_matrix(yte, (pp >= t).astype(int)).ravel()
    print(t, "TN", tn, "FP", fp, "FN", fn, "TP", tp)
```

Results

```
auc 0.992
0.5  TN 58  FP 6  FN 4   TP 103
0.8  TN 64  FP 0  FN 12  TP 95
0.95 TN 64  FP 0  FN 31  TP 76
```
</details>

| Threshold | False Positives (FP) | False Negatives (FN) |
|---|---|---|
| 0.5 | 6 | 4 |
| 0.8 | 0 | 12 |
| 0.95 | 0 | 31 |

The AUC remains unchanged at 0.992, but the types of errors change completely depending on the threshold. Raising the threshold makes the criterion for calling something positive stricter, reducing FP and increasing FN. Therefore, which error is more painful determines the threshold selection criteria. For issues like disease screening where missing a case is unacceptable, prioritize recall; for issues like spam filters where blocking legitimate emails is unacceptable, prioritize precision. Definitions of each metric are available [in detail → Model Evaluation](#/post/bd-evaluation).

## Report Generation and Model Operations

Analysis results must be delivered to the end-users of the model to conclude the process. Reports typically include:

1. Analysis objectives and data description (source, period, size)
2. Preprocessing and model selection process, used metrics
3. Results summary (key figures and interpretation)
4. Limitations and utilization strategies

When interpreting results, distinguishing between correlation and causation is fundamental. High variable importance does not mean that variable is the cause of the outcome. The reason for splitting data into training, validation, and test sets, along with overfitting checks, continues in [in detail → Analysis Model Design](#/post/bd-model-design).

Models remain a management target even after deployment. Over time, the distribution of input data may change, leading to performance degradation; thus, operations involve continuously monitoring performance metrics and retraining as needed. How the model was created using which algorithm is covered in [in detail → Supervised Learning Models](#/post/bd-supervised) and [in detail → Unsupervised Learning Models](#/post/bd-unsupervised).

## Order of Interpretation

Interpreting problems becomes easier if you filter the question stems in the following order:

- What kind of graph is being asked about? → Determine the relationship to be shown (distribution, association, trend, composition) first.
- Is it asking for importance or direction? → Importance refers only to magnitude; direction refers to coefficient signs or PDP.
- Options like "high importance means causation" → Eliminate these by distinguishing correlation from causation.
- Is it asking about error types? → Determine the threshold based on which loss (FP vs. FN) is greater.

In practical exams, practice translating this flow into code is necessary. That part continues in [in detail → Practical Python Highlights](#/post/bd-practical-python).

← [Concept Map](#/post/bd-map)

Related articles: [Model Evaluation](#/post/bd-evaluation), [Analysis Model Design](#/post/bd-model-design), [Practical Python Highlights](#/post/bd-practical-python)

## Reference Links

- scikit-learn, Permutation feature importance: https://scikit-learn.org/stable/modules/permutation_importance.html
- scikit-learn, Partial Dependence and Individual Conditional Expectation plots: https://scikit-learn.org/stable/modules/partial_dependence.html