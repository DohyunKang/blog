In SQLD, questions frequently ask about the order of GROUP BY clauses with aggregate functions and NULL handling, the number of rows returned by ROLLUP, CUBE, and GROUPING SETS, and how set operators handle duplicates. The examples below were run directly in DuckDB to verify the results. Differences from Oracle syntax in exam environments are noted separately.

## Example Table

The table used for explanation contains 7 employees and has only four columns: department (dept), job title (job), salary (sal), and commission (comm).

| id | dept | job | sal | comm |
|---|---|---|---|---|
| 1 | SALES | CLERK | 300 | 50 |
| 2 | SALES | CLERK | 320 | NULL |
| 3 | SALES | SENIOR | 400 | NULL |
| 4 | DEV | CLERK | 350 | NULL |
| 5 | DEV | SENIOR | 450 | NULL |
| 6 | DEV | SENIOR | 470 | NULL |
| 7 | HR | CLERK | 310 | NULL |

## Aggregate Functions

Aggregate functions take multiple rows and return a single value. COUNT, SUM, AVG, MAX, and MIN are the basics.

- `COUNT(*)` counts the number of rows, including those with NULL values.
- `COUNT(column)` counts only rows where that column is not NULL.
- SUM, AVG, MAX, and MIN skip NULL values during calculation.
- When there are no rows, `COUNT` returns 0, while the others return NULL.

```sql
SELECT COUNT(*), COUNT(comm), AVG(sal), AVG(comm) FROM emp;
-- 7, 1, 371.43, 50
```

Since only one person has a commission, `COUNT(comm)` is 1, and `AVG(comm)` is 50 (not 7 divided by something). This is because NULL values are excluded from the denominator. This part is a common trap; when facing calculation problems, always check how many NULLs exist first.

