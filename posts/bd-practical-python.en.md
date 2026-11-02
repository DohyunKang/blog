Practical Python involves a single workflow: receiving data, preprocessing it, building a model, evaluating it, and exporting the results to a file. Memorize this sequence rather than just function names. Check the exam schedule, registration fee, and question format on the official website. This article summarizes only the code flow, not domain knowledge; concepts are covered separately in previous chapters.

## The Six-Step Flow

| Step | Task | Commonly Used Tools |
|---|---|---|
| 1 | View data · Check missing values | `df.shape`, `df.isna().sum()` |
| 2 | Handle missing and outlier values | `fillna`, `dropna`, quartiles |
| 3 | Encode categorical variables | `pd.get_dummies` |
| 4 | Split into train/test sets | `train_test_split` |
| 5 | Scaling · Model training | `StandardScaler`, `RandomForestClassifier` |
| 6 | Evaluation · Saving results | `accuracy_score`, `roc_auc_score`, `to_csv` |

There are two critical points where the order matters. The scaler must be fitted only on the training data after splitting, and encoding should be done once before splitting to prevent column name mismatches. We will see why in the code below.

Concepts are covered in detail at [Data Preprocessing →](#/post/bd-preprocessing) and [Model Design →](#/post/bd-model-design).

## Example Data

This is practice data created directly, not exam data. Missing values were intentionally added to `age` and `income`.

```python
import numpy as np, pandas as pd
rng = np.random.default_rng(0)
n = 200
df = pd.DataFrame({
    "age": rng.integers(20, 70, n).astype(float),
    "income": rng.normal(4000, 800, n).round(0),
    "grade": rng.choice(["A", "B", "C"], n),
})
df["buy"] = ((df["income"] > 4000) ^ (rng.random(n) < 0.2)).astype(int)
df.loc[rng.choice(n, 20, replace=False), "age"] = np.nan
df.loc[rng.choice(n, 10, replace=False), "income"] = np.nan
print(df.isna().sum())
print(df.shape)
```

Running this produces `age` 20, `income` 10, and `grade`·`buy` 0, with a shape of `(200, 4)`. In practical exams, it's good practice to immediately print these two lines (shape and count of missing values) when loading data.

## Handling Missing Values

Based on the pandas documentation, `isna()` returns boolean arrays indicating missing status, `dropna()` removes rows (by default) or columns containing missing values, and `fillna()` fills them with specified values. A one-sentence mnemonic is "find, remove, fill".

```python
num_cols = ["age", "income"]
df[num_cols] = df[num_cols].fillna(df[num_cols].median())
print(df.isna().sum().sum())   # 0
```

For numeric columns, filling with the mean or median is common. If outliers are present, the mean can be skewed, so the median is safer. After filling, confirm that `isna().sum().sum()` equals 0.

<details>
<summary>Filtering Outliers Using Quartiles</summary>

The IQR method considers values below Q1 − 1.5×IQR or above Q3 + 1.5×IQR as outliers.

```python
s = pd.DataFrame({"v": [1, 2, 5]})
q1, q3 = s["v"].quantile([.25, .75])
iqr = q3 - q1
kept = s[(s.v >= q1 - 1.5*iqr) & (s.v <= q3 + 1.5*iqr)]
```

If the values are 1, 2, and 5, Q1 is calculated as 1.5 and Q3 as 3.5, so all three remain. In exams, always read the question first to determine whether to "remove" or "replace" outliers.
</details>

## Categorical Encoding

String columns must be converted to numbers because models cannot read them directly. One-hot encoding uses `pd.get_dummies`.

```python
X = pd.get_dummies(df.drop(columns="buy"), columns=["grade"], drop_first=True)
y = df["buy"]
print(list(X.columns))   # ['age', 'income', 'grade_B', 'grade_C']
```

Setting `drop_first=True` removes the reference category (A), reducing the number of columns by one. With three categories, only two columns are created. While tree-based models can run without this option, regression models may suffer from multicollinearity; thus, providing it is generally safer.

## Splitting and Scaling

```python
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)

sc = StandardScaler().fit(X_tr[num_cols])
X_tr = X_tr.copy(); X_te = X_te.copy()
X_tr[num_cols] = sc.transform(X_tr[num_cols])
X_te[num_cols] = sc.transform(X_te[num_cols])
```

Three points are key:

- Fix `random_state` to ensure the same split across runs.
- Use `stratify=y` in classification to maintain class proportions between train and test sets.
- Fit the scaler only on training data using `fit`, then apply `transform` to test data to prevent data leakage.

Refer to [Model Design →](#/post/bd-model-design) for details on overfitting and cross-validation to understand why this order is important.

## Model Training and Prediction

```python
from sklearn.ensemble import RandomForestClassifier

m = RandomForestClassifier(n_estimators=100, random_state=42).fit(X_tr, y_tr)
pred  = m.predict(X_te)
proba = m.predict_proba(X_te)[:, 1]
print(m.classes_)   # [0 1]
```

According to scikit-learn documentation, the default `n_estimators` is 100 and `random_state` is None; without setting them, results vary between runs. `predict_proba` returns probabilities with shape `(n_samples, n_classes)`, where column order follows `classes_`. Thus, `[:, 1]` corresponds to class 1's probability. If the problem asks to "submit probabilities," use this method instead of `predict`.

Model-specific features are covered in [Supervised Learning Models →](#/post/bd-supervised). Since code structures are nearly identical, you can replace `RandomForestClassifier` with `LogisticRegression`, `DecisionTreeClassifier`, or `SVC`, while keeping the rest (`fit`, `predict`) unchanged.

## Evaluation

```python
from sklearn.metrics import (accuracy_score, f1_score,
                             roc_auc_score, confusion_matrix)

print(confusion_matrix(y_te, pred))
print(accuracy_score(y_te, pred), f1_score(y_te, pred), roc_auc_score(y_te, proba))
```

Running on the example data above yields a confusion matrix of `[[18 4] [4 14]]`, accuracy of 0.8, F1 score around 0.778, and AUC around 0.836. The structure of these metrics matters more than the raw numbers themselves.

| Metric | Input |
|---|---|
| Accuracy, F1 | True labels, **predicted class** |
| AUC | True labels, **predicted probability** |

If you pass classes (0/1) to AUC, no error occurs, but the value changes. This is a common pitfall because different functions accept different arguments. For detailed meanings of these metrics, see [Evaluation → Model Evaluation](#/post/bd-evaluation).

## Saving Results

```python
out = pd.DataFrame({"pred": proba})
out.to_csv("result.csv", index=False)
```

Removing `index=False` adds an extra column with row numbers at the beginning. In problems with specified submission formats, this single line can lead to point deductions, so ensure the column names and count match the problem instructions exactly.

## Common Mistakes

- Applying `fit` to test data as well. `fit` should only be used for training; for testing, use only `transform` or `predict`.
- Not setting `random_state`, causing results to vary every time.
- Encoding separately for training and test sets, leading to misaligned columns.
- Leaving the target variable (`buy`) in `X` as is.
- Passing classes instead of probabilities to AUC.

The code in this article was verified using Python 3 with pandas 3.1.0 and scikit-learn 1.9.1. Version differences may exist in your testing environment, so always refer to the official documentation for function arguments.

---

← [Concept Map](#/post/bd-map)

Related posts: [Data Preprocessing](#/post/bd-preprocessing) · [Supervised Learning Models](#/post/bd-supervised) · [Model Evaluation](#/post/bd-evaluation)

## Reference Links

- [pandas documentation — Working with missing data](https://pandas.pydata.org/docs/user_guide/missing_data.html)
- [scikit-learn documentation — RandomForestClassifier](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html)