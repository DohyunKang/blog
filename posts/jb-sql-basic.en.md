In the Information Processing Technician exam, SQL questions do not require writing long syntax; instead, they present short queries and ask you to identify the result or classification. Therefore, you only need to distinguish what type of command each statement is, how the number of rows in the result differs for each join type, and the purpose of views versus indexes. The following queries were executed directly using SQLite included in Python to verify the results. Note that the exam standard follows Oracle syntax; dialect-specific differences are noted separately. Original questions are not reproduced here; only the question types are described. Check the exam schedule and registration fees on the official website.

## Memorize the Classifications First

| Classification | Command | Function |
|---|---|---|
| DDL (Data Definition Language) | CREATE, ALTER, DROP, TRUNCATE | Create, modify, or delete the structure of objects such as tables, views, and indexes |
| DML (Data Manipulation Language) | SELECT, INSERT, UPDATE, DELETE | Read, insert, modify, or delete rows |
| DCL (Data Control Language) | GRANT, REVOKE | Grant or revoke user privileges |
| TCL (Transaction Control Language) | COMMIT, ROLLBACK, SAVEPOINT | Commit DML results or undo them |

Most exam questions asking about classification directly refer to this table. A common trap is TRUNCATE: although it deletes rows like DML, it is classified as DDL. Additionally, DROP removes the entire table structure, whereas DELETE only removes rows. This distinction is frequently mixed in multiple-choice options.

ALTER under DDL is used for adding, modifying, or deleting columns. CASCADE and RESTRICT are options attached to DROP that determine whether referencing objects should be deleted together or prevented from being dropped when dependencies exist.

