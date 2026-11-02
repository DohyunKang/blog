在 SQLD 中，连接（JOIN）和子查询是 SQL 应用课程的重要组成部分。连接是将多个表横向拼接在一起的语法，而子查询是在查询语句内部嵌套另一个查询的语法。这两者经常出现在“该查询结果会返回多少行”这类问题中。下面的示例全部使用 Python SQLite (3.50.4) 运行并验证了结果。SQLD 考试环境可在官方网站上查看，由于不同方言的语法略有差异，请以官方指南为准确定考试范围。

## 示例表

共有 3 个部门和 5 名员工。员工“正”没有部门（NULL），而“人事”部门没有员工。这两行数据几乎展示了连接和子查询问题的所有陷阱。

```sql
CREATE TABLE dept(dept_id INTEGER PRIMARY KEY, dname TEXT);
CREATE TABLE emp(emp_id INTEGER PRIMARY KEY, ename TEXT, sal INTEGER,
                 dept_id INTEGER, mgr_id INTEGER);
INSERT INTO dept VALUES (10,'영업'),(20,'개발'),(30,'인사');
INSERT INTO emp VALUES (1,'김',500,10,NULL),(2,'이',300,10,1),
  (3,'박',400,20,1),(4,'최',200,20,3),(5,'정',350,NULL,3);
```

```
dept: 10 영업 / 20 개발 / 30 인사
emp : 김(500,10) 이(300,10) 박(400,20) 최(200,20) 정(350,NULL)
      관리자(mgr_id): 이·박→김, 최·정→박
```

## 连接类型

| 类型 | 结果 | 示例行数 |
|---|---|---|
| INNER JOIN | 仅保留两边都满足条件的行 | 4 |
| LEFT OUTER JOIN | 左边全部保留，右边无匹配则为 NULL | 5 |
| RIGHT OUTER JOIN | 右边全部保留，左边无匹配则为 NULL | 5 |
| FULL OUTER JOIN | 两边全部保留 | 6 |
| CROSS JOIN | 无条件的所有组合（笛卡尔积） | 15 |
| SELF JOIN | 将同一表用作两个别名 | 5 |

