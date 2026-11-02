# 变量选择与降维

当数据包含 30 个变量和 5 个变量时，如果是同一个模型，通常变量较少的那个更容易处理。学习速度快、易于解释且过拟合风险较低。因此，在构建模型之前需要加入减少变量的步骤。减少变量的方法主要分为两大类。

| 分类 | 操作内容 | 结果变量 | 代表技术 |
|---|---|---|---|
| 变量选择 | 仅从原始变量中选取一部分 | 保持原始变量不变 | 过滤法·包装法·嵌入法 |
| 降维 | 合并变量以创建新变量 | 新生成的变量 | PCA 等 |

考试中经常考察这两者的区别，以及在变量选择内部区分三种方式的问题。与其死记硬背题目原文，不如掌握“依据什么标准进行选择”更为重要。

在 [预处理](#/post/bd-preprocessing) 中整理完缺失值和尺度后，在选择模型之前 ([模型设计](#/post/bd-model-design)) 会进行这一步骤。

## 过滤法：利用统计量在不构建模型的情况下剔除变量

对每个变量进行统计评分，仅保留得分较高的变量。由于不需要运行模型，因此速度很快。scikit-learn 文档将基于方差的 `VarianceThreshold`（丢弃方差小的变量）和基于评分前 k 名的 `SelectKBest` 归类为过滤法。评分函数在分类任务中包括 `chi2`、`f_classif`、`mutual_info_classif`，在回归任务中包括 `f_regression` 等。

- 方差几乎为 0 的变量不包含信息。
- 对于相关性高的变量对，仅保留一个（参考 [相关分析](#/post/bd-eda-stats)）。如果自变量之间过于相似，会产生多重共线性。
- 使用检验统计量（F 值、卡方等）对变量与目标变量的关系进行评分。

其缺点是单独看待每个变量。虽然单个变量可能表现不佳，但某些变量组合在一起时效果显著，这种方法可能会遗漏这些组合。

## 包装法：通过反复运行模型进行选择

不断改变变量子集并重复训练模型，从而选择性能较好的组合。虽然准确但成本高昂。文档将 `RFE`（递归特征消除）归类为包装法。该方法会学习输出系数或重要性的模型，移除最弱的变量，并重复此过程直到剩余变量数量达到目标。还有一种通过交叉验证确定数量的 `RFECV`。

考试中常出现的特定名称如下表所示：

| 方法 | 操作方式 |
|---|---|
| 前向选择 | 从空集开始，逐个添加最有帮助的变量 |
| 后向消除 | 全部加入，逐个移除最不重要的变量 |
| 逐步选择 | 在添加过程中，若发现不再需要的变量则将其移除 |

## 嵌入法：在学习过程中同时进行选择

在模型学习过程中确定变量的重要性，并据此进行筛选。文档将 `SelectFromModel` 介绍为一种元转换器。该方法仅保留重要性超过阈值的变量，阈值可以是数字或 `"mean"`、`"median"` 等字符串。

- L1 正则化（Lasso）：使部分系数精确为 0，从而剔除变量。正则化强度越大，剩余变量越少。根据文档标准，Lasso 的 alpha 值越大，分类模型的 C 参数越小，变量数量就越少。
- L2 正则化（Ridge）：减小系数数值但不会使其变为 0。因此，这更接近于系数稳定化而非变量选择。
- 树系模型：使用如随机森林等集成方法的变量重要性。

三种方法可以总结为一句话：过滤法在构建模型之前进行，包装法通过反复训练模型进行选择，而嵌入法则在模型学习过程中进行选择。速度方面，过滤法最快，包装法最慢。

## 实际运行结果

使用乳腺癌诊断数据（`load_breast_cancer`，569 行，30 个变量）进行了测试。将数据分为训练集（70%）和测试集（30%），且变量选择仅基于训练数据进行。如果查看测试数据来选择变量，会导致评估结果虚高。

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

使用每种方法选择的变量重新训练逻辑回归模型，并计算了测试集的准确率。

| 变量构成 | 变量数量 | 测试准确率 |
|---|---|---|
| 全部 | 30 | 0.988 |
| 移除高相关变量（过滤法） | 19 | 0.977 |
| RFE（包装法） | 5 | 0.953 |
| 随机森林重要性（嵌入法） | 10 | 0.936 |
| SelectKBest（过滤法） | 5 | 0.924 |

将变量从 30 个减少到 5 个，准确率并未大幅下降。不过，这张表仅展示了一个种子和一个划分的结果，不能据此认为排名总是如此。值得注意的是，在 `SelectKBest` 选出的 5 个变量中，`mean perimeter`、`worst radius` 和 `worst perimeter` 都是表示尺寸的相似变量；由于过滤器是独立评估每个变量的，因此同时选中了这些相似的变量。而 RFE 则混合了性质不同的变量，如 `area error` 和 `worst texture`。在该数据集中，这种差异反映在了准确率上。

<details>
<summary>变量重要性前 5 名与方差过滤器</summary>

随机森林（Random Forest）的前 5 个重要变量依次为：`worst perimeter`(0.141)、`worst area`(0.132)、`worst concave points`(0.122)、`worst radius`(0.085) 和 `mean concave points`(0.077)。半径、周长和面积彼此提供的信息几乎相同，因此重要性被分散分配。

应用 `VarianceThreshold(threshold=1.0)` 后剩余 10 个变量，且剩下的全是数值单位较大的变量（如周长、面积等）。方差对单位敏感，若在不同单位的变量间直接比较方差，会导致仅保留单位大的变量，而忽略其实际重要性。因此，在使用方差过滤器前需谨慎，最好在标准化之前使用。
</details>

## 降维与 PCA

特征选择是从原始变量中挑选，而主成分分析（PCA）则是通过线性组合创建彼此正交的新轴。第一个轴解释的方差最大，第二个次之，依此类推。根据文档说明，PCA 会减去每个变量的均值，但不会调整其尺度；若混合了不同单位的变量，必须先进行标准化。

使用相同数据进行了验证：标准化后应用 PCA，得到的解释方差比例为 PC1 0.452、PC2 0.196、PC3 0.089。累积达到 90% 需要 7 个主成分，达到 95% 则需要 10 个。若不进行标准化直接应用 PCA，PC1 占据了整体方差的 0.985，即单位较大的变量（如面积）独占了一个轴。

```python
from sklearn.decomposition import PCA

pca = PCA(n_components=0.95).fit(sc.transform(Xtr))   # 누적 95%까지
print(pca.n_components_)                              # 10
Ztr = pca.transform(sc.transform(Xtr))
Zte = pca.transform(sc.transform(Xte))
m = LogisticRegression(max_iter=1000).fit(Ztr, ytr)
print(round(m.score(Zte, yte), 3))                    # 0.971
```

若给 `n_components` 一个介于 0 和 1 之间的浮点数，它会选择累积解释方差达到该值所需的最小主成分数量。30 个变量被压缩为 10 个主成分，准确率为 0.971。

在考试中，确定主成分数量的依据包括：累积解释方差比例达到一定水平（例如 80%~90%）的点，或碎石图（scree plot）中弯曲的“肘部”点。从计算角度看，这与协方差（或相关）矩阵的特征值分解相关联。特征值越大，该轴解释的方差也越大。

同时也总结了 PCA 的缺点：

- 新轴是原始变量的混合，难以解释其含义。
- 仅寻找方差大的方向，并不考虑与目标变量的相关性。
- 作为线性变换，无法捕捉曲线结构。

关于聚类或可视化中使用 PCA 的内容，将在 [无监督学习](#/post/bd-unsupervised) 部分继续探讨。

## 派生变量

组合现有变量以创建新变量也是一种特征工程。例如，利用身高和体重计算 BMI，从日期中提取星期几和月份，或用购买次数和金额计算平均购买额等。对于分类变量，可转换为虚拟（独热）变量；对于连续变量，可进行分箱（binning）。派生变量常源于领域知识，其效果是直接引入模型难以自行发现的比率、差异等关系。若生成的变量与现有变量高度重叠，则需再次通过相关分析进行筛选。

## 备考总结

- 过滤器（Filter）、包装器（Wrapper）和嵌入法（Embedded）可根据“是否使用模型”及“何时使用”来区分。
- 前向选择、后向消除和逐步选择属于包装器类方法。
- Lasso 采用 L1 正则化，使部分变量系数变为 0；Ridge 采用 L2 正则化，不会将系数变为 0。
- PCA 并非特征选择方法，而是创建新变量的方法，且需先进行标准化。
- 主成分数量应根据累积解释方差比例或碎石图确定。
- 特征选择仅在训练数据上拟合，并直接应用于测试数据。

在实操考试中，基本顺序是：在 `train_test_split` 之后，`fit` 仅用于训练集，而 `transform` 则同时用于训练和测试集。特征选择与 PCA 均遵循此规则。关于考试日程和报名方式，请访问官方网站查询。

## 参考链接

- [scikit-learn: Feature selection](https://scikit-learn.org/stable/modules/feature_selection.html)
- [scikit-learn: Decomposing signals in components (PCA)](https://scikit-learn.org/stable/modules/decomposition.html#pca)

← [概念图](#/post/bd-map)

相关文章：[数据预处理](#/post/bd-preprocessing) · [分析模型设计](#/post/bd-model-design) · [无监督学习模型](#/post/bd-unsupervised)