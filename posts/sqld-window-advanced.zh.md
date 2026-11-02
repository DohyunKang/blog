窗口函数（Window Functions）是一种类似于 GROUP BY 但不合并行，而是为每一行附加计算结果的函数。在 SQLD 第 2 课中，排名、前后行、累计求和、TOP N、层级查询、PIVOT 以及正则表达式均属于本单元内容。考试日程与报名费用请查阅官方网站。

## 什么是窗口函数

聚合函数会为每个组生成一行结果。而窗口函数（分析函数）执行相同的计算，但保留输入的行数。用 Oracle 文档的表述来说，就是“为每一行返回一个结果的聚合”。

其结构始终一致：

```
함수() OVER ( [PARTITION BY ...] [ORDER BY ...] [윈도잉 절] )
```

- **PARTITION BY**：用于划分分组。若省略，则所有数据视为一个大组。与 GROUP BY 不同，它不会合并行。
- **ORDER BY**：定义组内的排序依据。
- **窗口子句（ROWS/RANGE）**：指定参与计算的行的范围。必须配合 ORDER BY 使用。

执行顺序也值得记忆：窗口函数在 FROM、WHERE、GROUP BY、HAVING 之后计算。因此，它们只能用于 SELECT 和 ORDER BY 子句中，不能用于 WHERE 子句。若需根据排名进行过滤，必须使用子查询包裹一次。这往往是考试中常见的错误选项陷阱。

## 三种排名函数

当分数相同时，如何分配编号是这三个函数的区别所在。下表是基于部门薪资排名的实际运行结果（表格数据为虚构）：

| ename | deptno | sal | RANK | DENSE_RANK | ROW_NUMBER |
|---|---|---|---|---|---|
| A | 10 | 500 | 1 | 1 | 1 |
| B | 10 | 500 | 1 | 1 | 2 |
| C | 10 | 400 | 3 | 2 | 3 |
| D | 10 | 300 | 4 | 3 | 4 |

- **RANK**：若出现并列，则分配相同编号并跳过后续编号（例如 1, 1, 3）。
- **DENSE_RANK**：若出现并列，则分配相同编号且不跳过后续编号（例如 1, 1, 2）。
- **ROW_NUMBER**：即使分数相同，也会强制分配不同的编号。由于并列时谁先谁后未定，若要固定结果，需额外添加排序键（如 `ORDER BY sal DESC, ename`）。

```sql
select ename, deptno, sal,
  rank()       over (partition by deptno order by sal desc) rnk,
  dense_rank() over (partition by deptno order by sal desc) drnk,
  row_number() over (partition by deptno order by sal desc, ename) rn
from emp;
```

## 前后行、累计与比例

- **LAG(列名, n)**：获取前 n 行的值；**LEAD(列名, n)**：获取后 n 行的值。第一行的 LAG 和最后一行的 LEAD 结果为 NULL（可通过第三个参数设置默认值）。
- **FIRST_VALUE / LAST_VALUE**：分别获取窗口内的第一个值和最后一个值。
- 在类似 SUM 的聚合函数后添加 OVER，即可实现累计求和或移动求和。
- **RATIO_TO_REPORT(x)**：计算 x 占组总和的比例。
- **NTILE(n)**：将组划分为 n 个区间。
- **CUME_DIST, PERCENT_RANK**：分别用于计算累积分布和相对排名。

在月度销售额数据中，添加上月和下月的值后结果如下：

```sql
select month, amount,
  lag(amount,1)  over (order by month) prev,
  lead(amount,1) over (order by month) nxt
from sales where product='x';
-- (1, 10, NULL, 20) (2, 20, 10, 30) (3, 30, 20, NULL)
```

<details>
<summary>窗口子句详解（ROWS 与 RANGE，默认范围）</summary>

边界关键字共有五种：

| 关键字 | 含义 |
|---|---|
| UNBOUNDED PRECEDING | 分区起始点（仅用于开始位置） |
| UNBOUNDED FOLLOWING | 分区结束点（仅用于结束位置） |
| CURRENT ROW | 当前行 |
| n PRECEDING | 相对于当前行之前的 n 行 |
| n FOLLOWING | 相对于当前行之后的 n 行 |

