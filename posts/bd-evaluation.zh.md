模型评估是一个用数字衡量“该模型在新数据上的表现如何”的单元，在考试中，最常出现的是通过混淆矩阵计算指标的题目。与其死记硬背指标名称和公式，不如将“在何种情境下查看哪个指标”结合起来记忆，这样才能避免混淆。

## 从混淆矩阵开始

这是一个将分类模型的预测结果与实际值进行比较，并统计为四个格子的表格。几乎所有分类指标都是基于此得出的。

| | 预测阳性 | 预测阴性 |
|---|---|---|
| 实际阳性 | TP (正确预测阳性) | FN (漏掉的阳性) |
| 实际阴性 | FP (错误预测为阳性) | TN (正确预测阴性) |

名称可以按照“预测是否正确 (T/F) + 预测类别 (P/N)"的顺序来读。FP 虽然说是阳性，但其实是错的；FN 虽然说是阴性，但也是错的。

在 scikit-learn 中，行代表实际值，列代表预测值。对于二分类问题，执行 `confusion_matrix(...).ravel()` 会按 `tn, fp, fn, tp` 的顺序返回结果。考试题目中的表格行列方向可能因题而异，因此查看表格时首先要确认哪一边是实际值。

## 指标公式

| 指标 | 公式 | 一句话含义 |
|---|---|---|
| 准确率 (Accuracy) | (TP+TN) / 总数 | 整体中预测正确的比例 |
| 精确率 (Precision) | TP / (TP+FP) | 被预测为阳性的样本中，真正是阳性的比例 |
| 召回率/灵敏度 (Recall/Sensitivity) | TP / (TP+FN) | 真正的阳性样本中被找出的比例 |
| 特异度 (Specificity) | TN / (TN+FP) | 真正的阴性样本中预测正确的比例 |
| F1 分数 | 2·精确率·召回率 / (精确率 + 召回率) | 精确率和召回率的调和平均数 |

精确率的分子分母都包含“被预测为阳性”的情况，而召回率的分子分母都包含“实际阳性”。只要记住这两个分母的区别，就不会混淆。

## 手动计算示例

假设有 20 个样本（5 个阳性，15 个阴性），模型做出了如下预测。下面的代码是运行后得到的结果。

```python
from sklearn.metrics import (confusion_matrix, accuracy_score,
                             precision_score, recall_score, f1_score)

y_true = [1,1,1,1,1] + [0]*15
y_pred = [1,1,1,0,0] + [1,1] + [0]*13

print(confusion_matrix(y_true, y_pred))
print(accuracy_score(y_true, y_pred), precision_score(y_true, y_pred),
      recall_score(y_true, y_pred), f1_score(y_true, y_pred))
```

```
[[13  2]
 [ 2  3]]
0.8 0.6 0.6 0.6
```

TN=13, FP=2, FN=2, TP=3。准确率为 16/20 = 0.8，精确率为 3/5，召回率也为 3/5，F1 分数为 0.6。这与手动计算的结果一致。准确率 0.8 看起来不错，但阳性样本却漏掉了将近一半。

## 准确率具有误导性的情况

如果同样的数据中模型只预测阴性，结果如下：

```python
z = [0]*20
print(accuracy_score(y_true, z), recall_score(y_true, z), f1_score(y_true, z, zero_division=0))
# 0.75 0.0 0.0
```

