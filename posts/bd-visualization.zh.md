大数据分析师笔试第四部分主要讲解如何展示和解读结果。计算题很少，核心在于判断哪种图表适用于何种情境，以及阅读指标与结果并得出结论。模型评估指标本身已在 [详细→模型评估](#/post/bd-evaluation) 中单独整理，此处重点探讨如何解读和传达这些数值。

考试日程和报名费可在官方网站查询。本文仅涵盖单元核心内容及常见题型。

## 根据问题选择可视化图表

一旦确定了需要展示的关系，图表的选择也就基本确定了。

| 展示内容 | 典型图表 | 备注 |
|---|---|---|
| 单变量分布 | 直方图、箱线图 | 箱线图可一次性显示中位数、四分位数和异常值 |
| 两个数值变量的关系 | 散点图 | 首先观察是否存在相关性或异常值 |
| 多变量间的相关性 | 相关系数热力图 | 通过颜色深浅读取相关系数大小 |
| 各类别的大小比较 | 条形图 | 若类别无顺序，按大小排序更易于阅读 |
| 随时间的变化 | 折线图 | 时间序列的基础图表 |
| 整体中的构成比例 | 饼图、堆积条形图 | 项目较多时建议使用条形图 |
| 分类结果 | 混淆矩阵、ROC 曲线 | 观察不同阈值下的变化情况 |

考试中常出现“针对该目的应选择何种图表”的题型。若将分布归为直方图和箱线图，关系归为散点图，趋势归为折线图，则大部分题目均可排除。

此外，可视化必须诚实地展示数据。若在坐标轴中间截断，微小的差异会被放大；若饼图切片过多，则无法进行比较。用于报告的图表必须具备标题、坐标轴名称和单位。

## 解读中需区分的三个概念

解读题通常考察对看似相似概念的区分能力。

### 1. 变量重要性（什么对模型重要）

树系模型在学习过程中，会根据各变量减少不纯度的程度赋予其重要性。以下是使用乳腺癌诊断数据（scikit-learn 内置）训练随机森林后直接运行的结果。

<details>
<summary>执行代码与结果（使用 pandas 和 scikit-learn 运行验证）</summary>

```python
import pandas as pd, numpy as np
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance

d = load_breast_cancer(as_frame=True)
X, y = d.data, d.target
Xtr, Xte, ytr, yte = train_test_split(
    X, y, test_size=0.3, random_state=42, stratify=y)

rf = RandomForestClassifier(n_estimators=200, random_state=42).fit(Xtr, ytr)

# 트리 불순도 기반 중요도
imp = pd.Series(rf.feature_importances_, index=X.columns)
print(imp.sort_values(ascending=False).head(5).round(3))

# 순열 중요도 (시험 데이터에서)
pi = permutation_importance(rf, Xte, yte, n_repeats=10, random_state=42)
print(pd.Series(pi.importances_mean, index=X.columns)
        .sort_values(ascending=False).head(5).round(3))
```

基于不纯度的前 5 个变量

```
worst perimeter         0.141
worst area              0.132
worst concave points    0.122
worst radius            0.085
mean concave points     0.077
```

置换重要性前 5 个变量

```
worst texture      0.011
mean texture       0.005
concavity error    0.005
symmetry error     0.005
perimeter error    0.005
```
</details>

同一模型却得出了截然不同的排序。基于不纯度的方法中，大小（perimeter, area, radius）排在前面；而置换重要性中，所有变量的得分均低于 0.01，非常小。这是因为该数据集中存在多个包含几乎相同信息的变量，例如半径、周长和面积。scikit-learn 文档也指出，若存在高度相关的变量，即使混合其中一个，其余变量也能恢复信息，因此两者的重要性都可能较低。因此建议将高相关变量合并，仅保留一个代表变量。

总结如下：

| 区分 | 基于不纯度（树内置） | 置换重要性 |
|---|---|---|
| 计算方式 | 学习过程中不纯度的减少量之和 | 混合一个变量后得分下降的程度 |
| 适用模型 | 树系模型 | 任何模型 |
| 缺点 | 偏向数值型或高基数变量 | 若存在高度相关变量，两者得分均较低 |
| 数据依据 | 基于训练数据 | 可在测试（验证）数据上计算 |

两者仅展示模型对该变量的依赖程度，并不代表变量本身的预测能力或因果关系。这一点在考试中常作为选项句子进行变形考察。

### 2. 变量的影响方向（朝哪个方向产生影响）

重要性仅告知大小，不知晓方向。方向的解读方式因模型而异。

- 线性回归和逻辑回归通过系数的符号和大小来解读。逻辑回归系数表示对数几率的变化，`exp(系数)` 为几率比。
- 树系模型则通过部分依赖图（PDP）来观察。通过改变一个变量的值并计算其余变量的平均值，绘制预测值如何变化的图表。

<details>
<summary>逻辑回归系数与部分依赖值（直接运行）</summary>

```python
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.inspection import partial_dependence

lr = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
lr.fit(Xtr, ytr)
coef = pd.Series(lr[-1].coef_[0], index=X.columns).sort_values()
print(coef.head(3).round(2))
print(np.exp(coef.head(1)).round(3).to_dict())

pdp = partial_dependence(rf, Xte, ["worst radius"], grid_resolution=5)
print(pdp["grid_values"][0].round(1))
print(pdp["average"][0].round(3))
```

结果

```
worst texture          -1.23
worst concave points   -1.00
worst area             -0.95
{'worst texture': 0.293}

[10.4 14.1 17.7 21.4 25.1]
[0.662 0.656 0.527 0.524 0.524]
```
</details>

由于已对数据进行标准化后再训练，因此 `worst texture` 的系数 -1.23 表示该变量每增加一个标准差，对数几率减少 1.23。对应的几率比为 0.293，约为原来的 0.29 倍。在该数据集中，目标值为 1 代表良性（benign），因此负系数意味着降低良性的概率。

部分依赖值（Partial Dependence Values）显示，随着 `worst radius` 增大，阳性概率平均值从 0.66 下降至 0.52。曲线在中间部分弯曲最明显，两端则趋于平缓；仅凭平均曲线容易忽略这种分段差异。根据文档，为每个样本绘制 ICE 图（Individual Conditional Expectation Plot）能够揭示隐藏在平均值中的异质性效应。此外，PDP（Partial Dependence Plot）和 ICE 均假设关注变量与其他变量相互独立，因此若存在高度相关的变量，可能导致不切实际的数据点混入曲线中，从而造成曲线扭曲。

### 3. 阈值与预测结果（在何处进行切割）

分类模型输出概率值，而由决策者决定以何种概率作为阳性判定的阈值。我们在同一模型中仅改变阈值，观察混淆矩阵的变化情况。

<details>
<summary>各阈值的混淆矩阵（直接执行）</summary>

```python
from sklearn.metrics import confusion_matrix, roc_auc_score
pp = rf.predict_proba(Xte)[:, 1]
print("auc", round(roc_auc_score(yte, pp), 3))
for t in (0.5, 0.8, 0.95):
    tn, fp, fn, tp = confusion_matrix(yte, (pp >= t).astype(int)).ravel()
    print(t, "TN", tn, "FP", fp, "FN", fn, "TP", tp)
```

结果

```
auc 0.992
0.5  TN 58  FP 6  FN 4   TP 103
0.8  TN 64  FP 0  FN 12  TP 95
0.95 TN 64  FP 0  FN 31  TP 76
```
</details>

| 阈值 | 假阳性 (FP) | 假阴性 (FN) |
|---|---|---|
| 0.5 | 6 | 4 |
| 0.8 | 0 | 12 |
| 0.95 | 0 | 31 |

AUC 保持为 0.992 不变，但错误类型随阈值变化而完全改变。提高阈值会使判定为阳性的标准更加严格，导致假阳性（FP）减少、假阴性（FN）增加。因此，哪种错误代价更大应成为选择阈值的标准。例如，在疾病筛查中，漏诊是不可接受的，故优先考虑召回率；而在垃圾邮件过滤中，误删正常邮件不可接受，故优先考虑精确率。各指标的定义详见 [详情 → 模型评估](#/post/bd-evaluation)。

## 结果报告与模型部署

分析结果必须传达给模型使用者才算完成。报告通常包含以下内容：

1. 分析目的与数据说明（来源、时间范围、规模）
2. 数据预处理过程、模型选择依据及所用指标
3. 结果摘要（核心数值及其解释）
4. 局限性与应用建议

进行解释时，区分相关性与因果性是基本原则。变量重要性高并不意味着该变量是结果的成因。划分训练集、验证集和测试集的原因以及过拟合检查，可参考 [详情 → 分析模型设计](#/post/bd-model-design)。

模型在部署后仍需持续管理。随着时间推移，输入数据的分布可能发生变化，导致性能下降，因此需持续监控性能指标，并在必要时重新训练模型。关于模型所使用的算法类型，详见 [详情 → 监督学习模型](#/post/bd-supervised) 与 [详情 → 无监督学习模型](#/post/bd-unsupervised)。

## 解题时的分析顺序

解析此类问题时，按以下顺序筛选选项较为便捷：

- **选择哪种图表？** → 首先确定需展示的关系类型（分布、关联、趋势或构成）。
- **询问重要性还是方向？** → 重要性仅关注大小；方向则通过系数符号或 PDP 判断。
- **“重要性高即为原因”类选项** → 应依据相关性与因果性的区别予以排除。
- **询问错误类型？** → 需判断 FP 与 FN 中哪一种造成更大损失，从而确定阈值。

在实际练习中，有必要将上述流程转化为代码实现。相关内容可参考 [详情 → 实战 Python 要点](#/post/bd-practical-python)。

← [概念地图](#/post/bd-map)

相关文章：[模型评估](#/post/bd-evaluation)、[分析模型设计](#/post/bd-model-design)、[实战 Python 要点](#/post/bd-practical-python)

## 参考链接

- scikit-learn, Permutation feature importance: https://scikit-learn.org/stable/modules/permutation_importance.html
- scikit-learn, Partial Dependence and Individual Conditional Expectation plots: https://scikit-learn.org/stable/modules/partial_dependence.html