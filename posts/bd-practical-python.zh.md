实操 Python 是一个连贯的流程：接收数据、进行预处理、构建模型、评估模型，最后将结果输出为文件。需要记忆的不是函数名称，而是这个顺序。考试日程、报名费和出题形式请查看官方网站。本文仅整理代码流程，而非单元知识；概念部分请参阅前面的单元文章。

## 流程分为六个步骤

| 顺序 | 任务 | 主要使用的工具 |
|---|---|---|
| 1 | 查看数据·检查缺失值 | `df.shape`, `df.isna().sum()` |
| 2 | 处理缺失值与异常值 | `fillna`, `dropna`, 四分位数 |
| 3 | 类别特征编码 | `pd.get_dummies` |
| 4 | 训练集/测试集划分 | `train_test_split` |
| 5 | 标准化·模型训练 | `StandardScaler`, `RandomForestClassifier` |
| 6 | 评估·保存结果 | `accuracy_score`, `roc_auc_score`, `to_csv` |

顺序颠倒会导致两处错误。标准化必须在划分之后仅针对训练数据进行拟合；编码应在划分之前一次性完成，以避免列名错位。原因将在下面的代码中一同说明。

概念部分请参考 [详细 → 数据预处理](#/post/bd-preprocessing) 和 [详细 → 分析模型设计](#/post/bd-model-design)。

## 示例数据

这不是考试数据，而是自行制作的练习用数据。其中故意在“年龄”、“收入”列中加入了缺失值。

```python
import numpy as np, pandas as pd
rng = np.random.default_rng(0)
n = 200
df = pd.DataFrame({
    "age": rng.integers(20, 70, n).astype(float),
    "income": rng.normal(4000, 800, n).round(0),
    "grade": rng.choice(["A", "B", "C"], n),
})
df["buy"] = ((df["income"] > 4000) ^ (rng.random(n) < 0.2)).astype(int)
df.loc[rng.choice(n, 20, replace=False), "age"] = np.nan
df.loc[rng.choice(n, 10, replace=False), "income"] = np.nan
print(df.isna().sum())
print(df.shape)
```

运行后输出 `age` 为 20、`income` 为 10、`grade` 和 `buy` 为 0，形状为 `(200, 4)`。在实操考试中，打开数据后首先打印这两行（形状和缺失值数量）是一个好习惯。

## 缺失值处理

以 pandas 文档为准，`isna()` 返回相同形状的布尔值（True/False）表示是否存在缺失值；`dropna()` 会删除存在缺失值的行（默认）或列；`fillna()` 则不删除而是用指定值填充。用一句话记忆就是“查找、删除、填充”。

```python
num_cols = ["age", "income"]
df[num_cols] = df[num_cols].fillna(df[num_cols].median())
print(df.isna().sum().sum())   # 0
```

对于数值型列，常用平均值或中位数进行填充。若存在异常值，平均值会被拉偏，因此中位数更为稳健。填充后检查 `isna().sum().sum()` 是否为 0 即可结束。

<details>
<summary>使用四分位数剔除异常值</summary>

IQR 方法将小于 Q1 − 1.5×IQR 或大于 Q3 + 1.5×IQR 的值视为异常值。

```python
s = pd.DataFrame({"v": [1, 2, 5]})
q1, q3 = s["v"].quantile([.25, .75])
iqr = q3 - q1
kept = s[(s.v >= q1 - 1.5*iqr) & (s.v <= q3 + 1.5*iqr)]
```

若值为 1、2、5，则计算得 Q1=1.5、Q3=3.5，这三个值均被保留。考试中需先阅读题目是要求“剔除”还是“替换”。
</details>

## 类别特征编码

字符串列模型无法直接读取，因此需要转换为数字。One-Hot 编码使用 `pd.get_dummies`。

```python
X = pd.get_dummies(df.drop(columns="buy"), columns=["grade"], drop_first=True)
y = df["buy"]
print(list(X.columns))   # ['age', 'income', 'grade_B', 'grade_C']
```

设置 `drop_first=True` 可去除基准类别（A），使列数减少一列。若有三个类别，则生成两列。即使不设置该选项，树模型也能正常运行；但在回归类模型中，未去除基准类别可能导致多重共线性问题，因此建议设置该参数更为稳妥。

## 划分与标准化

```python
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

X_tr, X_te, y_tr, y_te = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)

sc = StandardScaler().fit(X_tr[num_cols])
X_tr = X_tr.copy(); X_te = X_te.copy()
X_tr[num_cols] = sc.transform(X_tr[num_cols])
X_te[num_cols] = sc.transform(X_te[num_cols])
```

有三个关键点：

- 固定 `random_state`，确保下次运行时划分结果一致。
- `stratify=y` 用于分类任务，保持训练集和测试集中的类别比例相似。
- 标准化器仅在训练数据上调用 `fit`，在测试数据上仅调用 `transform`，以防止测试数据信息泄露到学习中。

关于过拟合和交叉验证为何重要，可参考 [详细 → 分析模型设计](#/post/bd-model-design) 继续了解。

## 模型训练与预测

```python
from sklearn.ensemble import RandomForestClassifier

m = RandomForestClassifier(n_estimators=100, random_state=42).fit(X_tr, y_tr)
pred  = m.predict(X_te)
proba = m.predict_proba(X_te)[:, 1]
print(m.classes_)   # [0 1]
```

以 scikit-learn 文档为准，`n_estimators` 的默认值为 100，`random_state` 的默认值为 None；若不指定，每次运行结果都会不同。`predict_proba` 返回形状为 `(样本数, 类别数)` 的概率分布，列顺序遵循 `classes_`，因此 `[:, 1]` 代表类别 1 的概率。若题目要求“提交概率”，应使用此方法而非 `predict`。

各类模型的特点请参考 [详细 → 监督学习模型](#/post/bd-supervised)。代码结构几乎相同，只需将 `RandomForestClassifier` 替换为 `LogisticRegression`、`DecisionTreeClassifier`、`SVC` 等，其余 `fit` 和 `predict` 调用保持不变。

## 评估

```python
from sklearn.metrics import (accuracy_score, f1_score,
                             roc_auc_score, confusion_matrix)

print(confusion_matrix(y_te, pred))
print(accuracy_score(y_te, pred), f1_score(y_te, pred), roc_auc_score(y_te, proba))
```

在上述示例数据上运行后，混淆矩阵为 `[[18 4] [4 14]]`，准确率为 0.8，F1 约为 0.778，AUC 约为 0.836。比起具体数值，参数的形状更为重要。

| 指标 | 输入内容 |
|---|---|
| 准确率、F1 | 真实值，**预测类别** |
| AUC | 真实值，**预测概率** |

如果在 AUC 中输入类别（0/1）虽然不会报错，但计算出的数值会发生变化。不同函数所需的参数差异是容易出错的地方。指标的含义请参考 [详细说明 → 模型评估](#/post/bd-evaluation)。

## 结果保存

```python
out = pd.DataFrame({"pred": proba})
out.to_csv("result.csv", index=False)
```

去掉 `index=False` 后，生成的数据框前会多出一列序号。在提交格式有严格要求的问题中，这一行很容易导致扣分，因此列名和列数必须严格按照题目要求进行调整。

## 常见错误点

- 对测试数据也调用了 `fit`。`fit` 仅用于训练集，测试集应使用 `transform` 或 `predict`。
- 未指定 `random_state`，导致结果每次运行都不同。
- 对训练集和测试集分别进行编码，导致列顺序不一致。
- 目标变量（如 `buy`）未被移除而保留在特征矩阵 `X` 中。
- 在计算 AUC 时输入了类别而非概率。

本文代码已在 Python 3 环境下使用 pandas 3.1.0 和 scikit-learn 1.9.1 运行并验证。由于测试环境的版本可能不同，建议再次查阅官方文档以确认函数参数。

---

← [概念地图](#/post/bd-map)

相关文章：[数据预处理](#/post/bd-preprocessing) · [监督学习模型](#/post/bd-supervised) · [模型评估](#/post/bd-evaluation)

## 参考链接

- [pandas 文档 — 处理缺失值](https://pandas.pydata.org/docs/user_guide/missing_data.html)
- [scikit-learn 文档 — RandomForestClassifier](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestClassifier.html)