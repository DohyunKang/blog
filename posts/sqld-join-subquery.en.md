In SQLD, joins and subqueries constitute a major portion of the SQL utilization course. Joins are syntax for connecting multiple tables side by side, while subqueries involve embedding one query inside another. Both concepts frequently appear in problems asking "how many rows does this query return?" The examples below were all executed using Python's SQLite (3.50.4) to verify the results. You can check the SQLD exam environment on the official website; note that syntax varies slightly by dialect, so always refer to the official guidelines for the exam scope.

## Example Tables

There are three departments and five employees. The employee 'Jeong' has no department (NULL), and the 'HR' department has no employees. These two rows represent almost all the pitfalls in join and subquery problems.

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

## Types of Joins

| Type | Result | Example Row Count |
|---|---|---|
| INNER JOIN | Only rows matching conditions on both sides | 4 |
| LEFT OUTER JOIN | All from the left; NULL if no match on the right | 5 |
| RIGHT OUTER JOIN | All from the right; NULL if no match on the left | 5 |
| FULL OUTER JOIN | All rows from both sides | 6 |
| CROSS JOIN | All combinations (Cartesian product) without conditions | 15 |
| SELF JOIN | Using two aliases for the same table | 5 |

PostgreSQL documentation also explains joins using this same classification. Simply writing `JOIN` defaults to INNER, and `OUTER` can be omitted. Detailed basic concepts are available at [Learn more → Relational Databases and SQL Basics](#/post/db-rdb-sql).

### INNER JOIN

```sql
SELECT e.ename, d.dname
FROM emp e INNER JOIN dept d ON e.dept_id = d.dept_id;
```

```
김 영업 / 이 영업 / 박 개발 / 최 개발
```

'Jeong' is excluded because their department is NULL and has no match, and 'HR' is also excluded because it has no employees. Counting these disappearing rows is the core of INNER join problems.

### OUTER JOIN

```sql
SELECT e.ename, d.dname
FROM emp e LEFT OUTER JOIN dept d ON e.dept_id = d.dept_id;
```

```
김 영업 / 이 영업 / 박 개발 / 최 개발 / 정 NULL
```

All rows from the left (`emp`) remain, and the unmatched department for 'Jeong' is filled with NULL. Reversing the table order to `dept d LEFT JOIN emp e` keeps 'HR' and makes the employees NULL. RIGHT behaves like LEFT but with reversed direction; in exams, first identify which side is the reference (the side that remains entirely). FULL OUTER preserves unmatched rows from both sides, resulting in 6 rows in the above example (including Jeong-NULL and HR-NULL).

SQLite supports `RIGHT` and `FULL` joins starting from version 3.39.0. The official documentation includes syntax diagrams; older versions reject these commands.

### CROSS JOIN

```sql
SELECT COUNT(*) FROM emp CROSS JOIN dept;   -- 15
```

5 rows × 3 rows = 15 rows. Since there are no conditions, all combinations appear. Writing `FROM emp, dept` with a comma and omitting the join condition in the WHERE clause produces the same result, which is often the cause of problems where "rows suddenly explode."

### SELF JOIN

```sql
SELECT e.ename, m.ename AS mgr
FROM emp e LEFT JOIN emp m ON e.mgr_id = m.emp_id;
```

```
김 NULL / 이 김 / 박 김 / 최 박 / 정 박
```

Since the same table is used twice, aliases (e.g., `e`, `m`) are mandatory. Without aliases, you cannot distinguish which column belongs to which side. This is used to represent hierarchical structures (employee-manager). 'Kim', who is at the top, has no manager; thus, they are excluded with an INNER join but remain with a LEFT join.

### ON, USING, NATURAL

There are three ways to specify join conditions.

| Method | Meaning | Caution |
|---|---|---|
| `ON a.x = b.y` | Arbitrary condition | Most versatile |
| `USING (x)` | Joins on column `x`, which exists in both tables with the same name | Column `x` appears only once in the result |
| `NATURAL JOIN` | Automatically joins on all columns with matching names | Adding columns can silently change join conditions |

PostgreSQL documentation separately warns that NATURAL joins are risky. If the schema changes, join columns may increase silently.

<details>
<summary>Why ON and WHERE differ in OUTER JOIN</summary>

In INNER JOIN, using conditions in either `ON` or `WHERE` yields the same result. In OUTER JOIN, they differ. Conditions in `ON` are applied before the join, allowing unmatched rows to survive with NULL values, whereas conditions in `WHERE` are applied after the join, filtering out even rows filled with NULL. The example below applies the same "salary >= 400" condition in both locations.

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

'HR' disappears on the WHERE side because `NULL >= 400` evaluates to false and is filtered out. Consequently, applying conditions from the right table in a LEFT JOIN makes it behave like an INNER JOIN. Exams often ask about this difference via row counts.

</details>

## Subquery Types

Subqueries are SELECT statements enclosed in parentheses, categorized by their position and the number of rows they return.

| Position | Name | Example |
|---|---|---|
| SELECT clause | Scalar subquery | Fetching a single department name per employee |
| FROM clause | Inline view | Using subquery results like a temporary table |
| WHERE clause | Correlated subquery | Used with IN, comparison operators, and EXISTS |

| Number of Rows Returned | Usable Operators |
|---|---|
| Single Row | `=`, `>`, `<`, etc. |
| Multiple Rows | `IN`, `ANY` (SOME), `ALL`, `EXISTS` |

If a single-row subquery returns multiple rows, an error occurs. This combination frequently appears in exams.

### Single-Row vs. Multi-Row Subqueries

```sql
-- 평균 급여보다 많이 받는 사람 (단일 행)
SELECT ename FROM emp WHERE sal > (SELECT AVG(sal) FROM emp);   -- 김, 박

-- 개발 부서 소속 (다중 행 가능)
SELECT ename FROM emp
WHERE dept_id IN (SELECT dept_id FROM dept WHERE dname = '개발'); -- 박, 최
```

The average is (500+300+400+200+350)/5 = 350, so only Kim and Park qualify. 'Jeong' has a value of 350, which matches the average, so it does not satisfy `>`. Boundary values are often tested in problems.

According to PostgreSQL documentation, `IN` is equivalent to `= ANY`, and `NOT IN` is equivalent to `<> ALL`. `ANY` returns true if at least one condition is true, while `ALL` requires all conditions to be true. If the subquery returns an empty result, `ANY` evaluates to false and `ALL` evaluates to true. (`> ALL` and `> ANY` are not supported in SQLite, so they were not tested here; only their concepts were taken from the documentation.)

### Inline Views and Scalar Subqueries

```sql
SELECT d.dname, t.avg_sal
FROM dept d
JOIN (SELECT dept_id, AVG(sal) AS avg_sal FROM emp GROUP BY dept_id) t
  ON d.dept_id = t.dept_id;
-- 영업 400.0 / 개발 300.0
```

Subqueries in the `FROM` clause must have an alias (e.g., `t`) immediately after the parentheses. The SQL standard requires an alias, PostgreSQL allows omitting it but recommends adding one. In this case, although 'Jeong' is grouped into a single group by `GROUP BY` despite having a NULL department, it disappears in the join because there is no matching pair.

```sql
SELECT ename, (SELECT dname FROM dept d WHERE d.dept_id = e.dept_id) AS dname
FROM emp e;
-- 김 영업 / 이 영업 / 박 개발 / 최 개발 / 정 NULL
```

Scalar subqueries must return exactly one row and one column. The result resembles a `LEFT JOIN`. It also shares the characteristic that unmatched rows produce `NULL`.

### Correlated Subqueries

A subquery that references columns from the outer query. The inner query is re-executed for each row of the outer query.

```sql
-- 자기 부서 평균보다 급여가 높은 사람
SELECT ename, sal, dept_id FROM emp e
WHERE sal > (SELECT AVG(sal) FROM emp WHERE dept_id = e.dept_id);
-- 김 500 10 / 박 400 20
```

The sales average is 400, and the development average is 300. Only Kim (500) and Park (400) exceed their department's average. 'Jeong' has a `NULL` department, so `dept_id = NULL` evaluates to false, causing the subquery to return `NULL`, and the comparison result filters out this row.

The distinction is simple: if you see the outer alias (e.g., `e.`) inside the subquery, it is a correlated subquery. If you can execute the inner part separately without referencing the outer query, it is non-correlated.

### The Pitfalls of EXISTS, IN, and NOT IN

```sql
-- 사원이 없는 부서
SELECT dname FROM dept d
WHERE NOT EXISTS (SELECT 1 FROM emp e WHERE e.dept_id = d.dept_id);   -- 인사

SELECT dname FROM dept WHERE dept_id NOT IN (SELECT dept_id FROM emp);  -- 결과 0행!
```

The second query returns 0 rows because `emp.dept_id` contains `NULL` (for 'Jeong'). PostgreSQL documentation provides a similar explanation. If the subquery contains any `NULL` values and there are no matching rows, the result of `NOT IN` becomes `NULL`, not false. Since `WHERE` treats `NULL` as neither true nor false, all rows are filtered out. Removing `NULL` from the subquery restores normal behavior.

```sql
SELECT dname FROM dept
WHERE dept_id NOT IN (SELECT dept_id FROM emp WHERE dept_id IS NOT NULL);  -- 인사
```

| | EXISTS | IN |
|---|---|---|
| Condition | Does the subquery return at least one row? | Is the value in the list? |
| Subquery SELECT List | Usually `SELECT 1`; values are irrelevant | Single column |
| Impact of NULL | Minimal | Fatal for `NOT IN` |

`EXISTS` behaves similarly to a join as described in PostgreSQL documentation but appears at most once per outer row. In one-to-many relationships, a join increases the number of rows, whereas `EXISTS` does not. Whether to use a join or a subquery for the same result depends on whether duplicates are desired.

<details>
<summary>Summary of pitfalls frequently seen in exams</summary>

- Self joins without aliases cause errors.
- Placing conditions from the right table in the `WHERE` clause of an `OUTER JOIN` converts it to behave like an `INNER JOIN`.
- Omitting the join condition in a comma-separated join results in a Cartesian product (N×M rows).
- A subquery with multiple rows after a single-row operator (`=`) causes an error.
- If the subquery result of `NOT IN` contains `NULL`, the result becomes empty. `EXISTS` is unaffected by this.
- Scalar subqueries must return one row and one column.
- Inline views should have an alias attached.

</details>

## Views

A view is a stored name for a `SELECT` statement. It does not store copied data; instead, it stores the query itself, which executes every time the view is queried.

```sql
CREATE VIEW v_dev AS
SELECT e.ename, e.sal FROM emp e
JOIN dept d ON d.dept_id = e.dept_id WHERE d.dname = '개발';

SELECT * FROM v_dev;   -- 박 400 / 최 200
```

| Reason for Use | Description |
|---|---|
| Hiding Complex Joins | Avoid writing long queries repeatedly by using a single name |
| Access Control | Restrict visibility to certain columns and rows for authorization |
| Query Reusability | Apply the same join in multiple places |

Exams often feature statements like "Views do not hold independent data" or "Deleting a view does not affect the original table." View definition syntax continues in [DML·TCL·DDL and Constraints](#/post/sqld-dml-ddl). Whether a view is updatable varies by DBMS, so this was not tested here.

## Solution Order

Following this order for join problems solves almost all cases:

1. Determine which table is the base (the side that retains all rows).
2. Identify rows without matches in the join condition (including those with `NULL`).
3. For `INNER` joins, discard unmatched rows; for `OUTER` joins, fill them with `NULL`.
4. Check if the `WHERE` clause filters out rows filled with `NULL`.
5. If `GROUP BY` or aggregation is present, perform calculations after that step.

Subqueries are executed from the inside out; for correlated subqueries, evaluate them row by row against the outer query. If you encounter `NOT IN`, first check whether the subquery contains any NULL values. For similar aggregate and set operations, see [GROUP BY and Set Operations](#/post/sqld-group-set), and continue with the previous section on [SELECT and Functions](#/post/sqld-select-func). For practice, try solving JOIN and SELECT problems directly from the Programmers SQL High Score Kit.

---

← [Concept Map](#/post/sqld-map)

Related posts: [GROUP BY and Set Operations](#/post/sqld-group-set) · [Window Functions and Advanced SQL](#/post/sqld-window-advanced) · [Relational Databases and Basic SQL](#/post/db-rdb-sql)

## Reference Links

- SQLite SELECT documentation: https://www.sqlite.org/lang_select.html
- PostgreSQL documentation, Table Expressions (Joins): https://www.postgresql.org/docs/current/queries-table-expressions.html
- PostgreSQL documentation, Subquery Expressions: https://www.postgresql.org/docs/current/functions-subquery.html