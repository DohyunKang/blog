在 SQLD 中，关于 `GROUP BY` 子句的常见考题包括：聚合函数与 NULL 的处理顺序、`WHERE` 和 `HAVING` 的执行顺序、`ROLLUP`·`CUBE`·`GROUPING SETS` 生成的结果行数以及集合运算符的重叠处理。下面的示例是在 DuckDB 中直接运行并验证了结果的。对于考试环境（Oracle）中与上述语法不同的地方，已另行注明。

## 示例表

用于说明的表包含 7 名员工，仅有四个列：部门 (`dept`)、职位 (`job`)、薪资 (`sal`) 和津贴 (`comm`)。

| id | dept | job | sal | comm |
|---|---|---|---|---|
| 1 | SALES | CLERK | 300 | 50 |
| 2 | SALES | CLERK | 320 | NULL |
| 3 | SALES | SENIOR | 400 | NULL |
| 4 | DEV | CLERK | 350 | NULL |
| 5 | DEV | SENIOR | 450 | NULL |
| 6 | DEV | SENIOR | 470 | NULL |
| 7 | HR | CLERK | 310 | NULL |

## 聚合函数

聚合函数接收多行数据并返回单个值。`COUNT`、`SUM`、`AVG`、`MAX`、`MIN` 是基本函数。

- `COUNT(*)` 统计行数，即使存在 NULL 也会计入。
- `COUNT(列名)` 仅统计该列不为 NULL 的行数。
- `SUM`、`AVG`、`MAX`、`MIN` 会跳过 NULL 值进行计算。
- 当没有行时，`COUNT` 返回 0，而其他函数返回 NULL。

```sql
SELECT COUNT(*), COUNT(comm), AVG(sal), AVG(comm) FROM emp;
-- 7, 1, 371.43, 50
```

由于只有 1 名员工有津贴，因此 `COUNT(comm)` 为 1，而 `AVG(comm)` 是 50 而非除以 7，这是因为分母中排除了 NULL 行。这部分是常见的陷阱，遇到计算问题时首先应查看有多少个 NULL。

