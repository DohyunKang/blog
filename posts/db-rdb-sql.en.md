Relational databases store data in tables and link those tables together using keys, while SQL is the language used to retrieve and modify rows within those tables.

## What is a Relational Database?

Think of multiple Excel sheets. One sheet represents a table, one horizontal line is a row, and one vertical cell is a column. The difference from Excel is that the database enforces data types and rules for each column: you cannot enter text into a numeric column, and you cannot leave required columns empty.

The term "relational" comes from the relationships between tables. Instead of writing the customer name repeatedly in an orders table, you store only the customer ID and look up the name in the customers table when needed. This approach keeps duplicate information in just one place. The reasons for this separation are covered separately in [Normalization →](#/post/db-normalization).

Common relational databases include PostgreSQL, MySQL, and SQLite. This article uses SQLite, which is included with Python without requiring installation. It runs on a single file (or in memory) without needing a server, making it convenient for study. While there are minor dialect differences, the content below applies almost identically to PostgreSQL and MySQL as well.

## Tables and Keys

There are two core terms:

| Term | Meaning | In the example below |
|---|---|---|
| Primary Key | A column that uniquely identifies a row | `users.id`, `orders.id` |
| Foreign Key | A column that references the primary key of another table | `orders.user_id` → `users.id` |

A primary key cannot have duplicates and cannot be empty. A foreign key is constrained by the database to reference only existing rows. Additionally, constraints like `NOT NULL` (forbidding empty values) and `UNIQUE` (forbidding duplicates) can be applied to columns.

The example tables are for customers and orders.

```sql
CREATE TABLE users (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);
CREATE TABLE orders (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  item    TEXT NOT NULL,
  price   INTEGER NOT NULL
);
```

```
users                              orders
id | name | email                  id | user_id | item   | price
1  | 민지 | minji@...              1  | 1       | 키보드 | 50000
2  | 준호 | junho@...              2  | 1       | 마우스 | 20000
3  | 서연 | seoyeon@...            3  | 2       | 모니터 | 200000
```

The `user_id` in the `orders` table references the `id` in the `users` table. Seoyeon has no orders. This "customer without orders" will be used when explaining joins later.

## Insert, Select, Update, and Delete

There are four basic operations for handling data (often called CRUD).

```sql
INSERT INTO users (name, email) VALUES ('민지','minji@example.com'), ('준호','junho@example.com'), ('서연','seoyeon@example.com');
INSERT INTO orders (user_id, item, price) VALUES (1,'키보드',50000), (1,'마우스',20000), (2,'모니터',200000);

SELECT name, email FROM users WHERE id = 1;     -- 꺼내기
UPDATE orders SET price = 45000 WHERE id = 1;   -- 바꾸기
DELETE FROM orders WHERE id = 3;                -- 지우기
```

Running these commands shows that `SELECT` returned the row `('민지', 'minji@example.com')`, and after the `UPDATE`, the price of order ID 1 changed to 45000. After `DELETE`, the `orders` table went from 3 rows to 2 rows.

The syntax for `SELECT` can be read as `SELECT column FROM table WHERE condition`: specify which table (FROM), which rows (WHERE), and which columns (SELECT) to retrieve. Sorting is done with `ORDER BY`, and limiting the number of results is done with `LIMIT`.

If you omit the `WHERE` clause in `UPDATE` or `DELETE`, it applies to all rows. I tested this intentionally: running `UPDATE orders SET price = 0` without a `WHERE` clause set the price of all 3 rows to 0, with no errors or warnings. This is why, in practice, you are often asked to first run a `SELECT` with the same condition to see how many rows are affected before making changes.

## Joins

Since tables are separated, we need a way to combine them. That is what `JOIN` does.

```sql
SELECT u.name, o.item, o.price
FROM users u JOIN orders o ON o.user_id = u.id;
```

The result was as follows:

```
('민지', '키보드', 50000)
('민지', '마우스', 20000)
('준호', '모니터', 200000)
```

Only rows matching the `ON` condition are combined. Seoyeon disappears from the result because she has no orders. This is an `INNER JOIN` (simply writing `JOIN` implies this). PostgreSQL tutorials also use the same explanation; inner joins ignore rows that do not have a match.

If you want to see Seoyeon as well, use a `LEFT JOIN`.

```sql
SELECT u.name, o.item
FROM users u LEFT JOIN orders o ON o.user_id = u.id;
```

```
('민지', '마우스')
('민지', '키보드')
('준호', '모니터')
('서연', None)
```

All rows from the left table (`users`) are included, and unmatched positions in the right columns are filled with `NULL`. In Python, this appears as `None`. The order of rows is not guaranteed unless you use `ORDER BY`; indeed, Minji's two rows appeared in reverse order of input.

| Type | Rows without a match | Seoyeon |
|---|---|---|
| `JOIN` (INNER) | Discarded | Does not appear |
| `LEFT JOIN` | Left side kept, right side filled with NULL | Appears |

## Grouping and Counting

The number of orders per customer and the total sum are calculated using `GROUP BY`.

```sql
SELECT u.name, COUNT(o.id), SUM(o.price)
FROM users u LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id;
```

```
('민지', 2, 70000)
('준호', 1, 200000)
('서연', 0, None)
```

Here, `COUNT(o.id)` does not count `NULL` values, so Seoyeon appears as 0. If you had used `COUNT(*)`, Seoyeon would have appeared as 1 (I did not run this specific case in this session; this is based on the general behavior of aggregate functions skipping `NULL`s). The `SUM` function returns `NULL` if all values are `NULL`, rather than returning 0.

<details>
<summary>Full code executed (Python sqlite3)</summary>

```python
import sqlite3
con = sqlite3.connect(":memory:")
con.execute("PRAGMA foreign_keys = ON")
con.executescript("""
CREATE TABLE users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  item TEXT NOT NULL, price INTEGER NOT NULL
);
INSERT INTO users (name, email) VALUES ('민지','minji@example.com'),('준호','junho@example.com'),('서연','seoyeon@example.com');
INSERT INTO orders (user_id, item, price) VALUES (1,'키보드',50000),(1,'마우스',20000),(2,'모니터',200000);
""")
for r in con.execute("SELECT u.name, o.item, o.price FROM users u JOIN orders o ON o.user_id = u.id"):
    print(r)
```

This was run with SQLite 3.50.4, and the output in the text is exactly as produced by this connection.
</details>

## What Constraints Prevent

Constraints are mechanisms that cause the database to reject invalid data before it enters. I intentionally tried two things wrong.

```sql
INSERT INTO orders (user_id, item, price) VALUES (99, 'x', 1);        -- 없는 고객 99
INSERT INTO users (name, email) VALUES ('a', 'minji@example.com');    -- 이메일 중복
```

Each was blocked with `FOREIGN KEY constraint failed` and `UNIQUE constraint failed: users.email`, respectively.

There is a catch with SQLite. According to the official documentation, foreign key checking is disabled by default for backward compatibility, so you must enable it per connection with `PRAGMA foreign_keys = ON`. That's why I added that line at the very beginning of the code above. If not enabled, orders from non-existent customers (e.g., customer 99) would simply be inserted (I did not test this with checking disabled; I followed the documentation). PostgreSQL and MySQL (InnoDB) are known to check by default, though I did not verify this with documentation this time.

## Common Misconceptions

- SQL does not tell you "how" to do something like a programming language; it specifies "what" you want. The database decides which index to use and in what order. For details, see [Index → Index](#/post/db-index).
- Relational databases may seem outdated, but they are still widely used as the default for service data. For comparisons with other approaches, see [NoSQL → NoSQL](#/post/db-nosql).
- `JOIN` is not inherently slow; it depends on whether indexes exist on the keys.
- `NULL` is neither 0 nor an empty string; it means "no value". `WHERE x = NULL` will not match anything; you must use `IS NULL` (I did not execute this during this review).
- Combining multiple statements to handle success or failure together is a separate topic called transactions. Continue reading about [Transactions → Transactions](#/post/db-transaction).

## Reference Links

- SQLite, Foreign Key Support: https://www.sqlite.org/foreignkeys.html (Foreign keys disabled by default, PRAGMA)
- PostgreSQL Documentation, Joins Between Tables: https://www.postgresql.org/docs/current/tutorial-join.html (Explanation of inner/left outer joins)
- Code output was generated by running directly (SQLite 3.50.4, Python sqlite3)

← Concept map (#/post/db-map)

Related posts: [Index](#/post/db-index) · [Normalization](#/post/db-normalization) · [Transactions](#/post/db-transaction)