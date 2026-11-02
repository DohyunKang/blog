Normalization addresses problems arising from repeated facts by splitting tables, while transactions group multiple operations so that they either all succeed or all fail. These concepts appear almost every time in the Database section of the Information Processing Engineer exam. You don't need to memorize the exam schedule or fees; check the official website if necessary.

## Why Normalization is Needed

Imagine a single table containing students, subjects, and instructors. Instructor names are repeated as many times as there are students. Such duplication leads to anomalies. In exams, these three types are often distinguished.

| Anomaly | When it occurs | Example |
| --- | --- | --- |
| Insertion anomaly | Cannot insert a value unless unwanted data is also present | A new subject with no enrolled students cannot have a row created |
| Deletion anomaly | Deleting one row causes other information to disappear as well | Removing the last student enrolling in a subject deletes the subject's information |
| Update anomaly | Updating only some duplicate values creates contradictions | Changing an instructor's name in two rows results in two names for one subject |

Normalization is the process of splitting tables based on functional dependencies to prevent this. Basic database concepts are summarized separately at [Details → Database Basics and Data Models](#/post/jb-db-concept).

## Starting with Functional Dependencies

The core issue of normalization boils down to whether you can read dependencies correctly. If knowing A determines B uniquely, B is said to be functionally dependent on A, denoted as A → B. For example, Student ID → Name.

- **Full functional dependency**: The value is determined only when the entire primary key is known. This applies to grades in a composite key (Student ID, Subject).
- **Partial functional dependency**: The value is determined by only part of the composite key. If the name is determined solely by the Student ID within (Student ID, Subject), then the name has a partial dependency.
- **Transitive functional dependency**: Since A → B and B → C, it holds that A → C via the intermediate path. For example, if Student ID → Department and Department → Head of Department, then Student ID → Head of Department is a transitive dependency.

## Normal Forms

Each normal form builds upon the previous one by adding further conditions.

| Normal Form | Additional Condition | What it Eliminates |
| --- | --- | --- |
| First Normal Form (1NF) | All attributes contain atomic values | Multiple values in a single cell |
| Second Normal Form (2NF) | Removal of partial functional dependencies | Attributes dependent on part of the composite key |
| Third Normal Form (3NF) | Removal of transitive functional dependencies | Dependencies passing through non-key attributes |
| BCNF | Every determinant is a candidate key | Determinants that are not candidate keys |
| Fourth Normal Form (4NF) | Removal of multivalued dependencies | Combinations of unrelated multivalued attributes |
| Fifth Normal Form (5NF) | Removal of join dependencies | Join dependencies not passing through candidate keys |

Here's how I memorized them: 1NF ensures one value per cell; 2NF removes attributes hanging off part of the key; 3NF removes dependencies passing through non-key attributes; BCNF requires all determinants to be candidate keys.

<details>
<summary>Understanding 2NF and 3NF decomposition through examples</summary>

Consider a table `Enrollment(StudentID, Subject, Name, Department, HeadOfDepartment, Grade)` with the primary key `(StudentID, Subject)`.

1. Dependencies like StudentID → Name and Department hold true. These are partial dependencies based on part of the key. To achieve 2NF, we must split the table:
   - `Student(StudentID, Name, Department, HeadOfDepartment)`
   - `Enrollment(StudentID, Subject, Grade)`
2. In the Student table, Department → HeadOfDepartment holds true, forming a transitive dependency (StudentID → Department → HeadOfDepartment). To reach 3NF, we split again:
   - `Student(StudentID, Name, Department)`
   - `Department(Department, HeadOfDepartment)`

When decomposing, ensure that rejoining the tables restores the original data without loss (lossless join), and functional dependencies are preserved. I developed the habit of checking these two conditions during problem-solving.
</details>

## Denormalization

Excessive normalization splits tables, increasing the need for joins during queries. If performance becomes an issue, intentional denormalization allowing duplication is applied. Exams often ask about this as the opposite of normalization, noting that while query performance improves, data integrity must be managed more carefully. Physical design topics continue at [Details → DB Physical Design and Distributed DB](#/post/jb-physical-design).

## Transactions and ACID

A transaction represents a single logical unit of work. A bank transfer requires both withdrawal and deposit to be completed; thus, two SQL statements are grouped into one. This grouping must adhere to four properties known as ACID.

| Property | Meaning | Ensured by |
| --- | --- | --- |
| Atomicity (A) | Either all operations execute or none do | Recovery mechanisms |
| Consistency (C) | Constraints are maintained before and after execution | Integrity constraints |
| Isolation (I) | Intermediate results of an executing transaction are invisible to others | Concurrency control |
| Durability (D) | Committed results persist even after a failure | Logs |

I tested atomicity directly using SQLite. I enforced a constraint preventing negative balances and violated it during a transfer.

```python
import sqlite3
c = sqlite3.connect(":memory:", isolation_level=None)
c.execute("create table acct(id integer primary key, bal int check(bal>=0))")
c.execute("insert into acct values(1,1000),(2,0)")
try:
    c.execute("begin")
    c.execute("update acct set bal=bal-300 where id=1")
    c.execute("update acct set bal=bal+300 where id=2")
    c.execute("update acct set bal=bal-900 where id=1")  # 700-900 < 0
    c.execute("commit")
except sqlite3.IntegrityError as e:
    c.execute("rollback")
    print("rollback:", e)
print(c.execute("select * from acct").fetchall())
```

Executing this produces `rollback: CHECK constraint failed: bal>=0`, and the balance remains at its initial state `[(1, 1000), (2, 0)]`. Even though the previous two `UPDATE` statements succeeded, they are rolled back together. This demonstrates atomicity. The SQL syntax for this flow (`COMMIT`, `ROLLBACK`, `SAVEPOINT`) continues in [detailed → SQL application](#/post/jb-sql-basic).

## Concurrency Control and Isolation Levels

These phenomena occur when isolation is violated during concurrent execution of multiple transactions.

- **Lost Update**: Two transactions read the same value, each modifies it, and one result overwrites the other.
- **Dirty Read**: Reading data from another transaction that has not yet committed.
- **Non-repeatable Read**: Reading the same row twice yields different values because another transaction modified it in between.
- **Phantom Read**: Two queries with the same condition return a different number of rows because new rows were inserted or deleted by another transaction.

The four standard isolation levels and their allowed phenomena are confirmed in the table from PostgreSQL documentation.

| Isolation Level | Dirty Read | Non-repeatable Read | Phantom Read |
| --- | --- | --- | --- |
| Read Uncommitted | Allowed | Allowed | Allowed |
| Read Committed | Prevented | Allowed | Allowed |
| Repeatable Read | Prevented | Prevented | Allowed |
| Serializable | Prevented | Prevented | Prevented |

This table follows the SQL standard; actual implementations may differ. For example, PostgreSQL behaves like `Read Committed` internally even when `Read Uncommitted` is specified, and phantom reads do not occur even in `Repeatable Read`. SQLite defaults to the serializable level for all transactions. For exam purposes, you can base your answers on the standard table.

Higher isolation levels provide greater safety but reduce concurrency. This trade-off frequently appears in exams.

### Concurrency Control Techniques

| Technique | Core Concept |
| --- | --- |
| Locking | Controls access by placing locks on data. Includes shared (read) and exclusive (write) locks. |
| Two-Phase Locking (2PL) | Divides locking into an expansion phase (acquiring more locks) and a contraction phase (releasing locks), guaranteeing serializability. |
| Timestamp Ordering | Determines operation order based on start timestamps. |
| Optimistic Concurrency Control | Executes first and validates conflicts just before commit. |
| Multi-Version Concurrency Control (MVCC) | Maintains multiple versions of data to allow reads without blocking writes. |

<details>
<summary>Summary of Deadlocks and 2PL</summary>

While 2PL guarantees serializability, it does not prevent deadlocks. A deadlock occurs when T1 holds resource A and waits for B, while T2 holds B and waits for A, causing them to wait indefinitely. Solutions are generally categorized into three approaches:

- **Prevention**: Request all necessary locks at once or impose an order on resources.
- **Avoidance**: Check for potential deadlocks upon each request and allow only if safe.
- **Detection and Recovery**: If a cycle appears in the wait-for graph, treat it as a deadlock and roll back one victim transaction.

SQLite documentation notes that in WAL mode, if a read transaction attempts to upgrade to write while another connection commits, an `SQLITE_BUSY_SNAPSHOT` error occurs. Therefore, if you intend to write, use `BEGIN IMMEDIATE` to acquire write locks from the start. Although this is outside the exam scope, understanding how locking and snapshots actually manifest is helpful.
</details>

## Recovery

Logs are used to maintain atomicity and durability in case of failures. Logs contain the transaction ID, target data, Before Image (value before change), and After Image (value after change).

| Technique | Operation |
| --- | --- |
| REDO | Re-executes committed transactions using the log's after images. |
| UNDO | Rolls back uncommitted transactions using the log's before images. |
| Immediate Update | Reflects changes in the DB immediately, even before commit. Both REDO and UNDO may be needed during failure. |
| Deferred Update | Reflects changes at commit time. Usually, only REDO is required. |
| Checkpoint | Confirms application up to a specific point to reduce the recovery scope. |
| Shadow Paging | Instead of logs, keeps page copies and swaps them at commit time. |

Checkpoint issues often involve distinguishing transaction types via logs: "This transaction needs REDO, that one needs UNDO." Transactions committed before the checkpoint are already reflected and require no action; those committed after the checkpoint need REDO, while those not committed at the failure point need UNDO.

## Common Question Types and Solution Order

- Distinguishing Anomalies: Determine whether the situation involves insertion, deletion, or update by removing and reinserting rows to verify.
- Normalization Check: First identify the primary key, then express dependencies using arrows, and examine them in the order of partial dependency → transitive dependency → determinant.
- Matching ACID Properties: Atomicity is paired with recovery; Isolation is paired with concurrency control; Durability is memorized as being paired with logs.
- Isolation Level Table: Draw the table such that lower levels allow more anomalies, filling in the blanks accordingly.
- Recovery Techniques: Draw lines for checkpoints and commit points to divide REDO and UNDO.

The original text of past exam questions has not been translated. For recent exams, it is appropriate to solve them directly from official sites or services providing past questions.

← [Concept Map for (Information Processing Engineer)](#/post/jb-map)

Related posts: [Database Fundamentals and Data Models](#/post/jb-db-concept) · [SQL Application](#/post/jb-sql-basic) · [DB Physical Design and Distributed DB](#/post/jb-physical-design)

## Reference Links

- [SQLite: Isolation In SQLite](https://www.sqlite.org/isolation.html)
- [PostgreSQL Documentation: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)