如果希望将 NULL 视为 0 来计算平均值，则需改为 `AVG(NVL(comm, 0))`。`NVL` 是 Oracle 函数。相关内容在 [详细 → SELECT 语句与函数](#/post/sqld-select-func) 中进一步讨论。

## GROUP BY 和 HAVING

`GROUP BY` 会将具有相同指定列值的行分组，并为每个组生成一行。规则有两条：

- `SELECT` 列表中只能包含 `GROUP BY` 中使用的列、聚合函数或常量。使用其他列会导致 Oracle 抛出 ORA-00979 错误。
- 用于过滤组的条件应写在 `HAVING` 中，而不是 `WHERE`。`WHERE` 在分组前过滤行，而 `HAVING` 在分组后过滤组。

```sql
SELECT dept, COUNT(*), SUM(sal)
FROM emp
GROUP BY dept
HAVING SUM(sal) >= 1000
ORDER BY dept;
-- DEV 3 1270 / SALES 3 1020   (HR은 310이라 빠짐)
```

记住 SQL 执行的逻辑顺序如下会更方便：

| 顺序 | 子句 | 作用 |
|---|---|---|
| 1 | FROM | 确定表 |
| 2 | WHERE | 过滤行 |
| 3 | GROUP BY | 分组 |
| 4 | HAVING | 过滤组 |
| 5 | SELECT | 选择列 |
| 6 | ORDER BY | 排序 |

由于 `ORDER BY` 出现在 `SELECT` 之后，因此可以在 `ORDER BY` 中使用 `SELECT` 中定义的别名。Oracle 文档也指出别名只能在 `ORDER BY` 中使用。

<details>
<summary>为什么不能在 WHERE 中使用聚合函数</summary>

`WHERE` 在步骤 3（分组）之前执行。此时尚未形成组，因此不存在 `SUM(sal)` 之类的值。所以 `WHERE SUM(sal) >= 1000` 会导致错误。如果相同条件是针对“部门合计”而非“单行值”，则可以在 `WHERE` 中使用。例如 `WHERE sal >= 400` 会在分组前仅保留薪资大于等于 400 的行。从性能角度看，如果不是针对组条件的过滤，先通过 `WHERE` 减少行数更为有利。

</details>

## ROLLUP, CUBE, GROUPING SETS

这是通过单个 `GROUP BY` 一次性生成子总计和总计的扩展语法。Oracle 文档指出，与其使用 `UNION ALL` 分别拼接，不如在一个查询块中处理，从而只读取一次表。

### ROLLUP

`ROLLUP(a, b)` 会从右侧列开始逐个移除以生成子总计。如果有 n 个列，则会有 n+1 个聚合级别。

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY ROLLUP(dept, job)
ORDER BY dept, job;
```

| dept | job | SUM(sal) |
|---|---|---|
| DEV | CLERK | 350 |
| DEV | SENIOR | 920 |
| DEV | NULL | 1270 |
| HR | CLERK | 310 |
| HR | NULL | 310 |
| SALES | CLERK | 620 |
| SALES | SENIOR | 400 |
| SALES | NULL | 1020 |
| NULL | NULL | 2600 |

`(dept, job)` 的详细行、`(dept)` 的部门小计以及 `()` 的总计都包含在结果中。如果改变列顺序使用 `ROLLUP(job, dept)`，则小计基准将变为职级。顺序决定结果这一点在考试中经常考到。

### CUBE

`CUBE(a, b)` 会生成列的所有可能组合。如果有 n 个列，其级别为 2 的 n 次方。

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY CUBE(dept, job)
ORDER BY dept, job;
```

ROLLUP 的结果中会额外增加两行按职级的小计。

| dept | job | SUM(sal) |
|---|---|---|
| NULL | CLERK | 1280 |
| NULL | SENIOR | 1320 |

ROLLUP 的 9 行结果中增加了两行按职级的小计，总共为 11 行。这是因为组合有 `(dept, job)`、`(dept)`、`(job)`、`()` 这四种情况。CUBE 即使改变列顺序，结果行的集合也相同。

### GROUPING SETS

`GROUPING SETS` 仅计算我指定的分组组合。当只需要小计中的特定部分时使用它。

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY GROUPING SETS ((dept), (job))
ORDER BY dept, job;
-- 부서별 3줄 + 직급별 2줄 = 5줄
```

既不会输出总计，也不会输出详细行，只输出指定的 `(dept)` 和 `(job)`。即使列顺序改变，结果也相同，这一点与 CUBE 一致。

<details>
<summary>用 GROUPING SETS 展开这三种语法</summary>

这是 Oracle 文档中提到的等价表达式。

- `ROLLUP(a, b, c)` = `GROUPING SETS ((a,b,c), (a,b), (a), ())`
- `CUBE(a, b, c)` = `GROUPING SETS ((a,b,c), (a,b), (a,c), (b,c), (a), (b), (c), ())`（共 8 个）
- `GROUPING SETS (a, b, (b,c))` = `GROUP BY a` UNION ALL `GROUP BY b` UNION ALL `GROUP BY b, c`

括号包裹的 `(b, c)` 被视为一个整体。`ROLLUP(a, (b, c))` 包含 `(a,b,c)`、`(a)`、`()` 这三个层级，因此不会生成仅关于 b 的小计。

</details>

### GROUPING 函数

ROLLUP 和 CUBE 的小计行中，对应列会显示为 NULL。但由于实际数据中也可能存在 NULL，仅凭 NULL 无法区分是否为小计行。`GROUPING(列名)` 函数会在该 NULL 是由小计引起时返回 1，否则返回 0。

```sql
SELECT dept, job, SUM(sal), GROUPING(dept), GROUPING(job)
FROM emp
GROUP BY ROLLUP(dept, job)
ORDER BY dept, job;
-- DEV / NULL / 1270 / 0 / 1   (직급 자리가 소계)
-- NULL / NULL / 2600 / 1 / 1  (총계)
```

Oracle 文档中的示例用法是 `DECODE(GROUPING(department_name), 1, 'ALL DEPARTMENTS', department_name)`，用于给小计行添加名称。同系列中，`GROUPING_ID` 会返回多个列的 GROUPING 值的位向量数字，而 `GROUP_ID` 则用于区分重复的组。

## 集合运算符

这是一种将两个 SELECT 结果上下合并或相减的操作。如果说 JOIN 是将列横向拼接，那么集合运算则是处理行的上下组合。JOIN 的详细讲解见 [此处 → JOIN 与子查询](#/post/sqld-join-subquery)。

| 运算符 | 结果 | 重复处理 |
|---|---|---|
| UNION | 并集 | 去除 |
| UNION ALL | 并集 | 保留 |
| INTERSECT | 交集 | 去除 |
| MINUS | 差集（从前一个结果中减去后一个） | 去除 |

MINUS 是 Oracle 特有的名称，而在 duckdb、PostgreSQL 等数据库中则使用 EXCEPT。下面的结果是使用 EXCEPT 获得的。

```sql
SELECT job FROM emp WHERE dept = 'SALES'
UNION ALL
SELECT job FROM emp WHERE dept = 'DEV';
-- CLERK CLERK SENIOR CLERK SENIOR SENIOR  (6행)

-- UNION이면 CLERK, SENIOR (2행)

SELECT job FROM emp WHERE dept = 'SALES'
INTERSECT
SELECT job FROM emp WHERE dept = 'HR';
-- CLERK

SELECT job FROM emp WHERE dept = 'DEV'
MINUS   -- duckdb에서는 EXCEPT
SELECT job FROM emp WHERE dept = 'HR';
-- SENIOR
```

UNION 需要额外进行一次去重操作。如果已知没有重复数据，直接使用 UNION ALL 会更简单。

Oracle 文档整理的规则如下：

- 两个 SELECT 的列数必须相同，且同一位置的列必须属于相同的数据类型组（数字或字符串）。对于某一方缺失的列，需使用 `TO_CHAR(NULL)` 等方式进行匹配。
- ORDER BY 只能在最后使用一次，不能在每个 SELECT 内部使用。
- 运算符优先级相同，按从左到右顺序处理。文档指出，当 INTERSECT 与其他运算符混合使用时，需用括号明确运算顺序。

<details>
<summary>解决集合运算问题的步骤</summary>

解决此类集合运算问题可按以下步骤进行：

1. 首先分别列出每个 SELECT 返回的行。
2. 从左到右依次应用运算符。如果涉及 UNION 和 INTERSECT、MINUS，需检查是否有括号。
3. 最后再次确认是否去重（即使用 UNION ALL）。
4. 如果列数或类型不匹配，错误选项可能是正确答案。

</details>

## 常见题型总结

- COUNT(*)、COUNT(列) 以及 AVG 的 NULL 处理结果计算
- WHERE 与 HAVING 的位置，以及在不使用 HAVING 的情况下在 WHERE 子句中错误使用聚合函数的 SQL 语句识别
- 解释为何在 SELECT 子句中使用未包含在 GROUP BY 中的列会导致错误
- 统计 ROLLUP、CUBE 和 GROUPING SETS 的结果行数
- 查找 GROUPING 函数值为 1 的行
- UNION 与 UNION ALL 结果行数的差异，以及 INTERSECT 和 MINUS 的结果

使用窗口函数在组内进行排名将在 [详情 → 窗口函数与高级 SQL](#/post/sqld-window-advanced) 中继续介绍。考试日程和报名费用请访问官方网站查询。

← 概念图 (#/post/sqld-map)

相关文章：[SELECT 语句与函数](#/post/sqld-select-func) · [连接与子查询](#/post/sqld-join-subquery) · [窗口函数与高级 SQL](#/post/sqld-window-advanced)

## 参考链接

- Oracle Database 19c SQL Language Reference, SELECT: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html
- Oracle Database 19c, GROUPING 函数：https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/GROUPING.html
- Oracle Database 19c, UNION ALL·INTERSECT·MINUS 运算符：https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/The-UNION-ALL-INTERSECT-MINUS-Operators.html
- Oracle Database 19c Data Warehousing Guide, SQL for Aggregation: https://docs.oracle.com/en/database/oracle/oracle-database/19/dwhsg/sql-aggregation-data-warehouses.html