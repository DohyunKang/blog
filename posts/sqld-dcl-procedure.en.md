In the SQLD course, this unit is relatively short. However, since questions frequently test the differences between GRANT and REVOKE options, what a role is, and how procedures, functions, and triggers differ, I have summarized these key points here. For information regarding schedules and registration, please check the official website.

SQL commands are categorized into DDL, DML, TCL, and DCL based on their nature. The first three were covered in [DML·TCL·DDL and Constraints](#/post/sqld-dml-ddl), while this article focuses on the remaining DCL and Procedural SQL.

## What is DCL?

DCL (Data Control Language) consists of commands that control access permissions to data. There are two types that appear in exams.

| Command | Function |
|---|---|
| GRANT | Grants permissions to a user or role |
| REVOKE | Revokes previously granted permissions |

Permissions fall into two categories. System privileges relate to the entire database, such as creating tables or connecting sessions. Object privileges relate to specific objects, such as performing SELECT or UPDATE on a particular table. The syntax also differs between these two. Below is the format from Oracle's official documentation.

```sql
-- 시스템 권한·롤
GRANT 시스템권한 | 롤 TO 대상 [WITH ADMIN OPTION];

-- 객체 권한
GRANT 객체권한 ON 객체 TO 대상 [WITH GRANT OPTION];
```

The grantee (target) can be a user, a role, or PUBLIC. PUBLIC refers to all users.

## Two Options That Are Most Confusing

WITH ADMIN OPTION and WITH GRANT OPTION have similar names but apply to different targets. Exam questions often swap these two options to test you.

| | WITH ADMIN OPTION | WITH GRANT OPTION |
|---|---|---|
| Where it applies | System privileges, Roles | Object privileges |
| What the recipient can do | Can grant that privilege or role to others | Can grant that object privilege to other users or roles |
| Restrictions | According to documentation, GLOBAL roles cannot be granted | Cannot be granted to a role |

A simple way to remember this is: ADMIN applies to System/Roles, and GRANT applies to Objects. There is no separate command to remove just the option; to remove it, you must revoke the entire privilege and then grant it again without the option.

<details>
<summary>Cascading revocation in REVOKE</summary>

When object privileges are revoked, they are deleted cascadingly. If A granted an object privilege to B with WITH GRANT OPTION, and B subsequently granted it to C, revoking A's privilege from B will also remove C's privilege. The documentation example showed that revoking a user's UPDATE privilege also removed the privileges passed on by that user to others relying on them. Procedures or functions depending on those object privileges can no longer be executed, and views created on those objects become invalid.

When revoking system privileges or roles, the documentation does not explicitly state that they cascade to other people. Exams often distinguish between them with questions like "Object privilege revocation cascades, but system privilege revocation does not."

REVOKE also includes CASCADE CONSTRAINTS. This option is only meaningful when revoking REFERENCES privileges (or ALL); it removes the referential integrity constraints created by the other party using that privilege. If the other party has created such constraints, this option is mandatory.

```sql
REVOKE REFERENCES ON hr.employees FROM oe CASCADE CONSTRAINTS;
```
</details>

## Roles (ROLE)

Granting permissions individually to each user becomes difficult to manage as the number of users grows. A role is a collection of multiple permissions grouped together under a name. You can store permissions in a role and then grant that role to a user.

- When a role is granted to a user, that user can use those permissions. According to the documentation, the role must be enabled within the session for the privileges to actually take effect.
- A role can also be granted to another role. The receiving role then inherits the combined permissions. Circular granting (mutual exchange) is not allowed.
- Granting a role to PUBLIC allows all users to use it.
- REFERENCES privileges cannot be granted to a role.

In exams, statements like "Using roles makes permission management easier" are often the correct answer. Each DBMS comes with pre-defined roles, but their names and compositions vary by product, so check the documentation for the specific DBMS you are using.

## Procedural SQL

Standard SQL executes one statement at a time. Procedural SQL incorporates programming elements such as variables, conditional statements, and loops into SQL to combine multiple statements into one, which is then stored within the database with a name. Oracle calls this PL/SQL, while SQL Server calls it T-SQL. There are three types of storage units:

| Type | Invocation | Returns Value | Characteristics |
|---|---|---|---|
| Procedure | Explicitly called | Not required | Accepts parameters and bundles multiple operations |
| Function | Explicitly called | Returns one value | Can be used within SQL statements because it returns a value |
| Trigger | Automatically executes on an event | None | Has no parameters and cannot be called directly |

Oracle documents describe a trigger as "a named PL/SQL unit stored in the database that is automatically executed by the DB when a system-defined event (such as DML on a table) occurs." While you can enable or disable them, you cannot call them directly, nor can you redefine events for them. This distinction is the key to separating triggers from procedures and functions.

### How to Read About Triggers

Exams often ask questions about trigger names and their components. There are three things to know:

- **BEFORE / AFTER**: Indicates whether the code executes before or after the event statement. In a BEFORE trigger, you can modify values before they are written.
- **Row-level / Statement-level**: If `FOR EACH ROW` is included, it runs once for each affected row; if not, it runs once per statement. Even if zero rows are affected, a statement-level trigger still executes once.
- **:OLD / :NEW**: Represent the values before and after the change in a row. These are used only in row-level triggers. For `UPDATE`, both apply; for `INSERT`, only `:NEW` is meaningful; for `DELETE`, only `:OLD` is meaningful.

```sql
CREATE OR REPLACE TRIGGER emp_bi
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
  :NEW.created_on := SYSDATE;
END;
/
```

The above is an example from Oracle documentation, where the current timestamp is inserted into a creation date column before a row is inserted.

I wanted to verify the behavior directly, so I ran the same structure using SQLite. While SQLite uses `old.` instead of `:OLD` and has slightly different syntax, the flow of reading pre- and post-change values in a row-level AFTER UPDATE trigger and logging them to a log table remains the same.

```sql
create table emp(id integer primary key, name text, sal integer);
create table sal_log(emp_id int, old_sal int, new_sal int);
create trigger trg_sal after update of sal on emp for each row
begin insert into sal_log values(old.id, old.sal, new.sal); end;

insert into emp values(1, 'kim', 300);
update emp set sal = 350 where id = 1;
select * from sal_log;   -- (1, 300, 350)
```

After changing a salary from 300 to 350, the log accumulated one line: `(1, 300, 350)`. The fact that the trigger fired with just a single `UPDATE` without being explicitly called is what distinguishes it from procedures.

## Common Question Types

- **Matching Options**: `ADMIN OPTION` applies to system privileges and roles, whereas `GRANT OPTION` applies to object privileges. Swapping these results in an incorrect answer.
- **Revocation Results**: If object privileges are transferred A→B→C, and then A revokes privileges from B, the privileges held by C also disappear.
- **Nature of Roles**: Roles are collections of privileges designed for management convenience. They can be granted to users or other roles.
- **Distinguishing Procedures, Functions, and Triggers**: Do they get called (procedures/functions) or run automatically (triggers)? Do they return values (functions)?
- **Trigger Components**: Understanding where `BEFORE/AFTER`, row/statement-level, and `:OLD/:NEW` are meaningful within specific events.

When solving problems, start by looking for keywords in the question. If an option mentions "automatically," it's likely a trigger; if it mentions "return," it's a function; if it mentions "object," focus on `GRANT OPTION`. This usually narrows down the choices to two or three. Also consider whether the database management system (DBMS) in question is Oracle, SQL Server, etc., as detailed syntax varies by product.

For further reading on related topics, check out articles covering constraints and DDL: [DML·TCL·DDL and Constraints](#/post/sqld-dml-ddl), basic query syntax: [SELECT and Functions](#/post/sqld-select-func), and the overall flow overview in [SQLD map](#/post/sqld-map).

← Concept Map ([#/post/sqld-map])

## Reference Links

- Oracle Database SQL Language Reference, GRANT: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/GRANT.html
- Oracle Database SQL Language Reference, REVOKE: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/REVOKE.html
- Oracle Database PL/SQL Language Reference, Triggers: https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-triggers.html