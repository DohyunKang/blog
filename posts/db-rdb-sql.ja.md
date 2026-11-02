Relational databases store data in tables and link these tables together using keys, while SQL is the language used to retrieve and modify rows within those tables.

## What is a Relational Database?

Think of multiple Excel sheets. One sheet represents a table, one horizontal line is a row, and one vertical cell is a column. The difference from Excel is that the database enforces data types and rules for each column. You cannot enter text into a number column, nor can you leave required columns empty.

The term "relational" comes from the relationships between tables. Instead of writing customer names repeatedly in an orders table, you store only customer IDs and look up the names in the customers table when needed. This approach keeps information in a single place. The reasons for this separation are discussed separately in [Normalization →](#/post/db-normalization).

Representative relational databases include PostgreSQL, MySQL, and SQLite. This article uses SQLite, which comes built-in with Python, without requiring installation. It runs on a single file (or in memory) without a server, making it convenient for study. While there are slight dialect differences, the content below applies almost identically to PostgreSQL and MySQL as well.

## Tables and Keys

There are two core terms.

| Term | Meaning | In the example below |
|---|---|---|
| Primary Key | A column that uniquely identifies a row | `users.id`, `orders.id` |
| Foreign Key | A column that references a primary key in another table | `orders.user_id` → `users.id` |

A primary key cannot have duplicates or be null. The database enforces the rule for foreign keys that they must reference an existing row. Additionally, constraints such as `NOT NULL` (forbidding empty values) and `UNIQUE` (forbidding duplicates) can be applied to columns.

The example tables are customers and orders.

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

The `user_id` in the `orders` table references the `id` in the `users` table. Suyeon has no orders. This "customer without orders" is used later when explaining joins.

## Insert, Select, Update, and Delete

There are four basic operations for handling data (often referred to as CRUD).

```sql
INSERT INTO users (name, email) VALUES ('민지','minji@example.com'), ('준호','junho@example.com'), ('서연','seoyeon@example.com');
INSERT INTO orders (user_id, item, price) VALUES (1,'키보드',50000), (1,'마우스',20000), (2,'모니터',200000);

SELECT name, email FROM users WHERE id = 1;     -- 꺼내기
UPDATE orders SET price = 45000 WHERE id = 1;   -- 바꾸기
DELETE FROM orders WHERE id = 3;                -- 지우기
```

Upon execution, `SELECT` returned the row `('민지', 'minji@example.com')`, and the price of order ID 1 changed to 45000 after `UPDATE`. After `DELETE`, the `orders` table went from 3 rows to 2 rows.

You can read `SELECT` in the order: `SELECT columns FROM table WHERE condition`. It specifies which table (FROM), which rows (WHERE), and which columns (SELECT) to retrieve. Sorting is added with `ORDER BY`, and limiting the count with `LIMIT`.

If you omit `WHERE` in `UPDATE` and `DELETE`, it applies to all rows. I tried this intentionally; running `UPDATE orders SET price = 0` without `WHERE` set the price of all 3 rows to 0. There were no errors or warnings. This is why, in practice, you are asked to run a `SELECT` with the same condition first to see how many rows match before making changes.

## Joins

Since tables are separated, we need a way to combine them. That is `JOIN`.

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

Only rows matching the `ON` condition are combined. Suyeon disappeared from the result because she has no orders. This is an `INNER JOIN` (simply written as `JOIN`). PostgreSQL tutorials also explain it this way. Inner joins ignore rows that do not have a match.

If you want to see Suyeon as well, use `LEFT JOIN`.

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

All rows from the left table (`users`) are included, and unmatched places in the right columns are filled with NULL. In Python, this appears as `None`. The order of rows is not guaranteed without using `ORDER BY`. Indeed, Minji's two rows appeared in reverse order of input.

| Type | Rows without a match | Suyeon |
|---|---|---|
| `JOIN` (INNER) | Discarded | Does not appear |
| `LEFT JOIN` | Left side remains; right side becomes NULL | Appears |

## Grouping and Counting

The number of orders per customer and the total are calculated using `GROUP BY`.

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

Here, `COUNT(o.id)` does not count NULLs, so Suyeon appeared with 0. If written as `COUNT(*)`, Suyeon would have appeared with 1 (I did not execute this part in this run; the explanation follows the general behavior of aggregate functions skipping NULLs). `SUM` returns NULL if all targets are NULL, rather than returning 0.

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

This was run on SQLite 3.50.4, and the output recorded in the text is exactly as produced by this session.
</details>

## 制約が防いでくれること

制約とは、不正なデータが入る前にデータベースが拒否する仕組みです。意図的に 2 つのケースを試してみました。

```sql
INSERT INTO orders (user_id, item, price) VALUES (99, 'x', 1);        -- 없는 고객 99
INSERT INTO users (name, email) VALUES ('a', 'minji@example.com');    -- 이메일 중복
```

それぞれ `FOREIGN KEY constraint failed`、`UNIQUE constraint failed: users.email` でブロックされました。

SQLite には罠があります。公式ドキュメントによると、互換性の問題で外래 키チェックはデフォルトでオフになっているため、接続ごとに `PRAGMA foreign_keys = ON` をオンにする必要があります。上記コードの先頭にその行を入れた理由です。オンにしないと、存在しない顧客 99 番の注文もそのまま受け付けてしまいます（この状態に戻すことは試しておらず、ドキュメントの説明に従いました）。PostgreSQL や MySQL(InnoDB) はデフォルトでチェックを行うと聞いていますが、今回は改めて確認していませんでした。

## よくある誤解

- SQL はプログラミング言語のように「どのように」やるかを書くのではなく、「何を」望むかを記述します。どのインデックスをどのような順序で使うかはデータベースが決定します。その部分は [詳しく → インデックス](#/post/db-index) をご覧ください。
- 関係型データベースは古臭いという印象がありますが、現在もサービスデータのデフォルトとして広く使用されています。他の方式との比較は [詳しく → NoSQL](#/post/db-nosql) で確認してください。
- `JOIN` が遅いわけではありません。キーにインデックスがあるかどうかにかかっています。
- `NULL` は 0 でも空文字列でもなく、「値がない」ことを意味します。`WHERE x = NULL` では捕捉できず、`IS NULL` と書く必要があります（これも今回実行していません）。
- 一度に複数の文をまとめて成功・失敗を同時に処理するのは、別のトピックであるトランザクションです。[詳しく → トランザクション](#/post/db-transaction) で続きます。

## 根拠となるリンク

- SQLite, Foreign Key Support: https://www.sqlite.org/foreignkeys.html（外래 키のデフォルトオフ、PRAGMA）
- PostgreSQL ドキュメント, Joins Between Tables: https://www.postgresql.org/docs/current/tutorial-join.html（inner/left outer join の説明）
- コード出力は直接実行（SQLite 3.50.4、Python sqlite3）

← コンセプトマップへ (#/post/db-map)

関連記事：[インデックス](#/post/db-index) · [正規化](#/post/db-normalization) · [トランザクション](#/post/db-transaction)