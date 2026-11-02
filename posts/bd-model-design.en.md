Designing an analysis model involves deciding on the evaluation strategy—"How will we verify that this model performs well on unseen data?"—before selecting an algorithm. In theory, concepts like split ratios, overfitting and underfitting, and types of cross-validation are emphasized repeatedly; in practice, these directly translate to using `train_test_split` and `cross_val_score`.

## Order of Selecting a Model

First, determine the problem type. If the target value is numerical, it's regression; if categorical, it's classification; if there is no correct answer and we are grouping items, it's clustering. Once this distinction is made, the set of usable models and evaluation metrics narrows down accordingly.

| Goal | Type | Example |
|---|---|---|
| Predict continuous values | Regression | House prices, sales revenue |
| Predict categories | Classification | Churn status, spam detection |
| Find structure without labels | Clustering/Association | Customer segments |

Next, consider whether interpretability is needed, the amount of data available, and the number of variables to narrow down candidates to two or three. In this unit, the goal is rarely to pin down a single candidate immediately; rather, it is to establish a framework for comparing candidates under the same conditions. Each individual model will be examined separately in [Details → Supervised Learning Models](#/post/bd-supervised).

## Why Split Data into Three Sets

If we evaluate a model using the same data used for training, we are essentially checking how well it memorized the data, leading to inflated scores. Therefore, we split the data and assign distinct roles.

| Name | Role | When Used |
|---|---|---|
| Training (train) | Learn model parameters | During learning |
| Validation (validation) | Tune hyperparameters, compare models | During tuning |
| Test (test) | Verify final performance | Once at the end |

The scikit-learn documentation follows this same structure. Test data is used only for the final evaluation; when adjusting hyperparameters, validation data is kept separate to prevent information leakage into the model. While common ratios like 6:2:2 or 7:3 exist, there is no fixed rule. When data is scarce, splitting off a validation set becomes burdensome, so cross-validation is used instead.

In classification, class proportions must be similar across splits, so stratified sampling (`stratify=y`) is employed. Checking with cancer diagnosis data, when the overall positive rate was 0.627, the training set had 0.626 and the test set had 0.632. With a split size of 569 cases in a 6:2:2 ratio, the counts became 341/114/114 respectively.

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split

X, y = load_breast_cancer(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42)
Xtr2, Xva, ytr2, yva = train_test_split(
    Xtr, ytr, test_size=0.25, stratify=ytr, random_state=42)
print(len(Xtr2), len(Xva), len(Xte))  # 341 114 114
```

The reason for providing `random_state` in the test phase is to ensure reproducibility of results. Without this value, the split changes with every execution, leading to varying scores.

## Underfitting and Overfitting

If a model is too simple to capture patterns, it suffers from underfitting; if it is too complex and learns noise in the training data, it suffers from overfitting. scikit-learn examples illustrate this using polynomial degree. Degree 1 (a straight line) fails to fit well, degree 4 fits almost perfectly, and degree 15 follows the noise, causing validation error to explode.

| State | Training Performance | Validation Performance | Cause |
|---|---|---|---|
| Underfitting | Low | Low | Model is too simple |
| Appropriate | High | High | Balanced |
| Overfitting | Very high | Significantly lower than training | Model is too complex, data is scarce |

The criterion for judgment is the gap between training and validation scores. This was verified directly by changing decision tree depth.

```python
from sklearn.tree import DecisionTreeClassifier

for d in [1, 2, 3, 5, 10, None]:
    m = DecisionTreeClassifier(max_depth=d, random_state=0).fit(Xtr2, ytr2)
    print(d, round(m.score(Xtr2, ytr2), 3), round(m.score(Xva, yva), 3))
```

| max_depth | Training Accuracy | Validation Accuracy |
|---|---|---|
| 1 | 0.927 | 0.895 |
| 2 | 0.968 | 0.947 |
| 3 | 0.971 | 0.947 |
| 5 | 0.997 | 0.956 |
| 10 | 1.000 | 0.956 |
| None | 1.000 | 0.956 |

At depth 1, both scores are low, indicating underfitting. Increasing depth raises the training score to 1.0, while the validation score plateaus at 0.956. The gap where training achieves a perfect score but validation fails to follow is the signature of overfitting. In this dataset, increasing depth beyond 5 improves training accuracy further while validation remains unchanged.

<details>
<summary>Summary of Methods to Reduce Overfitting</summary>

- Collect more data.
- Simplify the model (limit tree depth, reduce variables). The variable side is covered in [Details → Feature Selection and Dimensionality Reduction](#/post/bd-feature-select).
- Apply regularization (penalties like ridge or lasso).
- Use pruning or early stopping.
- Select hyperparameters using cross-validation.

Limiting depth in the table above is an example of the second method.
</details>

## Cross-Validation

If we split off validation data only once, the score can fluctuate depending on how it was sliced. Cross-validation divides the training data into *k* pieces and uses each piece alternately for validation, averaging the results. Since every data point is used for both training and validation exactly once, this approach is advantageous when data is scarce; however, the model must be trained *k* times instead.

| Method | Description | Characteristics |
|---|---|---|
| Hold-out | Split once | Fast, but results may vary depending on the split |
| k-fold | Verify by alternating k pieces | Most common; trains k times |
| Stratified k-fold | Maintain class proportions in each piece | Used for imbalanced classification |
| LOOCV (leave-one-out) | Set k equal to the number of data points | Verifies by removing one at a time; high computational cost |
| Bootstrap | Generate training samples via resampling with replacement | Verify using the remaining samples not selected in each iteration |

According to the scikit-learn documentation, `shuffle` is disabled by default, so you must set `shuffle=True` if your data is sorted. Additionally, passing an integer for `cv` to a classifier causes `cross_val_score` to use stratification by default.

```python
from sklearn.model_selection import StratifiedKFold, cross_val_score

skf = StratifiedKFold(5, shuffle=True, random_state=0)
for d in [1, 2, 3, 5, None]:
    s = cross_val_score(
        DecisionTreeClassifier(max_depth=d, random_state=0), Xtr, ytr, cv=skf)
    print(d, s.round(3), round(s.mean(), 3))
```

| max_depth | Average over 5 folds |
|---|---|
| 1 | 0.895 |
| 2 | 0.932 |
| 3 | 0.914 |
| 5 | 0.916 |
| None | 0.914 |

When using a single hold-out validation set, depths of 5 or greater appeared best; however, running with 5 folds showed that depth 2 yielded the highest score. This demonstrates that even with the same model, conclusions can differ depending on how the data is split. The score variance across folds was also quite significant (for depth 3, scores ranged from 0.846 to 0.945).

<details>
<summary>Data leakage in cross-validation</summary>

If you perform preprocessing or feature selection on the entire dataset before splitting it for validation, statistics from the validation fold leak into the training process. The method recommended by scikit-learn is to wrap preprocessing and the model into a `Pipeline`, ensuring that preprocessing is refitted only on the training portion of each fold.

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

p = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
s = cross_val_score(p, Xtr, ytr, cv=skf)
print(round(s.mean(), 3))  # 0.974
```

The cross-validation average for this logistic regression pipeline was higher than that of decision trees trained on the same data (0.974). Comparing candidate models using the same split in this manner constitutes model selection. For more details on preprocessing itself, see [Data Preprocessing](#/post/bd-preprocessing).
</details>

## Evaluate Test Data Only Once at the End

After selecting settings via cross-validation, retrain the model on the entire training dataset and evaluate it once using the test data. Training with a depth of 3 and applying it to the test data resulted in an accuracy of 0.939. If you start adjusting the model based on test scores, the test data effectively becomes validation data, rendering the final score meaningless. For details on which metrics to use for interpretation, see [Model Evaluation](#/post/bd-evaluation).

## Common Misconceptions

- Validation data and test data are different. Validation is used for tuning; testing is done only at the end.
- A high training accuracy does not necessarily indicate a good model; you must examine the gap between scores.
- Cross-validation is a method for estimating performance, not for creating a model. Training is performed anew for each fold.
- Stratification adjusts class proportions and therefore is not directly applicable to regression tasks.
- Ratios like 7:3 or 6:2:2 are conventions, not fixed formulas.

To see this workflow implemented in a single code block, refer to [Practical Python Key Points](#/post/bd-practical-python).

## Reference Links

- scikit-learn, Cross-validation: evaluating estimator performance — https://scikit-learn.org/stable/modules/cross_validation.html
- scikit-learn, Underfitting vs. Overfitting — https://scikit-learn.org/stable/auto_examples/model_selection/plot_underfitting_overfitting.html

← Concept map (#/post/bd-map)

Related articles: [Model Design Front End · Feature Selection and Dimensionality Reduction](#/post/bd-feature-select) · [Supervised Learning Models](#/post/bd-supervised) · [Model Evaluation](#/post/bd-evaluation)