For a more detailed breakdown of SQL commands by category, see the SQLD section: [Details → DML·TCL·DDL and Constraints](#/post/sqld-dml-ddl)

## Transaction Control is Brief

TCL consists of three commands: COMMIT, ROLLBACK, and SAVEPOINT. SAVEPOINT allows you to mark a name within a transaction and roll back only up to that point. The flow verified by direct execution is as follows:

```sql
BEGIN;
DELETE FROM emp WHERE emp_id = 1;
SAVEPOINT a;
DELETE FROM emp WHERE emp_id = 2;
ROLLBACK TO a;   -- 2번 삭제만 취소
COMMIT;          -- 1번 삭제는 확정
-- 남은 행: emp_id 2, 3
```

In Oracle, the first DML statement starts a transaction without BEGIN. In SQLite, BEGIN must be used as shown above. Details on transaction properties (ACID) and concurrency control are covered in a separate article: [Details → Normalization and Transactions](#/post/jb-normalization-transaction)

## Example Tables

The following queries are based on these two tables. Among the four employees, choi has a NULL department, and there are no employees in the HR department.

```sql
CREATE TABLE dept(dept_id INTEGER PRIMARY KEY, dname TEXT NOT NULL);
CREATE TABLE emp(emp_id INTEGER PRIMARY KEY, ename TEXT, sal INTEGER,
                 dept_id INTEGER REFERENCES dept(dept_id));
INSERT INTO dept VALUES (10,'영업'),(20,'개발'),(30,'인사');
INSERT INTO emp VALUES (1,'kim',3000,10),(2,'lee',4000,20),
                       (3,'park',5000,20),(4,'choi',2500,NULL);
```

## Joins

Joins connect rows from two tables based on conditions. The number of resulting rows for each join type is a key exam point.

| Type | Rows Retained | Result with Above Data |
|---|---|---|
| INNER JOIN | Only rows with matches on both sides | kim, lee, park (3 rows) |
| LEFT OUTER JOIN | All left rows; unmatched right become NULL | The 3 above + choi (NULL dept) = 4 rows |
| RIGHT OUTER JOIN | All right rows | Includes the HR department employee with NULL department |
| FULL OUTER JOIN | All rows from both sides | Includes unmatched rows from both sides |
| CROSS JOIN | All combinations | 4 × 3 = 12 rows |

```sql
SELECT e.ename, d.dname
FROM emp e LEFT OUTER JOIN dept d ON e.dept_id = d.dept_id;
-- choi|NULL, kim|영업, lee|개발, park|개발

SELECT d.dname, e.ename
FROM dept d LEFT JOIN emp e ON e.dept_id = d.dept_id;
-- 인사|NULL 이 포함된다
```

Even for LEFT JOIN, changing the table order changes which side retains unmatched rows. In the first query above, choi remained; in the second, the HR department (with NULL) remained alongside its matches. RIGHT and FULL can be understood according to the descriptions in the table above.

Other terms may appear, such as NATURAL JOIN (automatic join on columns with the same name), SELF JOIN (using the same table twice with aliases), and NON-EQUI JOIN (joining with conditions other than equality). You only need to distinguish these terms.

For further explanation of joins and subqueries, see SQLD: [Details → Joins and Subqueries](#/post/sqld-join-subquery)

## GROUP BY and HAVING

HAVING applies conditions after grouping and aggregation, whereas WHERE filters rows before grouping. Aggregation functions cannot be used in WHERE.

```sql
SELECT dept_id, COUNT(*), AVG(sal) FROM emp GROUP BY dept_id;
-- NULL|1|2500.0,  10|1|3000.0,  20|2|4500.0

SELECT dept_id, COUNT(*) FROM emp GROUP BY dept_id HAVING COUNT(*) >= 2;
-- 20|2
```

In the above data, NULL departments are grouped together as a single group under GROUP BY. Also, `COUNT(*)` and `COUNT(column)` differ: with the above data, `COUNT(*)` returns 4, while `COUNT(dept_id)` returns 3. When a column name is provided, NULL values are not counted. This distinction often appears in calculation-related questions.

Set operations (UNION, UNION ALL, INTERSECT, EXCEPT) fall into the same category. UNION removes duplicates, while UNION ALL retains them. [Details → Grouping and Set Operations](#/post/sqld-group-set)

## Subqueries and NULL Traps

A subquery is a SELECT statement inside parentheses. If it returns a single row, use comparison operators; if multiple rows, use IN, ANY, ALL, or EXISTS.

```sql
SELECT ename FROM emp WHERE sal > (SELECT AVG(sal) FROM emp);
-- lee, park      (평균 3625보다 큰 사원)

SELECT dname FROM dept d
WHERE EXISTS (SELECT 1 FROM emp e WHERE e.dept_id = d.dept_id);
-- 개발, 영업
```

NOT IN and NULL are the two things that frequently trip you up in exams. If there is even a single NULL in the subquery result, NOT IN will return no rows at all.

```sql
SELECT dname FROM dept WHERE dept_id NOT IN (SELECT dept_id FROM emp);
-- 결과 없음 (emp.dept_id에 NULL이 있어서)

SELECT dname FROM dept
WHERE dept_id NOT IN (SELECT dept_id FROM emp WHERE dept_id IS NOT NULL);
-- 인사
```

In the first query, even though there were no employees in the HR department, the result was empty. This happens because comparisons with NULL evaluate to UNKNOWN (neither TRUE nor FALSE). Using NOT EXISTS avoids this issue entirely.

## Views

A view is a virtual table created by saving a SELECT statement with a name. It does not store data separately; instead, it reads from the original tables every time you query it.

```sql
CREATE VIEW v_dev AS SELECT ename, sal FROM emp WHERE dept_id = 20;
SELECT * FROM v_dev;               -- lee 4000, park 5000
UPDATE emp SET sal = 9999 WHERE emp_id = 2;
SELECT * FROM v_dev;               -- lee 9999, park 5000
```

When the underlying table was modified, the view results changed immediately. Exams often ask about the characteristics of views, which are summarized below:

| Item | Description |
|---|---|
| Purpose | Security (exposing only specific columns and rows), simplifying complex queries, logical independence |
| Storage | Only the definition (SELECT statement) is stored; no data is stored |
| Deletion | Use DROP VIEW. The original table remains unchanged |
| Updatability | Views containing joins, aggregations, or DISTINCT have limited updatability (SQLite treats views as read-only by default) |
| Indexes | It is generally considered that you cannot create indexes on views in exam contexts |

<details>
<summary>The index item varies by DBMS</summary>

The standard explanation in textbooks is that since regular views do not store data, they are not candidates for indexing. Conversely, physical views (Materialized Views), which actually store the results, are a separate concept and some DBMS support indexes on them. If an exam question simply mentions "view," assume it refers to a regular view.
</details>

## Indexes

An index is a separate structure that allows for quick retrieval of rows based on specific column values. While creating an index speeds up queries, it slows down INSERT, UPDATE, and DELETE operations because the index must also be updated. It also consumes additional storage space.

```sql
CREATE INDEX idx_emp_dept ON emp(dept_id);
EXPLAIN QUERY PLAN SELECT * FROM emp WHERE dept_id = 20;
-- SEARCH emp USING INDEX idx_emp_dept (dept_id=?)
```

Before creating an index, the table is scanned from the beginning; after creation, the execution plan shows that rows are found by traversing the index as illustrated above. Exams typically cover which columns benefit from indexing, the differences between clustered and non-clustered indexes, and B-Tree structures. When encountering execution plan questions, simply distinguish whether an index is used or a full table scan occurs.

Content regarding physical design indexes and partitioning is covered separately. [Details → DB Physical Design and Distributed DB](#/post/jb-physical-design). Index structures are discussed further in [Details → Indexes](#/post/db-index).

## Constraints and Integrity

Integrity refers to rules that prevent incorrect values from entering the data. Exams require you to distinguish between entity integrity (primary keys cannot be NULL or duplicated), referential integrity (foreign keys must reference existing values or be NULL), and domain integrity (allowed value ranges).

```sql
DELETE FROM dept WHERE dept_id = 20;
-- FOREIGN KEY constraint failed  (emp가 20번 부서를 참조하는 중)
```

Attempting to delete a parent row referenced by a foreign key is blocked due to referential integrity. You can configure foreign key options such as ON DELETE CASCADE (deleting child rows as well) or SET NULL (setting the child's foreign key to NULL). SQLite requires `PRAGMA foreign_keys=ON` to enable this check. The types of keys and data modeling concepts are summarized in [Details → Database Basics and Data Models](#/post/jb-db-concept).

## DCL

DCL consists of two commands: GRANT (granting privileges) and REVOKE (revoking privileges). Their syntax is as follows:

```sql
GRANT SELECT, INSERT ON emp TO user1 WITH GRANT OPTION;
REVOKE INSERT ON emp FROM user1;
```

Adding WITH GRANT OPTION allows the user who received the privilege to grant it to others. This option is a common topic for single-line exam questions. SQLite does not support GRANT or REVOKE, so these statements cannot be executed directly; only their forms are provided here.

## Common Question Types Summary

| Type | Solution Approach |
|---|---|
| Command Classification Selection | Immediately determine using DDL/DML/DCL/TCL table; TRUNCATE is DDL |
| Join Result Row Count | Identify the base table and check for unmatched rows |
| GROUP BY Results | Filter with WHERE first, then group, and finally filter with HAVING |
| COUNT Calculation | `COUNT(*)` counts all rows; `COUNT(column)` excludes NULLs |
| Subquery Results | Solve the inner query first, then assign to the outer query |
| View/Index Description Selection | Views are virtual (store only definition); Indexes speed up reads but slow down writes |

For questions asking about results, drawing the data in a table and tracing through step-by-step is the safest approach. It is recommended to practice by first predicting the outcome manually with the examples above and then verifying your predictions.

← [Concept Map](#/post/jb-map)

Related articles: [Normalization and Transactions](#/post/jb-normalization-transaction) · [DB Physical Design and Distributed DB](#/post/jb-physical-design) · [Database Basics and Data Models](#/post/jb-db-concept)

## Reference Links

- SQLite SAVEPOINT documentation: https://www.sqlite.org/lang_savepoint.html
- SQLite CREATE VIEW documentation (views are read-only in SQLite): https://www.sqlite.org/lang_createview.html
- Direct execution: Verified the query results from this article using Python 3's built-in sqlite3 module (SQLite 3.50.4).