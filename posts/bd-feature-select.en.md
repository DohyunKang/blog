# Variable Selection and Dimensionality Reduction

When you have data with 30 variables versus data with only 5, if the model is the same, the dataset with fewer variables is generally easier to handle. It learns faster, is easier to interpret, and has a lower risk of overfitting. Therefore, a step to reduce variables is included before building the model. Methods for reduction are broadly divided into two categories.

| Category | Action | Resulting Variables | Representative Techniques |
|---|---|---|---|
| Variable Selection | Selects only some of the original variables | Original variables remain unchanged | Filter, Wrapper, Embedded |
| Dimensionality Reduction | Combines variables to create new ones | Newly created variables | PCA, etc. |

In exams, questions frequently ask for the distinction between these two and how to differentiate the three methods within variable selection. It is better to understand "the criteria for selection" rather than memorizing past exam sentences.

After organizing missing values and scaling in [Preprocessing](#/post/bd-preprocessing), this step comes before selecting a model ([Model Design](#/post/bd-model-design)).

## Filter: Eliminate using statistics without a model

Each variable is scored using statistics, and only those with high scores are retained. Since no model is run, this approach is fast. The scikit-learn documentation introduces `VarianceThreshold` (which discards variables with low variance) and `SelectKBest` (which keeps the top k variables by score) under the filter category. Scoring functions include `chi2`, `f_classif`, and `mutual_info_classif` for classification, and `f_regression` for regression.

- Variables with nearly zero variance contain no information.
- Variable pairs with high correlation coefficients should be reduced to one (see [Correlation Analysis](#/post/bd-eda-stats)). If independent variables are too similar, multicollinearity arises.
- The relationship between a variable and the target variable is scored using test statistics (F-value, Chi-square, etc.).

The disadvantage is that variables are considered individually. While weak on their own, effective combinations of variables are missed.

## Wrapper: Select by repeatedly running a model

A subset of variables is changed, and a model is repeatedly trained to select the combination with good performance. It is accurate but expensive. The documentation treats `RFE` (Recursive Feature Elimination) as a wrapper method. A model that outputs coefficients or importance scores is trained, the weakest variable is removed, and this is repeated until the desired number of variables remains. There is also `RFECV`, which determines the number using cross-validation.

There are specific names often seen in exams.

| Method | Movement |
|---|---|
| Forward Selection | Adds one variable at a time that provides the most help starting from an empty set |
| Backward Elimination | Starts with all variables and removes one at a time that provides the least help |
| Stepwise Selection | Adds variables, then removes those that become unnecessary |

## Embedded: Select while learning

Variable importance is determined during the model training process, and selection is made based on that. The documentation introduces `SelectFromModel` as a meta-transformer. Only variables with importance above a threshold are retained; the threshold can be provided as a number or strings like `"mean"` or `"median"`.

- L1 Regularization (Lasso): Sets some coefficients exactly to zero, causing variables to be removed. The stricter the regularization, the fewer variables remain. According to the documentation, for Lasso, a larger alpha reduces the number of variables, and for classification models, a smaller C reduces the number of variables.
- L2 Regularization (Ridge): Shrinks coefficients but does not set them to zero. Therefore, it is closer to coefficient stabilization than variable selection.
- Tree-based methods: Use variable importance from ensembles like Random Forest.

If you memorize these three methods in one line, it goes like this: Filter selects before the model, Wrapper selects while repeatedly training the model, and Embedded selects within the model training process. Speed-wise, Filter is fast and Wrapper is slow.

## Results from Actual Implementation

I tested this using breast cancer diagnosis data (`load_breast_cancer`, 569 rows, 30 variables). The data was split into 70% for training and 30% for testing, and variable selection was performed only on the training data. This is because selecting variables based on test data would inflate the evaluation.

```python
import numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.feature_selection import SelectKBest, f_classif, RFE, SelectFromModel
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

X, y = load_breast_cancer(return_X_y=True, as_frame=True)
Xtr, Xte, ytr, yte = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)

# 필터: 상관 0.9 넘는 쌍에서 하나씩 제거
corr = Xtr.corr().abs()
up = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
drop = [c for c in up.columns if (up[c] > 0.9).any()]
print(len(drop), Xtr.shape[1] - len(drop))   # 11 19

# 필터: F검정 점수 상위 5개
skb = SelectKBest(f_classif, k=5).fit(Xtr, ytr)

# 래퍼: RFE (표준화 후 로지스틱)
sc = StandardScaler().fit(Xtr)
rfe = RFE(LogisticRegression(max_iter=1000), n_features_to_select=5)
rfe.fit(sc.transform(Xtr), ytr)

# 임베디드: 랜덤포레스트 중요도 (평균 이상)
sfm = SelectFromModel(
    RandomForestClassifier(n_estimators=200, random_state=42)).fit(Xtr, ytr)
```

Logistic regression was retrained using the variables selected by each method to measure accuracy on the test data.

| Variable Composition | Number of Variables | Test Accuracy |
|---|---|---|
| All | 30 | 0.988 |
| Remove highly correlated variables (Filter) | 19 | 0.977 |
| RFE (Wrapper) | 5 | 0.953 |
| Random Forest Importance (Embedded) | 10 | 0.936 |
| SelectKBest (Filter) | 5 | 0.924 |

Reducing the number of variables from 30 to 5 did not significantly decrease accuracy. However, this table shows the result for a single seed and a single split; we cannot assume that rankings will always appear like this. A notable observation is that among the 5 features selected by `SelectKBest`, `mean perimeter`, `worst radius`, and `worst perimeter` all represent size-related variables that are similar to each other. Because the filter evaluates variables independently, it tends to select similar variables together, whereas RFE mixed in variables with different characteristics, such as `area error` and `worst texture`. In this dataset, this difference manifested as a difference in accuracy.

<details>
<summary>Top feature importance values and variance filter</summary>

The top 5 features by Random Forest importance were `worst perimeter` (0.141), `worst area` (0.132), `worst concave points` (0.122), `worst radius` (0.085), and `mean concave points` (0.077) in that order. Since radius, perimeter, and area convey almost the same information, their importance is split among them.

Applying `VarianceThreshold(threshold=1.0)` leaves 10 features, all of which are variables with large value units (e.g., perimeter, area). Variance is sensitive to scale; therefore, when filtering by variance between variables with different scales, only those with larger units survive regardless of their actual importance. One must be careful when using the variance filter before standardization.
</details>

## Dimensionality Reduction and PCA

Feature selection involves choosing original features, whereas PCA (Principal Component Analysis) creates new orthogonal axes by linearly combining variables. The first axis explains the most variance, the second the next most, and so on. According to the documentation, PCA subtracts the mean of each variable but does not adjust the scale. If variables with different units are mixed, standardization must be performed first.

We verified this using the same data. After standardizing and applying PCA, the explained variance ratios were 0.452 for PC1, 0.196 for PC2, and 0.089 for PC3. Seven components were needed to reach 90% cumulative explained variance, and ten components for 95%. Without standardization, PC1 accounted for 0.985 of the total variance, effectively monopolizing the axis with a single variable having a large unit (e.g., area).

```python
from sklearn.decomposition import PCA

pca = PCA(n_components=0.95).fit(sc.transform(Xtr))   # 누적 95%까지
print(pca.n_components_)                              # 10
Ztr = pca.transform(sc.transform(Xtr))
Zte = pca.transform(sc.transform(Xte))
m = LogisticRegression(max_iter=1000).fit(Ztr, ytr)
print(round(m.score(Zte, yte), 3))                    # 0.971
```

Passing a float between 0 and 1 to `n_components` selects the minimum number of components required to reach that cumulative explained variance threshold. With 30 variables reduced to 10 principal components, the accuracy was 0.971.

In exams, criteria for determining the number of principal components include the point where the cumulative explained variance ratio reaches a certain level (e.g., 80–90%) or the "elbow" point in a scree plot. From a computational perspective, this connects to the eigenvalue decomposition of the covariance (or correlation) matrix. Larger eigenvalues indicate that the corresponding axis explains more variance.

We also list the disadvantages of PCA:

- New axes are mixtures of original variables, making interpretation difficult.
- They find directions with large variance but do not check for relevance to the target variable.
- As a linear transformation, they cannot capture non-linear structures.

Using PCA in clustering or visualization will be covered next in [unsupervised learning](#/post/bd-unsupervised).

## Derived Features

Creating new features by combining existing ones is also part of feature engineering. Examples include calculating BMI from height and weight, extracting day-of-week and month from a date, or computing average purchase amount from purchase frequency and amount. Categorical variables can be converted to dummy (one-hot) variables, and continuous variables can be binned. Derived features often stem from domain knowledge and have the effect of directly injecting relationships like ratios or differences that models struggle to discover on their own. If a derived feature overlaps significantly with existing features, it should be filtered out again using correlation analysis.

## Summary for Exams

- Filters, wrappers, and embedded methods are distinguished by "whether a model is used and when."
- Forward selection, backward elimination, and stepwise selection belong to the wrapper category.
- Lasso (L1) sets some coefficients to zero, whereas Ridge (L2) does not.
- PCA is not a selection method but a way to create new variables; standardization must be performed first.
- The number of principal components is determined by cumulative explained variance or a scree plot.
- Feature selection should fit only on training data and then be applied directly to test data.

In practical exams, the basic order after `train_test_split` is to use `fit` for training only and `transform` for both sets. This rule applies to both feature selection and PCA. Check the exam schedule and registration method on the official website.

## Reference Links

- [scikit-learn: Feature selection](https://scikit-learn.org/stable/modules/feature_selection.html)
- [scikit-learn: Decomposing signals in components (PCA)](https://scikit-learn.org/stable/modules/decomposition.html#pca)

← [Concept Map](#/post/bd-map)

Related posts: [Data Preprocessing](#/post/bd-preprocessing) · [Analysis Model Design](#/post/bd-model-design) · [Unsupervised Learning Models](#/post/bd-unsupervised)