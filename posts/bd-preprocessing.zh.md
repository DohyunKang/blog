在大数据分析师考试中，数据预处理贯穿笔试和实操两部分。笔试主要考察概念与术语，而实操则要求使用 pandas 或 scikit-learn（若使用 R 语言则对应 R 函数）直接完成相同任务。因此，建议将术语、适用场景以及代码片段组合在一起进行记忆。关于数据收集与存储的前置步骤，请参考 [详情 → 数据收集与存储](#/post/bd-collection-storage)。

## 一览流程

| 操作 | 解决的问题 | 典型方法 |
|---|---|---|
| 缺失值处理 | 存在空值 | 删除、均值/中位数/众数填充、插值 |
| 异常值处理 | 存在离群值 | 基于 IQR、标准化分数、剔除/替换 |
| 转换 | 数值范围与分布各异 | 归一化、标准化、对数变换、分箱 |
| 编码 | 模型无法读取文本类别 | One-Hot 编码、标签编码 |
| 不平衡处理 | 某一类样本过少 | 过采样、欠采样、加权 |
| 划分 | 希望公平评估 | 训练/验证/测试集划分、分层抽样 |

以下示例均基于同一个小型数据集：包含 6 名年龄、6 名收入及 6 个城市的数据。

```python
import pandas as pd, numpy as np
df = pd.DataFrame({
    'age':[25,30,np.nan,45,28,100],
    'income':[300,350,400,np.nan,320,330],
    'city':['서울','부산','서울','대구','부산','서울']})
print(df.isna().sum())   # age 1, income 1, city 0
```

## 缺失值

pandas 将空值在 float 类型列中表示为 NaN；若整数列中包含任一 NaN，该列会自动转换为 float 类型。检查某列是否为空时，应使用 `isna()` 而非 `==`，因为 NaN 与自身比较并不相等。

主要处理方法有三种：

| 方法 | 代码 | 适用场景 |
|---|---|---|
| 删除 | `df.dropna()` | 缺失比例小且为随机缺失时 |
| 填充 | `df.fillna(值)` | 均值（数值型）、中位数（偏态分布）、众数（类别型） |
| 插值 | `s.interpolate()`、`s.ffill()` | 具有时间顺序的数据 |

```python
df.dropna()             # 6행 중 4행만 남는다
df.fillna({'age': df['age'].median(), 'income': df['income'].mean()})
# age의 빈칸은 30, income의 빈칸은 340이 들어간다
pd.Series([1, np.nan, 3]).interpolate().tolist()  # [1.0, 2.0, 3.0]
pd.Series([1, np.nan, 3]).ffill().tolist()        # [1.0, 1.0, 3.0]
```

注意此处 `dropna()` 将行数从 6 行减少至 4 行。当列较多时，即使某一行仅有一个空值，整行也会被删除。因此考试中填充方法往往比删除更常被优先采用。

填充值的选取需依据数据分布：若年龄数据中混入 100 岁，均值会被拉高，此时使用中位数更为稳健。`interpolate()` 默认采用线性插值，而 `ffill()` 则向前填充前一行的值，两者结果不同。上述两行输出即展示了这一差异。

<details>
<summary>缺失类型（MCAR·MAR·MNAR）</summary>

根据缺失产生的原因可分为三类：

| 类型 | 含义 | 示例 |
|---|---|---|
| MCAR | 完全随机缺失 | 传感器偶然中断一次 |
| MAR | 依其他观测变量而缺失 | 年轻人更常跳过收入问题 |
| MNAR | 依缺失值本身而缺失 | 高收入者不填写收入项 |

若为 MCAR，删除不会产生明显偏差；若为 MNAR，则无论删除还是填充都需谨慎。
</details>

## 异常值

异常值是与其他数值显著不同的数据点。它可能是错误也可能是真实的极端值，因此在删除前应先探究原因。考试中基于 IQR 的方法出现频率最高。

判定标准为：小于 Q1 − 1.5×IQR 或大于 Q3 + 1.5×IQR。以年龄数据 [25, 30, 45, 28, 100]（不含缺失值）计算如下：

```python
x = df[['age']].dropna()
q1, q3 = x['age'].quantile([.25, .75])   # 28.0, 45.0
iqr = q3 - q1                            # 17.0
lo, hi = q1 - 1.5*iqr, q3 + 1.5*iqr      # 2.5, 70.5
x[(x.age < lo) | (x.age > hi)]           # 100만 걸린다
```

下限为 2.5，上限为 70.5，因此仅 100 被判定为异常值。此外也可通过标准化分数（z-score）判断，通常绝对值超过 3 即视为异常值。由于均值和标准差易受异常值影响，样本量较小时 IQR 方法更稳定。

处理方式包括：剔除、用上下限替换、进行转换（如对数变换），或保留并使用对异常值鲁棒的方法。关于在探索阶段如何解读异常值，可参考 [详情 → 探索性分析与基础统计](#/post/bd-eda-stats)。

## 转换

### 归一化与标准化

两者均为调整变量单位与范围的操作。基于距离的模型（如 k-NN、k-均值）或使用梯度下降法的模型，容易受大尺度变量主导，因此需要此类处理；而基于树的模型通常对此不敏感。

| 名称 | 公式 | 结果范围 | scikit-learn |
|---|---|---|---|
| 最小 - 最大归一化 | (x − min) / (max − min) | 0~1 | `MinMaxScaler` |
| 标准化（z-score） | (x − 均值) / 标准差 | 均值 0，标准差 1 | `StandardScaler` |
| 鲁棒缩放 | 基于中位数与四分位数 | 受异常值影响小 | `RobustScaler` |

对相同年龄数据 [25, 30, 45, 28, 100] 应用上述两种方法：

```python
from sklearn.preprocessing import StandardScaler, MinMaxScaler
StandardScaler().fit_transform(x).ravel().round(3)
# [-0.734 -0.556 -0.021 -0.627  1.939]
MinMaxScaler().fit_transform(x).ravel().round(3)
# [0.    0.067 0.267 0.04  1.   ]
```

极小值和极大值由于只有 100 个样本，导致其余数据集中在 0~0.27 之间。如果存在异常值，标准化结果会因此偏向一侧。因此，当异常值较多时，说明应使用鲁棒缩放（Robust Scaling）。术语名称容易混淆，在笔试中可能会以“根据公式选择名称”的形式出现。

### 仅针对学习数据进行拟合

缩放器对**学习数据**执行 `fit`，对**测试数据**仅执行 `transform`。如果对整个数据进行拟合，会导致测试数据的特征信息泄露到学习中。scikit-learn 文档也建议使用管道（Pipeline）来确保遵循此顺序。

```python
tr = pd.DataFrame({'v':[1,2,3,4]}); te = pd.DataFrame({'v':[10]})
s = MinMaxScaler().fit(tr)
s.transform(te)    # [[3.]]
```

学习范围为 1~4，而测试值为 10 时输出结果为 3。超出 0~1 范围是正常的。不应强行阻止这种情况而使用整个数据进行 `fit`。

### 对数变换与分箱

对于右偏（向右长尾）的变量，取对数可以使其分布形态更紧凑。`np.log1p([1,10,100,1000])` 的结果约为 0.693, 2.398, 4.615, 6.909，原本 1000 倍的差异缩小到了约 10 倍。如果数据中存在小于等于 0 的值，则不能使用 `log`，而应使用 `log1p`。

分箱是将连续值转换为类别。`pd.cut` 允许直接指定区间宽度，而 `pd.qcut` 则是根据数量大致均等地进行切割。

```python
pd.cut(pd.Series([5,15,25,35,45]), bins=[0,20,40,60], labels=['a','b','c']).tolist()
# ['a','a','b','b','c']
pd.qcut(pd.Series(range(1,9)), 4, labels=False).tolist()
# [0,0,1,1,2,2,3,3]
```

## 编码

模型需要数值输入，因此必须将字符型的类别转换为数字。如果类别之间没有顺序，默认使用独热编码（One-Hot）；如果有顺序，则默认使用标签（序数）编码。如果在无顺序的类别上直接赋予 1, 2, 3 等数值，模型可能会误读这些数字的大小差异为实际意义。

```python
pd.get_dummies(df['city'], dtype=int)
#    대구  부산  서울
# 0   0   0   1
# 1   0   1   0
# ...
pd.get_dummies(df['city'], drop_first=True, dtype=int)   # 열 하나를 뺀다
```

如果类别有三个，则会生成三列。设置 `drop_first=True` 会删除其中一列，以便通过其余列还原（用于避免虚拟变量陷阱）。scikit-learn 的 `OneHotEncoder` 执行相同操作，并提供了处理学习中未出现但在测试中出现的类别的选项 (`handle_unknown`) 以及 `drop` 选项。如果类别种类非常多会导致列数爆炸，因此需要采用合并低频类别的方法。

## 不平衡数据

在阳性占 5%、阴性占 95% 的数据集中，即使将所有样本都预测为阴性，准确率也能达到 95%。因此，对于不平衡数据，不应只看准确率，而应关注召回率、F1 分数等指标。这些指标将在 [详细介绍 → 模型评估](#/post/bd-evaluation) 中讨论。

处理方法主要有三类：

| 方法 | 内容 | 注意事项 |
|---|---|---|
| 过采样 (Over-sampling) | 增加少数类的样本数量（如重复抽样、SMOTE） | 简单的复制容易导致过拟合 |
| 欠采样 (Under-sampling) | 减少多数类的样本数量 | 会导致信息丢失 |
| 加权 (Weighting) | 在损失函数中为少数类赋予更高权重 (`class_weight`) | 保持数据原样不变 |

使用 `make_classification(n_samples=1000, weights=[.95,.05])` 生成的数据集类别比例为 946:54。在此之上使用 `sklearn.utils.resample` 可实现如下效果：

```python
from sklearn.utils import resample
up = resample(Xm, replace=True,  n_samples=946, random_state=0)  # 54개 -> 946개
dn = resample(Xj, replace=False, n_samples=54,  random_state=0)  # 946개 -> 54개
```

SMOTE 是一种在少数类样本之间插值生成新样本的方法。采样操作仅应用于学习数据，测试数据应保持原始比例。

## 划分

将数据划分为学习集、验证集和测试集进行评估。若要保持类别比例，需使用 `stratify` 参数。

```python
from sklearn.model_selection import train_test_split
a, b, c, d = train_test_split(X, y, test_size=.2, stratify=y, random_state=0)
np.bincount(c), np.bincount(d)   # [757 43], [189 11]
```

学习集比例为 43/800，测试集比例为 11/200，两者均约为 5%。如果不使用 `stratify`，少数类样本可能会集中到某一侧。关于划分和交叉验证的设计，将在 [详细介绍 → 分析模型设计](#/post/bd-model-design) 中继续讨论。

## 常见题型

- 比较缺失值处理方法的优缺点，并选择替代值
- 基于 IQR 计算异常值的边界值
- 根据标准化/归一化公式判断名称，以及选择对异常值更稳健的方法
- 解释为何在无顺序类别上应使用独热编码
- 解释为何在不平衡数据中准确率具有误导性，以及区分采样方法
- 确定缩放器应在哪部分数据上进行 `fit`（仅学习数据）

实操考试中常将 `isna().sum()`、`fillna`、缩放器的 `fit_transform`/`transform` 区分、`get_dummies`、`train_test_split` 组合考查。考试日程和报考要求请在官方网站查询。

变量筛选和降维的步骤将在 [详细介绍 → 变量选择与降维](#/post/bd-feature-select) 中继续讨论。

← [概念地图](#/post/bd-map)

相关文章：[探索性分析与基础统计](#/post/bd-eda-stats)、[变量选择与降维](#/post/bd-feature-select)、[模型评估](#/post/bd-evaluation)

## 参考链接

- scikit-learn，数据预处理：https://scikit-learn.org/stable/modules/preprocessing.html
- pandas，处理缺失数据：https://pandas.pydata.org/docs/user_guide/missing_data.html