在信息处理技术员考试中，SQL 并不会要求写出冗长的语法，而是通过展示简短的查询语句来考察结果或分类。因此，关键在于能够区分命令所属的分类、理解不同连接类型对结果行数的影响，以及明确视图和索引各自的作用。下方的代码是使用 Python 内置的 SQLite 直接运行并验证的结果。考试标准采用 Oracle 系语法，对于方言不同的部分会另行说明。此处不列出历年真题原文，仅说明题型。考试时间和报名费用请查阅官方网站。

## 先记忆分类

| 分类 | 命令 | 作用 |
|---|---|---|
| DDL (定义语) | CREATE, ALTER, DROP, TRUNCATE | 创建、修改或删除表、视图、索引等对象的**结构** |
| DML (操作语) | SELECT, INSERT, UPDATE, DELETE | 读取、插入、修改或删除**行** |
| DCL (控制语) | GRANT, REVOKE | 授予或撤销用户权限 |
| TCL (事务控制语) | COMMIT, ROLLBACK, SAVEPOINT | 确认或回滚 DML 的结果 |

考试中询问分类的题目，大多直接考查此表。陷阱在于 **TRUNCATE**：虽然它删除行，看似属于 DML，但实际上被归类为 DDL。此外，DROP 会删除整个表结构，而 DELETE 仅删除行，这一区别常在选项中混淆。

DDL 中的 ALTER 用于添加、修改或删除列。DROP 中附加的 CASCADE 和 RESTRICT 是当存在引用对象时，决定是一起删除还是禁止删除的选项。

