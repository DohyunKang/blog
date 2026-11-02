模型设计是在选择算法之前，确定“如何验证该模型在新数据上的表现”的阶段。笔记部分反复出现划分比例、过拟合与欠拟合、交叉验证类型等内容，而实操中则直接沿用 `train_test_split` 和 `cross_val_score`。

## 选择模型的顺序

首先确定问题类型。若目标是预测数值则为回归，若是类别则为分类，若无明确答案仅进行分组则为聚类。只有明确了这一区分，才能缩小可用的模型与评估指标的候选范围。

| 目标 | 类型 | 示例 |
|---|---|---|
| 连续值预测 | 回归 | 房价、销售额 |
| 类别预测 | 分类 | 是否流失、是否为垃圾邮件 |
| 无答案的结构发现 | 聚类·关联 | 客户细分 |

接下来根据是否需要解释性、数据量大小以及变量数量，筛选出两到三个候选模型。本章节的目标并非锁定单一模型，而是构建在相同条件下比较候选模型的框架。每个具体模型将在 [详见 → 监督学习模型](#/post/bd-supervised) 中单独讨论。

## 将数据划分为三部分的理由

若仅使用训练数据进行评分，相当于检查模型是否“死记硬背”，导致分数虚高。因此需要将数据划分并赋予不同角色。

| 名称 | 作用 | 使用时机 |
|---|---|---|
| 训练集 (train) | 学习模型参数 | 训练时 |
| 验证集 (validation) | 调整超参数、比较模型 | 调优时 |
| 测试集 (test) | 确认最终性能 | 最后使用一次 |

scikit-learn 文档也采用相同的结构进行说明。测试数据仅用于最后的评估；调整超参数时应单独保留验证集，防止测试集信息泄露到模型中。划分比例虽常见如 6:2:2 或 7:3，但并无固定规则。当数据量较少时，单独划分验证集会显得吃力，此时可采用交叉验证。

在分类任务中，各类别比例需保持一致，因此使用分层抽样 (`stratify=y`)。以癌症诊断数据为例，整体阳性比例为 0.627 时，训练集为 0.626，测试集为 0.632。将 569 条记录按 6:2:2 比例划分后，得到 341/114/114 条记录。

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

在测试集中指定 `random_state` 是为了能够重现相同的结果。若不指定该值，每次执行时的划分结果及分数都会不同。

## 欠拟合与过拟合

若模型过于简单而无法捕捉模式，则为欠拟合；若模型过于复杂以至于学习了训练数据中的噪声，则为过拟合。scikit-learn 示例通过多项式阶数展示了这一现象：1 阶为直线，无法拟合；4 阶几乎完美拟合；15 阶则连噪声也一并跟随，导致验证误差急剧上升。

| 状态 | 训练性能 | 验证性能 | 原因 |
|---|---|---|---|
| 欠拟合 | 低 | 低 | 模型过于简单 |
| 合适 | 高 | 高 | 平衡 |
| 过拟合 | 非常高 | 显著低于训练集 | 模型过于复杂、数据量不足 |

判断依据是训练分数与验证分数之间的差距。我们通过调整决策树的深度进行了直接验证。

```python
from sklearn.tree import DecisionTreeClassifier

for d in [1, 2, 3, 5, 10, None]:
    m = DecisionTreeClassifier(max_depth=d, random_state=0).fit(Xtr2, ytr2)
    print(d, round(m.score(Xtr2, ytr2), 3), round(m.score(Xva, yva), 3))
```

| max_depth | 训练准确率 | 验证准确率 |
|---|---|---|
| 1 | 0.927 | 0.895 |
| 2 | 0.968 | 0.947 |
| 3 | 0.971 | 0.947 |
| 5 | 0.997 | 0.956 |
| 10 | 1.000 | 0.956 |
| None | 1.000 | 0.956 |

当深度为 1 时，两者均较低，属于欠拟合。增加深度后，训练分数升至 1.0，而验证分数停留在 0.956。训练得满分而验证未能跟进的差距即为过拟合的表现。在该数据集中，深度达到 5 及以上时，仅训练分数上升，验证分数保持不变。

<details>
<summary>减少过拟合的方法总结</summary>

- 收集更多数据。
- 简化模型（限制树深度、减少变量）。关于变量方面，将在 [详见 → 特征选择与降维](#/post/bd-feature-select) 中讨论。
- 施加正则化（如岭回归、Lasso 等惩罚项）。
- 使用剪枝或早停法。
- 通过交叉验证选择超参数。

上表中限制深度即为第二种方法的示例。
</details>

## 交叉验证

若仅划分一次验证集，其划分方式会直接影响分数。交叉验证是将训练数据划分为 k 份，轮流将其中一份作为验证集，其余用于训练，并取平均值。由于所有数据都会经历一次训练和验证过程，因此在数据量较少时更为有利；代价是需要对模型进行 k 次训练。

| 方法 | 内容 | 特点 |
|---|---|---|
| Hold-out | 一次性划分 | 速度快，但受划分影响较大 |
| k-fold | 将数据分为 k 份轮流验证 | 最常见，训练 k 次 |
| Stratified k-fold | 每份保持类别比例 | 用于不平衡分类问题 |
| LOOCV (leave-one-out) | k 设为数据量 | 每次留一个样本验证，计算量大 |
| Bootstrap | 通过有放回抽样生成训练样本 | 用未抽中的剩余样本进行验证 |

根据 scikit-learn 文档，`shuffle` 默认关闭，如果数据已排序则需设置 `shuffle=True`；若给分类器传入整数 `cv`，`cross_val_score` 会默认使用分层方式。

```python
from sklearn.model_selection import StratifiedKFold, cross_val_score

skf = StratifiedKFold(5, shuffle=True, random_state=0)
for d in [1, 2, 3, 5, None]:
    s = cross_val_score(
        DecisionTreeClassifier(max_depth=d, random_state=0), Xtr, ytr, cv=skf)
    print(d, s.round(3), round(s.mean(), 3))
```

| max_depth | 5 折平均得分 |
|---|---|
| 1 | 0.895 |
| 2 | 0.932 |
| 3 | 0.914 |
| 5 | 0.916 |
| None | 0.914 |

当只划分一次验证集时，深度 5 及以上表现最好；但改用 5 折交叉验证后，深度 2 得分最高。这直接展示了即使是同一个模型，划分方式不同也会导致结论差异。各折之间的分数波动也较大（例如深度 3 的得分范围为 0.846~0.945）。

<details>
<summary>交叉验证中的数据泄漏（前处理泄露）</summary>

如果先对整个数据集进行缩放或特征选择，然后再划分数据进行验证，会导致验证集的统计信息混入训练过程。scikit-learn 文档推荐的方法是将前处理和模型封装在 `Pipeline` 中，并在每个折内仅基于训练集重新拟合前处理步骤。

```python
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

p = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
s = cross_val_score(p, Xtr, ytr, cv=skf)
print(round(s.mean(), 3))  # 0.974
```

在同一训练数据上，该逻辑回归管道（Logistic Regression Pipeline）的交叉验证平均得分高于决策树（0.974）。这种用相同划分方式比较候选模型的方法即为模型选择。关于前处理的详细内容请参见 [详细 → 数据前处理](#/post/bd-preprocessing)。
</details>

## 测试数据仅在最后使用一次

通过交叉验证选定的参数应在整个训练集上重新训练，然后仅用测试集评估一次。使用深度 3 训练并在测试集上应用后，准确率为 0.939。若根据测试分数调整模型，则测试集会沦为验证集，导致最终评分失去意义。关于如何解读评分指标，请参见 [详细 → 模型评估](#/post/bd-evaluation)。

## 容易混淆的概念

- 验证数据与测试数据不同：验证用于调参，测试仅在最后使用一次。
- 训练准确率高并不代表模型好，需观察间隔（泛化性能）。
- 交叉验证是估计性能的方法，而非创建模型的方法；每个折都需要重新训练。
- 分层仅用于匹配分类问题的类别比例，不能直接用于回归问题。
- 7:3、6:2:2 等比例是惯例而非固定公式。

在实战中尝试用一段代码串联上述流程，请参见 [详细 → 实战 Python 要点](#/post/bd-practical-python)。

## 参考链接

- scikit-learn, Cross-validation: evaluating estimator performance — https://scikit-learn.org/stable/modules/cross_validation.html
- scikit-learn, Underfitting vs. Overfitting — https://scikit-learn.org/stable/auto_examples/model_selection/plot_underfitting_overfitting.html

← 概念图 (#/post/bd-map)

相关文章：[分析模型设计前端 · 特征选择与降维](#/post/bd-feature-select) · [监督学习模型](#/post/bd-supervised) · [模型评估](#/post/bd-evaluation)