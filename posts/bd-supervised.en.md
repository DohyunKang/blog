Supervised learning is a method of training models using data with answers (labels). If the answer is a number, it's regression; if it's a category, it's classification. In the Big Data Analyst exam, you'll encounter questions where you identify model characteristics based on the model name, as well as practical exams where you run code and interpret results. Check the exam schedule and fees on the official site. For splitting and validating data, see [Details → Model Design](#/post/bd-model-design); this article focuses solely on the models themselves.

## Models at a Glance

| Model | One-Liner Feature | What's Tested in Exams |
|---|---|---|
| Linear & Multiple Regression | Fit a line (or plane) to predict numbers | Assumptions, multicollinearity, R-squared |
| Logistic Regression | Convert probabilities to 0~1 for classification | Odds, sigmoid, coefficient interpretation |
| Decision Tree | Split data by asking sequential questions | Impurity (Gini, entropy), pruning |
| SVM | Choose the boundary with the widest margin between two groups | Support vectors, kernels, C·gamma |
| Ensemble | Combine multiple models | Bagging vs. boosting differences, Random Forest |
| Neural Networks | Stack hidden layers to learn non-linear patterns | Activation functions, backpropagation, overfitting |

Regression connects to [Details → Exploratory Analysis and Basic Statistics](#/post/bd-eda-stats) regarding correlation and regression, so it's best to grasp assumptions and interpretations there first.

## Logistic Regression

Despite its name, this is a classification model. It takes linear equation values, feeds them into a sigmoid function to convert them into probabilities between 0 and 1, and typically uses 0.5 as the threshold for class assignment. The scikit-learn documentation expresses probability in binary classification as 1 / (1 + exp(-(Xw + w0))) and explains minimizing loss with regularization terms added. For multiple classes, weights are assigned per class to generate probabilities via softmax.

Regularization strength is controlled by C; since C is the inverse of regularization intensity, a larger C means weaker regularization. If asked in an exam "Which regularization sets coefficients to zero?", the answer is Lasso (L1). Ridge (L2) reduces coefficients but does not set them to zero. The reason Lasso achieves variable selection effects continues in [Details → Feature Selection and Dimensionality Reduction](#/post/bd-feature-select).

## Decision Trees

At each node, we find which variable and split point make the child nodes "cleanest." Impurity measures this cleanliness; for classification, Gini index and entropy are used. Since it's a greedy approach that selects only the best split at each step, it doesn't guarantee an overall optimal tree.

The advantages are easy interpretability and little need for scaling. There are two main disadvantages to memorize: if grown without limits, it overfits the training data, and small changes in data can drastically alter the tree structure. Overfitting is prevented via pruning. There's pre-pruning (stopping early with max depth or min samples per leaf) and post-pruning (cutting after full growth using cost complexity or ccp_alpha).

## SVM

Among boundaries separating two classes, we choose the one with the widest margin on both sides. Only points near the boundary influence the decision; these are called support vectors. If a straight line won't work, we transform the space using kernels to solve it. Available kernels include linear, polynomial, RBF, and sigmoid.

- **C**: Penalty for points violating the boundary. A small C yields a smoother boundary, while a large C tries to fit all training data.
- **gamma**: Influence range of a single point. A large gamma affects only nearby points, making overfitting more likely.

SVM is sensitive to feature scales, so scaling is practically mandatory. If your SVM score seems unusually low in the practical exam, suspect scaling first. Direct results from running code are in the practice section below.

## Ensemble

Combines multiple weak models to create one better than any individual model. The distinction between bagging and boosting frequently appears in exams.

| | Bagging & Random Forest | Boosting |
|---|---|---|
| Construction Order | Parallel (independent) | Sequential (corrects previous model's errors) |
| Main Reduction Target | Variance | Bias |
| Individual Models | Deeply grown trees | Shallow trees |
| Example | Random Forest | AdaBoost, Gradient Boosting |

Random Forest uses bootstrap samples for each tree and randomly selects only a subset of variables as candidates during splits. This reduces similarity in errors among trees, so averaging them cancels out errors. AdaBoost increases weights of misclassified samples so subsequent models focus on difficult ones, while Gradient Boosting fits the next tree to match the gradient of current prediction loss. Reducing step size via learning rate helps prevent overfitting.

## Neural Networks

Between the input and output layers, hidden layers are placed so that each neuron passes a weighted sum of inputs through an activation function before passing it to the next layer. Thanks to activation functions, we can learn non-linear relationships. For the output layer, logistic regression is used for binary classification, softmax for multi-class classification, and the identity function for regression tasks. Learning involves backpropagation, where errors calculated at the output are propagated backward to adjust weights. Disadvantages include sensitivity to initial values, sensitivity to scaling, and the need to determine the number of layers and neurons.

## Direct Comparison Results

We split the breast cancer diagnosis dataset (built into scikit-learn, 569 samples, 30 features) in a 7:3 ratio and measured accuracy for each model. The environment is scikit-learn 1.9.1. Since this is just for a quick look, cross-validation was not performed, and numbers may vary slightly if the data is split again.

<details>
<summary>Show code</summary>

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier

X, y = load_breast_cancer(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)

models = {
    "logistic": make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)),
    "tree_full": DecisionTreeClassifier(random_state=42),
    "tree_d3": DecisionTreeClassifier(max_depth=3, random_state=42),
    "svm_noscale": SVC(),
    "svm_scale": make_pipeline(StandardScaler(), SVC()),
    "rf": RandomForestClassifier(random_state=42),
    "gb": GradientBoostingClassifier(random_state=42),
    "mlp": make_pipeline(StandardScaler(), MLPClassifier(max_iter=1000, random_state=42)),
}
for name, m in models.items():
    m.fit(Xtr, ytr)
    print(name, round(m.score(Xtr, ytr), 3), round(m.score(Xte, yte), 3))
```

</details>

| Model | Training Accuracy | Test Accuracy |
|---|---|---|
| Logistic (with scaling) | 0.987 | 0.988 |
| Tree, no depth limit | 1.000 | 0.918 |
| Tree, max_depth=3 | 0.980 | 0.924 |
| SVM, without scaling | 0.920 | 0.906 |
| SVM, with scaling | 0.982 | 0.977 |
| Random Forest | 1.000 | 0.936 |
| Gradient Boosting | 1.000 | 0.942 |
| Neural Network (MLP) | 0.997 | 0.982 |

There are three key takeaways. An unlimited-depth tree shows a large gap between training accuracy (1.000) and test accuracy (0.918), indicating overfitting; limiting depth to 3 reduces training accuracy slightly but improves test accuracy. For SVM, applying scaling alone improved test accuracy from 0.906 to 0.977. For logistic regression, changing C to 0.01, 1, and 100 resulted in sum of absolute coefficient values of 3.82, 15.81, and 107.23 respectively, with test accuracies of 0.942, 0.988, and 0.953. The numbers confirm that stronger regularization reduces coefficients. In this dataset, simple logistic regression performed best, illustrating that complex models are not always better.

## Common Patterns

- **Overfitting diagnosis**: If training score is high but test score is low, the model is overfitting. Solutions include pruning for trees, adjusting C and gamma for SVM, or applying regularization/reducing layers for neural networks.
- **Model selection**: Choose logistic regression or trees if interpretability is important; choose ensembles, SVM, or neural networks if accuracy is the priority.
- **Bagging vs Boosting**: Distinguish based on two axes: parallel vs sequential processing, and reducing variance vs reducing bias.
- **Models requiring scaling**: SVM and neural networks require it; tree-based models generally do not.

The original exam questions are not translated here. First, classify which of these four patterns a problem falls into by reading the question. How to interpret scores is detailed in [Detailed → Model Evaluation](#/post/bd-evaluation), and code flow for practical exams is summarized in [Detailed → Practical Python Key Points](#/post/bd-practical-python).

## Common Misconceptions

- **Logistic regression is for regression problems**: Incorrect; its output is a probability, making it suitable for classification.
- **A model with ~100% accuracy is good**: If based on training data, this is actually a signal of overfitting.
- **Random Forest boosts like boosting methods do**: False; Random Forest creates trees independently rather than sequentially correcting previous models.
- **Neural networks work without scaling**: Documentation strongly recommends scaling.

## Reference Links

- scikit-learn, Decision Trees: https://scikit-learn.org/stable/modules/tree.html
- scikit-learn, Support Vector Machines: https://scikit-learn.org/stable/modules/svm.html
- scikit-learn, Ensembles: https://scikit-learn.org/stable/modules/ensemble.html
- scikit-learn, Linear Models (Logistic, Ridge, Lasso): https://scikit-learn.org/stable/modules/linear_model.html
- scikit-learn, Neural network models (supervised): https://scikit-learn.org/stable/modules/neural_networks_supervised.html

← Concept map ([Big Data Analyst Exam Map](#/post/bd-map))

Related posts: [Model Design](#/post/bd-model-design) · [Unsupervised Learning Models](#/post/bd-unsupervised) · [Model Evaluation](#/post/bd-evaluation)