A transaction is a unit that groups multiple SQL statements to be executed either all or none, and the isolation level is a setting that determines how much intermediate state of concurrently running transactions are visible to each other.

## What is a Transaction?

Think of a bank transfer: it requires two queries—one to deduct 30 won from account A and another to add 30 won to account B. If only the first query executes and the server crashes, the 30 won disappears. A transaction groups these two queries to ensure that "either both are reflected or both are undone."

```sql
BEGIN;
UPDATE acc SET bal = bal - 30 WHERE id = 1;
UPDATE acc SET bal = bal + 30 WHERE id = 2;
COMMIT;   -- 문제가 생기면 COMMIT 대신 ROLLBACK
```

Executing `COMMIT` finalizes the entire group, while executing `ROLLBACK` cancels all changes made since `BEGIN`. I tested this myself: using Python's sqlite3, I deducted 30 from account A, deliberately raised an exception, and rolled back; the balance remained exactly as `[(1, 100), (2, 0)]`. No half-state remains even if something dies in the middle.

## ACID

The four properties that a transaction upholds are referred to by their first letters: ACID.

| Letter | Name | In a Nutshell |
|---|---|---|
| A | Atomicity (원자성) | All or nothing |
| C | Consistency (일관성) | Constraints (PK, FK, CHECK, etc.) are not violated after completion |
| I | Isolation (격리성) | Concurrent transactions appear not to interfere with each other |
| D | Durability (지속성) | Committed changes persist even after a failure |

Atomicity and durability are relatively easy to understand. The confusing ones are consistency and isolation. Consistency does not mean the database magically enforces business rules; rather, it ensures that constraints declared by me cannot be violated at the end of a transaction. Isolation ranges from "no interference at all" to "some visibility," and these stages define the isolation levels. This is where the main discussion begins.

## Problems Arising When Running Concurrently

If only one transaction runs at a time, there are no issues. However, when multiple transactions run concurrently, strange things can happen. The PostgreSQL documentation defines four such phenomena:

- Dirty read: Reading changes from another transaction that has not yet committed.
- Nonrepeatable read: Reading the same row twice and finding its value changed because another transaction committed in between.
- Phantom read: Querying with the same condition twice and finding that the set of rows matching the condition has changed due to a committed transaction in between.
- Serialization anomaly: The result of concurrently committed transactions does not match any possible outcome if those transactions were executed serially one after another.

