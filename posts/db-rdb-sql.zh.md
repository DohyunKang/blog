关系型数据库将数据存储在表中，并通过键连接这些表；SQL 则是用于从这些表中检索和修改所需行的语言。

## 什么是关系型数据库

想象一下多张 Excel 工作表即可。一张工作表就是一个表，一行是行（row），一列是列（column）。与 Excel 不同的是，数据库会强制规定每一列的数据类型和规则：在数字列中输入文字会被阻止，而在不允许为空的列中填入空值也会被阻止。

“关系型”这一名称源于表之间的关系。例如，在订单表中只需记录客户编号，而无需每次重复填写客户姓名；当需要客户姓名时，再从客户表中查找。这样做的目的是将相同信息只存储在一个地方。关于这种划分的原因，将在 [详细说明 → 规范化](#/post/db-normalization) 中单独讨论。

典型的关系型数据库包括 PostgreSQL、MySQL、SQLite 等。本文基于无需安装、直接集成在 Python 中的 SQLite 的运行结果进行讲解。它仅需一个文件（或内存）即可运行，无需服务器，非常适合学习用途。虽然不同方言间存在细微差异，但以下内容在 PostgreSQL 和 MySQL 中也几乎相同。

## 表与键

核心术语有两个：

| 术语 | 含义 | 下方示例中 |
|---|---|---|
| 主键 (Primary Key) | 唯一标识一行的列 | `users.id`, `orders.id` |
| 外键 (Foreign Key) | 指向其他表主键的列 | `orders.user_id` → `users.id` |

主键不能重复且不能为空。外键遵循“只能指向已存在的行”这一规则，由数据库强制执行。此外，还可以为列添加如 `NOT NULL`（禁止空值）、`UNIQUE`（禁止重复）等约束。

示例表涉及客户和订单：

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

orders 的 `user_id` 指向 users 的 `id`。西媛没有订单，这个“无订单的客户”将在后续讲解 JOIN 时使用。

## 增删改查

处理数据的基本操作有四种（常称为 CRUD）：

```sql
INSERT INTO users (name, email) VALUES ('민지','minji@example.com'), ('준호','junho@example.com'), ('서연','seoyeon@example.com');
INSERT INTO orders (user_id, item, price) VALUES (1,'키보드',50000), (1,'마우스',20000), (2,'모니터',200000);

SELECT name, email FROM users WHERE id = 1;     -- 꺼내기
UPDATE orders SET price = 45000 WHERE id = 1;   -- 바꾸기
DELETE FROM orders WHERE id = 3;                -- 지우기
```

运行后发现：`SELECT` 返回了 `('민지', 'minji@example.com')` 这一行；`UPDATE` 后 id 为 1 的订单价格变为 45000；`DELETE` 后 orders 表从 3 行减少到 2 行。

`SELECT` 的阅读顺序应为 `SELECT 列 FROM 表 WHERE 条件`：从哪个表（FROM）、选取哪些行（WHERE）、获取哪些列（SELECT）。排序使用 `ORDER BY`，限制数量使用 `LIMIT`，均附加在语句末尾。

若在 `UPDATE` 和 `DELETE` 中遗漏 `WHERE` 子句，则会对所有行生效。我曾故意测试过：执行不带 `WHERE` 的 `UPDATE orders SET price = 0` 后，3 行订单的价格全部变为 0，且没有任何错误或警告。这正是实践中为何建议先使用相同条件执行 `SELECT` 查看影响行数，再决定是否更新的原因。

## JOIN

既然表已拆分，就需要一种合并查看的方法，这就是 `JOIN`。

```sql
SELECT u.name, o.item, o.price
FROM users u JOIN orders o ON o.user_id = u.id;
```

结果如下：

```
('민지', '키보드', 50000)
('민지', '마우스', 20000)
('준호', '모니터', 200000)
```

只有满足 `ON` 条件的行才会被连接。由于西媛没有订单，她在结果中消失了。这就是 `INNER JOIN`（简写为 `JOIN` 即指此）。PostgreSQL 教程中的解释也与此一致。内连接会忽略无法匹配的行列。

若想同时查看西媛的信息，则使用 `LEFT JOIN`：

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

左侧表（users）的所有行都会出现，而右侧表中无匹配的部分则以 NULL 填充。在 Python 中显示为 `None`。若不使用 `ORDER BY`，行的顺序无法保证；实际上，民智的两行以与输入相反的顺序出现。

| 类型 | 无匹配的行处理 | 西媛 |
|---|---|---|
| `JOIN`(INNER) | 丢弃 | 不出现 |
| `LEFT JOIN` | 保留左侧，右侧填 NULL | 出现 |

## 分组统计

按客户统计订单数量和总和可通过 `GROUP BY` 实现：

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

此处 `COUNT(o.id)` 不计入 NULL 值，因此西媛显示为 0。若使用 `COUNT(*)`，西媛也会显示为 1（本次未实际运行验证，这是基于聚合函数跳过 NULL 值的通用行为说明）。`SUM` 在目标全部为 NULL 时返回 NULL，而非 0。

<details>
<summary>完整运行代码 (Python sqlite3)</summary>

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

在 SQLite 3.50.4 上运行，正文中的输出与此会话结果完全一致。
</details>

## 约束所阻止的内容

约束是一种机制，在错误数据进入数据库之前就将其拒绝。我特意尝试了两种情况：

```sql
INSERT INTO orders (user_id, item, price) VALUES (99, 'x', 1);        -- 없는 고객 99
INSERT INTO users (name, email) VALUES ('a', 'minji@example.com');    -- 이메일 중복
```

分别被 `FOREIGN KEY constraint failed` 和 `UNIQUE constraint failed: users.email` 拦截。

SQLite 有一个陷阱。根据官方文档，由于向下兼容的原因，外键检查默认是关闭的，因此必须在每次连接时启用 `PRAGMA foreign_keys = ON`。这就是在代码最前面添加该行语句的原因。如果不启用，第 99 号不存在的客户的订单也会直接插入（我并未尝试将其恢复为关闭状态，而是遵循了文档说明）。据我所知，PostgreSQL 和 MySQL (InnoDB) 默认会进行检查，但此次尚未通过文档确认。

## 常见的误解

- SQL 并非像编程语言那样描述“如何做”，而是描述“想要什么”。数据库引擎决定使用哪个索引以及以何种顺序进行访问。相关内容请参见 [详情 → 索引](#/post/db-index)。
- 关系型数据库虽然显得有些陈旧，但目前仍广泛用于服务数据的存储。关于与其他方案的对比，请参见 [详情 → NoSQL](#/post/db-nosql)。
- `JOIN` 操作并不慢，这取决于键上是否建立了索引。
- `NULL` 既不是 0，也不是空字符串，它代表“无值”。使用 `WHERE x = NULL` 无法匹配到数据，必须使用 `IS NULL`（这一点我也尚未亲自执行验证）。
- 将多个语句组合在一起并统一处理成功或失败的情况，属于独立的主题——事务。相关内容请继续参见 [详情 → 事务](#/post/db-transaction)。

## 参考链接

- SQLite, Foreign Key Support: https://www.sqlite.org/foreignkeys.html（外键默认关闭，PRAGMA）
- PostgreSQL 文档，Joins Between Tables: https://www.postgresql.org/docs/current/tutorial-join.html（内连接/左外连接说明）
- 代码输出结果需自行运行验证（SQLite 3.50.4，Python sqlite3）

← 概念地图 (#/post/db-map)

相关文章：[索引](#/post/db-index) · [规范化](#/post/db-normalization) · [事务](#/post/db-transaction)