PostgreSQL 文档也采用相同的分类进行说明。仅使用 `JOIN` 时默认为 INNER，可以省略 `OUTER`。基本概念详见 [详情 → 关系型数据库与 SQL 基础](#/post/db-rdb-sql)。

### INNER JOIN

```sql
SELECT e.ename, d.dname
FROM emp e INNER JOIN dept d ON e.dept_id = d.dept_id;
```

```
김 영업 / 이 영업 / 박 개발 / 최 개발
```

由于“正”的部门为 NULL 导致无匹配而被排除，“人事”也因没有员工而被排除。统计这些消失的行数是解决 INNER JOIN 问题的核心。

### OUTER JOIN

```sql
SELECT e.ename, d.dname
FROM emp e LEFT OUTER JOIN dept d ON e.dept_id = d.dept_id;
```

```
김 영업 / 이 영업 / 박 개발 / 최 개발 / 정 NULL
```

左边（emp）全部保留，无匹配的“正”的部门被填充为 NULL。如果交换表顺序使用 `dept d LEFT JOIN emp e`，则“人事”会被保留而员工变为 NULL。RIGHT 只是 LEFT 的方向相反，因此在考试中应先判断“哪一边是基准（即全部保留的那一边）”。FULL OUTER 保留了两边未匹配的行，在上述示例中产生了 6 行（包含“正-NULL"和“人事-NULL"）。

SQLite 从版本 3.39.0 开始支持 RIGHT 和 FULL。官方文档中列出了语法图表，旧版本会拒绝这些语句。

### CROSS JOIN

```sql
SELECT COUNT(*) FROM emp CROSS JOIN dept;   -- 15
```

5 行 × 3 行 = 15 行。由于没有条件，因此产生所有组合。即使像 `FROM emp, dept` 那样用逗号书写并在 WHERE 子句中遗漏连接条件，也会得到相同的结果，这往往是导致“行数突然爆炸”问题的原因。

### SELF JOIN

```sql
SELECT e.ename, m.ename AS mgr
FROM emp e LEFT JOIN emp m ON e.mgr_id = m.emp_id;
```

```
김 NULL / 이 김 / 박 김 / 최 박 / 정 박
```

由于使用了两次同一表，别名（e, m）是必需的。没有别名的话无法区分哪一列属于哪个表。这种语法常用于表达层级结构（如员工 - 经理）。最上层的“金”因为没有经理，如果使用 INNER JOIN 会被排除，而使用 LEFT JOIN 则会被保留。

### ON, USING, NATURAL

有三种方法用于指定连接条件。

| 方式 | 含义 | 注意事项 |
|---|---|---|
| `ON a.x = b.y` | 任意条件 | 最通用 |
| `USING (x)` | 使用两个表中名称相同的列 x 进行连接 | 结果中 x 只出现一次 |
| `NATURAL JOIN` | 自动基于所有同名列进行连接 | 增加列会悄悄改变连接条件 |

PostgreSQL 文档特别警告 NATURAL 的危险性。因为模式（schema）发生变化时，连接列可能会悄无声息地增加。

<details>
<summary>OUTER JOIN 中 ON 和 WHERE 不同的原因</summary>

在 INNER JOIN 中，无论将条件写在 ON 还是 WHERE 子句中，结果都是一样的。但在 OUTER JOIN 中则会有所不同。ON 是在连接之前应用的，因此未匹配的行会以 NULL 保留；而 WHERE 是在连接之后应用的，会过滤掉那些被填充为 NULL 的行。我们在两个位置都尝试了相同的“薪资 >= 400"条件。

```sql
-- ON에 조건
SELECT d.dname, e.ename FROM dept d
LEFT JOIN emp e ON e.dept_id = d.dept_id AND e.sal >= 400;
-- 영업 김 / 개발 박 / 인사 NULL   (3행)

-- WHERE에 조건
SELECT d.dname, e.ename FROM dept d
LEFT JOIN emp e ON e.dept_id = d.dept_id
WHERE e.sal >= 400;
-- 영업 김 / 개발 박               (2행)
```

“人事”在 WHERE 一侧消失了。因为 `NULL >= 400` 并非真值，所以被过滤掉了。最终，如果在 WHERE 子句中对右侧表施加条件，LEFT JOIN 的行为就会变得像 INNER JOIN。考试中经常通过行数来询问这种差异。

</details>

## 子查询类型

子查询是用括号括起来的 SELECT 语句。根据放置位置和返回的行数进行分类。

| 位置 | 名称 | 示例 |
|---|---|---|
| SELECT 子句 | 标量子查询 | 为每位员工获取一个部门的名称 |
| FROM 子句 | 内联视图 | 将子查询结果像临时表一样使用 |
| WHERE 子句 | 嵌套子查询 | 与 IN、比较运算符、EXISTS 一起使用 |

| 返回行数 | 可使用的运算符 |
|---|---|
| 单行 | `=`, `>`, `<` 等 |
| 多行 | `IN`, `ANY`(SOME), `ALL`, `EXISTS` |

如果单行子查询返回了多行，则会报错。这种组合在考试中经常出现。

### 单行与多行

```sql
-- 평균 급여보다 많이 받는 사람 (단일 행)
SELECT ename FROM emp WHERE sal > (SELECT AVG(sal) FROM emp);   -- 김, 박

-- 개발 부서 소속 (다중 행 가능)
SELECT ename FROM emp
WHERE dept_id IN (SELECT dept_id FROM dept WHERE dname = '개발'); -- 박, 최
```

平均值为 (500+300+400+200+350)/5 = 350，因此只有金和朴符合条件。'郑'的值为 350，与平均值相等，所以不满足 `>` 条件。边界值在题目中经常被考查。

基于 PostgreSQL 文档，`IN` 等同于 `= ANY`，而 `NOT IN` 等同于 `<> ALL`。只要有一个为真，`ANY` 即为真；只有全部为真，`ALL` 才为真。当子查询结果为空时，`ANY` 为假，`ALL` 为真。（注：SQLite 不支持 `> ALL` 和 `> ANY`，因此本文未进行演示，相关概念直接取自文档。）

### 内联视图与标量子查询

```sql
SELECT d.dname, t.avg_sal
FROM dept d
JOIN (SELECT dept_id, AVG(sal) AS avg_sal FROM emp GROUP BY dept_id) t
  ON d.dept_id = t.dept_id;
-- 영업 400.0 / 개발 300.0
```

FROM 子句中的子查询需在括号后添加别名（t）。标准 SQL 要求使用别名，PostgreSQL 虽允许省略但建议加上。此时，'郑'的 NULL 组在 GROUP BY 中会被归为一组，但在 JOIN 中因无匹配对而消失。

```sql
SELECT ename, (SELECT dname FROM dept d WHERE d.dept_id = e.dept_id) AS dname
FROM emp e;
-- 김 영업 / 이 영업 / 박 개발 / 최 개발 / 정 NULL
```

标量子查询必须只返回一行一列。从结果来看，它类似于 LEFT JOIN。同样地，若无匹配对，则会返回 NULL。

### 相关子查询

这是一种在内部引用外部查询列的子查询。对于外部的每一行，内部都会被重新计算。

```sql
-- 자기 부서 평균보다 급여가 높은 사람
SELECT ename, sal, dept_id FROM emp e
WHERE sal > (SELECT AVG(sal) FROM emp WHERE dept_id = e.dept_id);
-- 김 500 10 / 박 400 20
```

销售平均值为 400，开发平均值为 300。只有金（500）和朴（400）超过了各自部门的平均值。'郑'的部门为 NULL，因此 `dept_id = NULL` 不成立，子查询返回 NULL，比较结果也被过滤掉。

区分方法很简单：如果子查询内部能看到外部别名（e.），则为相关子查询；否则若可以单独执行内部部分，则为非相关子查询。

### EXISTS、IN 以及 NOT IN 的陷阱

```sql
-- 사원이 없는 부서
SELECT dname FROM dept d
WHERE NOT EXISTS (SELECT 1 FROM emp e WHERE e.dept_id = d.dept_id);   -- 인사

SELECT dname FROM dept WHERE dept_id NOT IN (SELECT dept_id FROM emp);  -- 결과 0행!
```

第二个查询返回 0 行，原因是 `emp.dept_id` 中存在 NULL（即'郑'）。PostgreSQL 文档中也有同样的说明：如果子查询中包含 NULL 且没有匹配的行，`NOT IN` 的结果不是假，而是 NULL；而在 WHERE 子句中，NULL 不被视为真，因此所有行都会被过滤掉。如果在子查询中去除 NULL，结果就会恢复正常。

```sql
SELECT dname FROM dept
WHERE dept_id NOT IN (SELECT dept_id FROM emp WHERE dept_id IS NOT NULL);  -- 인사
```

| | EXISTS | IN |
|---|---|---|
| 条件 | 子查询是否至少返回一行 | 值是否在列表中 |
| 子查询 SELECT 列表 | 通常为 `SELECT 1`，具体值无关紧要 | 必须是单列 |
| NULL 的影响 | 几乎无影响 | 在 `NOT IN` 中是致命的 |

EXISTS 的行为类似于 JOIN（参考 PostgreSQL 文档），但每行外部数据最多只出现一次。在一对多关系中，使用 JOIN 会导致行数增加，而 EXISTS 则不会。至于使用 JOIN 还是子查询来实现相同结果，可根据是否产生重复行来决定。

<details>
<summary>考试中常考的陷阱总结</summary>

- 无别名的 SELF JOIN 会报错。
- 在 OUTER JOIN 中若将右侧表的条件放在 WHERE 子句中，则会退化为 INNER JOIN。
- 逗号连接（隐式 JOIN）若缺少连接条件，会产生笛卡尔积，导致 N×M 行。
- 单行运算符（`=`）后的子查询若返回多行，会报错。
- 如果 `NOT IN` 的子查询结果中包含 NULL，则结果为空。EXISTS 不受此影响。
- 标量子查询必须只返回一行一列。
- 内联视图需要添加别名。

</details>

## 视图

视图是将 SELECT 语句赋予名称并保存下来的结构。它并非复制数据，而是保存查询定义，每次查询时都会执行该查询。

```sql
CREATE VIEW v_dev AS
SELECT e.ename, e.sal FROM emp e
JOIN dept d ON d.dept_id = e.dept_id WHERE d.dname = '개발';

SELECT * FROM v_dev;   -- 박 400 / 최 200
```

| 使用原因 | 说明 |
|---|---|
| 隐藏复杂 JOIN | 避免每次都编写冗长的查询，只需引用一个名称 |
| 访问限制 | 仅显示部分列或行，以便授予权限 |
| 查询重用 | 在多处复用相同的 JOIN 逻辑 |

考试中常出现类似“视图不拥有独立数据”、“删除视图不会影响原表”等描述。视图的定义语法将在 [详细 → DML·TCL·DDL 与约束](#/post/sqld-dml-ddl) 中继续介绍。视图是否可更新因数据库管理系统而异，本文未进行演示。

## 解题步骤

遵循以下顺序处理 JOIN 问题，几乎都能解决：

1. 确定哪个表是基准表（即全部保留的表）。
2. 找出在 JOIN 条件中没有匹配对的行（包括 NULL）。
3. 若是 INNER JOIN，则删除这些行；若是 OUTER JOIN，则用 NULL 填充。
4. 检查 WHERE 子句是否过滤了被填充 NULL 的行。
5. 若存在 GROUP BY 或聚合函数，则最后进行计算。

对于子查询问题，可以认为其从内向外执行，仅针对相关子查询，逐行对外层进行赋值。遇到 `NOT IN` 时，首先检查子查询中是否存在 NULL。类似的聚合与集合运算可参考 [GROUP BY 与集合运算](#/post/sqld-group-set)，前一个单元可继续学习 [SELECT 与函数](#/post/sqld-select-func)。练习可直接通过解决 프로그래머스 SQL 高分 Kit 中的 JOIN 和 SELECT 问题来完成。

---

← [概念 map](#/post/sqld-map)

相关文章：[GROUP BY 与集合运算](#/post/sqld-group-set) · [窗口函数与高级 SQL](#/post/sqld-window-advanced) · [关系型数据库与 SQL 基础](#/post/db-rdb-sql)

## 参考链接

- SQLite SELECT 文档：https://www.sqlite.org/lang_select.html
- PostgreSQL 文档，表表达式（JOIN）：https://www.postgresql.org/docs/current/queries-table-expressions.html
- PostgreSQL 文档，子查询表达式：https://www.postgresql.org/docs/current/functions-subquery.html