Structured data mining is divided into three categories: classification, clustering, and association analysis. Exams frequently test two aspects: "which technique to use in which situation" and "whether you can calculate metrics." This article is organized around these two points.

## The Big Picture First

The first distinction is whether labels (answers) are present or not.

| Category | Labels Present? | Question | Representative Techniques |
|---|---|---|---|
| Classification | Yes | Which category does this data belong to? | Decision Trees, Ensemble Methods |
| Clustering | No | How do similar items group together? | K-means, Hierarchical, DBSCAN |
| Association Analysis | No | What items appear together? | Support, Confidence, Lift |

The side with labels is called supervised learning, while the side without labels is unsupervised learning. Detailed concepts are available in [Details → Machine Learning Basics](#/post/ml-basics). For where this step fits within the entire analysis procedure, see [Details → Analysis Methodology](#/post/adsp-methodology).

## Classification: Decision Trees

A decision tree is a model that divides data by creating if-then rules based on feature values. The scikit-learn documentation cites its interpretability as an advantage because the rules are visible.

The core question is "where to split," and the criterion is impurity. We choose the split that minimizes the weighted average impurity of the child nodes.

- Gini Index: 1 − Σp². It is maximized at 0.5 when classes are evenly split (50/50) and equals 0 when only one class exists. CART uses this for classification trees.
- Entropy: −Σp·log p. It is maximized when classes are evenly split and equals 0 when only one class exists. ID3 uses entropy-based information gain.

Let's calculate directly. Suppose we have a node with 10 items (5 A, 5 B) and split it into two children: left with 6 items (5 A, 1 B) and right with 4 items (0 A, 4 B).

- Gini: Parent = 0.5; Weighted child impurity = 0.6×0.278 + 0.4×0 = 0.167 → Reduction = 0.333
- Entropy (log₂): Parent = 1.0; Weighted child entropy ≈ 0.39 → Reduction ≈ 0.61

Splits with larger reduction are adopted. Exams often ask about the direction that "a smaller Gini index means higher purity."

If we grow the tree too deep, it memorizes training data and performs poorly on new data (overfitting). Therefore, we limit depth (max_depth) or perform pruning. The cost-complexity pruning described in documentation evaluates the tree by adding leaf_count × α to the error; a larger α retains smaller trees.

<details>
<summary>Detailed Solution: Gini and Entropy Calculation Order</summary>

Let p be the class proportion within a node. Then Gini is 1 − Σp².

- Node (5, 1): p = 5/6, 1/6 → 1 − (0.694 + 0.028) = 0.278
- Node (0, 4): p = 0, 1 → 0
- Weighted average: (6/10)×0.278 + (4/10)×0 = 0.167
- Parent (5, 5): 1 − (0.25 + 0.25) = 0.5

Entropy for the parent is 1.0, and for node (5, 1) it is approximately 0.65. Weighted average: 0.6×0.65 = 0.39; reduction is 0.61. These numbers were verified using Python.

</details>

## Classification: Ensemble Methods

This approach combines multiple models instead of relying on a single one. According to the documentation, the methods are summarized as follows.

| Method | Training Style | Function |
|---|---|---|
| Bagging | Parallel, independent | Builds and combines models for each sample drawn with replacement; reduces variance |
| Random Forest | Parallel | Bagging + considers only a subset of variables as candidates at each split |
| Boosting | Sequential | Focuses on data misclassified by previous models to build the next model (AdaBoost, Gradient Boosting) |

The documentation states that bagging suits deep, complex trees because it reduces variance, while boosting stacks shallow trees (weak learners) to reduce bias. For exams: if the description is "creating multiple samples independently and voting," choose bagging; if it is "adding weights to errors sequentially," choose boosting.

## Classification Model Evaluation

For binary classification, the confusion matrix has rows representing actual values and columns representing predicted values.

| | Predicted Negative | Predicted Positive |
|---|---|---|
| Actual Negative | TN | FP |
| Actual Positive | FN | TP |

All metrics are derived from these four cells.

- Accuracy = (TP + TN) / Total
- Precision = TP / (TP + FP) — True positives among those predicted as positive
- Recall = TP / (TP + FN) — True positives found among all actual positives; also called sensitivity
- F1 = Harmonic mean of precision and recall

Let's work through an example. If TN=50, FP=10, FN=5, and TP=35:
- Accuracy = 85/100 = 0.85
- Precision = 35/45 ≈ 0.778
- Recall = 35/40 = 0.875
- F1 = 0.824

To solve these, first check the cell positions, then verify whether the denominator is the "sum of predicted positives" or the "sum of actual positives." Precision uses the column sum as the denominator, while recall uses the row sum.

The ROC curve plots FPR on the x-axis and TPR (recall) on the y-axis by varying the threshold; the area under this curve is the AUC. It is used to summarize a model with a single number for comparison between models.

## Clustering Analysis

Groups similar items together without predefined labels. There are three types mentioned in the document:

- K-means: Requires specifying the number of clusters $K$ in advance. It groups data by minimizing the sum of squares (inertia) within each cluster, and results can vary depending on initial centroids. It performs poorly on elongated or irregularly shaped clusters.
- Hierarchical clustering: Starts from individual data points and merges nearby clusters progressively; the result is a dendrogram (tree diagram). Methods for measuring distance between clusters (linkage methods) include single, complete, average, and Ward. Single linkage uses the nearest pair, complete linkage uses the farthest pair, and average linkage uses the mean distance of all pairs.
- DBSCAN: Treats high-density regions as clusters. A point is a core point if at least `min_samples` points are within radius `eps`; points belonging to no cluster become noise (outliers). It allows for arbitrary shapes without needing to specify $K$, but `eps` must be chosen carefully. If `eps` is too small, most points become noise; if too large, everything merges into one cluster.

The silhouette coefficient is used to evaluate clustering quality. For a point, let $a$ be the average distance to other points in the same cluster and $b$ be the average distance to the nearest different cluster; the coefficient is $(b - a) / \max(a, b)$. Higher values indicate clearer clusters.

## Association Analysis

Market basket analysis is a representative example. For a rule $A \to B$, three metrics are used:

- Support: The proportion of transactions containing both A and B
- Confidence: The proportion of transactions containing A that also contain B (direction matters, so $A \to B$ differs from $B \to A$)
- Lift: Confidence divided by the support of B. A value of 1 indicates independence; greater than 1 suggests a tendency to appear together

I calculated these directly for 5 transactions:

| Transaction | Items |
|---|---|
| 1 | Bread, Milk |
| 2 | Bread, Diapers, Beer, Eggs |
| 3 | Milk, Diapers, Beer, Cola |
| 4 | Bread, Milk, Diapers, Beer |
| 5 | Bread, Milk, Diapers, Cola |

Diapers appear in 4 transactions, beer in 3, and both together in 3. For Diapers → Beer: support = 3/5 = 0.6, confidence = 3/4 = 0.75, lift = 0.75 / 0.6 = 1.25. For Bread → Milk: support = 0.6, confidence = 0.75, but since milk appears in 4 transactions, lift = 0.75 / 0.8 = 0.94. Even with identical confidence, lift does not exceed 1.

Solving exam problems always follows the same order: count transactions, determine the numerator (count of transactions containing both A and B) and denominator (count of A or total), then divide. If lift is confusing, check how common B originally is.

## Common Misconceptions

- High accuracy means a good model: In datasets where positives are rare, predicting all negatives can yield high accuracy. Therefore, precision and recall should be considered together.
- Clustering has ground truth: There is no ground truth, so internal metrics like the silhouette coefficient are used.
- High confidence implies a strong rule: If the target item is common, confidence may appear high; lift must also be examined.
- Ensembles are always better: The document distinguishes that bagging suits complex models while boosting suits shallow models; there are specific combinations suited for each case.

For predicting numerical values using regression, see [Details → Regression Analysis](#/post/adsp-regression); for dimensionality reduction multivariate techniques, see [Details → Multivariate Analysis and Time Series](#/post/adsp-multivariate-ts); and for testing mean differences, see [Details → Hypothesis Testing](#/post/adsp-hypothesis). Check the exam schedule and syllabus on the official site.

[← ADsP map](#/post/adsp-map)

Related posts: [Analysis Methodology](#/post/adsp-methodology) · [Regression Analysis](#/post/adsp-regression) · [Multivariate Analysis and Time Series](#/post/adsp-multivariate-ts)

## Reference Links

- scikit-learn, Decision Trees: https://scikit-learn.org/stable/modules/tree.html
- scikit-learn, Ensembles: https://scikit-learn.org/stable/modules/ensemble.html
- scikit-learn, Metrics and scoring: https://scikit-learn.org/stable/modules/model_evaluation.html
- scikit-learn, Clustering: https://scikit-learn.org/stable/modules/clustering.html
- mlxtend, Association rules: https://rasbt.github.io/mlxtend/user_guide/frequent_patterns/association_rules/
- Wikipedia, Decision tree learning: https://en.wikipedia.org/wiki/Decision_tree_learning