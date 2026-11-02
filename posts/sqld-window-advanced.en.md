Window functions are functions that attach a calculated value to each row individually without merging rows like `GROUP BY` does. In SQLD Course 2, topics such as ranking, previous/next row, running totals, TOP N, hierarchical queries, PIVOT, and regular expressions are covered in this unit. Check the official site for exam schedules and fees.

## What is a Window Function?

Aggregate functions produce one result line per group. Window functions (also called analytic functions) perform the same calculation while preserving the original number of input rows. In Oracle documentation terms, it is described as "an aggregate that returns one result per row."

The syntax always follows the same pattern:

```
함수() OVER ( [PARTITION BY ...] [ORDER BY ...] [윈도잉 절] )
```

- `PARTITION BY`: Divides the data into groups. If omitted, all rows form a single group. Unlike `GROUP BY`, rows are not merged.
- `ORDER BY`: Specifies the sort order within each group.
- Windowing clause (`ROWS`/`RANGE`): Defines the range of rows used for the calculation. This must be accompanied by an `ORDER BY` clause.

The execution order is also worth memorizing. Window functions are evaluated after `FROM`, `WHERE`, `GROUP BY`, and `HAVING`. Therefore, they can only be used in the `SELECT` and `ORDER BY` clauses, not in the `WHERE` clause. If you need to filter based on a ranking, you must wrap it once more. This distinction frequently appears as a distractor in exams.

## Ranking Functions: The Three Types

The difference among the three functions lies in how they assign numbers when there are ties. Below is a direct result of calculating department-wise salary rankings (using virtual data).

| ename | deptno | sal | RANK | DENSE_RANK | ROW_NUMBER |
|---|---|---|---|---|---|
| A | 10 | 500 | 1 | 1 | 1 |
| B | 10 | 500 | 1 | 1 | 2 |
| C | 10 | 400 | 3 | 2 | 3 |
| D | 10 | 300 | 4 | 3 | 4 |

- `RANK`: Assigns the same number for ties and skips subsequent numbers (e.g., 1, 1, 3).
- `DENSE_RANK`: Assigns the same number for ties without skipping (e.g., 1, 1, 2).
- `ROW_NUMBER`: Always assigns a unique number even for ties. Since the order among tied rows is not deterministic, add an additional sort key to fix the result (`ORDER BY sal DESC, ename`).

```sql
select ename, deptno, sal,
  rank()       over (partition by deptno order by sal desc) rnk,
  dense_rank() over (partition by deptno order by sal desc) drnk,
  row_number() over (partition by deptno order by sal desc, ename) rn
from emp;
```

## Previous/Next Rows, Running Totals, and Ratios

- `LAG(column, n)`: Retrieves the value from `n` rows before.
- `LEAD(column, n)`: Retrieves the value from `n` rows after.
  - For the first row, `LAG` returns `NULL`; for the last row, `LEAD` returns `NULL`. You can provide default values as the third argument.
- `FIRST_VALUE` / `LAST_VALUE`: Return the first and last values within the window, respectively.
- Appending `OVER` to an aggregate function like `SUM` creates a running or moving total.
- `RATIO_TO_REPORT(x)`: Calculates the ratio of `x` to the group total.
- `NTILE(n)`: Divides the group into `n` intervals.
- `CUME_DIST`, `PERCENT_RANK`: Provide cumulative distribution and relative ranking, respectively.

When attaching previous month and next month values to monthly sales, the result looks like this:

```sql
select month, amount,
  lag(amount,1)  over (order by month) prev,
  lead(amount,1) over (order by month) nxt
from sales where product='x';
-- (1, 10, NULL, 20) (2, 20, 10, 30) (3, 30, 20, NULL)
```

<details>
<summary>Detailed Windowing Clause (ROWS vs RANGE, Default Ranges)</summary>

There are five boundary keywords:

| Keyword | Meaning |
|---|---|
| `UNBOUNDED PRECEDING` | The very beginning of the partition (start point only) |
| `UNBOUNDED FOLLOWING` | The very end of the partition (end point only) |
| `CURRENT ROW` | The current row |
| `n PRECEDING` | `n` rows before the current row |
| `n FOLLOWING` | `n` rows after the current row |

- `ROWS` defines the range by the physical count of rows, while `RANGE` defines it by the distance of `ORDER BY` values (e.g., date intervals).
- If you use only `ORDER BY` and omit the windowing clause, the default range is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. Consequently, `SUM(x) OVER (ORDER BY ...)` produces a running total.
- When there are tied rows, `RANGE` yields the same result for tied rows, whereas `ROWS` may produce different results depending on row order.
- Since `LAST_VALUE` defaults to the current row range, to retrieve the actual last value of the partition, you must specify `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.

Examples of running totals and ratios (direct execution results):

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

The solution using window functions involves ranking first and then filtering in the outer query.

```sql
select * from (
  select ename, deptno, sal,
         rank() over (partition by deptno order by sal desc) rnk
  from emp
) where rnk <= 2;
```

Running this on the virtual data above yields two people with tied scores (A and B) as rank 1 in department 10, while E and F appear in department 20. Using `RANK` may result in more than `N` rows due to ties, whereas `ROW_NUMBER` ensures exactly `N` rows. Exams often ask about this difference.

It is also frequently noted that the syntax for TOP N varies across different database systems.

| DBMS | Syntax |
|---|---|
| Oracle | `ROWNUM <= n` (sorting inside a subquery), or `FETCH FIRST n ROWS ONLY` for 12c and later |
| SQL Server | `SELECT TOP (n) ...`, use `WITH TIES` to include rows tied for the last rank |

In Oracle, `ROWNUM` is assigned before sorting; therefore, writing `WHERE ROWNUM <= 3 ... ORDER BY` does not return the top 3 sorted rows. You must sort first using an inline view and then filter from the outside. `FETCH FIRST n ROWS WITH TIES` returns rows tied with the last row as well and requires an `ORDER BY` clause (works in Oracle 12c and later).

## Hierarchical Queries

This syntax reads data where parent-child relationships exist within a single table (like organizational charts, menus, or comments) in tree order. Oracle uses `CONNECT BY`.

```sql
SELECT last_name, employee_id, manager_id, LEVEL
  FROM employees
  START WITH employee_id = 100
  CONNECT BY PRIOR employee_id = manager_id
  ORDER SIBLINGS BY last_name;
```

| Element | Meaning |
|---|---|
| START WITH | Condition to define the root row |
| CONNECT BY | Parent-child connection condition; one side must contain `PRIOR` |
| PRIOR | Operator pointing to the parent row's value |
| LEVEL | Depth level; root is 1 |
| NOCYCLE | Returns rows even if cycles exist instead of raising an error (omitting it causes ORA-01436) |
| ORDER SIBLINGS BY | Sorts only among siblings while maintaining hierarchy order |
| SYS_CONNECT_BY_PATH(col, '/') | Path from root to the current row |
| CONNECT_BY_ISLEAF | Returns 1 if there are no children |
| CONNECT_BY_ROOT col | Value of the topmost ancestor |

`CONNECT BY PRIOR employee_id = manager_id` means "the parent's employee ID equals the child's manager ID," so it traverses from top to bottom (forward direction). Attaching `PRIOR` to the opposite side traverses from bottom to top (reverse direction). When direction issues arise, check where `PRIOR` is attached first. `WHERE` conditions are applied after the hierarchy is built and for each row; using standard `ORDER BY` or `GROUP BY` breaks the hierarchy order.

SQL Server lacks `CONNECT BY` and uses recursive CTEs instead. Oracle documentation also guides toward a more flexible method using recursive `WITH`. Below is a recursive query executed directly in SQLite (the organizational chart uses dummy data).

```sql
with recursive t(id, name, lvl, path) as (
  select id, name, 1, '/'||name from org where mgr is null
  union all
  select o.id, o.name, t.lvl+1, t.path||'/'||o.name
  from org o join t on o.mgr = t.id)