- **ROWS** 基于物理行数，而 **RANGE** 基于 ORDER BY 表达式的值距离（如时间间隔等）来确定范围。
- 若仅使用 ORDER BY 而省略窗口子句，默认范围为 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`。因此，`SUM(x) OVER (ORDER BY ...)` 会生成累计求和结果。
- 当存在并列行时，RANGE 会对并列行返回相同结果，而 ROWS 则可能因行的物理顺序不同而产生不同结果。
- **LAST_VALUE** 的默认范围仅到当前行，若需获取分区的真正最后一个值，应使用 `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`。

以下是累计求和与比例的计算示例（实际运行结果）：

```sql
select month, product, amount,
  sum(amount) over (order by month, product
                    rows between unbounded preceding and current row) run,
  sum(amount) over (partition by month) month_total,
  round(100.0*amount/sum(amount) over (partition by month),1) pct
from sales order by month, product;
-- (1,'x',10, 10,15,66.7) (1,'y',5, 15,15,33.3) (2,'x',20, 35,35,57.1) ...
```
</details>

## TOP N

关于窗口函数的解决方案通常是先进行排名，然后在外部查询中过滤出前 N 名。

```sql
select * from (
  select ename, deptno, sal,
         rank() over (partition by deptno order by sal desc) rnk
  from emp
) where rnk <= 2;
```

使用上述虚构数据运行后，10 号部门中有两名并列第一的员工（A、B），而 20 号部门则显示 E 和 F。若使用 RANK，由于并列情况可能导致结果人数超过 N；若使用 ROW_NUMBER，则能精确返回恰好 N 名员工。考试中常会考查这一区别。

此外，不同数据库管理系统（DBMS）的完整 TOP N 语法也存在差异，这也是考试中的常见考点。

| DBMS | 语法 |
|---|---|
| Oracle | `ROWNUM <= n`（排序在子查询内），12c 之后使用 `FETCH FIRST n ROWS ONLY` |
| SQL Server | `SELECT TOP (n) ...`，若要包含并列行则需添加 `WITH TIES` |

在 Oracle 中，由于 `ROWNUM` 是在排序之前分配的，因此如果按 `WHERE ROWNUM <= 3 ... ORDER BY` 的顺序编写，得到的并不是排序后的前 3 个。应先在子查询（内联视图）中进行排序，然后在外部截取。`FETCH FIRST n ROWS WITH TIES` 会返回与最后一行并列的行，且需要配合 `ORDER BY` 使用（适用于 Oracle 12c 及更高版本）。

## 层次查询

用于读取组织架构图、菜单、评论等数据中父子关系存在于同一表内的树形顺序数据。Oracle 使用 `CONNECT BY`。

```sql
SELECT last_name, employee_id, manager_id, LEVEL
  FROM employees
  START WITH employee_id = 100
  CONNECT BY PRIOR employee_id = manager_id
  ORDER SIBLINGS BY last_name;
```

| 元素 | 含义 |
|---|---|
| START WITH | 指定根行条件 |
| CONNECT BY | 父子连接条件，其中一侧必须包含 `PRIOR` |
| PRIOR | 指向父行值的运算符 |
| LEVEL | 深度，根节点为 1 |
| NOCYCLE | 即使存在循环也返回行而不是报错（若省略则抛出 ORA-01436） |
| ORDER SIBLINGS BY | 在保持层次结构的同时仅对兄弟节点排序 |
| SYS_CONNECT_BY_PATH(col, '/') | 从根到当前行的路径 |
| CONNECT_BY_ISLEAF | 若无子节点则为 1 |
| CONNECT_BY_ROOT col | 最顶层祖先的值 |

`CONNECT BY PRIOR employee_id = manager_id`表示父员工的 ID 等于子员工的经理 ID，因此是从上到下（正向）遍历。若将 `PRIOR` 放在等式另一侧，则变为从下到上（反向）遍历。遇到方向问题时，首先检查 `PRIOR` 附着在哪一侧。`WHERE` 条件是在构建完整个层次结构后逐行应用的，而使用普通的 `ORDER BY` 或 `GROUP BY` 会破坏层次顺序。

SQL Server 没有 `CONNECT BY`，而是使用递归 CTE。Oracle 文档也推荐使用更灵活的递归 `WITH` 方法。以下是直接在 SQLite 中运行的递归查询示例（组织架构图为虚拟数据）。

```sql
with recursive t(id, name, lvl, path) as (
  select id, name, 1, '/'||name from org where mgr is null
  union all
  select o.id, o.name, t.lvl+1, t.path||'/'||o.name
  from org o join t on o.mgr = t.id)
