这是 SQLD 第二门课程（SQL 基础及应用）的第一个单元。SELECT 的书写顺序与执行顺序不同，题目通常就围绕这两者的差异以及 NULL 展开。概念虽然简单，但能准确得出结果的题目很多，因此我附带了实际运行验证的结果。

考试时间和报名费用可以在官方网站上确认。本文仅涵盖单元核心内容和常见题型。关于数据建模的部分，请参见 [详细 → 理解数据建模](#/post/sqld-modeling)。

## 书写顺序与执行顺序

SELECT 语句的写法如下：

```
SELECT 열 → FROM 테이블 → WHERE 조건 → GROUP BY → HAVING → ORDER BY
```

而执行过程则有所不同。根据 SQL Server 文档整理的逻辑处理顺序为：FROM、ON、JOIN、WHERE、GROUP BY、HAVING、SELECT、DISTINCT、ORDER BY、TOP。文档补充说明，实际的物理执行顺序由优化器决定，可能会有所不同。考试中询问的仅限于上述逻辑顺序。

在此顺序下存在直接适用的规则：

| 情况 | 原因 |
|---|---|
| WHERE 中不能使用 SELECT 的别名 | 别名是在 SELECT 阶段生成的，而 WHERE 在其之前 |
| ORDER BY 中可以使用别名 | ORDER BY 位于 SELECT 之后 |
| WHERE 中不能使用聚合函数 | 分组是在 WHERE 之后创建的。分组条件应使用 HAVING |

HAVING 和聚合运算将在 [详细 → GROUP BY 与集合运算](#/post/sqld-group-set) 中单独讲解。

## WHERE 与运算符

比较运算符包括 `=, <>, <, >, <=, >=`，范围、列表和模式匹配如下所示：

| 运算符 | 含义 |
|---|---|
| BETWEEN a AND b | a 到 b 之间（包含两端值） |
| IN (a, b, c) | 等于列表中的某一个，等同于用 OR 连接的条件 |
| LIKE | 模式匹配。`%` 代表零个或多个字符，`_` 代表恰好一个字符 |
| IS NULL / IS NOT NULL | 判断是否为 NULL |

LIKE 的区分大小写规则以 Oracle 文档为准，且 `ESCAPE` 指定的字符后的 `%` 或 `_` 被视为普通字符。例如 `LIKE '_a%'` 匹配第二个字符为 'a' 的值。在下方的示例数据中，`'Park'` 符合条件。

逻辑运算符的优先级顺序为：NOT、AND、OR。由于 AND 优先于 OR 结合，若不加括号，解读结果可能与预期不符。以下两个查询虽然结果相同，但解读方式不同：

```
WHERE sal >= 300 AND dept = 'A' OR dept = 'B'     -- (sal>=300 AND dept='A') OR dept='B'
WHERE sal >= 300 AND (dept = 'A' OR dept = 'B')   -- 괄호가 있으면 이쪽
```

题目中可能会给出产生相同结果的偶然数据，因此不能只看结果，而应根据结合顺序进行分析，这样更为稳妥。

## NULL 是最容易出错的地方

NULL 表示没有值，既不是 0 也不是空字符串。涉及 NULL 的比较和运算结果几乎总是 NULL（未知）。下方的示例是在 SQLite 中实际运行验证的。

<details>
<summary>示例表（在 SQLite 中运行以验证）</summary>

```sql
create table emp(id int, name text, dept text, sal int, comm int);
insert into emp values
 (1,'Kim','A',300,null),
 (2,'Lee','A',250,50),
 (3,'Park','B',400,null),
 (4,'Choi',null,200,0),
 (5,'Jung','B',350,100);
```

</details>

以下是基于上述表运行的结果：

| 查询 | 结果 |
|---|---|
| `WHERE comm = NULL` | 0 行 |
| `WHERE comm IS NULL` | 2 行（id 1, 3） |
| `SELECT sal + comm` | id 1, 3 为 NULL，其余为数值 |
| `COUNT(*)`, `COUNT(comm)` | 5, 3 |
| `AVG(comm)` | 50.0（0, 50, 100 的平均值。NULL 行被忽略） |
| `WHERE dept <> 'A'` | id 3, 5（dept 为 NULL 的 id 4 被排除） |
| `WHERE dept NOT IN ('A', NULL)` | 0 行 |

总结如下：

- 比较运算中包含 NULL 时，结果既非真也非假，而是“未知”，因此该行会被过滤。所以 `= NULL` 永远返回 0 行，必须使用 `IS NULL`。
- 涉及 NULL 的算术运算结果为 NULL。
- `COUNT(*)` 统计行数，而 `COUNT(列)` 和 `AVG` 会跳过 NULL。在求和与平均问题中，这一差异经常出现。
- 如果 `NOT IN` 列表中包含一个 NULL，则不会返回任何行。这是当子查询结果中包含 NULL 时常见的陷阱。

## NULL 处理函数

| 函数 | 行为 |
|---|---|
| NVL(a, b) | 若 a 为 NULL 则返回 b，否则返回 a（Oracle） |
| COALESCE(a, b, c, ...) | 返回第一个非 NULL 的值。这是标准 SQL。 |
| NULLIF(a, b) | 若 a 与 b 相等则返回 NULL，否则返回 a |

NVL 是 Oracle 函数，而 COALESCE 可以用多个参数实现相同的功能。NULLIF 等同于 `CASE WHEN a = b THEN NULL ELSE a END`。常见的用途是避免除以零的情况。例如使用 `total / NULLIF(cnt, 0)`，当 cnt 为 0 时结果为 NULL。

以下是上述示例表的查询结果：

```sql
select id, sal + coalesce(comm, 0) from emp order by id;
-- (1,300) (2,300) (3,400) (4,200) (5,450)

select id, nullif(comm, 0) from emp order by id;
-- (1,None) (2,50) (3,None) (4,None) (5,100)
```

## 字符串与数字函数

考试中会出现直接询问结果值的问题，因此必须准确理解参数的含义。

| 函数 | 说明 |
|---|---|
| UPPER / LOWER | 大写 / 小写 |
| LENGTH | 字符数 |
| SUBSTR(字符串，起始位置，长度) | 从起始位置开始截取指定长度；省略长度则截取至末尾 |
| REPLACE(字符串，查找值，替换值) | 替换 |
| ROUND(数字，n) | 四舍五入到 n 位小数；若 n 为负数，则表示小数点左侧的位数 |
| ABS, MOD | 绝对值，取余 |

SUBSTR 在 Oracle 文档中规定：起始位置为 0 时视为 1；若为负数，则从字符串末尾向前计数。例如 `SUBSTR('ABCDEFG', -5, 4)` 的结果为 `CDEF`。

ROUND 函数中负数的 n 表示小数点左侧的位数。根据 Oracle 文档示例，`ROUND(15.193, -1)` 的结果为 20。对于负数值，是先对绝对值进行四舍五入再添加符号，因此 `ROUND(-15.193, -1)` 的结果为 -20。

## 日期函数

日期相关操作大多基于 Oracle 标准。需要重点确认的是 `ADD_MONTHS(日期，n)`：它返回 n 个月后的日期；若起始日期为该月的最后一天，或结果月份中不存在该日期，则返回结果月份的最后一天。例如，1 月 31 日加 1 个月后变为 2 月的最后一天。这一“月末规则”在考试中容易成为陷阱。

日期格式转换（`TO_CHAR`、`TO_DATE`）主要依赖记忆格式字符串，只需查阅一次文档中的格式元素表即可掌握。

## CASE

条件分支有两种形式：

```sql
select id,
  case when sal >= 350 then 'H' when sal >= 250 then 'M' else 'L' end
from emp order by id;
-- (1,'M') (2,'M') (3,'H') (4,'L') (5,'H')

select id, case dept when 'A' then 1 when 'B' then 2 end
from emp order by id;
-- (1,1) (2,1) (3,2) (4,None) (5,2)
```

上方示例中，条件表达式从上到下依次判断，一旦遇到第一个为真的条件即停止执行，因此必须将 `sal >= 350` 放在前面。若顺序颠倒，则 400 也会被归类为 M。下方示例是简单的 CASE 语句，仅比较单个值；若所有条件均不匹配且未提供 ELSE 子句，则返回 NULL。例如 dept 为 NULL 的 id 4 即属于此类情况。此外需注意，简单 CASE 使用 `=` 进行比较，因此无法匹配 NULL 值。

## 常见题型

- 给出查询语句，询问结果行数或数值：需追踪 NULL 行被排除的位置。
- 因执行顺序导致错误的查询：如在使用 WHERE 子句时引用别名，或将聚合函数用于 WHERE 条件中。
- `NOT IN` 与 NULL 的组合、`= NULL` 的比较。
- AND/OR 优先级影响 WHERE 子句结果的情况。
- 向函数传入参数后的输出（SUBSTR、ROUND、NVL、ADD_MONTHS）。

解题步骤：先通过 FROM 和 WHERE 筛选行，再查看 SELECT 中计算的表达式；若存在 NULL，需逐行单独评估。

← 概念图 ([SQLD map](#/post/sqld-map))

相关文章：[深入 → 连接与子查询](#/post/sqld-join-subquery) · [深入 → GROUP BY 与集合运算](#/post/sqld-group-set) · [深入 → 关系型数据库与 SQL 基础](#/post/db-rdb-sql)

## 参考资料

- [SELECT (Transact-SQL) — Microsoft Learn (逻辑处理顺序)](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql)
- [Oracle NVL](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/NVL.html)
- [Oracle NULLIF](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/NULLIF.html)
- [Oracle LIKE 条件](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Pattern-matching-Conditions.html)
- [Oracle SUBSTR](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SUBSTR.html)
- [Oracle ROUND(number)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ROUND-number.html)
- [Oracle ADD_MONTHS](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ADD_MONTHS.html)