This is the first unit of SQLD Unit 2 (SQL Basics and Applications). The `SELECT` clause differs in writing order versus execution order, and problems often hinge on these differences and how they handle `NULL`. While the concepts are straightforward, many questions require precise results, so I've included the actual output from running the queries.

Exam schedules and fees can be checked on the official site. This article covers only the core topics of the unit and frequently occurring question types. For data modeling, see [Details → Understanding Data Modeling](#/post/sqld-modeling).

## Writing Order vs. Execution Order

The `SELECT` statement is written like this:

```
SELECT 열 → FROM 테이블 → WHERE 조건 → GROUP BY → HAVING → ORDER BY
```

However, execution follows a different flow. According to SQL Server documentation, the logical processing order is FROM, ON, JOIN, WHERE, GROUP BY, HAVING, SELECT, DISTINCT, ORDER BY, TOP. The documentation adds that the actual physical execution plan is determined by the optimizer and may differ. In exams, only this logical order matters.

There are rules that directly follow from this order:

| Situation | Reason |
|---|---|
| Cannot use aliases in SELECT within WHERE | Aliases are created at the SELECT stage, which comes after WHERE |
| Can use aliases in ORDER BY | ORDER BY comes after SELECT |
| Cannot use aggregate functions in WHERE | Groups are formed after WHERE; group conditions belong in HAVING |

HAVING and aggregates are covered separately in [Details → GROUP BY and Set Operations](#/post/sqld-group-set).

## WHERE and Operators

Comparison operators include `=`, `<>`, `<`, `>`, `<=`, `>=`. Range, list, and pattern matching are used as shown below:

| Operator | Meaning |
|---|---|
| BETWEEN a AND b | From a to b inclusive. Includes both boundary values |
| IN (a, b, c) | Equals one of the items in the list. Equivalent to OR conditions |
| LIKE | Pattern matching. `%` matches zero or more characters; `_` matches exactly one character |
| IS NULL / IS NOT NULL | Checks for NULL presence |

Based on Oracle documentation, `LIKE` is case-sensitive, and `%` or `_` following a specified `ESCAPE` character are treated as literal characters. For example, `LIKE '_a%'` matches values where the second character is 'a'. In the sample data below, `'Park'` satisfies this condition.

Logical operators have precedence in the order: NOT, AND, OR. Since AND binds tighter than OR, omitting parentheses can lead to unintended interpretation. The following two queries produce the same result but are parsed differently:

```
WHERE sal >= 300 AND dept = 'A' OR dept = 'B'     -- (sal>=300 AND dept='A') OR dept='B'
WHERE sal >= 300 AND (dept = 'A' OR dept = 'B')   -- 괄호가 있으면 이쪽
```

In problems, you might encounter data that coincidentally yields the same result, so relying solely on output is risky; always consider the binding order.

## NULL Causes Most Errors

`NULL` means "no value" and is neither 0 nor an empty string. Comparisons and operations involving `NULL` almost always result in `NULL` (unknown). The examples below were verified by actually running them in SQLite.

<details>
<summary>Sample Table (Run with SQLite to verify)</summary>

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

The results from running the above table are as follows:

| Query | Result |
|---|---|
| `WHERE comm = NULL` | 0 rows |
| `WHERE comm IS NULL` | 2 rows (id 1, 3) |
| `SELECT sal + comm` | id 1 and 3 are NULL; others have values |
| `COUNT(*)`, `COUNT(comm)` | 5, 3 |
| `AVG(comm)` | 50.0 (average of 0, 50, 100; NULL rows are excluded) |
| `WHERE dept <> 'A'` | id 3, 5 (id 4 with NULL dept is excluded) |
| `WHERE dept NOT IN ('A', NULL)` | 0 rows |

To summarize:

- If `NULL` enters a comparison operation, the result is neither true nor false but "unknown," causing the row to be filtered out. Thus, `= NULL` always returns 0 rows, and you must use `IS NULL`.
- Arithmetic operations involving `NULL` yield `NULL`.
- `COUNT(*)` counts all rows, while `COUNT(column)` and `AVG` skip `NULL` values. This difference frequently appears in sum and average problems.
- If a list in `NOT IN` contains even one `NULL`, no rows are returned. This is a common trap when subquery results include `NULL`.

## NULL Handling Functions

| Function | Behavior |
|---|---|
| NVL(a, b) | Returns b if a is NULL; otherwise returns a (Oracle-specific) |
| COALESCE(a, b, c, ...) | Returns the first non-NULL value. Standard SQL function |
| NULLIF(a, b) | Returns NULL if a equals b; otherwise returns a |

NVL is an Oracle function, while COALESCE can perform the same operation with multiple arguments. NULLIF is equivalent to `CASE WHEN a = b THEN NULL ELSE a END`. A common use case is avoiding division by zero. For example, using `total / NULLIF(cnt, 0)` returns NULL when cnt is 0.

The following result was obtained from running the query on the table above.

```sql
select id, sal + coalesce(comm, 0) from emp order by id;
-- (1,300) (2,300) (3,400) (4,200) (5,450)

select id, nullif(comm, 0) from emp order by id;
-- (1,None) (2,50) (3,None) (4,None) (5,100)
```

## String and Numeric Functions

Since exam questions may ask for the direct output values, it is essential to understand the meaning of each argument precisely.

| Function | Description |
|---|---|
| UPPER / LOWER | Converts to uppercase / lowercase |
| LENGTH | Returns the number of characters |
| SUBSTR(string, start, length) | Returns a substring starting from the specified position for the given length. If length is omitted, it returns until the end of the string |
| REPLACE(string, find, replace) | Performs substitution |
| ROUND(number, n) | Rounds to n decimal places. If n is negative, it rounds to the left of the decimal point (integer part) |
| ABS, MOD | Absolute value and modulus |

According to Oracle documentation, SUBSTR treats a start position of 0 as 1, and a negative start position counts from the end of the string. For instance, `SUBSTR('ABCDEFG', -5, 4)` returns `CDEF`.

For ROUND, a negative n indicates rounding relative to the left of the decimal point. As shown in Oracle documentation examples, `ROUND(15.193, -1)` results in 20. Negative values are rounded based on their absolute value, with the sign preserved; thus, `ROUND(-15.193, -1)` returns -20.

## Date Functions

Date functions typically follow Oracle standards. One key function to verify is `ADD_MONTHS(date, n)`, which returns the date n months later. If the start date falls on the last day of its month, or if the resulting date does not exist in the target month, the result defaults to the last day of that target month. For example, adding one month to January 31st results in February's last day. This end-of-month rule often serves as a trap in exams.

Date format conversion functions (`TO_CHAR`, `TO_DATE`) rely on memorizing format strings; however, reviewing the format element table in the relevant documentation once is sufficient.

## CASE

There are two forms of conditional logic.

```sql
select id,
  case when sal >= 350 then 'H' when sal >= 250 then 'M' else 'L' end
from emp order by id;
-- (1,'M') (2,'M') (3,'H') (4,'L') (5,'H')

select id, case dept when 'A' then 1 when 'B' then 2 end
from emp order by id;
-- (1,1) (2,1) (3,2) (4,None) (5,2)
```

The first form evaluates conditions from top to bottom and stops at the first true condition. Therefore, `sal >= 350` must be placed first; reversing the order would incorrectly classify a salary of 400 as 'M'. The second form is a simple CASE that compares against a single value. If no match is found and there is no ELSE clause, it returns NULL. For example, id 4 with dept as NULL behaves this way. Note also that simple CASE uses `=` for comparison and cannot match NULL values.

## Common Question Types

- Queries where the number of rows or specific output values are asked; you must trace how NULL rows are filtered out.
- Identifying queries that fail due to execution order, such as using aliases in the WHERE clause or applying aggregation in the WHERE clause.
- Combinations of `NOT IN` with NULL and comparisons like `= NULL`.
- WHERE clauses where results differ due to AND/OR precedence.
- Results when arguments are passed to functions (SUBSTR, ROUND, NVL, ADD_MONTHS).

When solving problems, first filter rows using FROM and WHERE, then examine the calculated values in SELECT. If NULLs are present, they are evaluated separately for each row.

← Concept map ([SQLD map](#/post/sqld-map))

Related posts: [Details → Joins and Subqueries](#/post/sqld-join-subquery) · [Details → GROUP BY and Set Operations](#/post/sqld-group-set) · [Details → Relational Databases and SQL Basics](#/post/db-rdb-sql)

## Reference Links

- [SELECT (Transact-SQL) — Microsoft Learn (Logical Processing Order)](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql)
- [Oracle NVL](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/NVL.html)
- [Oracle NULLIF](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/NULLIF.html)
- [Oracle LIKE Condition](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Pattern-matching-Conditions.html)
- [Oracle SUBSTR](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SUBSTR.html)
- [Oracle ROUND(number)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ROUND-number.html)
- [Oracle ADD_MONTHS](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ADD_MONTHS.html)