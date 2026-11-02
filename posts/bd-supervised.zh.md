监督学习是一种利用带有标签（Label）的数据来训练模型的方法。如果标签是数字，则为回归；如果是类别，则为分类。在大数据分析师考试中，会出现根据模型名称直接回忆其特征的题目，以及运行代码并解释结果的实操题目。考试日程和报名费用可在官方网站查询。关于数据划分与验证的内容请参见 [详情 → 分析模型设计](#/post/bd-model-design)，本文仅讨论模型本身。

## 模型一览

| 模型 | 一句话特征 | 考试中常考内容 |
|---|---|---|
| 线性·多元回归 | 拟合直线（平面）以预测数值 | 假设、多重共线性、决定系数 |
| 逻辑回归 | 将概率转换为 0~1 进行分类 | Odds、Sigmoid、系数解释 |
| 决策树 | 通过连续提问来划分数据 | 不纯度（基尼·熵）、剪枝 |
| SVM | 选择使两类之间间隔（Margin）最大的边界 | 支持向量、核函数、C·gamma |
| 集成学习 | 组合多个模型 | Bagging与Boosting的区别、随机森林 |
| 神经网络 | 堆叠隐藏层以学习非线性关系 | 激活函数、反向传播、过拟合 |

回归部分可参考 [详情 → 探索性分析与基础统计](#/post/bd-eda-stats) 中的相关·回归章节，建议先在那里掌握假设与解释。

## 逻辑回归

虽然名字带“回归”，但实际上是分类模型。它将线性表达式的值输入 Sigmoid 函数，转换为 0~1 之间的概率，通常以 0.5 为阈值划分类别。scikit-learn 文档在二分类中将概率表示为 1 / (1 + exp(-(Xw + w0)))，并说明通过最小化对数损失（含正则项）来训练。对于多分类问题，则为每个类别设置权重，并通过 Softmax 生成概率。

正则化强度由 C 控制，C 是正则化强度的倒数，因此 C 越大，正则化越弱。若考题问“将系数变为 0 的正则化是什么”，答案是 Lasso（L1）。Ridge（L2）仅减小系数，不会将其变为 0。Lasso 能实现变量选择的原因将在 [详情 → 特征选择与降维](#/post/bd-feature-select) 中进一步说明。

## 决策树

在每个节点中寻找“用哪个变量、以哪个阈值划分时，子节点最纯净”。衡量纯净程度的指标是不纯度，在分类任务中使用基尼指数和熵。由于采用贪心策略，每一步只选择当前最优划分，因此不能保证得到全局最优树。

优点是易于解释且几乎不需要特征缩放。缺点只需记住两点：若不加限制地生长会导致过拟合；数据稍有变化，树的结构就会大幅改变。可通过剪枝防止过拟合。剪枝分为预剪枝（提前停止，如最大深度、最小叶节点样本数）和后剪枝（先长满再剪，如成本复杂度 ccp_alpha）。

## SVM

在所有能分隔两类的边界中，选择使两侧间隔最大的那个。决定边界的点仅为靠近边界的少数点，这些点称为支持向量。若无法用直线分隔，则通过核函数将空间转换后求解。可用的核函数包括线性、多项式、RBF 和 Sigmoid。

- C：对违反边界点的惩罚值。C 越小，边界越平滑；C 越大，模型越试图拟合所有训练数据。
- gamma：单个点的影响范围。gamma 越大，仅邻近点产生影响，容易导致过拟合。

SVM 对特征尺度非常敏感，因此特征缩放几乎是必需的。如果在实操中 SVM 得分异常低，应首先怀疑是否进行了缩放。直接运行的结果见下方练习。

## 集成学习

通过组合多个弱模型，使其性能优于单个模型。Bagging 与 Boosting 的区别是高频考点。

| | Bagging · 随机森林 | Boosting |
|---|---|---|
| 构建顺序 | 并行（相互独立） | 串行（弥补前一模型的错误） |
| 主要降低的误差 | 方差 | 偏差 |
| 单个模型 | 深度较大的树 | 浅层树 |
| 示例 | Random Forest | AdaBoost, Gradient Boosting |

随机森林中，每棵树使用 Bootstrap 样本，且在划分时仅随机选取部分变量作为候选。由于各树之间的误差相关性较低，取平均后可相互抵消误差。AdaBoost 通过提高错误样本的权重，使后续模型更关注困难样本；Gradient Boosting 则让下一棵树拟合当前预测的损失梯度。通过设置学习率（learning_rate）减小步长，可抑制过拟合。

## 神经网络

在输入层和输出层之间设置隐藏层，每个神经元经过激活函数对输入的加权和进行激活后传递给下一层。得益于激活函数，模型能够学习非线性关系。对于输出层，如果是二分类问题则使用逻辑斯蒂（Logistic）函数，多分类问题使用 Softmax 函数，回归问题则使用恒等函数。学习过程是通过计算输出端的误差并反向传播以调整权重的反向传播算法实现的。其缺点包括：结果受初始值影响较大、对数据缩放敏感，以及需要预先确定层数和神经元数量。

## 亲自运行后的对比

使用乳腺癌诊断数据集（scikit-learn 内置，569 个样本，30 个特征）按 7:3 比例划分，并比较了各模型的性能。运行环境为 scikit-learn 1.9.1。由于仅用于快速查看，未进行交叉验证；若重新划分数据，数值会有所不同。

<details>
<summary>展开代码</summary>

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

| 模型 | 训练准确率 | 测试准确率 |
|---|---|---|
| 逻辑斯蒂（已缩放） | 0.987 | 0.988 |
| 决策树，无深度限制 | 1.000 | 0.918 |
| 决策树，max_depth=3 | 0.980 | 0.924 |
| SVM，未缩放 | 0.920 | 0.906 |
| SVM，已缩放 | 0.982 | 0.977 |
| 随机森林 | 1.000 | 0.936 |
| 梯度提升 | 1.000 | 0.942 |
| 神经网络 (MLP) | 0.997 | 0.982 |

主要关注三点。无限制的决策树训练准确率为 1.000，测试准确率仅为 0.918，差距较大，疑似过拟合；将深度限制为 3 后，训练准确率下降，测试准确率略有提升。SVM 仅通过缩放操作，测试准确率就从 0.906 提升至 0.977。对于逻辑斯蒂回归，将 C 参数调整为 0.01、1、100 时，系数绝对值之和分别为 3.82、15.81、107.23，测试准确率依次为 0.942、0.988、0.953。数据表明：正则化越强，系数越小。在此数据集中，简单的逻辑斯蒂回归表现最佳，这也说明复杂的模型并不总是更优。

## 常见题型

- **过拟合诊断**：若训练分数高而测试分数低，则为过拟合。决策树可通过剪枝解决，SVM 可调整 C 和 gamma 参数，神经网络则通过添加正则化或减少层数来解决。
- **模型选择**：若重视可解释性，应选择逻辑斯蒂回归或决策树；若优先考虑准确率，则推荐集成方法、SVM 或神经网络。
- **Bagging 与 Boosting**：两者可从“并行 vs 串行”以及“降低方差 vs 降低偏差”两个维度进行区分。
- **需要缩放的模型**：SVM 和神经网络通常需要缩放，而决策树系列几乎不需要。

原文并未翻译题目本身。解题时，应先判断该题属于上述四种类型中的哪一种。关于如何解读分数，请参阅 [详细 → 模型评估](#/post/bd-evaluation)；关于实战代码流程，请参阅 [详细 → 实战 Python 要点](#/post/bd-practical-python)。

## 常见误区

- **逻辑斯蒂回归用于回归问题**：错误。其输出为概率，实际应用于分类问题。
- **准确率接近 100% 即为好模型**：错误。若基于训练数据，这反而是过拟合的信号。
- **随机森林像 Boosting 一样修正前序模型**：错误。随机森林是构建相互独立的决策树。
- **神经网络无需缩放即可运行**：错误。文档强烈建议进行缩放。

## 参考链接

- scikit-learn, Decision Trees: https://scikit-learn.org/stable/modules/tree.html
- scikit-learn, Support Vector Machines: https://scikit-learn.org/stable/modules/svm.html
- scikit-learn, Ensembles: https://scikit-learn.org/stable/modules/ensemble.html
- scikit-learn, Linear Models (逻辑斯蒂·岭回归·Lasso): https://scikit-learn.org/stable/modules/linear_model.html
- scikit-learn, Neural network models (supervised): https://scikit-learn.org/stable/modules/neural_networks_supervised.html

← 概念图 ([大数据分析师地图](#/post/bd-map))

相关文章：[分析模型设计](#/post/bd-model-design) · [无监督学习模型](#/post/bd-unsupervised) · [模型评估](#/post/bd-evaluation)