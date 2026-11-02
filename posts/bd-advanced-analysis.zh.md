高级分析技术是将基础统计学中向前迈进一步的四种工具整合而成的章节，包括多变量分析、时间序列分析、非参数检验和贝叶斯推断。题目更多是要求选择“在这种情况下应使用何种技术”，而非直接进行计算，因此记住每种技术适用的场景及其对应关键词会更高效。考试日程和报名费用请在官方网站上确认。基础统计学相关内容请参见 [详情 → 探索性分析与基础统计](#/post/bd-eda-stats)。

| 技术 | 适用情况 | 关键词 |
|---|---|---|
| 多变量分析 | 存在多个相互关联的变量 | 主成分、因子、多维尺度法、聚类 |
| 时间序列分析 | 观测值按时间顺序累积 | 平稳性、自相关、AR·MA·ARIMA |
| 非参数检验 | 难以假设正态分布或样本量较小 | 秩、中位数、Wilcoxon、Mann-Whitney |
| 贝叶斯推断 | 希望用数据更新先验信念 | 先验/后验概率、似然 |

## 多变量分析

对包含两个及以上变量的数据进行统一处理的方法统称为多变量分析。考试中常出现将名称与用途进行关联的题目。

| 名称 | 功能 |
|---|---|
| 主成分分析 (PCA) | 沿方差最大的方向构建新轴，从而减少变量数量 |
| 因子分析 | 寻找隐藏在变量背后的共同因子 |
| 多维尺度法 (MDS) | 尽可能保留个体间的距离，将其配置在 2~3 维平面上 |
| 聚类分析 | 将相似的个体归为一类 |
| 判别分析 | 依据已知群体对新个体进行分类 |

根据 scikit-learn 文档，PCA 是一种变换方法，它依次提取出彼此正交且能最大程度解释方差的成分；该方法会减去数据的均值以使其居中，但不会调整尺度（scale）。最后一句话在实务中尤为重要：若直接输入单位不同的变量，数值较大的变量将主导成分。已通过 iris 数据集进行了验证。

```python
from sklearn.datasets import load_iris
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

X = load_iris().data
print(PCA(2).fit(X).explained_variance_ratio_.round(3))
print(PCA(2).fit(StandardScaler().fit_transform(X)).explained_variance_ratio_.round(3))
```

```
[0.925 0.053]
[0.73  0.229]
```

标准化前，第一主成分解释了 92.5% 的方差；标准化后，该比例降至 73.0%，而第二主成分则上升至 22.9%。这两行代码展示了变量尺度如何影响结果。关于 PCA 与变量选择的内容将在 [详情 → 特征选择与降维](#/post/bd-feature-select) 中继续展开。聚类分析则单独收录于 [详情 → 无监督学习模型](#/post/bd-unsupervised)。

<details>
<summary>PCA 与因子分析容易混淆时</summary>

两者都用于减少变量数量，但出发点不同。PCA 的目的是构建能最大程度保留原始变量方差的新轴；而因子分析则是假设变量共同遵循某种潜在因子，并对其进行估计。若题目中出现“潜在因子”或“共同因子”，应理解为因子分析；若出现“最大程度保留方差”或“降维”，则对应 PCA。

</details>

## 时间序列分析

时间序列是指观测值按时间顺序累积的数据。NIST 手册指出，按时间顺序收集的数据可能具有“内部结构”，并以自相关为例加以说明。由于前后数值相互影响，不能直接套用假设独立样本的常规检验方法。

考试中常涉及的概念如下：

| 概念 | 含义 |
|---|---|
| 平稳性 | 均值和方差不随时间变化，且自协方差仅依赖于时滞的性质 |
| 差分 | 从当前值中减去前一值以消除趋势的变换 |
| 季节差分 | 与相隔一个季节周期的数值之差 |
| AR(p) | 用自身过去 p 个值解释当前值 |
| MA(q) | 用过去 q 个冲击（误差）解释当前值 |
| ARIMA(p,d,q) | 对非平稳时间序列进行 d 次差分后，结合 AR 与 MA 构成的模型 |

NIST 手册指出，Box-Jenkins 模型假设数据为平稳时间序列；若非平稳，则需至少进行一次差分，转化为 ARIMA（其中"I"代表 integrated）模型。使用模型的步骤依次为：识别、估计、验证。

我曾亲自运行代码验证差分的必要性。通过累积随机数生成的趋势型序列（随机游走），其滞后一阶的自相关系数接近 1；进行差分后则降至接近 0。

```python
import numpy as np, pandas as pd
rng = np.random.default_rng(0)
y = pd.Series(np.cumsum(rng.normal(size=200)))
print(round(y.autocorr(1), 3), round(y.diff().dropna().autocorr(1), 3))
```

```
0.977 0.039
```

AR 与 MA 的自相关衰减模式不同。分别用 AR(1) 系数 0.7 和 MA(1) 系数 0.8 各生成 500 个样本，并观察了不同滞后阶数的自相关性。

```python
e = rng.normal(size=500)
ar = np.zeros(500)
for t in range(1, 500):
    ar[t] = 0.7 * ar[t-1] + e[t]
s = pd.Series(ar)
print([round(s.autocorr(k), 2) for k in (1, 2, 3, 4)])
m = pd.Series(e[1:] + 0.8 * e[:-1])
print([round(m.autocorr(k), 2) for k in (1, 2, 3)])
```

```
[0.65, 0.41, 0.25, 0.15]
[0.46, -0.07, -0.05]
```

AR 的自相关呈逐渐衰减趋势，而 MA(1) 在滞后 1 之后则突然截断。考试中“若 ACF 指数级下降则为 AR，若在滞后 q 后截断则为 MA”即为此类模式。部分自相关系数（PACF）则相反：AR 表现为截断，MA 表现为衰减。

<details>
<summary>时间序列分解与移动平均</summary>

时间序列分解为趋势、季节、循环和不规则成分的方法也很常见。移动平均法是通过计算近期数值的平均值来平滑不规则波动以观察趋势；指数平滑法则给予近期数值更大的权重。只需将名称与简短说明配对即可。

</details>

## 非参数检验

参数检验（如 t 检验等）假设数据服从特定分布（主要是正态分布），并比较均值等参数。非参数检验不假设分布形态，而是使用秩或符号。当样本量较小、对正态性存疑或数据为顺序尺度时选择此类方法。

| 情况 | 参数检验 | 非参数对应 |
|---|---|---|
| 两个独立群体 | 独立样本 t 检验 | Mann-Whitney U (Wilcoxon 秩和) |
| 两个配对群体 | 配对样本 t 检验 | Wilcoxon 符号秩 |
| 三个及以上群体 | 单因素方差分析 | Kruskal-Wallis |
| 相关性 | Pearson | Spearman 秩相关 |

SciPy 文档将 Mann-Whitney U 描述为独立样本 t 检验的非参数版本。零假设为两个样本的基础分布相同，且样本必须相互独立。如果是配对样本，则建议使用 Wilcoxon 检验。我在同一数据上运行了 t 检验和 Mann-Whitney 检验。

```python
import numpy as np
from scipy import stats
a = np.array([12,15,14,10,18,20,11,13])
b = np.array([22,19,25,17,30,21,24,16])
print(stats.mannwhitneyu(a, b, alternative='two-sided').pvalue)
print(stats.ttest_ind(a, b).pvalue)
before = np.array([70,65,80,72,68,75,90,66])
after  = np.array([68,60,79,65,66,70,85,67])
print(stats.wilcoxon(before, after).pvalue)
print(stats.kruskal([5,7,6,9,8],[12,14,11,15,13],[20,18,22,19,21]).pvalue)
```

```
0.00295   (만-휘트니)
0.00211   (t검정)
0.0234    (윌콕슨 부호순위)
0.00193   (크러스칼-왈리스)
```

在正态性良好的数据中，两种检验得出相似的结论。解题时首先选择检验名称。如果看到“配对”、“多组”或“秩”等词，可在上述表格中找到对应单元格。p 值的解读方法和零假设与 [详细 → 探索性分析与基础统计](#/post/bd-eda-stats) 相同。

<details>
<summary>其他非参数检验</summary>

符号检验仅判断配对值之差是正还是负。游程检验通过计算数据中 +、- 交替出现的连续段（run）数量，来判断数据是否随机排列。Kolmogorov-Smirnov 检验用于确认样本是否服从特定分布，或两个样本是否来自同一分布。只需将名称与目的关联即可。

</details>

## 贝叶斯推断

频率学派将参数视为固定值，并根据数据的概率进行推断。贝叶斯学派则将关于参数的信念表示为概率分布，并随数据更新该分布。

后验概率与似然和先验概率的乘积成正比：

P(A|B) = P(B|A) × P(A) / P(B)

考试中会出现用数字求解此公式的问题。例如，在患病率为 1% 的疾病中，检测灵敏度为 95%，健康人呈阳性的比例为 5%，计算得出被判定为阳性的人实际患病的概率约为 16%。即使检测看似准确（95%），若先验概率（1%）较低，后验概率也会很低。这种结构容易让人混淆“灵敏度”与“后验概率”。

从 Beta(1,1) 先验分布开始，观察到 7 次成功和 3 次失败后，后验分布变为 Beta(1+7, 1+3) = Beta(8,4)，均值为 8/12 ≈ 0.667。先验分布与后验分布属于同一族的配对被称为共轭先验分布，对于二项数据，Beta 分布即为此类配对。

<details>
<summary>与朴素贝叶斯的关系</summary>

作为分类模型的朴素贝叶斯是在贝叶斯定理基础上添加了“给定类别时变量相互独立”的简化假设。关于监督学习的进一步说明请参见 [详细 → 分析模型设计](#/post/bd-model-design)。

</details>

## 解题顺序

若选项中混合了技术名称，首先观察数据形态：变量多则为多元分析，有时间顺序则为时间序列，涉及正态性或样本量问题则选非参数，文中提及先验概率则为贝叶斯方法。随后在表中选择具体名称。整体单元导览见 [详细 → 大数据分析师地图](#/post/bd-map)。

## 参考链接

- scikit-learn, 分解方法 (PCA): https://scikit-learn.org/stable/modules/decomposition.html#pca
- SciPy, scipy.stats.mannwhitneyu: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.mannwhitneyu.html
- NIST e-Handbook, 时间序列分析概述: https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc4.htm
- NIST e-Handbook, Box-Jenkins 模型: https://www.itl.nist.gov/div898/handbook/pmc/section4/pmc445.htm

← 概念地图 [(#/post/bd-map)](#/post/bd-map)

相关文章：[变量选择与降维](#/post/bd-feature-select) · [探索性分析与基础统计](#/post/bd-eda-stats) · [无监督学习模型](#/post/bd-unsupervised)