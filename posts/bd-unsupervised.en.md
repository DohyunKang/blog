Unsupervised learning is a method that discovers the structure of data itself without labels (answers). In exams, it typically appears in three categories: clustering analysis, association analysis, and dimensionality reduction. Questions often ask "what situation to use" and "what are the key metrics or parameters." The supervised learning models with answers are summarized separately in [Supervised Learning Models](#/post/bd-supervised).

## Three Categories First

| Type | What it does | Representative Techniques | Key Keywords |
|---|---|---|---|
| Clustering Analysis | Groups similar items together | K-means, Hierarchical Clustering, DBSCAN | Distance, Number of Clusters, Silhouette |
| Association Analysis | Finds items that occur together | Apriori | Support, Confidence, Lift |
| Dimensionality Reduction | Reduces the number of variables | PCA | Variance Explained Ratio |

Clustering is for situations like "how many groups to divide customers into," association analysis for "do people who buy A also buy B," and dimensionality reduction for "can we reduce too many variables." Questions often ask you to read the problem statement and choose which of the three categories it belongs to.

## Clustering Analysis

It groups observations that are close in distance together. Since distance is used, if variable units differ, variables with larger scales dominate the distance calculation. Therefore, standardization is almost essential before clustering. Scaling methods were covered in [Data Preprocessing](#/post/bd-preprocessing).

### K-means

First, specify the number of clusters $K$, then iteratively move centroids to minimize the sum of squared distances within each cluster (inertia). The characteristics summarized from the scikit-learn documentation are as follows:

- Assumes clusters are convex and round; it performs poorly on elongated or irregular shapes.
- Requires specifying the number of clusters in advance.
- Converges to a local minimum, so results depend on initial centroids. k-means++ is the default initialization method that mitigates this issue.
- Performs relatively well even with large sample sizes.

The sequence is easy to remember: initialize $K$ centroids, assign each point to the nearest centroid, update centroids to the mean of their assigned points, and repeat until no change occurs. Because it uses means, it is sensitive to outliers. If concerned about outliers, K-medoids can be used instead, where centroids are actual observations rather than averages.

### How to Choose K

Two methods frequently appear in exams:

- **Elbow Method**: Plot inertia against increasing $K$ and choose the point where the curve bends. Inertia always decreases as $K$ increases, so this metric alone cannot determine the optimal $K$.
- **Silhouette Coefficient**: Calculated as $(b - a) / \max(a, b)$, where $a$ is the average distance to points in the same cluster and $b$ is the average distance to the nearest neighboring cluster. Values range from -1 to 1; closer to 1 indicates well-separated clusters, near 0 suggests overlapping clusters, and negative values may indicate misassignment.

<details>
<summary>Results from direct execution (K = 2~6)</summary>

Virtual data created with three blobs (300 points) was standardized and tested with varying $K$.

| K | Inertia | Silhouette |
|---|---|---|
| 2 | 187.8 | 0.688 |
| 3 | 18.3 | 0.848 |
| 4 | 15.5 | 0.679 |
| 5 | 12.7 | 0.522 |
| 6 | 10.7 | 0.357 |

Inertia shows a significant drop when moving from $K=2$ to $K=3$, then levels off (the elbow). The silhouette score is highest at $K=3$. Since the data was generated with three blobs, this result is correct. In real-world data, these two metrics do not always align so neatly.
</details>

### Hierarchical Clustering

This method does not require specifying the number of clusters in advance. It starts with each point as its own cluster and iteratively merges the closest clusters (agglomerative approach). The merging process is visualized as a tree structure called a dendrogram, where the number of clusters is determined by cutting the tree at a specific height. There are several ways to measure distances between clusters (linkage methods):

| Linkage Method | Distance Between Clusters |
|---|---|
| Single | The closest pair of points between two clusters |
| Complete | The farthest pair of points between two clusters |
| Average | The average distance of all pairs between two clusters |
| Ward | The pair that results in the smallest increase in within-cluster sum of squares when merged |

Ward's method has a similar objective to K-means and tends to produce more balanced cluster sizes according to documentation. Single linkage is known to have a tendency to form chain-like structures. Hierarchical clustering calculates distances for every pair of points, making it computationally expensive for large datasets. When applied to the virtual data above using Ward's method with 3 clusters, the silhouette score was 0.848, matching K-means.

### DBSCAN

This is a density-based approach. A point is considered a core point if there are at least `min_samples` points within a radius of `eps`. Clusters are formed by connecting core points. Points that do not connect to any core point are labeled as noise with a label of -1.

- Does not require specifying the number of clusters.
- Can handle arbitrary shapes.
- Identifies outliers as noise separately.
- If `eps` is too small, most points become noise (-1); if too large, clusters merge together.

Running the above data with `eps=0.3` and `min_samples=5` yielded 3 clusters and 1 noise point.

## Association Analysis

Market basket analysis is a representative example. It finds rules such as "If A is purchased, B is also purchased" from item sets. The strength of a rule is measured using three metrics.

| Metric | Formula | Meaning |
|---|---|---|
| Support | P(A and B) | The proportion of transactions where both A and B appear among all transactions |
| Confidence | P(A and B) / P(A) | The proportion of transactions containing B among those that contain A |
| Lift | Confidence / P(B) | The multiplier of the probability of buying B given A, compared to the baseline probability of buying B |

If lift is greater than 1, there is a positive relationship between A and B; if it equals 1, they are independent; if less than 1, there is a negative relationship. Even with high confidence, if B is an item everyone buys anyway, the lift will be close to 1. There was a question asking about this distinction, so I memorized it together.

Apriori uses the property that "subsets of frequent itemsets are also frequent" to prune candidates. Conversely, if a set is not frequent, there is no need to examine larger sets containing it. We search by growing only sets with support above the minimum threshold, and then select rules whose confidence exceeds the minimum on top of that.

<details>
<summary>Verify calculated values from 5 transactions in code</summary>

Transactions: {milk, bread}, {milk, diapers, beer, bread}, {bread, beer}, {milk, diapers, bread}, {milk, diapers, beer}

```python
tx = [{'우유','빵'},{'우유','기저귀','맥주','빵'},{'빵','맥주'},
      {'우유','기저귀','빵'},{'우유','기저귀','맥주'}]
n = len(tx)
def sup(s): return sum(s <= t for t in tx) / n
for a, b in [({'기저귀'},{'맥주'}), ({'우유'},{'빵'})]:
    s = sup(a | b); c = s / sup(a)
    print(a, b, s, round(c, 3), round(c / sup(b), 3))
```

| Rule | Support | Confidence | Lift |
|---|---|---|---|
| Diapers → Beer | 0.4 | 0.667 | 1.111 |
| Milk → Bread | 0.6 | 0.75 | 0.937 |

Milk → Bread has higher support and confidence, but its lift is less than 1. Since bread appears in 4 out of the 5 transactions originally, having milk does not mean someone buys additional bread. Even though Diapers → Beer has lower values, its lift exceeds 1.
</details>

## Dimensionality Reduction: PCA

When correlations between variables are high, this method reduces the number of variables by transforming them into new orthogonal axes (principal components) while maximizing the retention of information (variance). The first principal component explains the most variance, followed by subsequent components.

- scikit-learn's PCA performs mean subtraction (centering) automatically but does not perform scaling. Variables with different units must be standardized first to prevent variables with larger magnitudes from dominating the principal components.
- The number of components to retain is determined by examining the cumulative explained variance ratio.
- Principal components are combinations of original variables, which makes interpretation difficult as a trade-off.
- This differs from feature selection (choosing original variables). Both topics were summarized in [Feature Selection and Dimensionality Reduction](#/post/bd-feature-select).

<details>
<summary>Explained variance ratio verified using iris</summary>

```python
from sklearn.datasets import load_iris
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
X = StandardScaler().fit_transform(load_iris().data)
p = PCA().fit(X)
print(p.explained_variance_ratio_.round(3))
print(p.explained_variance_ratio_.cumsum().round(3))
```

The ratios are 0.730, 0.229, 0.037, 0.005; the cumulative values are 0.730, 0.958, 0.995, 1.0. The four variables explain approximately 96% of the variance with just two principal components.
</details>

## Checking Clustering Results and Common Pitfalls

- Since clustering has no ground truth, it is not evaluated using accuracy. Instead, internal metrics like silhouette scores and whether the resulting clusters make sense in a business context are examined. General evaluation metrics are covered in [Model Evaluation](#/post/bd-evaluation).
- K-means results are skewed by variables with larger units if standardization is not performed.
- It is natural for inertia to decrease as K increases in the elbow method; therefore, "a larger K is better for clustering" is an incorrect statement.
- In DBSCAN, -1 indicates noise, not a cluster number.
- For association analysis, one should not look at confidence alone; lift must also be considered.
- If standardization is skipped before PCA, variables with larger units will dominate the first principal component.
- The concept of splitting data into training and testing sets applies to supervised learning and does not directly apply to clustering. Data splitting is summarized in [Analysis Model Design](#/post/bd-model-design).

← [Big Data Analysis Expert Map](#/post/bd-map)

Related posts: [Supervised Learning Models](#/post/bd-supervised) · [Model Evaluation](#/post/bd-evaluation) · [Feature Selection and Dimensionality Reduction](#/post/bd-feature-select)

## Reference Links

- scikit-learn, Clustering: https://scikit-learn.org/stable/modules/clustering.html
- scikit-learn, Decomposing signals in components (PCA): https://scikit-learn.org/stable/modules/decomposition.html