select * from t order by path;
-- (1,'King',1,'/King') (2,'Kim',2,'/King/Kim') (4,'Park',3,'/King/Kim/Park') (3,'Lee',2,'/King/Lee')
```

The first `SELECT` corresponds to `START WITH`, the join condition in the second `SELECT` corresponds to `CONNECT BY`, `lvl` maps to `LEVEL`, and `path` maps to `SYS_CONNECT_BY_PATH`.

## PIVOT and UNPIVOT

`PIVOT` transforms rows into columns. Since it aggregates, an implicit `GROUP BY` is applied for unused columns.

```sql
SELECT *
FROM (SELECT product, quarter, amount FROM sales)
PIVOT (
  SUM(amount) FOR quarter IN ('Q1' AS q1, 'Q2' AS q2, 'Q3' AS q3, 'Q4' AS q4)
);
```

`UNPIVOT` does the reverse, transforming columns into rows. By default, it excludes rows with `NULL` values (`EXCLUDE NULLS`).

```sql
SELECT product, quarter, amount
FROM sales_wide
UNPIVOT (amount FOR quarter IN (q1 AS 'Q1', q2 AS 'Q2', q3 AS 'Q3', q4 AS 'Q4'));
```

For DBMS lacking `PIVOT` syntax or before `PIVOT` existed, the approach using `CASE` and aggregate functions together is used. This also appears in SQLD exams. Below are results from a direct execution.

```sql
select month,
  sum(case when product='x' then amount end) x,
  sum(case when product='y' then amount end) y
from sales group by month;
-- (1,10,5) (2,20,15) (3,30,NULL)
```

The result above also shows that if no value matches the condition, `SUM` returns `NULL` (e.g., for March's `y`).

## Regular Expressions

Oracle's `REGEXP_LIKE(original, pattern [, option])` is the regex version of `LIKE` and follows POSIX standards. Options are single characters.

| Option | Effect |
|---|---|
| i | Case-insensitive |
| c | Case-sensitive and accent-sensitive |
| n | Matches newline with `.` |
| m | `^` and `$` match start/end of each line |
| x | Ignores whitespace in the pattern |

```sql
SELECT first_name FROM employees
WHERE REGEXP_LIKE (first_name, '^Ste(v|ph)en$');   -- Steven, Stephen
```

Related functions include `REGEXP_INSTR`, `REGEXP_REPLACE`, and `REGEXP_SUBSTR`. The symbols themselves follow standard regular expressions (`^` for start, `$` for end, `|` for OR, `()` for groups). For exams, knowing function names and basic symbols is sufficient.

## Common Pitfalls

- Window functions cannot be used in the `WHERE` clause; wrap them to filter.
- `RANK` skips numbers, `DENSE_RANK` does not skip, and `ROW_NUMBER` distinguishes ties.
- The first row for `LAG` and the last row for `LEAD` are `NULL`.
- `PARTITION BY` does not merge rows.
- In hierarchical queries, the position of `PRIOR` determines direction.
- Oracle `ROWNUM` is assigned before sorting.

Window functions may seem complex inside the `OVER` clause initially, but reading what goes into these three sections makes it clear.

[← Concept map](#/post/sqld-map)

Related posts: [GROUP BY and Set Operations](#/post/sqld-group-set), [Joins and Subqueries](#/post/sqld-join-subquery), [SELECT and Functions](#/post/sqld-select-func), [DML, TCL, DDL, and Constraints](#/post/sqld-dml-ddl)

## Reference Links

- [Oracle Database 19c SQL Language Reference – Analytic Functions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Analytic-Functions.html)
- [Oracle Database 19c SQL Language Reference – Hierarchical Queries](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Hierarchical-Queries.html)
- [Oracle Database 19c SQL Language Reference – SELECT (PIVOT/UNPIVOT)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html)
- [Oracle Database 19c SQL Language Reference – Pattern-matching Conditions (REGEXP_LIKE)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Pattern-matching-Conditions.html)