准确率为 0.75，但却一个阳性都没找到。在类别比例严重倾斜的数据（如缺陷检测、异常交易等）中，即使准确率很高，模型也可能毫无用处。此时应同时查看召回率、F1 分数和 AUC。处理类别不平衡本身的方法见 [详情 → 数据预处理](#/post/bd-preprocessing)。

## 应该看哪个指标

| 情况 | 重要指标 | 原因 |
|---|---|---|
| 如癌症诊断、缺陷检测等，漏报后果严重 | 召回率 | 必须减少 FN (漏报) |
| 如垃圾邮件过滤、推荐系统等，误报很麻烦 | 精确率 | 必须减少 FP (误报) |
| 两者都需要且类别不平衡 | F1 分数 | 能过滤掉只有一项指标高的模型 |
| 类别比例相近 | 准确率 | 简单且足够 |

精确率和召回率通常呈此消彼长的关系，因此常使用将两者结合在一起的 F1 分数。根据 scikit-learn 文档，F1 是 F-beta 中 beta=1 的情况，即对精确率和召回率赋予同等权重。

## ROC 曲线与 AUC

分类模型通常会输出属于阳性的概率，并根据设定的阈值（多少概率以上视为阳性）来决定最终结果。ROC 曲线是以 TPR (= 召回率) 为纵轴、FPR (= 1 − 特异度) 为横轴，通过改变阈值绘制而成的曲线。AUC 则是该曲线下方的面积。

- 曲线越贴近左上角，模型越好。
- 随机猜测的模型呈对角线，AUC 为 0.5。
- AUC 越接近 1 越好。
- 它考察的是模型的排序能力，而不局限于单一阈值。

通过一个小例子来验证：

```python
from sklearn.metrics import roc_auc_score, roc_curve

s = [0.9,0.8,0.7,0.4,0.3, 0.6,0.5,0.35,0.2,0.1,0.1,0.15,0.2,0.05,0.1,0.3,0.25,0.1,0.05,0.02]
print(roc_auc_score(y_true, s))   # 0.9266...
fpr, tpr, th = roc_curve(y_true, s)
```

当阈值从 0.9、0.7、0.5 …逐渐降低时，(FPR, TPR) 点从 (0, 0.2) → (0, 0.6) → (0.133, 0.6) → … → (1, 1) 移动，其面积为 0.927。随着阈值降低，模型捕获的阳性样本增多，TPR 上升，但 FPR 也随之上升。

<details>
<summary>改变阈值时混淆矩阵会发生什么变化</summary>

如果将上述评分的阈值设为 0.5，则评分大于等于 0.5 的样本被视为阳性。该阈值以上包含 3 个实际阳性样本（0.9, 0.8, 0.7）和 2 个实际阴性样本（0.6, 0.5），因此 TP 为 3，FP 为 2，结果与前述混淆矩阵一致。若将阈值降低至 0.3，则能捕获全部 5 个实际阳性样本（TPR 1.0），但同时有 4 个实际阴性样本也被判为阳性，导致 FPR 约为 0.27。roc_curve 返回的表格中，阈值为 0.5 的行对应 (0.133, 0.6)，阈值为 0.3 的行对应 (0.267, 1.0)。

确定阈值本质上就是回答上表中“应观察哪个指标”这类问题。对于不能遗漏的情况应调低阈值，对于不能误判的情况应调高阈值。
</details>

## 回归模型评估

预测值为数值的回归任务需要计算误差。设实际值为 $y$，预测值为 $\hat{y}$，样本数为 $n$，则计算公式如下：

| 指标 | 公式 | 特点 |
|---|---|---|
| MSE | (1/n) Σ (y − ŷ)² | 对大误差给予较大惩罚 |
| RMSE | √MSE | 还原至原始单位，便于解释 |
| MAE | (1/n) Σ \|y − ŷ\| | 受异常值影响相对较小 |
| MAPE | (100/n) Σ \|y − ŷ\| / \|y\| | 百分比误差，若实际值为 0 则无法使用 |
| R² | 1 − Σ(y − ŷ)² / Σ(y − ȳ)² | 衡量相比简单平均预测的改进程度 |

以下是一个包含四个样本的小例子计算结果：

```python
import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

yt = np.array([3, 5, 2.5, 7]); yp = np.array([2.5, 5, 4, 8])
mse = mean_squared_error(yt, yp)
print(mse, mse**0.5, mean_absolute_error(yt, yp), r2_score(yt, yp))
# 0.875 0.935... 0.75 0.724...
```

误差分别为 -0.5, 0, 1.5, 1，其均方误差为 0.875，平均绝对误差为 0.75。考试中常出现给出误差值并要求手动计算 MSE、RMSE、MAE 的题目。

R²越接近 1，说明模型的解释能力越强。由于增加变量会使 R²单调上升，因此在比较不同变量数量的模型时，应同时参考调整后的决定系数。根据 scikit-learn 文档，R²是回归模型的默认 `score` 指标，且与均方误差排名一致。

## 超参数调优

模型评估与调优紧密相连。像决策树的深度一样，在训练前由人工设定的值称为超参数；通过尝试不同候选值并选择交叉验证得分最优者，即为调优过程。关于数据划分和交叉验证的详细内容，请参阅 [详细 → 分析模型设计](#/post/bd-model-design)。

- **网格搜索 (Grid Search)**：尝试所有候选组合。对应 scikit-learn 中的 `GridSearchCV`。
- **随机搜索 (Random Search)**：从候选分布中按指定次数抽样并尝试。对应 `RandomizedSearchCV`。文档指出其优势在于可以分别设定尝试次数和参数数量。

以下是直接运行实验的结果。在乳腺癌数据集中，我们使用 5 折交叉验证，以 F1 分数为标准，对树深度和最小叶子样本数进行了调优。

```python
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import f1_score, confusion_matrix

X, y = load_breast_cancer(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

g = GridSearchCV(DecisionTreeClassifier(random_state=42),
                 {'max_depth': [2,3,4,5], 'min_samples_leaf': [1,5,10]},
                 cv=5, scoring='f1')
g.fit(Xtr, ytr)
print(g.best_params_, round(g.best_score_, 4))
p = g.predict(Xte)
print(round(f1_score(yte, p), 4), confusion_matrix(yte, p).tolist())
```

```
{'max_depth': 4, 'min_samples_leaf': 1} 0.9514
0.951 [[39, 3], [4, 68]]
```

最优组合为深度 4、最小叶子节点数为 1。交叉验证 F1 得分为 0.9514，独立测试集的 F1 得分也为 0.951，两者非常接近。这种一致性至关重要。scikit-learn 文档也建议：不要直接用调优数据报告最终性能，而应在开发集上调优后，仅在评估集上进行一次验证。

<details>
<summary>查看交叉验证分数的方法</summary>

交叉验证将训练数据分为 $k$ 份，轮流使用其中一份作为验证集进行 $k$ 次评分。对于深度为 3 的树，精确度结果如下：

```python
from sklearn.model_selection import cross_val_score
print(cross_val_score(DecisionTreeClassifier(max_depth=3, random_state=42), Xtr, ytr, cv=5).round(3))
# [0.934 0.923 0.901 0.901 0.967]
```

各折分数在 0.90 到 0.97 之间波动。不能仅看平均值，还需关注波动较大的情况。若分数差异较大，通常意味着数据量不足或模型不稳定。
</details>

## 常见误区

- **认为高准确率即代表好模型**：如前例所示，即使全部预测为阴性，准确率也可能高达 0.75。
- **混淆精确度与召回率的定义分母**：精确度的分母是“预测阳性”，召回率的分母是“实际阳性”。
- **对 AUC 0.5 的误解**：AUC 0.5 代表随机猜测的水平，而非"50 分”。
- **使用调优数据报告最终性能**：这会导致分数虚高。
- **在回归任务中随意使用 MAPE**：当实际值为 0 时无法计算。

## 考试解题顺序

1. 若出现混淆矩阵，首先确认行和列分别代表“实际值”还是“预测值”。
2. 确定 TP、FP、FN、TN，并根据要求指标的分母进行计算。
3. 若存在类别不平衡，应优先选择召回率或 F1 分数，而非准确率。
4. ROC 曲线越靠近左上角越好，AUC 为 0.5 表示随机猜测。
5. 回归任务先列出误差，再按 MSE → RMSE 的顺序计算。

历年考题内容各不相同，故未附原文。关于考试日程及报名事宜，请访问官方网站查询。在实操考试中一次性提取这些指标的代码流程，请参阅 [详细 → 实操 Python 要点](#/post/bd-practical-python)；模型背景知识则见 [详细 → 监督学习模型](#/post/bd-supervised)。

## 参考资料链接

- scikit-learn, Metrics and scoring: https://scikit-learn.org/stable/modules/model_evaluation.html
- scikit-learn, Tuning the hyper-parameters of an estimator: https://scikit-learn.org/stable/modules/grid_search.html

← [概念图](#/post/bd-map)

相关文章：[分析模型设计](#/post/bd-model-design) · [监督学习模型](#/post/bd-supervised) · [实战 Python 要点](#/post/bd-practical-python)