This is the beginning of ADsP Subject 3 (Data Analysis). It covers R data types and preprocessing, missing values and outliers, data marts (summaries and derived variables), data joining, and reshaping—all in one go. The concepts are simple, but many questions ask "what does this code produce?", so the code below lists results I have directly run in R 4.6.2.

Exam schedules and fees can be checked on the official website. This post covers only the core topics and frequently appearing question types. For the overall flow of the exam, see [Details → ADsP map](#/post/adsp-map).

## Data Types and Data Structures

In R, every value is an element of a vector—even a single number is a vector of length 1. You just need to remember the main data types: numeric, integer, character, and logical.

`class(c(1L, 2L, 3L))` returns "integer", `class("a")` returns "character", and `class(TRUE)` returns "logical". If you write a number as `c(1, 2)`, it is stored as a double (real number), not an integer. To create an integer, you must append `L`, like `1L`.

| Structure | One-line description | Must be same data type? |
| --- | --- | --- |
| Vector | One-dimensional, created with `c()` | Yes |
| Matrix (matrix) | Two-dimensional | Yes |
| List (list) | Elements can have different types | No |
| Data frame | A table where each column can have a different data type; all columns must have the same length | Within columns only |
| Factor | Categorical; view category list via `levels` | Categories |

The official R manual describes a data frame as a list with class "data.frame". That's why list access syntax like `df$col` works seamlessly. A factor is a vector that partitions vectors of the same length into discrete groups; using `ordered()` creates an ordered factor.

<details>
<summary>Indexing and Factor Execution Results</summary>

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

`v[-1]` excludes the first element and returns the rest. Matrices are filled column-wise, which often causes confusion. In ordered factors, the `<` comparison operator works; it does not work for regular factors.

</details>

## Missing Values

In R, missing values are represented by `NA`. The key point is that if you perform calculations on a vector containing NA, the result will also be NA.

```r
df <- data.frame(id=1:4, dept=c("A","B","A","B"), sal=c(300,NA,500,400), stringsAsFactors=TRUE)
is.na(df$sal)               # FALSE TRUE FALSE FALSE
sum(is.na(df$sal))          # 1
mean(df$sal)                # NA
mean(df$sal, na.rm=TRUE)    # 400
complete.cases(df)          # TRUE FALSE TRUE TRUE
```

Setting `na.rm=TRUE` excludes NA values before calculation. `complete.cases()` returns TRUE for rows with no NA values. `na.omit(df)` removes entire rows containing NA; in the example above, row 2 is removed, leaving only row 3.

NA behaves uniquely in logical operations. `NA > 1` results in NA. However, `NA & FALSE` yields FALSE, and `NA | TRUE` yields TRUE. If the other operand is FALSE, AND will always be FALSE; if it's TRUE, OR will always be TRUE—so NA does not affect the result.

There are mainly two ways to handle missing values: delete rows (complete deletion) or fill them with values (imputation). Imputation methods include replacing with representative values like mean or median, using values from similar entities, or filling via predictive models. Note that replacing with the mean can reduce variance.

```r
df2 <- df
df2$sal[is.na(df2$sal)] <- mean(df2$sal, na.rm=TRUE)
# 2번 행의 sal이 400으로 채워짐
```

## Outliers

Outliers are values that deviate significantly from others. They may indicate errors or represent genuine extreme values, so they should not always be removed blindly. In exams, boxplot criteria are most frequently tested.

The criterion is a fence based on 1.5 times the interquartile range (IQR), where IQR is the difference between the third quartile (Q3) and the first quartile (Q1). Values less than Q1 - 1.5×IQR or greater than Q3 + 1.5×IQR are considered outliers. The R function `boxplot.stats()` documentation states that the default `coef = 1.5` sets the whisker length and returns points outside this range as `out`.

```r
y <- c(10,12,11,13,12,11,95)
boxplot.stats(y)$out      # 95
q <- quantile(y)          # 25% = 11.0, 75% = 12.5
IQR(y)                    # 1.5
q[2]-1.5*IQR(y)           # 8.75
q[4]+1.5*IQR(y)           # 14.75
```

The fences are between 8.75 and 14.75, so only 95 lies outside. Note that `boxplot.stats()` uses hinge values similar to quartiles; for datasets with an even number of observations, these may differ from `quantile()` values, as mentioned in the documentation. Since exam problems are usually designed for manual calculation, understanding the concept is sufficient.

Methods for handling outliers include deletion, replacement with other values, variable transformation (e.g., log), and binning into intervals (categorization). The point that outliers may be important signals relevant to the analysis objective is always emphasized.

## Data Mart

A data mart is a small repository extracted from a data warehouse tailored to specific departments or topics. According to Wikipedia, it is a subset of a data warehouse created for a particular business domain—such as sales, finance, or marketing—and its narrower scope allows teams to quickly access the data they use frequently. For more details on the data warehouse itself, see [Details → Understanding Data](#/post/adsp-data-understanding).

In ADsP, this term is frequently used to refer to a table of variables created and organized for analysis. The step of preparing data in this format before building an analytical model connects with the data preparation stage in [Details → Analysis Methodology](#/post/adsp-methodology). There are two common types of variables that arise when creating a mart:

| Variable | Meaning | Example |
| --- | --- | --- |
| Summary variable | A variable created by aggregating raw data | Total purchase amount per customer, average monthly visit count |
| Derived variable | A variable newly calculated from existing variables or based on conditions | "Excellent" if purchase amount meets a threshold, weight/height² |

Summary variables often result in fewer rows (e.g., multiple transactions → one row per customer), while derived variables increase the number of columns. Summary variables are highly reusable, whereas derived variables may require interpretation depending on the context and are thus considered subjective.

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

`aggregate` is an example for creating summary variables, and `ifelse` for creating derived variables. Standardization (mean 0, standard deviation 1), as shown in `scale(c(1,2,3))`, is also common in preprocessing. The resulting values are -1, 0, and 1.

## apply family

These functions apply a function to multiple locations without using loops. Because their names are similar, distinguishing their return types can be problematic.

| Function | Target | Return |
| --- | --- | --- |
| `apply(m, 1 or 2, f)` | Rows (1) or columns (2) of a matrix | Vector |
| `lapply(x, f)` | Each element of a list or vector | List |
| `sapply(x, f)` | Same as lapply but simplifies the result if possible | Vector or matrix |
| `tapply(x, group, f)` | By group | Result with group names attached |

```r
m2 <- matrix(1:6, nrow=2)
apply(m2, 1, sum); apply(m2, 2, sum)    # 9 12 / 3 7 11
lapply(list(a=1:3,b=4:6), mean)         # $a 2 $b 5  (리스트)
sapply(list(a=1:3,b=4:6), mean)         # a b / 2 5  (이름 붙은 벡터)
tapply(df$sal, df$dept, mean, na.rm=TRUE)   # A 400 / B 400
```

The R manual describes `tapply()` as applying a function to groups defined by factors and returning results with factor level names. In the example above, the `tapply` result is the mean excluding NA values, so both A and B yielded 400.

## Combining: merge, rbind, cbind

`merge()` combines two data frames based on column names common to both by default (the default for `by` is the common column name). If `all` is not specified, only rows present in both sides remain, which is equivalent to an SQL inner join. The concept of joins is discussed further in [Details → Joins and Subqueries](#/post/sqld-join-subquery).

```r
a <- data.frame(id=c(1,2,3), x=c("a","b","c"))
b <- data.frame(id=c(2,3,4), y=c("p","q","r"))
merge(a,b)               # id 2,3 (교집합)
merge(a,b,all=TRUE)      # id 1,2,3,4 (전체 외부 조인, 없는 쪽은 NA)
merge(a,b,all.x=TRUE)    # id 1,2,3 (a 기준 왼쪽 조인)
```

Setting `all=TRUE` sets both `all.x` and `all.y` to TRUE; `all.x=TRUE` performs a left join, while `all.y=TRUE` performs a right join. A typical question asks how many rows are in the resulting data frame.

`rbind` appends rows vertically (column names must match), and `cbind` appends columns horizontally (number of rows must match).

## reshape: Wide and Long formats

Reshape allows switching between wide tables and long tables representing the same information. According to R documentation, a wide format has one subject per row with values at different time points as columns, while a long format has multiple rows for each subject (one per time point) with separate variables for time and identifiers.

| Argument | Role |
| --- | --- |
| `direction` | "wide" converts long to wide; "long" converts wide to long |
| `varying` | Column names split by time points in the wide format |
| `idvar` | Identifier variables grouping the same subject |
| `timevar` | Variable distinguishing time points. In long→wide, values are appended after the column name |

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

A 2-row × 2-column wide table became a 4-row long table, and converting back to wide resulted in time points being appended to names like `score.1` and `score.2`. The presence of values like `1.1` in row names is because reshape retains information needed for reversal.

## Common Question Types

- Questions providing code and asking for output. Examples include handling NA with `mean`, using short codes like `v[-1]`, or `apply(m, 1, sum)`.
- Choosing pros and cons of missing value handling methods. Complete deletion reduces sample size, while mean imputation reduces variance.
- Identifying outliers based on boxplots. Calculate Q1, Q3, and IQR, then compare with the fences.
- Distinguishing between summary and derived variables. Variables created via aggregation are summary variables; those newly created via conditions or calculations are derived variables.
- Determining the number of rows in `merge` results based on the `all` option.
- Distinguishing return types among apply family functions.

When solving problems, first check for NA values, then verify whether the function applies to rows, columns, or groups; this filters out most issues. Basic statistics concepts connect further to [Details → Basics of Statistical Analysis](#/post/adsp-stat-basic).

← Concept map ([ADsP map](#/post/adsp-map))

Related posts: [Learn more → Understanding data](#/post/adsp-data-understanding) · [Learn more → Analysis methodology](#/post/adsp-methodology) · [Learn more → Basics of statistical analysis](#/post/adsp-stat-basic)

## Reference links

- [R merge documentation (base)](https://stat.ethz.ch/R-manual/R-devel/library/base/html/merge.html)
- [R reshape documentation (stats)](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/reshape.html)
- [R boxplot.stats documentation (grDevices)](https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/boxplot.stats.html)
- [An Introduction to R — Official CRAN manual](https://cran.r-project.org/doc/manuals/r-release/R-intro.html)
- [Data mart — Wikipedia](https://en.wikipedia.org/wiki/Data_mart)