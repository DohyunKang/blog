Model evaluation is a unit that quantifies "how well this model performs on new data" with numbers, and in exams, questions asking you to directly calculate metrics based on a confusion matrix appear most frequently. It's better to associate which metric to use in which situation rather than just memorizing the names and formulas of each metric to avoid confusion.

## Starting with the Confusion Matrix

This is a four-cell table comparing the predictions made by a classification model against the actual values. Almost all classification metrics are derived based on this.

| | Predicted Positive | Predicted Negative |
|---|---|---|
| Actual Positive | TP (True Positive) | FN (False Negative) |
| Actual Negative | FP (False Positive) | TN (True Negative) |

The names can be read in the order "Did the prediction match? (T/F) + What was predicted? (P/N)". FP means it was predicted as positive but was actually wrong. FN means it was predicted as negative but was actually wrong.

In `scikit-learn`, rows represent actual values and columns represent predictions. In binary classification, calling `confusion_matrix(...).ravel()` returns values in the order `tn, fp, fn, tp`. Since the row/column orientation of tables in exam questions may vary by problem, always check which side represents the actual values first when looking at a table.

## Metric Formulas

| Metric | Formula | One-line Meaning |
|---|---|---|
| Accuracy | (TP+TN) / Total | Proportion of correct predictions out of all cases |
| Precision | TP / (TP+FP) | Proportion of true positives among those predicted as positive |
| Recall (Sensitivity) | TP / (TP+FN) | Proportion of actual positives that were correctly identified |
| Specificity | TN / (TN+FP) | Proportion of true negatives correctly identified |
| F1 | 2·Precision·Recall / (Precision+Recall) | Harmonic mean of precision and recall |

Remember that the denominator for precision is "those predicted as positive," while the denominator for recall is "actual positives." Memorizing just these denominators will help you distinguish between them.

## Example with Manual Calculation

Let's assume a dataset with 5 positive and 15 negative cases (total 20), where the model made predictions as follows. The code below shows the output from running it.

```python
from sklearn.metrics import (confusion_matrix, accuracy_score,
                             precision_score, recall_score, f1_score)

y_true = [1,1,1,1,1] + [0]*15
y_pred = [1,1,1,0,0] + [1,1] + [0]*13

print(confusion_matrix(y_true, y_pred))
print(accuracy_score(y_true, y_pred), precision_score(y_true, y_pred),
      recall_score(y_true, y_pred), f1_score(y_true, y_pred))
```

```
[[13  2]
 [ 2  3]]
0.8 0.6 0.6 0.6
```

We have TN=13, FP=2, FN=2, TP=3. Accuracy is 16/20 = 0.8, precision is 3/5, recall is also 3/5, and F1 is 0.6, matching the manually calculated values. While an accuracy of 0.8 seems reasonable, nearly half of the positive cases were missed.

## When Accuracy is Misleading

If the model always predicts negative on the same data, it would look like this:

```python
z = [0]*20
print(accuracy_score(y_true, z), recall_score(y_true, z), f1_score(y_true, z, zero_division=0))
# 0.75 0.0 0.0
```