关于按分类更详细整理的 SQL 命令文章，请参见 SQLD 专栏：[详情 → DML·TCL·DDL 与约束条件](#/post/sqld-dml-ddl)

## 事务控制要简短

TCL 包含 COMMIT、ROLLBACK 和 SAVEPOINT 三个命令。SAVEPOINT 允许在事务中间设置标记，并仅回滚到该标记处。直接运行验证后的流程如下：

```sql
BEGIN;
DELETE FROM emp WHERE emp_id = 1;
SAVEPOINT a;
DELETE FROM emp WHERE emp_id = 2;
ROLLBACK TO a;   -- 2번 삭제만 취소
COMMIT;          -- 1번 삭제는 확정
-- 남은 행: emp_id 2, 3
```

在 Oracle 中，第一个 DML 语句会自动开启事务，无需 BEGIN；而 SQLite 则需要像上面那样显式使用 BEGIN。关于事务特性（ACID）和并发控制的详细内容，请参见另一篇文章：[详情 → 规范化与事务](#/post/jb-normalization-transaction)

## 示例表

后续的查询均基于以下两个表。其中四名员工中 choi 的部门为 NULL，且人事部门没有员工。

```sql
CREATE TABLE dept(dept_id INTEGER PRIMARY KEY, dname TEXT NOT NULL);
CREATE TABLE emp(emp_id INTEGER PRIMARY KEY, ename TEXT, sal INTEGER,
                 dept_id INTEGER REFERENCES dept(dept_id));
INSERT INTO dept VALUES (10,'영업'),(20,'개발'),(30,'인사');
INSERT INTO emp VALUES (1,'kim',3000,10),(2,'lee',4000,20),
                       (3,'park',5000,20),(4,'choi',2500,NULL);
```

## 连接 (JOIN)

连接是根据条件将两个表的行关联起来。不同连接类型产生的行数数量是考试的考点。

| 类型 | 保留的行 | 上述数据的结果 |
|---|---|---|
| INNER JOIN | 仅保留两边都有匹配的行 | kim, lee, park (3 行) |
| LEFT OUTER JOIN | 保留左边全部，无匹配则为 NULL | 上述 3 行 + choi(部门 NULL) = 4 行 |
| RIGHT OUTER JOIN | 保留右边全部 | 包含人事部门中部门为 NULL 的员工 |
| FULL OUTER JOIN | 保留两边全部 | 两边无匹配的行都会出现 |
| CROSS JOIN | 所有组合 | 4 × 3 = 12 行 |

```sql
SELECT e.ename, d.dname
FROM emp e LEFT OUTER JOIN dept d ON e.dept_id = d.dept_id;
-- choi|NULL, kim|영업, lee|개발, park|개발

SELECT d.dname, e.ename
FROM dept d LEFT JOIN emp e ON e.dept_id = d.dept_id;
-- 인사|NULL 이 포함된다
```

即使是相同的 LEFT JOIN，如果交换表顺序，保留的一侧也会不同。上述两个查询中，第一个保留了 choi，第二个则保留了与人事部门 NULL 匹配的行。RIGHT 和 FULL 可按照上表的说明理解。

此外还会出现其他术语，如通过同名列自动关联的 NATURAL JOIN、对同一表使用两次别名的 SELF JOIN，以及使用非等值条件连接的 NON-EQUI JOIN 等。只需区分这些术语即可。

关于连接和子查询的更详细解析，请参见 SQLD：[详情 → 连接与子查询](#/post/sqld-join-subquery)

## GROUP BY 与 HAVING

先分组并聚合后再加条件的是 **HAVING**，在分组前过滤行的是 **WHERE**。聚合函数不能在 WHERE 中使用。

```sql
SELECT dept_id, COUNT(*), AVG(sal) FROM emp GROUP BY dept_id;
-- NULL|1|2500.0,  10|1|3000.0,  20|2|4500.0

SELECT dept_id, COUNT(*) FROM emp GROUP BY dept_id HAVING COUNT(*) >= 2;
-- 20|2
```

NULL 部门在 GROUP BY 中也被视为一个组。此外，`COUNT(*)` 和 `COUNT(列)` 是不同的。在上述数据中，`COUNT(*)` 结果为 4，而 `COUNT(dept_id)` 结果为 3。如果填入列名，则 NULL 值不会被计数。这一区别常作为计算类问题的考点。

集合运算（UNION, UNION ALL, INTERSECT, EXCEPT）也属于同一范畴。UNION 会去除重复项，而 UNION ALL 则保留所有行。[详情 → 分组与集合运算](#/post/sqld-group-set)

## 子查询与 NULL 陷阱

子查询是括号内的 SELECT 语句。如果返回单行，可与比较运算符连用；如果返回多行，则需使用 IN、ANY、ALL 或 EXISTS。

```sql
SELECT ename FROM emp WHERE sal > (SELECT AVG(sal) FROM emp);
-- lee, park      (평균 3625보다 큰 사원)

SELECT dname FROM dept d
WHERE EXISTS (SELECT 1 FROM emp e WHERE e.dept_id = d.dept_id);
-- 개발, 영업
```

考试中经常遇到的两个陷阱是 `NOT IN` 和 `NULL`。如果子查询结果中包含任何一个 `NULL`，`NOT IN` 将不会返回任何行。

```sql
SELECT dname FROM dept WHERE dept_id NOT IN (SELECT dept_id FROM emp);
-- 결과 없음 (emp.dept_id에 NULL이 있어서)

SELECT dname FROM dept
WHERE dept_id NOT IN (SELECT dept_id FROM emp WHERE dept_id IS NOT NULL);
-- 인사
```

即使人事部门没有任何员工，第一个查询却返回了空结果。这是因为与 `NULL` 的比较既非真也非假，而是 `UNKNOWN`。在这种情况下，使用 `NOT EXISTS` 就不会出现同样的问题。

## 视图

视图是一种给 `SELECT` 语句命名并存储起来的虚拟表。它不单独复制数据，而是在每次查询时从原始表中读取。

```sql
CREATE VIEW v_dev AS SELECT ename, sal FROM emp WHERE dept_id = 20;
SELECT * FROM v_dev;               -- lee 4000, park 5000
UPDATE emp SET sal = 9999 WHERE emp_id = 2;
SELECT * FROM v_dev;               -- lee 9999, park 5000
```

修改了源表后，视图的结果也随之立即改变。考试中关于视图特性的提问通常如下：

| 项目 | 内容 |
|---|---|
| 目的 | 安全（仅暴露可见的列和行）、简化复杂查询、逻辑独立性 |
| 存储 | 仅存储定义（`SELECT` 语句），不存储数据 |
| 删除 | `DROP VIEW`。原始表保持不变 |
| 更新 | 包含连接、聚合或 `DISTINCT` 的视图通常限制更新（SQLite 将视图本身设为只读） |
| 索引 | 一般认为无法在视图上创建索引，这是常见的考试答案 |

<details>
<summary>索引情况因 DBMS 而异</summary>

普通视图不存储数据，因此不是索引对象，这是教材的基本观点。相反，实际存储结果的物化视图（Materialized View）是独立概念，某些 DBMS 支持在其上创建索引。如果考试中仅提到“视图”，应理解为普通视图。
</details>

## 索引

索引是一种辅助结构，通过特定列的值快速定位行。建立索引后查询速度加快，但在 `INSERT`、`UPDATE`、`DELETE` 操作时也需要同步维护索引，因此写入变慢。同时也会占用更多存储空间。

```sql
CREATE INDEX idx_emp_dept ON emp(dept_id);
EXPLAIN QUERY PLAN SELECT * FROM emp WHERE dept_id = 20;
-- SEARCH emp USING INDEX idx_emp_dept (dept_id=?)
```

创建索引之前，数据库采用从头扫描表的方式；创建之后，执行计划显示会利用索引进行查找。考试中常涉及索引对哪些列有效、聚簇与非聚簇的区别、B-Tree 结构等内容。若遇到读取执行计划的题目，只需区分“是否使用了索引”或“是部分扫描还是全表扫描”。

关于物理设计中的索引与分区内容已另行整理。[详情 → DB 物理设计与分布式数据库](#/post/jb-physical-design)；索引结构在 [详情 → 索引](#/post/db-index) 中进一步讨论。

## 约束与完整性

完整性是指防止错误数据进入的规则。考试中需区分实体完整性（主键不能为 `NULL` 且不可重复）、参照完整性（外键必须引用目标表中存在的值或为 `NULL`）以及域完整性（允许的值范围）。

```sql
DELETE FROM dept WHERE dept_id = 20;
-- FOREIGN KEY constraint failed  (emp가 20번 부서를 참조하는 중)
```

尝试删除被外键引用的父行时，会因参照完整性而被阻止。可以通过外键选项设置 `ON DELETE CASCADE`（级联删除子记录）或 `SET NULL`（将子记录的外键设为 `NULL`）。SQLite 需启用 `PRAGMA foreign_keys=ON` 才能执行此类检查。键的类型和关系模型已在 [详情 → 数据库基础与数据模型](#/post/jb-db-concept) 中整理。

## DCL

DCL 包括授权（`GRANT`）和回收（`REVOKE`）两种操作，其语法如下：

```sql
GRANT SELECT, INSERT ON emp TO user1 WITH GRANT OPTION;
REVOKE INSERT ON emp FROM user1;
```

添加 `WITH GRANT OPTION` 后，获得权限的用户可将该权限再次授予他人。此选项常作为单行判断题出现在考试中。由于 SQLite 不支持 `GRANT` 和 `REVOKE`，无法直接执行上述语句，此处仅列出语法形式。

## 常见题型总结

| 类型 | 解题方法 |
|---|---|
| 命令分类选择 | 通过 DDL/DML/DCL/TCL 表格快速判断；`TRUNCATE` 属于 DDL |
| 连接结果行数 | 观察以哪一方为基准，检查是否有未匹配的剩余行 |
| `GROUP BY` 结果 | 先通过 `WHERE` 过滤，再分组，最后用 `HAVING` 过滤 |
| `COUNT` 计算 | `COUNT(*)` 统计所有行；`COUNT(列)` 排除 `NULL` 值 |
| 子查询结果 | 先求解内部查询结果，再代入外部查询 |
| 视图/索引描述选择 | 视图是虚拟的，仅存储定义 / 索引提升读取速度但降低写入速度 |

涉及结果的问题，最稳妥的方法是画出数据表并逐步手动追踪。建议先手动推演上述示例再进行练习。

← [概念地图](#/post/jb-map)

相关文章：[规范化与事务](#/post/jb-normalization-transaction) · [DB 物理设计与分布式数据库](#/post/jb-physical-design) · [数据库基础与数据模型](#/post/jb-db-concept)

## 参考链接

- SQLite SAVEPOINT 文档：https://www.sqlite.org/lang_savepoint.html
- SQLite CREATE VIEW 文档（在 SQLite 中，视图为只读）：https://www.sqlite.org/lang_createview.html
- 直接运行：已在 Python 3 内置 sqlite3（SQLite 3.50.4）中验证了本文的查询结果。