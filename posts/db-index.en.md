An index is a separate structure that stores values sorted independently of the table, allowing the database to locate matching rows directly without scanning from the beginning. However, since it must be updated every time data changes, it's not free.

## What is an Index?

Suppose you want to find a single row in a table using a condition like `WHERE email = '...'`. Without an index, the database reads from the first row to the last. This is a full scan. If there are only ten rows, this isn't a problem, but things change drastically with twenty thousand or twenty million rows.

An index is similar to an index at the back of a book. Words are sorted alphabetically, and page numbers are listed next to them. The SQLite documentation explains it similarly: an index is a separate structure that stores the indexed column values and the original row's `rowid` in sorted order. If values are identical, the `rowid` determines the order. Because it is sorted, binary search becomes possible; thus, the time to find data is proportional to log N rather than N. The documentation estimates that for a table with ten million rows, this difference amounts to about a million-fold improvement.

[Read more → Relational Databases and SQL Basics](#/post/db-rdb-sql) first to understand tables and keys; you'll find this article easier to follow afterward. While most databases automatically create an index on the primary key, implementation details vary by database, so always check the specific database documentation.

## How Does a B-Tree Look?

The most common index structure is the B-Tree. *Use The Index, Luke* introduces an index as a combination of "doubly linked list + search tree." At the bottom layer (the leaf), sorted index entries are connected in sequence, while layers above provide guidance such as "this range belongs to this slot." As a balanced tree, the depth from top to bottom remains the same regardless of which value you search for.

Visually, it looks like this:

```
        [ 50 | 100 ]              <- 루트: 어느 구간인지만 알려 줌
       /     |     \
 [10|30]  [60|80]  [120|150]      <- 중간층
   |        |         |
 리프: 10 20 30 | 55 60 70 80 | 120 130 150 ...  (정렬된 채로 서로 연결)
```

To find 61, you start at the root, go down to "between 50 and 100," then to the middle layer's "slot 60–80," and finally reach the leaf near 61. After descending three levels, you're done. The more items stored per node, the shallower the tree becomes. For instance, if a node holds 100 entries, three layers could point to one million leaf nodes (this is just arithmetic; actual database numbers differ). The key point is that even if data grows tenfold, the number of layers increases by only one or two.

Since leaves are connected and sorted, this structure also aids range queries (`BETWEEN`) and sorting (`ORDER BY`). Once a starting point is found, you can simply read sequentially to the side.

<details>
<summary>Detailed explanation: Cost of finding one row vs. multiple rows</summary>

According to the SQLite documentation, finding one row using an index requires two binary searches: first to find the `rowid` in the index, and second to retrieve the row from the original table using that `rowid`. If K rows match the condition, the cost is approximately (K+1)·log N. The first row is found via search, while subsequent rows are read by moving to the next entry in the index.

However, when K grows large enough to represent a significant portion of the table, the dynamics change. Scanning the entire table might become more efficient than traversing the table one row at a time using the index. The database uses statistics to decide which approach to take. The exact formula for this decision criterion varies by database.

</details>

## I Ran the Test Myself

I inserted 200,000 rows into a user table in SQLite (version 3.50.4) and searched for one email address. All emails were unique, while city and age were randomized.

```python
import sqlite3, random, time
c = sqlite3.connect(':memory:')
c.execute("create table users(id integer primary key, email text, city text, age int)")
random.seed(1)
cities = ['서울','부산','대구','인천','광주']
c.executemany("insert into users(email,city,age) values(?,?,?)",
    [(f"u{i}@ex.com", random.choice(cities), random.randint(18,70)) for i in range(200000)])

q = "select * from users where email='u123456@ex.com'"
for r in c.execute("explain query plan " + q): print(r[3])
c.execute("create index idx_email on users(email)")
for r in c.execute("explain query plan " + q): print(r[3])
```

The results were as follows:

| | Execution Plan | Time Taken (Single Measurement) |
|---|---|---|
| Before Index | `SCAN users` | ~4.17ms |
| After Index | `SEARCH users USING INDEX idx_email (email=?)` | ~0.019ms |

Since this was a single measurement, the exact ratio isn't meaningful; what matters is that the operation switched from a full scan to an index search, and execution time dropped by more than an order of magnitude. Performance varies by computer.

## Verifying via Execution Plan

The code above used `EXPLAIN QUERY PLAN` to display the execution plan. Just creating an index doesn't guarantee the query will use it, so you should develop the habit of checking the plan after creation.

Based on PostgreSQL documentation, `EXPLAIN` shows the plan chosen by the database without executing the query. Here are a few key observations:

- `Seq Scan`: Reads the entire table (SQLite uses `SCAN`).
- `Index Scan`: Finds rows via an index and then retrieves them from the table. As noted in the documentation, this is typically chosen for high selectivity conditions, similar to single-row lookups.
- `cost`: Represents start cost and total cost; units are arbitrary and not measured in milliseconds (ms).
- `rows`: The estimated number of rows expected at that step. Since it's an estimate, it can be incorrect.

`EXPLAIN ANALYZE` executes the query in real life and displays both the actual time and the actual number of rows. It is said that a large discrepancy between the estimated row count and the actual row count signals that the statistics are outdated. The documentation advises wrapping `UPDATE` and `DELETE` operations with `BEGIN`/`ROLLBACK` when actually executing them. I did not run PostgreSQL directly; I only read the documentation on this part.

## Cases Where Indexes Are Not Helpful

I examined execution plans for several queries on the same table, which already has an email index.

| Query | Execution Plan |
|---|---|
| `email = 'u123456@ex.com'` | Index Scan |
| `email like '%123456@ex.com'` | `SCAN users` (Full Scan) |
| `lower(email) = '...'` | `SCAN users` (Full Scan) |

A `LIKE '%...'` pattern starting with a wildcard cannot determine the starting point in sorted order, so the index cannot be used. It is like looking up "words ending in 'love'" in a dictionary. Applying a function to a column, such as `lower(email)`, also fails because the index is sorted based on the original values, not the transformed ones. This was verified with SQLite; however, there are exceptions per database (e.g., functional indexes).

There are other generally known cases as well. For columns with very few distinct values (like gender), even if an index is used, too many rows match the condition, so the benefit is small. If the table is very small, a simple scan is faster.

## Composite Indexes Work from Left to Right

If there are many queries filtering on both `city` and `age`, you can create a composite index combining both columns.

```python
q4 = "select * from users where city='서울' and age=30"
c.execute("create index idx_city_age on users(city, age)")
```

| Query | Before Creation | After Creation |
|---|---|---|
| `city='서울' and age=30` | `SCAN users` | `SEARCH ... USING INDEX idx_city_age (city=? AND age=?)` |
| `city='서울'` | `SCAN users` | `SEARCH ... USING INDEX idx_city_age (city=?)` |
| `age=30` | `SCAN users` | `SCAN users` (Index not used) |
| `select city, age ... where city='서울' and age=30` | | `SEARCH ... USING COVERING INDEX idx_city_age` |

The second and third rows illustrate the rule: the index is used if only the left column (`city`) is in the condition, but not if only the right column (`age`) is. It is like a phone book sorted by surname then given name; you cannot find someone using only their first name. The SQLite documentation explains that the leftmost column is the primary sort key, and subsequent columns are used to break ties. The same document also advises: "If one index covers the prefix of another, do not create both; delete the shorter one." This means if `(city, age)` exists, an index on `(city)` alone is unnecessary.

The fourth row's `COVERING INDEX` indicates that all columns needed by the query are contained within the index, so the original table does not need to be accessed at all. The documentation states that this is not asymptotically faster but offers a constant factor improvement (around 2x).

## Reading Is Fast, Writing Is Slow

Indexes must be kept sorted, so they must be updated whenever rows are inserted, modified, or deleted. Using the same SQLite database, I compared the time to insert 200,000 rows: one table had no indexes, and another had indexes on all three columns (a, b, c).

| | 200k INSERTs (Single Measurement) |
|---|---|
| 0 Indexes | ~120ms |
| 3 Indexes | ~403ms |

It was about three times slower. This is a single measurement and varies by environment. Therefore, indexes should be created only on columns that are frequently queried. Indexes also consume additional storage space. Loading many indexes on tables with heavy write activity can be detrimental. Issues related to write consistency connect further to [Transactions and Isolation Levels →](#/post/db-transaction), while table design aspects are covered in [Normalization and Modeling →](#/post/db-normalization).

## Common Misconceptions

- Creating an index doesn't always make queries faster: there are cases where it won't help, such as with `LIKE '%...'` patterns or conditions involving functions. You need to check the execution plan after creating the index.
- Adding indexes to every column is not safe: it slows down writes and consumes more space. For example, adding indexes to three columns caused INSERT operations to take about three times longer.
- The order of columns in a composite index matters: only the leftmost columns are used. An index on `(city, age)` provides no benefit if you're filtering only by `age`.
- Just because an index exists doesn't mean the database will use it: the DB evaluates statistics and may decide a full scan is more efficient than using the index.
- Indexes aren't limited to B-Trees: other structures exist too, such as HNSW for vector search. For more details, see [Vector DB](#/post/db-vector).

## What's Next

If indexes alone aren't enough, consider adding a cache layer ([see Cache and Redis](#/post/db-cache-redis)) or scaling the database itself ([see Replication and Sharding](#/post/db-scaling)). The typical learning order is to first understand queries and indexes, then move on to these topics.

← Concept map: (#/post/db-map)

Related articles: [Relational Databases and SQL Basics](#/post/db-rdb-sql) · [Transactions and Isolation Levels](#/post/db-transaction) · [Cache and Redis](#/post/db-cache-redis)

## Reference Links

- SQLite, Query Planning: https://www.sqlite.org/queryplanner.html
- PostgreSQL Documentation, Using EXPLAIN: https://www.postgresql.org/docs/current/using-explain.html
- Use The Index, Luke, Anatomy of an SQL Index: https://use-the-index-luke.com/sql/anatomy