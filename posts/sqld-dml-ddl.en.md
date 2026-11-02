SQL commands are grouped based on their function. Operations that insert, update, or delete rows are DML; operations that commit or roll back those changes are TCL; and operations that create, alter, or drop tables themselves are DDL. Exams often start by asking about this classification, followed by questions on how each command differs.

## Classification First

| Category | Name | Commands | Function |
|---|---|---|---|
| DML | Data Manipulation Language | SELECT, INSERT, UPDATE, DELETE, MERGE | Reads and modifies rows |
| DDL | Data Definition Language | CREATE, ALTER, DROP, RENAME, TRUNCATE | Handles the structure of objects like tables |
| DCL | Data Control Language | GRANT, REVOKE | Grants or revokes permissions ([details → DCL](#/post/sqld-dcl-procedure)) |
| TCL | Transaction Control Language | COMMIT, ROLLBACK, SAVEPOINT | Confirms or rolls back DML results |

The confusing part is TRUNCATE. Although it deletes rows and seems like DML, its category is actually DDL. This single line is a frequent trap in exams, so memorize it separately.

The examples below were run directly using SQLite, which is included in Python. Since SQLite has some dialect differences, any parts that differ from Oracle syntax (the standard for exams) will be noted as needed.

## DML: INSERT, UPDATE, DELETE

We start by creating a table like this. Constraints are explained later.

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

With INSERT, specifying column names is safer. If you omit columns, all values must be provided in the order defined in the table; if you add a column, it will break. In the INSERT above, since `sal` was not specified, the DEFAULT value of 3000 was inserted (`[(1, 'kim', 3000, 10)]`).

UPDATE is all about WHERE. Without WHERE, all rows are modified. Running a statement to raise salaries by 500 only for the development department yields this result.

```sql
UPDATE emp SET sal = sal + 500 WHERE dept_id = 20;
-- (1, 3000), (5, 2500)  ← 5번 사원(원래 2000)만 올랐다
```

DELETE works similarly. Without WHERE, all rows are deleted. Additionally, trying to delete a parent row (e.g., Sales Department) that is referenced by child rows will be blocked due to foreign keys. In SQLite, you must enable `PRAGMA foreign_keys=ON` to enforce this restriction (the default is off).

<details>
<summary>Frequent Exam Pattern: UPDATE/INSERT Using Subqueries</summary>

- `UPDATE ... SET column = (subquery)`: The subquery must return exactly one row and one value; otherwise, an error occurs.
- `INSERT INTO A SELECT ... FROM B`: Instead of VALUES, the entire result of SELECT is inserted. The number and types of columns must match.
- Exams often ask "how many rows are affected" or "where does the error occur," so practice counting the number of rows matching WHERE conditions directly.
</details>

## MERGE

This command performs an UPDATE if a row exists, or an INSERT if it doesn't, all in one statement. It matches source (USING) and target (INTO) based on ON conditions, then proceeds with `WHEN MATCHED` for matching rows and `WHEN NOT MATCHED` for non-matching ones. An example from Oracle documentation is as follows:

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

According to the documentation, three points must be understood: either the UPDATE clause or the INSERT clause must be present; columns specified in the ON clause cannot be modified via UPDATE; and a single target row cannot be updated twice within one MERGE statement.

SQLite does not have MERGE but offers UPSERT for a similar purpose. If inserting into an existing key (e.g., emp_id=1), it updates instead.

```sql
INSERT INTO emp VALUES (1,'kim2',9,10)
ON CONFLICT(emp_id) DO UPDATE SET ename = excluded.ename, sal = excluded.sal;
-- (1, 'kim2', 9, 10)
```

## TCL: Transactions

A transaction is a unit of work that either fully succeeds or fails entirely. For example, in a fund transfer, if only the withdrawal occurs without the deposit, both operations must be treated as a single unit. More in-depth discussions are available [here → Transaction](#/post/db-transaction).

- COMMIT: Confirms all DML performed so far.
- ROLLBACK: Undoes changes made since the last COMMIT.
- SAVEPOINT: Creates an intermediate save point, allowing rollback to that point using `ROLLBACK TO name`.

Here are the results from running these directly:

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

A common exam question involves sequence issues like "after a SAVEPOINT, what remains after executing ROLLBACK TO?" If you understand that only changes after the savepoint are undone while earlier changes remain, you can solve it.

<details>
<summary>Transaction Properties (ACID) and Automatic DDL Commit</summary>

- Atomicity: Either all changes are applied, or none are.
- Consistency: Database rules (constraints) are maintained before and after execution.
- Isolation: Concurrent transactions cannot see each other's intermediate states.
- Durability: Once committed, results persist even in the event of a failure.
- It is known that DDL statements in Oracle are automatically committed immediately upon execution; therefore, executing a DDL statement after a DML statement will also commit the preceding DML. This point often trips students up on exam questions asking whether a "ROLLBACK" is possible.
</details>

## DDL: CREATE, ALTER, DROP, TRUNCATE

We have already covered `CREATE`. `ALTER` modifies the structure of an existing table. Adding a column looks like this:

```sql
ALTER TABLE emp ADD COLUMN email TEXT;   -- 열: emp_id, ename, sal, dept_id, email
```

Oracle uses forms such as `ADD`, `MODIFY` (for changing type or size), `DROP COLUMN`, and `RENAME COLUMN`. SQLite has a different scope of support, so we verified it using `ADD COLUMN` as shown above.

The most frequently asked question in exams concerns the differences among the three deletion commands.

| Command | Category | Target Removed | Rollback Possible | WHERE Clause Supported |
|---|---|---|---|---|
| DELETE | DML | Rows (selected) | Yes (before COMMIT) | Yes |
| TRUNCATE | DDL | All rows (structure remains) | No | No |
| DROP | DDL | Table itself | No | N/A |

Oracle documentation states that `TRUNCATE` cannot be rolled back and cannot be recovered via `FLASHBACK TABLE`. Unlike deleting a table and recreating it, permissions, indexes, and constraints remain intact. In contrast, `DROP` removes the entire table definition; after executing `DROP TABLE emp`, the `emp` object disappears from the schema list.

## Constraints

Constraints are rules enforced by the database to prevent invalid values from being entered. We tested what errors occur by intentionally inserting incorrect values into the table above.

| Constraint | Meaning | Attempted Input | Result |
|---|---|---|---|
| NOT NULL | Prohibits empty values | NULL in `ename` | Rejected |
| PRIMARY KEY | Prohibits duplicates and NULLs; represents a row | Duplicate `emp_id=1` | Rejected (UNIQUE violation) |
| UNIQUE | Prohibits duplicates (NULLs allowed) | Duplicate `dname '영업'` | Rejected |
| CHECK | Must satisfy the condition | `sal = -1` | Rejected |
| FOREIGN KEY | Only allows values existing in the parent table | Non-existent `dept_id=99` | Rejected |
| DEFAULT | Provides a default value if none is given | Omitted `sal` | 3000 |

Strictly speaking, `DEFAULT` is not a constraint but a default value; however, it is often grouped and memorized together. Common exam points include: that a `PRIMARY KEY` combines `UNIQUE` and `NOT NULL`, and while only one `PK` can exist per table, multiple `UNIQUE` constraints are allowed. The concept of identifiers referenced by foreign keys continues in [Relation and Identifiers](#/post/sqld-relation-identifier).

<details>
<summary>Foreign Keys and Delete Options</summary>

When deleting a parent row with child rows present, the default behavior is to prevent deletion (as seen earlier when deleting the Sales department was blocked). This behavior can be changed using options:

- `ON DELETE CASCADE`: Deletes child rows along with the parent.
- `ON DELETE SET NULL`: Sets the foreign key column of the child to NULL.
- Conversely, dropping a parent table usually fails if children reference it.
</details>

## Common Misconceptions

- "TRUNCATE is just a faster version of DELETE and thus DML." It is actually DDL and cannot be rolled back.
- "NULLs cannot be inserted into UNIQUE columns." This restriction applies to `PRIMARY KEY`, not `UNIQUE`.
- "Using no WHERE clause in UPDATE causes an error." No error occurs; all rows are updated.
- "ROLLBACK also undoes DDL." In Oracle, since DDL is automatically committed, it cannot be rolled back.

For detailed information on `SELECT` functions and conditions, see [SELECT and Functions](#/post/sqld-select-func). The overall flow is available in the map.

← [Concept Map](#/post/sqld-map)

Related articles: [DCL and Procedural SQL](#/post/sqld-dcl-procedure) · [Transactions](#/post/db-transaction) · [Relation and Identifiers](#/post/sqld-relation-identifier)

## Reference Links

- Oracle Database SQL Language Reference, MERGE: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/MERGE.html
- Oracle Database SQL Language Reference, TRUNCATE TABLE: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TRUNCATE-TABLE.html