The accuracy is 0.75, but not a single positive case was found. In datasets with highly imbalanced class distributions (such as defect detection or fraud detection), a high accuracy may still indicate an useless model. In such cases, you should consider recall, F1, and AUC together. Methods to handle imbalance itself are covered in [Details → Data Preprocessing](#/post/bd-preprocessing).

## Which Metric to Use?

| Situation | Important Metric | Reason |
|---|---|---|
| Missing a case is critical (e.g., cancer diagnosis, defect detection) | Recall | Must reduce FN |
| False positives are problematic (e.g., spam filter, recommendations) | Precision | Must reduce FP |
| Both needed and classes are imbalanced | F1 | Filters out models that excel in only one aspect |
| Class distributions are balanced | Accuracy | Simple and sufficient |

Precision and recall often have an inverse relationship; raising one usually lowers the other, which is why we use F1 to combine them. According to the `scikit-learn` documentation, F1 corresponds to the F-beta score where beta=1, giving equal weight to precision and recall.

## ROC Curve and AUC

Classification models typically output the probability of being positive, and results vary depending on the threshold above which a prediction is considered positive. The ROC curve plots TPR (= Recall) on the y-axis against FPR (= 1 − Specificity) on the x-axis by varying the threshold. AUC represents the area under this curve.

- The closer the curve is to the top-left corner, the better the model.
- A random model follows the diagonal line with an AUC of 0.5.
- An AUC closer to 1 indicates a better model.
- AUC evaluates the model's ranking ability rather than being tied to a single threshold.

Let's verify this with a small example:

```python
from sklearn.metrics import roc_auc_score, roc_curve

s = [0.9,0.8,0.7,0.4,0.3, 0.6,0.5,0.35,0.2,0.1,0.1,0.15,0.2,0.05,0.1,0.3,0.25,0.1,0.05,0.02]
print(roc_auc_score(y_true, s))   # 0.9266...
fpr, tpr, th = roc_curve(y_true, s)
```

As the threshold decreases from 0.9, 0.7, 0.5, etc., the (FPR, TPR) moves from (0, 0.2) → (0, 0.6) → (0.133, 0.6) → … → (1, 1), and the area under the curve is 0.927. Lowering the threshold captures more positives, increasing TPR, but also increases FPR accordingly.

<details>
<summary>How does changing the threshold affect the confusion matrix?</summary>

If the threshold is set to 0.5 in the scores above, any score of 0.5 or higher is considered positive. This includes 3 actual positives (0.9, 0.8, 0.7) and 2 actual negatives (0.6, 0.5), resulting in TP = 3 and FP = 2, which matches the confusion matrix discussed earlier. If the threshold is lowered to 0.3, all 5 actual positives are captured (TPR = 1.0), but 4 actual negatives also become positive, leading to an FPR of approximately 0.27. In the table returned by `roc_curve`, the row for a threshold of 0.5 is (0.133, 0.6), and the row for a threshold of 0.3 is (0.267, 1.0).

Deciding on a threshold ultimately boils down to asking "which metric should I look at?" from the table above: lower it if you cannot afford to miss cases, and raise it if you cannot afford false positives.
</details>

## Regression Model Evaluation

Regression, where predicted values are numeric, measures error. Let $y$ be the actual value, $\hat{y}$ be the predicted value, and $n$ be the sample size. The formulas are as follows:

| Metric | Formula | Characteristics |
|---|---|---|
| MSE | (1/n) Σ (y − ŷ)² | Penalizes large errors heavily |
| RMSE | √MSE | Returns to original units, making interpretation easier |
| MAE | (1/n) Σ \|y − ŷ\| | Less affected by outliers |
| MAPE | (100/n) Σ \|y − ŷ\| / \|y\| | Percentage error; cannot be used if actual value is 0 |
| R² | 1 − Σ(y − ŷ)² / Σ(y − ȳ)² | Measures improvement over the mean |

I calculated these using a small example with four data points.

```python
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

yt = np.array([3, 5, 2.5, 7]); yp = np.array([2.5, 5, 4, 8])
mse = mean_squared_error(yt, yp)
print(mse, mse**0.5, mean_absolute_error(yt, yp), r2_score(yt, yp))
# 0.875 0.935... 0.75 0.724...
```

With errors of -0.5, 0, 1.5, and 1, the mean squared error is 0.875 and the mean absolute error is 0.75. In exams, you are often asked to manually calculate MSE, RMSE, and MAE given the error values.

R² approaches 1 for better explanatory power. Since adding variables always increases R², adjusted R² should be used when comparing models with different numbers of variables. According to the scikit-learn documentation, R² is the default `score` for regression models and ranks similarly to squared error.

## Hyperparameter Tuning

Model evaluation leads into tuning. Values set by humans before training, such as the depth of a decision tree, are hyperparameters. Tuning involves trying candidates and selecting the one with the best cross-validation score. Data splitting and cross-validation are covered in detail in [Analysis Model Design →](#/post/bd-model-design).

- Grid Search: Tries all combinations of candidates. This is `GridSearchCV` in scikit-learn.
- Random Search: Samples a fixed number of candidates from a distribution. This is `RandomizedSearchCV`. The documentation highlights that the number of trials can be set independently of the number of parameters as an advantage.

I tested this directly. On breast cancer data, I selected tree depth and minimum samples per leaf using 5-fold cross-validation based on the F1 score.

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import f1_score, confusion_matrix

X, y = load_breast_cancer(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

g = GridSearchCV(DecisionTreeClassifier(random_state=42),
                 {'max_depth': [2,3,4,5], 'min_samples_leaf': [1,5,10]},
                 cv=5, scoring='f1')
g.fit(Xtr, ytr)
print(g.best_params_, round(g.best_score_, 4))
p = g.predict(Xte)
print(round(f1_score(yte, p), 4), confusion_matrix(yte, p).tolist())
```

```
{'max_depth': 4, 'min_samples_leaf': 1} 0.9514
0.951 [[39, 3], [4, 68]]
```

The optimal settings were a depth of 4 and a minimum of 1 sample per leaf. The cross-validation F1 was 0.9514, and the F1 on held-out test data was 0.951, which are very similar. This similarity is crucial. The scikit-learn documentation also recommends against reporting final performance metrics trained on tuning data; instead, tune using development data and evaluate once on evaluation data.

<details>
<summary>How to Interpret Cross-Validation Scores</summary>

Cross-validation splits training data into $k$ pieces, evaluates the model on each piece in turn, and produces $k$ scores. For a tree with depth 3 evaluated via 5-fold cross-validation, the results look like this:

```python
from sklearn.model_selection import cross_val_score
print(cross_val_score(DecisionTreeClassifier(max_depth=3, random_state=42), Xtr, ytr, cv=5).round(3))
# [0.934 0.923 0.901 0.901 0.967]
```

Scores fluctuate between 0.90 and 0.97 for each fold. Do not just look at the average; also examine the variance. Large differences in scores signal either insufficient data or an unstable model.
</details>

## Common Misconceptions

- Believing that high accuracy implies a good model: As shown in the example above, predicting "negative" for all cases yields 0.75 accuracy.
- Memorizing precision and recall by swapping their denominators: Precision is based on predicted positives, while recall is based on actual positives.
- Interpreting an AUC of 0.5 as a score of "50": This actually means performance at the level of random guessing.
- Reporting final performance using data used for tuning: This inflates the scores.
- Using MAPE indiscriminately in regression: It cannot be calculated if the actual value is 0.

## Order of Operations in Exams

1. When a confusion matrix appears, first determine whether rows/columns represent actual or predicted values.
2. Identify TP, FP, FN, TN and use the denominator required for the specified metric.
3. If imbalance is present, prefer recall and F1 over accuracy.
4. For ROC curves, higher-left positioning is better; an AUC of 0.5 indicates random guessing.
5. For regression, write down errors first and calculate in the order MSE → RMSE.

Past exam questions vary every year, so original texts are not included here. Check official sites for exam schedules and registration details. The flow of extracting these metrics via code in practical exams is continued in [Practical Python Key Points →](#/post/bd-practical-python), and background on models can be found in [Supervised Learning Models →](#/post/bd-supervised).

## Reference Links

- scikit-learn, Metrics and scoring: https://scikit-learn.org/stable/modules/model_evaluation.html
- scikit-learn, Tuning the hyper-parameters of an estimator: https://scikit-learn.org/stable/modules/grid_search.html

← [Concept map](#/post/bd-map)

Related posts: [Model Design](#/post/bd-model-design) · [Supervised Learning Model](#/post/bd-supervised) · [Practical Python Key Points](#/post/bd-practical-python)