[More details → Index](#/post/db-index) discusses query speed, whereas this section addresses "what is visible when accessing the same data concurrently."

## Isolation Levels

The SQL standard defines four isolation levels, differing in which of the above phenomena are allowed at each level. The standard specifications are as follows:

| Isolation Level | Dirty Read | Nonrepeatable Read | Phantom Read | Serialization Anomaly |
|---|---|---|---|---|
| Read Uncommitted | Allowed | Allowed | Allowed | Allowed |
| Read Committed | Not Allowed | Allowed | Allowed | Allowed |
| Repeatable Read | Not Allowed | Not Allowed | Allowed | Allowed |
| Serializable | Not Allowed | Not Allowed | Not Allowed | Not Allowed |

Moving upward makes things looser and faster; moving downward makes them stricter and more expensive. However, these are the minimum requirements of the standard, and actual database implementations may vary. According to the PostgreSQL documentation:

- Read Uncommitted accepts the name but actually behaves like Read Committed, so dirty reads do not occur.
- Repeatable Read is stronger than the standard; it also prevents phantom reads, though serialization anomalies may still occur.
- The default level is Read Committed. The documentation states that "each statement sees a new snapshot."

MySQL (InnoDB) and other databases might behave differently even with the same name. This article is based solely on PostgreSQL behavior as verified.

## Differences at Each Level (PostgreSQL)

At Read Committed, `SELECT` only sees data committed before the query starts. If the same `SELECT` is executed twice within a transaction, the results may differ if another transaction commits in between.

Repeatable Read fixes the snapshot at the first statement of the transaction. Subsequent `SELECT`s continue to see the same data. However, if another transaction modifies and commits the row you intend to update before you do, this error occurs:

```
ERROR:  could not serialize access due to concurrent update
```

The documentation advises stopping the current transaction and retrying everything from the beginning in such cases.

Serializable goes beyond Repeatable Read by detecting dependencies that could cause results to differ under sequential execution, rolling back one of the transactions. Using this level requires the application to prepare for retries; as documented, a serialization failure returns SQLSTATE `40001`.

In short, the higher the isolation level, the more "fail and retry" logic falls on the application's shoulders. The cost of strictness is not just performance—it also includes retry code.

## What Isolation Levels Alone Cannot Prevent: Lost Updates

When discussing isolation levels, it's easy to overlook lost updates. This occurs when a code path reads a value, performs calculations, and then overwrites it. I reproduced this scenario in Python. Starting with an account balance of 100, two connections attempt to deduct 30 and 50 respectively; the expected remaining balance is 20.

```python
x = a.execute("select bal from acc where id=1").fetchone()[0]   # 100
y = b.execute("select bal from acc where id=1").fetchone()[0]   # 100
a.execute("update acc set bal=? where id=1", (x - 30,))
b.execute("update acc set bal=? where id=1", (y - 50,))
# 결과: 50 (기대값 20)
```

Since both transactions read 100, calculated their respective deductions, and overwrote the value, the first update of -30 was lost. This experiment was run with sqlite3 (I did not install PostgreSQL to test it). The purpose here is to demonstrate issues inherent in the common read-calculate-write pattern. The solution is to hand off the calculation to the database.

```python
a.execute("update acc set bal = bal - 30 where id=1")
b.execute("update acc set bal = bal - 50 where id=1")
# 결과: 20
```

`bal = bal - 30` is handled within a single statement by the DB, so overwriting does not occur.

## Locks: Pessimistic vs. Optimistic

When you must make decisions in the application based on read values, you use locks. There are two approaches.

Pessimistic locking takes the stance of "since collisions seem likely, let's lock first." In PostgreSQL, this is done using `SELECT ... FOR UPDATE`. According to the documentation, rows read under this mode cannot be locked, modified, or deleted by other transactions until the current transaction ends; attempts to do so will wait until the transaction completes.

```sql
BEGIN;
SELECT bal FROM acc WHERE id = 1 FOR UPDATE;   -- 이 행을 잠근다
UPDATE acc SET bal = bal - 30 WHERE id = 1;
COMMIT;
```

Optimistic locking takes the stance of "collisions are unlikely, so proceed first and verify upon save." Typically, a `version` column is added to rows, and an update is applied only if the version matches the one read at the time of access.

```python
def save(conn, body, ver):
    return conn.execute(
        "update doc set body=?, ver=ver+1 where id=1 and ver=?", (body, ver)
    ).rowcount

save(a, 'A', 1)   # 1  (성공)
save(b, 'B', 1)   # 0  (이미 ver이 2라서 갱신된 행이 없음 -> 충돌)
```

If `rowcount` is 0, it means someone else modified the row first; thus, you must re-read and retry. In actual testing, A returned 1 and B returned 0.

| | Pessimistic Locking | Optimistic Locking |
|---|---|---|
| Method | Locks on read | Version check on save |
| When collisions are frequent | Stable due to waiting | Wasteful due to many retries |
| When collisions are rare | Only incurs locking overhead | Lightweight |
| Caution | Long-held locks cause waiting and deadlocks | Requires retry logic |

Rather than declaring one superior, it's better to choose based on how frequent collisions are.

## Deadlocks

Using locks can lead to deadlocks (circular waits). For instance, if Transaction 1 modifies account 11111 and then attempts to modify 22222, while Transaction 2 modifies 22222 and then attempts to modify 11111, they will wait indefinitely for each other's held locks.

PostgreSQL documentation states that deadlocks are automatically detected, and one of the related transactions is aborted. It also notes that you cannot predict which transaction will be terminated. The primary prevention method cited is "always acquiring locks on multiple objects in the same order." In the example above, no deadlock would have occurred if both transactions had updated in the same order. If maintaining a consistent order is difficult, another option is to retry transactions aborted due to deadlocks. Furthermore, the documentation warns against keeping transactions open for too long by waiting for user input while holding locks.

Once again, the conclusion is retry. Serialization failures, optimistic locking collisions, and deadlocks are all resolved by "starting over from scratch."

## Common Misconceptions

- **Wrapping in a transaction eliminates concurrency issues:** Transactions ensure atomicity. Concurrency is managed by isolation levels and locks; under the default Read Committed level, patterns like lost updates can still occur.
- **Using only Serializable solves everything:** While it prevents conflicts, it causes transactions to fail, and without retry logic, errors are passed directly to the user.
- **Isolation level names mean the same across databases:** Standards define minimum requirements only; implementations differ. Even PostgreSQL maps Read Uncommitted to behave like Read Committed.
- **Locks slow things down, so avoid them:** In areas with frequent collisions, locks actually prevent a storm of retries.

<details>
<summary>Detailed explanation: Why do snapshots and MVCC come up?</summary>

The reason PostgreSQL documents cite for mapping Read Uncommitted to Read Committed is that it is "the only reasonable way consistent with PostgreSQL's multiversion concurrency control structure." Rows are not overwritten but kept in different versions, allowing each transaction to read the version valid at its own start time. This structure prevents reads from blocking writes. Consequently, there is no way to read "dirty" intermediate values.
</details>

The same applies to what I verified above using sqlite3. When querying with a read connection before the write connection commits, the value remains 100; after commit, it becomes 999. However, since SQLite operates differently from PostgreSQL, it was not used for comparing isolation levels.

</details>

<details>
<summary>Detailed explanation: Terminology</summary>

- Commit: Finalizes changes within a transaction.
- Rollback: Undoes changes made in a transaction.
- Snapshot: The state of data as seen at a specific point in time.
- Serializable: Ensures that even when executed concurrently, the result is equivalent to if it were run sequentially.

</details>

## Reference Links

- PostgreSQL documentation, Transaction Isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- PostgreSQL documentation, Explicit Locking (deadlock, SELECT FOR UPDATE): https://www.postgresql.org/docs/current/explicit-locking.html

← [Concept map](#/post/db-map)

Related posts: [Indexes](#/post/db-index) · [Relational Databases and SQL Basics](#/post/db-rdb-sql) · [Normalization and Modeling](#/post/db-normalization)