select * from t order by path;
-- (1,'King',1,'/King') (2,'Kim',2,'/King/Kim') (4,'Park',3,'/King/Kim/Park') (3,'Lee',2,'/King/Lee')
```

第一个 `SELECT` 对应 `START WITH`，第二个 `SELECT` 的联接条件对应 `CONNECT BY`，`lvl` 对应 `LEVEL`，`path` 对应 `SYS_CONNECT_BY_PATH`。

## PIVOT 和 UNPIVOT

`PIVOT` 将行转换为列。由于涉及聚合操作，因此会对未使用的列隐式应用 `GROUP BY`。

```sql
SELECT *
FROM (SELECT product, quarter, amount FROM sales)
PIVOT (
  SUM(amount) FOR quarter IN ('Q1' AS q1, 'Q2' AS q2, 'Q3' AS q3, 'Q4' AS q4)
);
```

`UNPIVOT` 则相反，将列转换为行。默认情况下会排除 `NULL` 行（通过 `EXCLUDE NULLS`）。

```sql
SELECT product, quarter, amount
FROM sales_wide
UNPIVOT (amount FOR quarter IN (q1 AS 'Q1', q2 AS 'Q2', q3 AS 'Q3', q4 AS 'Q4'));
```

在没有 `PIVOT` 语法的数据库管理系统中，或在 `PIVOT` 出现之前使用的另一种方法是结合 `CASE` 语句和聚合函数。SQLD 考试中也会涉及这种方法。以下是直接运行的结果。

```sql
select month,
  sum(case when product='x' then amount end) x,
  sum(case when product='y' then amount end) y
from sales group by month;
-- (1,10,5) (2,20,15) (3,30,NULL)
```

从上述结果可以看出，如果某个条件没有匹配的值，`SUM` 会返回 `NULL`（例如 3 月的 y）。

## 正则表达式

Oracle 的 `REGEXP_LIKE(原串，模式 [, 选项])` 是 `LIKE` 的正则表达式版本，遵循 POSIX 标准。选项为单个字符。

| 选项 | 效果 |
|---|---|
| i | 忽略大小写 |
| c | 区分大小写和重音符号 |
| n | `.` 也匹配换行符 |
| m | `^`、`$` 分别匹配每行的开始和结束 |
| x | 忽略模式中的空白字符 |

```sql
SELECT first_name FROM employees
WHERE REGEXP_LIKE (first_name, '^Ste(v|ph)en$');   -- Steven, Stephen
```

同一系列还包括 `REGEXP_INSTR`、`REGEXP_REPLACE` 和 `REGEXP_SUBSTR`。这些符号本身与普通正则表达式相同（`^` 表示开头，`$` 表示结尾，`|` 表示或，`()` 表示分组）。备考时只需掌握函数名称和基本符号即可。

## 常见易错点

- 窗口函数不能在 `WHERE` 子句中使用，需包裹在子查询中处理。
- `RANK` 会跳过编号，`DENSE_RANK` 不会跳过，而 `ROW_NUMBER` 即使并列也会区分序号。
- `LAG` 的第一行和 `LEAD` 的最后一行返回 `NULL`。
- `PARTITION BY` 并不会合并行。
- 在层次查询中，`PRIOR` 的位置决定了遍历方向。
- Oracle 的 `ROWNUM` 是在排序之前分配的。

初次接触窗口函数时，可能会觉得 `OVER` 子句看起来很复杂，但只要理解上述三个部分分别填入什么内容，就能轻松读懂。

[← 概念图](#/post/sqld-map)

相关文章：[GROUP BY 与集合运算](#/post/sqld-group-set)、[连接与子查询](#/post/sqld-join-subquery)、[SELECT 与函数](#/post/sqld-select-func)、[DML·TCL·DDL 与约束条件](#/post/sqld-dml-ddl)

## 参考链接

- [Oracle Database 19c SQL Language Reference – Analytic Functions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Analytic-Functions.html)
- [Oracle Database 19c SQL Language Reference – Hierarchical Queries](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Hierarchical-Queries.html)
- [Oracle Database 19c SQL Language Reference – SELECT (PIVOT/UNPIVOT)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html)
- [Oracle Database 19c SQL Language Reference – Pattern-matching Conditions (REGEXP_LIKE)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Pattern-matching-Conditions.html)