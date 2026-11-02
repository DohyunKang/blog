SQL 命令根据其功能被分为不同的类别：对行进行插入、修改和删除属于 DML，确认或回滚这些更改属于 TCL，而创建、修改或删除表本身则属于 DDL。考试中通常会先询问这种分类，然后再问各个命令之间的区别。

## 首先了解分类

| 分类 | 名称 | 命令 | 功能 |
|---|---|---|---|
| DML | 数据操纵语言 | SELECT, INSERT, UPDATE, DELETE, MERGE | 读取和修改行 |
| DDL | 数据定义语言 | CREATE, ALTER, DROP, RENAME, TRUNCATE | 处理如表等对象的结构 |
| DCL | 数据控制语言 | GRANT, REVOKE | 授予/撤销权限 ([详情 → DCL](#/post/sqld-dcl-procedure)) |
| TCL | 事务控制语言 | COMMIT, ROLLBACK, SAVEPOINT | 确认或回滚 DML 的结果 |

容易混淆的是 TRUNCATE。虽然它删除行，看似属于 DML，但其分类实际上是 DDL。这一条是考试中常见的陷阱，需要单独记忆。

下面的示例使用 Python 内置的 SQLite 直接运行并检查结果。由于 SQLite 的方言略有不同，与作为考试基准的 Oracle 语法不同的部分会在当时说明。

## DML: INSERT, UPDATE, DELETE

我们先创建如下表并开始操作。约束条件稍后说明。

```sql
CREATE TABLE dept(dept_id INTEGER PRIMARY KEY, dname TEXT NOT NULL UNIQUE);
CREATE TABLE emp(
  emp_id  INTEGER PRIMARY KEY,
  ename   TEXT NOT NULL,
  sal     INTEGER DEFAULT 3000 CHECK(sal >= 0),
  dept_id INTEGER REFERENCES dept(dept_id)
);
INSERT INTO dept VALUES (10,'영업'), (20,'개발');
INSERT INTO emp(emp_id, ename, dept_id) VALUES (1,'kim',10);
```

INSERT 时填写列名更为安全。如果省略列名，则必须按表定义顺序全部填充；否则若列数增加会导致错误。在上述 INSERT 中未指定 sal，因此进入了 DEFAULT 值 3000（`[(1, 'kim', 3000, 10)]`）。

UPDATE 的关键在于 WHERE 子句。如果没有 WHERE，所有行都会被修改。执行仅将开发部门薪资提升 500 的语句后，结果如下：

```sql
UPDATE emp SET sal = sal + 500 WHERE dept_id = 20;
-- (1, 3000), (5, 2500)  ← 5번 사원(원래 2000)만 올랐다
```

DELETE 也是如此。如果没有 WHERE，所有行都会被删除。此外，若尝试删除被子行引用的父行（如销售部门），则会因外键约束而失败。在 SQLite 中，需启用 `PRAGMA foreign_keys=ON` 才能触发此限制（默认是关闭的）。

<details>
<summary>常见题型：使用子查询的 UPDATE·INSERT</summary>

- `UPDATE ... SET 列 = (子查询)`：子查询必须返回一行和一个值；若返回多行则报错。
- `INSERT INTO A SELECT ... FROM B`：代替 VALUES，直接插入 SELECT 的结果集。列数量和类型必须匹配。
- 考试中常问“执行后有多少行被修改”或“哪里会出错”，因此需要练习手动统计 WHERE 条件匹配的行数。
</details>

## MERGE

MERGE 命令可以在一行语句中实现：存在则 UPDATE，不存在则 INSERT。它根据 ON 条件匹配源（USING）和目标（INTO），匹配的行列由 `WHEN MATCHED` 处理，不匹配的则由 `WHEN NOT MATCHED` 处理。Oracle 文档中的示例如下：

```sql
MERGE INTO people_target pt
USING people_source ps
ON (pt.person_id = ps.person_id)
WHEN MATCHED THEN UPDATE
  SET pt.first_name = ps.first_name, pt.last_name = ps.last_name, pt.title = ps.title
WHEN NOT MATCHED THEN INSERT
  (pt.person_id, pt.first_name, pt.last_name, pt.title)
  VALUES (ps.person_id, ps.first_name, ps.last_name, ps.title);
```

根据文档需掌握三点：UPDATE 子句或 INSERT 子句中必须有一个；ON 子句中使用的列不能通过 UPDATE 修改；同一目标行不能在单次 MERGE 中被更新两次。

SQLite 没有 MERGE 命令，但提供功能类似的 UPSERT。向已存在的键（emp_id=1）插入时，会执行 UPDATE 操作。

```sql
INSERT INTO emp VALUES (1,'kim2',9,10)
ON CONFLICT(emp_id) DO UPDATE SET ename = excluded.ename, sal = excluded.sal;
-- (1, 'kim2', 9, 10)
```

## TCL：事务

事务是“要么全部成功，要么全部失败”的工作单元。例如在转账操作中，若只完成取款而未完成存款，则整个操作无效，因此将两者视为一个整体。更深入的讨论可参考 [详情 → 事务](#/post/db-transaction)。

- COMMIT：确认当前所有 DML 操作。
- ROLLBACK：取消自上次 COMMIT 以来的所有更改。
- SAVEPOINT：创建中间保存点，并通过 `ROLLBACK TO 名称` 回滚到该点。

以下是实际运行结果：

```sql
BEGIN;
DELETE FROM emp;           -- count(*) = 0
ROLLBACK;                  -- count(*) = 2, 다시 살아났다

BEGIN;
UPDATE emp SET sal = 1 WHERE emp_id = 1;
SAVEPOINT a;
UPDATE emp SET sal = 2 WHERE emp_id = 1;
ROLLBACK TO a;             -- sal을 2로 바꾼 것만 취소
COMMIT;                    -- 결과 sal = 1
```

考试中常出现类似“在 SAVEPOINT 之后执行 ROLLBACK TO 会保留到哪一步”的顺序问题。只需记住：仅取消保存点之后的更改，其之前的更改会被保留，即可解题。

<details>
<summary>事务特性（ACID）与 DDL 的自动提交</summary>

- 原子性 (Atomicity)：要么全部生效，要么全部回滚。
- 一致性 (Consistency)：执行前后数据库规则（约束条件）保持不变。
- 隔离性 (Isolation)：并发执行的事务无法看到彼此的中间状态。
- 持久性 (Durability)：一旦 COMMIT，即使发生故障结果也会保留。
- 在 Oracle 中，DDL 语句执行时会立即自动 COMMIT，因此如果在 DML 之后执行 DDL，前面的 DML 也会被确认。考试中关于“是否会发生 ROLLBACK"的题目常涉及这一点。
</details>

## DDL：CREATE, ALTER, DROP, TRUNCATE

CREATE 前面已经介绍过了。ALTER 用于在创建后修改结构，例如添加列如下所示：

```sql
ALTER TABLE emp ADD COLUMN email TEXT;   -- 열: emp_id, ename, sal, dept_id, email
```

Oracle 中使用 `ADD`、`MODIFY`（修改类型或大小）、`DROP COLUMN`、`RENAME COLUMN` 等形式；而 SQLite 支持范围不同，因此像上面那样使用 `ADD COLUMN` 进行确认。

考试中常考的是三种删除操作的差异：

| 命令 | 分类 | 删除对象 | 是否可回滚 | 条件 (WHERE) |
|---|---|---|---|---|
| DELETE | DML | 行（选择性） | 可以（COMMIT 前） | 支持 |
| TRUNCATE | DDL | 所有行（保留结构） | 不可 | 不支持 |
| DROP | DDL | 表本身 | 不可 | 不适用 |

Oracle 文档中也指出，TRUNCATE 无法回滚，也无法通过 FLASHBACK TABLE 恢复。与删除表后重新创建不同，权限、索引和约束条件会保留。而 DROP 则会彻底移除表定义，执行 `DROP TABLE emp` 后，emp 会从 schema 列表中消失。

## 约束条件

这是数据库用来阻止非法值输入的规则。我在上面的表中故意输入了错误值，观察产生了什么错误。

| 约束条件 | 含义 | 尝试的输入 | 结果 |
|---|---|---|---|
| NOT NULL | 禁止空值 | ename 为 NULL | 拒绝 |
| PRIMARY KEY | 禁止重复和 NULL，代表行 | emp_id=1 出现两次 | 拒绝（违反 UNIQUE） |
| UNIQUE | 禁止重复（允许 NULL） | dname '영업' 出现两次 | 拒绝 |
| CHECK | 必须满足条件 | sal = -1 | 拒绝 |
| FOREIGN KEY | 只允许父表中存在的值 | 不存在的 dept_id=99 | 拒绝 |
| DEFAULT | 未提供值时使用默认值 | sal 省略 | 3000 |

严格来说，DEFAULT 不是规则而是默认值，但通常一起记忆。常见考点包括：PRIMARY KEY 是 UNIQUE 和 NOT NULL 的组合；一个表只能有一个 PK，但可以定义多个 UNIQUE 约束。外键所引用的标识符概念将在 [详细 → 关系与标识符](#/post/sqld-relation-identifier) 中继续讲解。

<details>
<summary>外键与删除选项</summary>

当删除父行且存在子行时，默认会阻止操作（即前面删除营业部门被阻止的原因）。可以通过选项改变行为：

- `ON DELETE CASCADE`：删除父表时同时删除子表。
- `ON DELETE SET NULL`：将子表的外键列设为 NULL。
- 相反地，当 DROP 父表时，如果仍有子表引用该表，通常也会阻止操作。
</details>

## 常见误解

- “TRUNCATE 是 DELETE 的快速版本，属于 DML。”实际上它属于 DDL，且不可回滚。
- “UNIQUE 列不能插入 NULL。”不能插入 NULL 的是 PRIMARY KEY。
- “UPDATE 不加 WHERE 会报错。”不会报错，而是更新所有行。
- “ROLLBACK 也能撤销 DDL。”在 Oracle 中，由于 DDL 自动确认，无法回滚。

SELECT 相关的函数和条件详见 [详细 → SELECT 与函数](#/post/sqld-select-func)，整体流程请参考 map。

← [概念图](#/post/sqld-map)

相关文章：[DCL 与过程化 SQL](#/post/sqld-dcl-procedure) · [事务](#/post/db-transaction) · [关系与标识符](#/post/sqld-relation-identifier)

## 参考链接

- Oracle 数据库 SQL 语言参考，MERGE：https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/MERGE.html
- Oracle 数据库 SQL 语言参考，TRUNCATE TABLE：https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TRUNCATE-TABLE.html