If you want to calculate an average treating NULL as 0, you must change it to `AVG(NVL(comm, 0))`. NVL is an Oracle function. This topic is covered in more detail in [SELECT statements and functions →](#/post/sqld-select-func).

## GROUP BY and HAVING

GROUP BY groups rows that have the same values in specified columns into a single row per group. There are two rules:

- The SELECT list can only contain columns used in GROUP BY, aggregate functions, or constants. Using any other column will cause Oracle to return an ORA-00979 error.
- Conditions to filter out groups must be written in HAVING, not WHERE. WHERE filters rows before grouping, while HAVING filters groups after they are formed.

```sql
SELECT dept, COUNT(*), SUM(sal)
FROM emp
GROUP BY dept
HAVING SUM(sal) >= 1000
ORDER BY dept;
-- DEV 3 1270 / SALES 3 1020   (HR은 310이라 빠짐)
```

Memorizing this logical execution order of SQL makes it easier:

| Step | Clause | Action |
|---|---|---|
| 1 | FROM | Determines the tables |
| 2 | WHERE | Filters rows |
| 3 | GROUP BY | Groups rows |
| 4 | HAVING | Filters groups |
| 5 | SELECT | Selects columns |
| 6 | ORDER BY | Sorts results |

Since ORDER BY comes after SELECT, aliases created in SELECT can be used in ORDER BY. Oracle documentation also states that aliases should only be used in ORDER BY.

<details>
<summary>Why aggregate functions cannot be used in WHERE</summary>

WHERE is executed before step 3 (grouping). At this point, groups do not yet exist, so values like `SUM(sal)` are not available. Therefore, `WHERE SUM(sal) >= 1000` will result in an error. However, if the same condition refers to a "department total" rather than a single row's value, it can be used in WHERE. For example, `WHERE sal >= 400` filters rows with a salary of 400 or more before grouping. From a performance perspective, filtering early with WHERE (when not involving group conditions) is preferable.

</details>

## ROLLUP, CUBE, GROUPING SETS

This is extended syntax that generates subtotals and grand totals in one go using a single GROUP BY clause. Oracle documentation explains that instead of combining results separately with UNION ALL, this approach processes everything within a single query block, reading the table only once.

### ROLLUP

`ROLLUP(a, b)` creates subtotals by progressively removing columns from the right. If there are n columns, there will be n+1 levels of aggregation.

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

The result contains detailed rows for `(dept, job)`, subtotals for `(dept)`, and a grand total for `()`. If you change the column order to `ROLLUP(job, dept)`, the subtotal basis shifts to job title. The fact that order determines the result is a common exam trap.

### CUBE

`CUBE(a, b)` generates all possible combinations of columns. If there are n columns, it produces $2^n$ levels.

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY CUBE(dept, job)
ORDER BY dept, job;
```

Two additional rows for subtotals by job title are appended to the ROLLUP result.

| dept | job | SUM(sal) |
|---|---|---|
| NULL | CLERK | 1280 |
| NULL | SENIOR | 1320 |

The ROLLUP result has 9 rows, and adding the 2 job-level subtotals brings the total to 11 rows. This is because there are four combinations: `(dept, job)`, `(dept)`, `(job)`, and `()`. CUBE produces the same set of result rows regardless of column order.

### GROUPING SETS

`GROUPING SETS` calculates only the specified groupings. It is used when you need to select specific subtotals from a larger set.

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY GROUPING SETS ((dept), (job))
ORDER BY dept, job;
-- 부서별 3줄 + 직급별 2줄 = 5줄
```

Neither grand totals nor detailed rows are produced; only the specified `(dept)` and `(job)` appear. Like CUBE, the result remains the same even if column order changes.

<details>
<summary>Expanding these three syntaxes using GROUPING SETS</summary>

This is an equivalent expression found in Oracle documentation.

- `ROLLUP(a, b, c)` = `GROUPING SETS ((a,b,c), (a,b), (a), ())`
- `CUBE(a, b, c)` = `GROUPING SETS ((a,b,c), (a,b), (a,c), (b,c), (a), (b), (c), ())` (8 groups)
- `GROUPING SETS (a, b, (b,c))` = `GROUP BY a` UNION ALL `GROUP BY b` UNION ALL `GROUP BY b, c`

The `(b, c)` enclosed in parentheses is treated as a single unit. `ROLLUP(a, (b, c))` results in three levels: `(a,b,c)`, `(a)`, and `()`, so no subtotal for `b` alone is produced.

</details>

### GROUPING Function

Rows representing subtotals in ROLLUP and CUBE contain NULL for the corresponding column. However, since actual data may also contain NULLs, you cannot distinguish a subtotal row solely based on NULL values. The `GROUPING(column)` function returns 1 if the NULL is due to a subtotal, and 0 otherwise.

```sql
SELECT dept, job, SUM(sal), GROUPING(dept), GROUPING(job)
FROM emp
GROUP BY ROLLUP(dept, job)
ORDER BY dept, job;
-- DEV / NULL / 1270 / 0 / 1   (직급 자리가 소계)
-- NULL / NULL / 2600 / 1 / 1  (총계)
```

The example in Oracle documentation uses `DECODE(GROUPING(department_name), 1, 'ALL DEPARTMENTS', department_name)` to label subtotal rows. Within the same family, `GROUPING_ID` returns a bit-vector number representing the GROUPING values of multiple columns, while `GROUP_ID` distinguishes between duplicate groups.

## Set Operators

These operators combine or subtract two SELECT results vertically. While joins attach columns horizontally, set operators handle rows vertically. Joins are covered in [detailed guide → Joins and Subqueries](#/post/sqld-join-subquery).

| Operator | Result | Duplicates |
|---|---|---|
| UNION | Union | Removed |
| UNION ALL | Union | Preserved |
| INTERSECT | Intersection | Removed |
| MINUS | Difference (front result minus back result) | Removed |

`MINUS` is an Oracle-specific term; databases like DuckDB and PostgreSQL use `EXCEPT` instead. The following result was obtained using `EXCEPT`.

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

UNION performs an additional operation to remove duplicates. If you know there are no duplicates, using UNION ALL is simpler.

The rules outlined in Oracle documentation are as follows:

- The number of columns in both SELECT statements must match, and columns at the same position must belong to the same data type group (numeric or character). Columns missing on one side should be aligned using expressions like `TO_CHAR(NULL)`.
- `ORDER BY` can only be used once at the very end; it cannot be used within individual SELECT statements.
- Operator precedence is equal, and processing occurs from left to right. The documentation advises using parentheses to clarify order when mixing INTERSECT with other operators.

<details>
<summary>How to determine the evaluation order</summary>

To solve set operator problems, follow this sequence:

1. First, write down the rows each SELECT returns separately.
2. Apply operators from left to one by one. If UNION and INTERSECT or MINUS are mixed, check for parentheses.
3. Finally, verify whether duplicate removal is required (UNION ALL vs. UNION).
4. If column counts or types do not match, the error option may be the correct answer.

</details>

## Summary of Common Problem Types

- Calculation of NULL handling results for COUNT(*), COUNT(column), and AVG
- Location of WHERE and HAVING, identifying incorrect SQL that uses aggregate functions in WHERE without HAVING
- Why a statement using a column not present in GROUP BY in SELECT causes an error
- Counting rows resulting from ROLLUP, CUBE, and GROUPING SETS
- Finding rows where the GROUPING function value is 1
- Difference in row counts between UNION and UNION ALL, results of INTERSECT and MINUS

Ranking within groups using window functions continues in [details → Window Functions and Advanced SQL](#/post/sqld-window-advanced). Check the exam schedule and registration fee on the official site.

← Concept map ([#/post/sqld-map])

Related posts: [SELECT Statement and Functions](#/post/sqld-select-func) · [Joins and Subqueries](#/post/sqld-join-subquery) · [Window Functions and Advanced SQL](#/post/sqld-window-advanced)

## Reference Links

- Oracle Database 19c SQL Language Reference, SELECT: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html
- Oracle Database 19c, GROUPING function: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/GROUPING.html
- Oracle Database 19c, UNION ALL·INTERSECT·MINUS operators: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/The-UNION-ALL-INTERSECT-MINUS-Operators.html
- Oracle Database 19c Data Warehousing Guide, SQL for Aggregation: https://docs.oracle.com/en/database/oracle/oracle-database/19/dwhsg/sql-aggregation-data-warehouses.html