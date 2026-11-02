In the Big Data Analysis Engineer exam, data preprocessing appears in both the written and practical sections. The written section tests concepts and terminology, while the practical section requires you to perform the same tasks directly using pandas or scikit-learn (using R functions if writing in R). Therefore, it is best to memorize terms, when they are used, and code snippets as sets. The preceding steps of collecting and storing data can be found [in detail → Data Collection and Storage](#/post/bd-collection-storage).

## Overview of the Workflow

| Task | Problem to Solve | Representative Methods |
|---|---|---|
| Missing Value Handling | Values are empty | Deletion, replacement with mean/median/mode, interpolation |
| Outlier Handling | Values that stand out alone | IQR-based method, standardized scores, removal/replacement |
| Transformation | Values have different ranges and shapes | Normalization, standardization, log transformation, binning |
| Encoding | Models cannot read categorical text | One-hot encoding, label encoding |
| Imbalance Handling | One class is too small | Oversampling, undersampling, weighting |
| Splitting | Want fair evaluation | Train/validation/test split, stratified splitting |

The examples below all use the same small dataset: 6 ages, 6 incomes, and 6 cities.

```python
import pandas as pd, numpy as np
df = pd.DataFrame({
    'age':[25,30,np.nan,45,28,100],
    'income':[300,350,400,np.nan,320,330],
    'city':['서울','부산','서울','대구','부산','서울']})
print(df.isna().sum())   # age 1, income 1, city 0
```

## Missing Values

pandas represents empty values as NaN in float columns. If a single NaN enters an integer column, it is converted to float. To check if a value is empty, use `isna()` instead of `==` because NaN is not equal to itself.

There are three main handling methods.

| Method | Code | When to Use |
|---|---|---|
| Deletion | `df.dropna()` | When the proportion is small and missing randomly |
| Replacement | `df.fillna(value)` | Mean (for numeric), median (for skewed numeric), mode (for categorical) |
| Interpolation | `s.interpolate()`, `s.ffill()` | For time-series data with order |

```python
df.dropna()             # 6행 중 4행만 남는다
df.fillna({'age': df['age'].median(), 'income': df['income'].mean()})
# age의 빈칸은 30, income의 빈칸은 340이 들어간다
pd.Series([1, np.nan, 3]).interpolate().tolist()  # [1.0, 2.0, 3.0]
pd.Series([1, np.nan, 3]).ffill().tolist()        # [1.0, 1.0, 3.0]
```

Note that `dropna()` reduced the 6 rows to 4 rows. If there are many columns, a single empty cell in a row causes the entire row to be deleted. Therefore, in exams, replacement often appears before deletion.

Choose the replacement value based on the distribution. If 100 is mixed into ages, the mean gets skewed upward, so the median is safer. `interpolate()` uses linear interpolation by default, while `ffill()` keeps the previous value, resulting in different outputs. The two lines above demonstrate this difference.

<details>
<summary>Types of Missing Data (MCAR·MAR·MNAR)</summary>

Missing data is categorized into three types based on why it occurred.

| Type | Meaning | Example |
|---|---|---|
| MCAR | Completely at random | A sensor randomly disconnects once |
| MAR | Depends on other observed variables | Younger people skip income questions more often |
| MNAR | Depends on the missing value itself | High-income individuals do not report their income |

If it is MCAR, deletion introduces little bias. If it is MNAR, be cautious with both deletion and replacement.
</details>

## Outliers

Outliers are values that deviate significantly from others. They could be errors or genuine extreme values, so investigate the cause before removing them. In exams, the IQR-based method appears most frequently.

The threshold is below Q1 − 1.5×IQR and above Q3 + 1.5×IQR. Calculating with age values [25, 30, 45, 28, 100] (excluding missing) yields the following:

```python
x = df[['age']].dropna()
q1, q3 = x['age'].quantile([.25, .75])   # 28.0, 45.0
iqr = q3 - q1                            # 17.0
lo, hi = q1 - 1.5*iqr, q3 + 1.5*iqr      # 2.5, 70.5
x[(x.age < lo) | (x.age > hi)]           # 100만 걸린다
```

With a lower bound of 2.5 and upper bound of 70.5, only 100 is identified as an outlier. Another method uses standardized scores (z-score); typically, values with an absolute z-score exceeding 3 are considered outliers. Since the mean and standard deviation themselves get skewed by outliers, IQR is less sensitive for small samples.

Handling options include removal, replacement with upper/lower bounds, transformation (e.g., log), or keeping as-is while using methods robust to outliers. How to interpret outliers during exploration continues in [in detail → Exploratory Data Analysis and Basic Statistics](#/post/bd-eda-stats).

## Transformation

### Normalization and Standardization

Both adjust variable units and ranges. Distance-based models (k-NN, k-means) or gradient descent-based models require this because variables with larger scales can dominate results. Tree-based models are generally considered unaffected by scaling.

| Name | Formula | Result Range | scikit-learn |
|---|---|---|---|
| Min-Max Normalization | (x − min) / (max − min) | 0~1 | `MinMaxScaler` |
| Standardization (z-score) | (x − mean) / std | Mean 0, Std 1 | `StandardScaler` |
| Robust Scaling | Based on median and quartiles | Less affected by outliers | `RobustScaler` |

Applied both methods to the same age values [25, 30, 45, 28, 100].

```python
from sklearn.preprocessing import StandardScaler, MinMaxScaler
StandardScaler().fit_transform(x).ravel().round(3)
# [-0.734 -0.556 -0.021 -0.627  1.939]
MinMaxScaler().fit_transform(x).ravel().round(3)
# [0.    0.067 0.267 0.04  1.   ]
```

Min-max scaling clusters the remaining values between 0 and 0.27 due to a minimum of 100, causing skewness when outliers are present. Therefore, robust scaling is recommended when there are many outliers. The terminology can be confusing, so you may encounter questions where you identify the formula first and then select the corresponding name in written exams.

### Fitting Only on Training Data

Scalers should use `fit` on the training data and `transform` only on test data. If you fit on the entire dataset, information from the test data leaks into the training process. The scikit-learn documentation also demonstrates using a pipeline to enforce this order.

```python
tr = pd.DataFrame({'v':[1,2,3,4]}); te = pd.DataFrame({'v':[10]})
s = MinMaxScaler().fit(tr)
s.transform(te)    # [[3.]]
```

If the training range is 1~4 but a test value of 10 results in 3, it is normal for values to fall outside the 0~1 range. You should not force a restriction by fitting on the entire dataset.

### Log Transformation and Binning

Variables skewed to the right can be normalized by taking the logarithm. `np.log1p([1,10,100,1000])` yields approximately 0.693, 2.398, 4.615, and 6.909, reducing a 1000-fold difference to roughly a 10-fold difference. If values are less than or equal to zero, `log` is undefined, so `log1p` is used.

Binning converts continuous values into categories. `pd.cut` allows you to specify bin widths directly, while `pd.qcut` splits the data so that each bin contains a similar number of observations.

```python
pd.cut(pd.Series([5,15,25,35,45]), bins=[0,20,40,60], labels=['a','b','c']).tolist()
# ['a','a','b','b','c']
pd.qcut(pd.Series(range(1,9)), 4, labels=False).tolist()
# [0,0,1,1,2,2,3,3]
```

## Encoding

Categorical variables represented as text must be converted to numbers before being fed into a model. For unordered categories, one-hot encoding is standard; for ordered categories, label (ordinal) encoding is used. Assigning 1, 2, 3 to unordered categories causes the model to interpret magnitude as order.

```python
pd.get_dummies(df['city'], dtype=int)
#    대구  부산  서울
# 0   0   0   1
# 1   0   1   0
# ...
pd.get_dummies(df['city'], drop_first=True, dtype=int)   # 열 하나를 뺀다
```

With three categories, three columns are generated. Setting `drop_first=True` removes one column so that the remaining columns can reconstruct the original category (to avoid dummy variable trap). scikit-learn's `OneHotEncoder` performs the same task and offers options for handling unseen categories in test data (`handle_unknown`) and dropping columns (`drop`). When there are many category types, the number of columns can explode, so methods to group low-frequency categories are employed.

## Imbalanced Data

In a dataset with 5% positive and 95% negative samples, predicting everything as negative yields an accuracy of 95%. Therefore, for imbalanced data, metrics like recall and F1 score are preferred over accuracy. These metrics are discussed in detail in [Evaluation → Model Evaluation](#/post/bd-evaluation).

There are three approaches to handling this:

| Method | Description | Caution |
|---|---|---|
| Oversampling | Increases the minority class (e.g., random sampling with replacement, SMOTE) | Duplication can lead to overfitting |
| Undersampling | Reduces the majority class | Information is discarded |
| Weights | Assigns weights to the minority class in loss calculation (`class_weight`) | Keeps the data as is |

Data created with `make_classification(n_samples=1000, weights=[.95,.05])` results in 946 vs. 54 samples per class. Using `sklearn.utils.resample` produces the following:

```python
from sklearn.utils import resample
up = resample(Xm, replace=True,  n_samples=946, random_state=0)  # 54개 -> 946개
dn = resample(Xj, replace=False, n_samples=54,  random_state=0)  # 946개 -> 54개
```

SMOTE is summarized as a method that creates new samples by interpolating between existing minority samples. Sampling should be applied only to the training data, while the test data must maintain its original distribution.

## Splitting

Evaluate by splitting into training, validation, and test sets. Use `stratify` to maintain class proportions across splits.

```python
from sklearn.model_selection import train_test_split
a, b, c, d = train_test_split(X, y, test_size=.2, stratify=y, random_state=0)
np.bincount(c), np.bincount(d)   # [757 43], [189 11]
```

With 43/800 in the training set and 11/200 in the test set, both are approximately 5%. Without `stratify`, the minority class may be concentrated in one split. The design of splitting and cross-validation continues in [Analysis → Model Design](#/post/bd-model-design).

## Common Question Types

- Pros and cons of missing value handling methods and choosing replacement values
- Calculating outlier boundaries based on IQR
- Identifying normalization/standardization formulas and selecting robust methods for outliers
- Why one-hot encoding is required for unordered categories
- Why accuracy is risky in imbalanced data and distinguishing sampling methods
- Which data to use for `fit` of a scaler (training data only)

In practical exams, topics such as `isna().sum()`, `fillna`, distinguishing scaler `fit_transform`/`transform`, `get_dummies`, and `train_test_split` often appear together. Check the official website for exam schedules and requirements.

The steps of reducing and selecting variables continue in [Feature Selection and Dimensionality Reduction](#/post/bd-feature-select).

← [Concept Map](#/post/bd-map)

Related posts: [Exploratory Data Analysis and Basic Statistics](#/post/bd-eda-stats), [Feature Selection and Dimensionality Reduction](#/post/bd-feature-select), [Model Evaluation](#/post/bd-evaluation)

## Reference Links

- scikit-learn, Preprocessing data: https://scikit-learn.org/stable/modules/preprocessing.html
- pandas, Working with missing data: https://pandas.pydata.org/docs/user_guide/missing_data.html