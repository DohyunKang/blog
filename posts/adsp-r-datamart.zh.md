这是 ADsP 3 科目（数据分析）的前半部分内容。涵盖了 R 数据类型与预处理、缺失值与异常值、数据集市（汇总·派生变量）、数据合并以及 reshape 操作，内容浑然一体。概念本身很简单，但题目多以“运行这段代码会得到什么结果”的形式出现，因此下方的代码均为在 R 4.6.2 中实际运行后的结果。

考试日程和报名费用可在官方网站查询。本文仅涵盖单元核心内容及高频题型。考试整体流程请参见 [详细 → ADsP map](#/post/adsp-map)。

## 数据类型与数据结构

在 R 中，单个值都是向量的元素。即使是单个数字，也是一个长度为 1 的向量。只需记住以下数据类型：数值（numeric）、整数（integer）、字符（character）和逻辑（logical）。

`class(c(1L, 2L, 3L))` 返回 "integer"，`class("a")` 返回 "character"，`class(TRUE)` 返回 "logical"。如果直接写成 `c(1, 2)`，数字会被存储为实数（double），而非整数；必须像 `1L` 那样加上 L 后缀才能表示整数。

| 结构 | 单行描述 | 是否仅限同种数据类型？ |
| --- | --- | --- |
| 向量 (vector) | 一维，使用 `c()` 创建 | 是 |
| 矩阵 (matrix) | 二维 | 是 |
| 列表 (list) | 元素类型可以不同 | 否 |
| 数据框 (data.frame) | 表格，每列数据类型可不同，但各列长度必须相同 | 仅列内 |
| 因子 (factor) | 分类变量，通过 `levels` 查看类别列表 | 类别 |

R 官方手册将数据框描述为类（class）为 "data.frame" 的列表。因此，像 `df$col` 这样的列表访问语法完全适用。因子是一种向量，它将相同长度的其他向量划分为离散组；使用 `ordered()` 创建则为有序因子。

<details>
<summary>索引与因子运行结果</summary>

```r
v <- c(10, 20, 30); v[2]; v[-1]
# [1] 20
# [1] 20 30
l <- list(a=1, b="x"); l$b; l[["a"]]
# [1] "x"
# [1] 1
m <- matrix(1:6, nrow=2); m; dim(m)
#      [,1] [,2] [,3]
# [1,]    1    3    5
# [2,]    2    4    6
# [1] 2 3
f <- factor(c("low","high","mid","low"), levels=c("low","mid","high"), ordered=TRUE)
f
# [1] low  high mid  low
# Levels: low < mid < high
f[1] < f[2]
# [1] TRUE
```

`v[-1]` 会排除第一个元素，保留其余部分。矩阵是按列方向填充的，这一点容易混淆。对于有序因子，可以进行 `<` 比较；而对于普通因子，则不能进行此类比较。

</details>

## 缺失值

在 R 中，缺失值表示为 `NA`。核心要点是：如果直接对包含 NA 的向量进行计算，结果也会变成 NA。

```r
df <- data.frame(id=1:4, dept=c("A","B","A","B"), sal=c(300,NA,500,400), stringsAsFactors=TRUE)
is.na(df$sal)               # FALSE TRUE FALSE FALSE
sum(is.na(df$sal))          # 1
mean(df$sal)                # NA
mean(df$sal, na.rm=TRUE)    # 400
complete.cases(df)          # TRUE FALSE TRUE TRUE
```

设置 `na.rm=TRUE` 可忽略 NA 后进行计算。`complete.cases()` 会在某行没有任何 NA 时返回 TRUE。`na.omit(df)` 会整行删除包含 NA 的行；在上述数据中，第 2 行被移除，剩余 3 行。

在逻辑运算中，NA 的行为也很特殊。`NA > 1` 的结果是 NA。但 `NA & FALSE` 为 FALSE，`NA | TRUE` 为 TRUE。这是因为如果对方是 FALSE，AND 运算结果必然是 FALSE；如果对方是 TRUE，OR 运算结果必然是 TRUE，因此 NA 不会影响最终结果。

处理缺失值主要有两种方法：删除行（完全删除）或用值填充（替代）。替代方法包括使用均值、中位数等代表性值填充，使用相似个体的值填充，或使用预测模型填充。需要注意的是，用均值填充会导致方差减小的问题。

```r
df2 <- df
df2$sal[is.na(df2$sal)] <- mean(df2$sal, na.rm=TRUE)
# 2번 행의 sal이 400으로 채워짐
```

## 异常值

异常值是与其他数值显著偏离的值。它可能是错误，也可能是真正的极端值，因此不能无条件地删除。考试中，基于箱线图（boxplot）的标准最为常见。

判断标准是以四分位数间距（IQR，即 Q3 与 Q1 之差）的 1.5 倍为界限：小于 Q1 - 1.5×IQR 或大于 Q3 + 1.5×IQR 的值被视为异常值。R 的 `boxplot.stats()` 文档也指出，其默认参数 `coef = 1.5` 用于确定须的长度，并将之外的点返回为 `out`。

```r
y <- c(10,12,11,13,12,11,95)
boxplot.stats(y)$out      # 95
q <- quantile(y)          # 25% = 11.0, 75% = 12.5
IQR(y)                    # 1.5
q[2]-1.5*IQR(y)           # 8.75
q[4]+1.5*IQR(y)           # 14.75
```

由于界限在 8.75 到 14.75 之间，因此只有 95 位于外部。需要注意的是，`boxplot.stats()` 使用的是与四分位数类似的 hinge 值；如果数据量为偶数，其结果可能与 `quantile()` 不同，文档中也有说明。考试题目通常设计为可手算解决，因此只需掌握概念即可。

处理异常值的方法包括：删除、用其他值替代、变量变换（如对数变换）、以及分区间段（分类化）。异常值有时可能是分析目标的重要信号，这一点常与上述方法一同出现。

## 数据集市

数据集市是从数据仓库中针对特定部门或主题提取的小型存储库。根据维基百科的描述，它是为某一业务领域（如销售、财务、营销）而建立的数据仓库的子集；由于其范围较窄，能够帮助该团队快速访问常用数据。关于数据仓库本身的详细内容，请参见 [详细 → 理解数据](#/post/adsp-data-understanding)。

在 ADsP 中，"ADsP"常被用来指代“为分析目的而创建变量并整理的表格”。在构建分析模型之前，将数据调整为这种格式的步骤，与 [详细 → 分析方法论](#/post/adsp-methodology) 中的数据准备阶段相衔接。在制作马特（Mart）时，常出现两种类型的变量：

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| 汇总变量 | 通过对原始数据进行聚合而生成的变量 | 每位客户的总购买额、月平均访问次数 |
| 派生变量 | 基于现有变量重新计算或根据条件生成的变量 | 若购买额达到标准则标记为“优秀”、体重/身高² |

汇总操作通常会减少行数（例如多笔交易合并为一行客户记录），而派生操作则会增加列数。汇总变量具有较高的可复用性；派生变量则可能因情境不同而产生不同的解释，因此常被认为带有主观性。

```r
d <- data.frame(id=1:6, g=c("A","A","B","B","C","C"), v=c(1,2,3,4,5,6))
aggregate(v ~ g, data=d, FUN=sum)
#   g  v
# 1 A  3
# 2 B  7
# 3 C 11
d$grp <- ifelse(d$v>3, "hi", "lo")     # 파생변수
subset(d, v>2, select=c(id,v))         # 조건 행 + 열 선택
d[order(-d$v),][1:2,]                  # 내림차순 정렬 후 상위 2행
```

`aggregate` 用于创建汇总变量，`ifelse` 用于创建派生变量。像 `scale(c(1,2,3))` 这样的标准化处理（均值为 0，标准差为 1）在前处理中也十分常见。其结果通常为 -1、0、1。

## apply 系列函数

这是一组可在多处应用函数而无需使用循环的函数。由于名称相似，区分其返回形式成为一个常见问题。

| 函数 | 适用对象 | 返回值 |
| --- | --- | --- |
| `apply(m, 1 또는 2, f)` | 矩阵的行 (1) 或列 (2) | 向量 |
| `lapply(x, f)` | 列表或向量的每个元素 | 列表 |
| `sapply(x, f)` | 与 lapply 相同，但尽可能简化结果 | 向量或矩阵 |
| `tapply(x, 그룹, f)` | 按组别 | 带有组名标签的结果 |

```r
m2 <- matrix(1:6, nrow=2)
apply(m2, 1, sum); apply(m2, 2, sum)    # 9 12 / 3 7 11
lapply(list(a=1:3,b=4:6), mean)         # $a 2 $b 5  (리스트)
sapply(list(a=1:3,b=4:6), mean)         # a b / 2 5  (이름 붙은 벡터)
tapply(df$sal, df$dept, mean, na.rm=TRUE)   # A 400 / B 400
```

R 手册指出，`tapply()` 会针对由因子定义的各组应用函数，并返回带有因子水平名称的结果。如上所述，`tapply` 的结果是去除 NA 后的平均值，因此 A 和 B 均显示为 400。

## 合并：merge, rbind, cbind

`merge()` 默认情况下会根据两个数据框中共有的列名进行合并（`by` 参数的默认值为公共列名）。如果不指定 `all` 参数，则仅保留两侧都存在的行，这等同于 SQL 的内连接。关于连接的概念，可参考 [详细 → 连接与子查询](#/post/sqld-join-subquery)。

```r
a <- data.frame(id=c(1,2,3), x=c("a","b","c"))
b <- data.frame(id=c(2,3,4), y=c("p","q","r"))
merge(a,b)               # id 2,3 (교집합)
merge(a,b,all=TRUE)      # id 1,2,3,4 (전체 외부 조인, 없는 쪽은 NA)
merge(a,b,all.x=TRUE)    # id 1,2,3 (a 기준 왼쪽 조인)
```

`all=TRUE` 相当于同时设置 `all.x` 和 `all.y` 为 TRUE；`all.x=TRUE` 表示左连接，`all.y=TRUE` 表示右连接。判断结果行数是多少是此类问题中的典型考题。

`rbind` 用于在下方追加行（要求列名相同），`cbind` 用于在右侧追加列（要求行数相同）。

## reshape：宽格式与长格式

reshape 用于在宽表（wide）和长表（long）之间转换同一信息。根据 R 文档的定义，宽表中每个对象占一行，各时间点的值作为列展开；而长表中每个对象对应多个行（数量等于时间点数量），并单独包含时间变量和标识变量。

| 参数 | 作用 |
| --- | --- |
| `direction` | "wide"将 long 转为 wide，"long"将 wide 转为 long |
| `varying` | 在 wide 格式中按时间点分隔的列名 |
| `idvar` | 用于标识同一对象的变量 |
| `timevar` | 区分时间点的变量。从 long 转为 wide 时，其值会附加到列名之后 |

```r
wide <- data.frame(id=1:2, t1=c(5,6), t2=c(7,8))
long <- reshape(wide, direction="long", varying=c("t1","t2"),
                v.names="score", timevar="time", times=1:2, idvar="id")
long
#     id time score
# 1.1  1    1     5
# 2.1  2    1     6
# 1.2  1    2     7
# 2.2  2    2     8
reshape(long, direction="wide", idvar="id", timevar="time", v.names="score")
#     id score.1 score.2
# 1.1  1       5       7
# 2.1  2       6       8
```

一个 2 行 × 2 列的宽表被转换为 4 行的长表；再转回宽表时，时间点会作为后缀出现在列名后（如 `score.1`、`score.2`）。行名中残留类似 `1.1` 的值，是因为 reshape 保留了用于还原的信息。

## 常见题型

- 给出代码并询问输出结果。例如：当 `mean` 中存在 NA 时，或使用 `v[-1]`、`apply(m, 1, sum)` 等简短代码的情况。
- 选择缺失值处理方法的优缺点。完全删除会导致样本量减少，均值填补则会使方差减小。
- 基于箱线图判定异常值：计算 Q1、Q3 和 IQR，并与“围栏”进行比较。
- 区分汇总变量与派生变量：通过聚合生成的为汇总变量，通过条件或计算新生成的为派生变量。
- 根据 `merge` 中的 `all` 选项调整结果行数。
- 区分 apply 系列函数的返回形式。

解题时，首先检查是否存在 NA，然后确认函数是应用于行、列还是组别，通常即可排除大部分错误选项。统计学基础内容可参考 [详细 → 统计分析基础](#/post/adsp-stat-basic)。

← 概念地图 ([ADsP map](#/post/adsp-map))

相关文章：[详细了解 → 数据理解](#/post/adsp-data-understanding) · [详细了解 → 分析方法论](#/post/adsp-methodology) · [详细了解 → 统计分析基础](#/post/adsp-stat-basic)

## 参考链接

- [R merge 文档 (base)](https://stat.ethz.ch/R-manual/R-devel/library/base/html/merge.html)
- [R reshape 文档 (stats)](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/reshape.html)
- [R boxplot.stats 文档 (grDevices)](https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/boxplot.stats.html)
- [《R 语言入门》— CRAN 官方手册](https://cran.r-project.org/doc/manuals/r-release/R-intro.html)
- [数据集市 — Wikipedia](https://en.wikipedia.org/wiki/Data_mart)