索引是一种独立于表的结构，它将值预先排序，因此无需从头到尾扫描所有行即可直接找到符合条件的记录。但代价是每次使用时都需要同步更新，并非免费午餐。

## 什么是索引

假设我们要在表中通过 `WHERE email = '...'` 这样的条件查找某一行。如果没有索引，数据库必须从第一行读到最后一行。这就是全表扫描（Full Scan）。如果只有几行数据，这不成问题；但如果达到二十万行、两千万行，情况就完全不同了。

索引类似于书后的目录。它将单词按字母顺序排列，并在旁边标注页码。SQLite 文档也有类似的解释：索引是一个独立的结构，其中按排序顺序存储了被索引列的值和原始行的 rowid；当值相同时，则通过 rowid 来确定顺序。由于已排序，因此可以使用二分查找，查找时间不再与行数 N 成正比，而是与 log N 成正比。文档估算，在千万行级别的表中，这种差异可达百万倍。

[详见 → 关系型数据库与 SQL 基础](#/post/db-rdb-sql)，建议先阅读关于表和键的内容，再读本文会更容易理解。大多数数据库都知道主键（primary key）会自动创建索引，但具体实现因数据库而异，需查阅对应数据库的文档确认。

## B-Tree 长什么样

最常见的索引结构是 B-Tree。《Use The Index, Luke》将索引介绍为“双向链表 + 搜索树”的组合。最底层（叶节点）是一系列按顺序连接的索引项，其上方堆叠着指示“该范围位于哪个区间”的引导层。由于是平衡树，无论查找哪个值，从顶层到底层的深度都相同。

直观理解如下：

```
        [ 50 | 100 ]              <- 루트: 어느 구간인지만 알려 줌
       /     |     \
 [10|30]  [60|80]  [120|150]      <- 중간층
   |        |         |
 리프: 10 20 30 | 55 60 70 80 | 120 130 150 ...  (정렬된 채로 서로 연결)
```

若要查找 61，则从根节点出发，进入"50 到 100"区间，在中层进入"60~80"区间，最后在叶节点定位到 61 附近。经过三次下探即可完成。每个节点容纳的项越多，层级就越浅。例如，若每个节点可存 100 个条目，则仅需三层即可指向一百万个叶节点（这只是数学计算，并非实际数据库中的数值）。数据量即使增加十倍，层数也仅增加一两级，这是关键点。

由于叶节点之间相互连接且已排序，该结构也有助于范围查询（`BETWEEN`）和排序（`ORDER BY`），因为找到起点后即可横向连续读取。

<details>
<summary>详细解析：查找单条记录与多条记录的成本</summary>

按照 SQLite 文档的说法，使用索引查找一行需要两次二分查找：首先在索引中查找 rowid，然后使用该 rowid 在原始表中获取该行。若符合条件的行有 K 个，则成本约为 (K+1)·log N。第一条记录通过搜索找到，其余记录则通过从索引中跳转到下一项来读取。

因此，当 K 增大、占表的比例变大时，情况就会改变。此时，直接全表扫描可能比逐条通过索引访问表更高效，数据库也会根据统计信息做出选择。不同数据库的具体计算标准不同。

</details>

## 亲自测试了一下

在 SQLite (3.50.4) 中，向用户表插入了二十万行数据，并尝试查找某一条电子邮件记录。所有邮箱地址均不相同，城市和年龄为随机生成。

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

结果如下：

| | 执行计划 | 耗时（单次测量） |
|---|---|---|
| 创建索引前 | `SCAN users` | 约 4.17ms |
| 创建索引后 | `SEARCH users USING INDEX idx_email (email=?)` | 约 0.019ms |

由于仅测量了一次，倍数关系并无精确意义，重点在于执行方式从全表扫描转变为索引搜索，且耗时减少了两个数量级以上。不同计算机的表现会有所差异。

## 通过执行计划验证

上述代码中的 `explain query plan` 展示了执行计划。即使创建了索引，查询也不一定会使用该索引，因此养成创建后查看执行计划的习惯很有必要。

以 PostgreSQL 文档为准，`EXPLAIN` 会显示数据库选择的计划而不会实际执行查询。以下是几个值得注意的点：

- `Seq Scan`：读取整张表（SQLite 中称为 `SCAN`）。
- `Index Scan`：通过索引查找后从表中获取行。文档指出，在具有高选择性的条件（如单条记录）下通常会选用此方式。
- `cost`：包含启动成本和总成本，单位为任意值，并非毫秒（ms）。
- `rows`：该步骤预计输出的行数。由于是估算，可能不准确。

`EXPLAIN ANALYZE` 会真正执行查询，并显示实际耗时和实际行数。如果估算行数与实际行数差异巨大，通常意味着统计数据已过期。文档建议：实际执行 `UPDATE` 或 `DELETE` 时，应使用 `BEGIN`/`ROLLBACK` 包裹事务。我并未亲自运行 PostgreSQL，此处仅参考了文档说明。

## 索引无用的情况

查看了同一表下几种查询的执行计划，该表已存在 email 索引。

| 查询 | 执行计划 |
|---|---|
| `email = 'u123456@ex.com'` | 索引扫描 |
| `email like '%123456@ex.com'` | `SCAN users` (全表扫描) |
| `lower(email) = '...'` | `SCAN users` (全表扫描) |

以通配符开头的 `LIKE '%...'` 无法确定排序序列的起始点，因此无法使用索引。这就像在字典中查找“以爱结尾的单词”。对列应用函数的 `lower(email)` 也无法命中索引，因为索引是基于原始值进行排序的。这是在 SQLite 上验证的结果，不同数据库可能存在例外（如函数索引等）。

此外还有一些常见情况：对于取值种类很少的列（如性别），即使建立索引，符合条件的行数也过多，收益甚微。如果表非常小，直接全表扫描反而更快。

## 多列索引从左向右生效

如果有很多查询同时以 `city` 和 `age` 为条件，可以创建包含这两个列的组合索引。

```python
q4 = "select * from users where city='서울' and age=30"
c.execute("create index idx_city_age on users(city, age)")
```

| 查询 | 创建前 | 创建后 |
|---|---|---|
| `city='서울' and age=30` | `SCAN users` | `SEARCH ... USING INDEX idx_city_age (city=? AND age=?)` |
| `city='서울'` | `SCAN users` | `SEARCH ... USING INDEX idx_city_age (city=?)` |
| `age=30` | `SCAN users` | `SCAN users` (无法使用索引) |
| `select city, age ... where city='서울' and age=30` | | `SEARCH ... USING COVERING INDEX idx_city_age` |

第二行和第三行展示了规则：仅当左侧列（`city`）作为条件时，该索引才生效；若仅右侧列（`age`）作为条件则无法使用。这就像电话簿按姓氏、名字排序，仅凭名字无法找到对应条目。SQLite 文档也指出，最左侧的列是主要的排序依据，后续列用于打破平局。同一份文档还建议：“如果一侧是另一侧的前缀，不要同时建立两个索引，只保留较短的那个。”这意味着若存在 `(city, age)` 组合索引，则单独的 `(city)` 索引就是多余的。

第四行中的 `COVERING INDEX` 表示查询所需的所有列都已包含在索引中，因此无需访问原始表。文档指出，这种优化并非渐近意义上的加速，而是带来常数倍（约 2 倍）的性能提升。

## 读快写慢

索引必须保持有序状态，因此在插入、修改或删除行时，也必须同步更新索引。使用相同的 SQLite 环境对比了插入 20 万行数据的时间：表包含三列（a, b, c），一组无索引，另一组在三列上均建立索引。

| | 20 万次 INSERT (单次测量) |
|---|---|
| 0 个索引 | 约 120ms |
| 3 个索引 | 约 403ms |

速度慢了约三倍。这也是单次测量结果，实际性能会随环境变化。因此建议“只为频繁查询的列”建立索引。索引还会占用额外的存储空间。对于写入频繁的表，建立过多索引可能适得其反。关于写一致性的问题可参考 [详细 → 事务与隔离级别](#/post/db-transaction)，而关于表设计方面的内容则在 [详细 → 规范化与建模](#/post/db-normalization) 中讨论。

## 常见误区

- 创建索引并不总是能提升速度：在某些情况下，例如 `LIKE '%...'` 模式或包含函数的条件，索引可能无法生效。需要查看执行计划才能确认。
- 为每个列都建立索引并不安全：这会降低写入性能并占用更多存储空间。例如，在三个列上建立索引后，INSERT 操作的速度大约下降了三分之一。
- 多列索引的顺序至关重要：查询时仅使用左侧的列。例如，对于 `(city, age)` 组合索引，如果查询条件只包含 `age`，则该索引无效。
- 即使存在索引，数据库也不一定会使用它：数据库会根据统计信息判断，若认为全表扫描更高效，则可能选择不使用索引。
- 索引不仅限于 B-Tree：并非如此。例如 HNSW 等结构也用于向量检索。更多信息请参见 [向量数据库](#/post/db-vector)。

## 接下来阅读

如果索引也无法解决问题，可以考虑在前面添加缓存层（[详见 → 缓存与 Redis](#/post/db-cache-redis)），或将数据库本身进行拆分（[详见 → 复制与分片](#/post/db-scaling)）。通常建议先了解查询和索引，再学习这些进阶内容。

← 概念地图 (#/post/db-map)

相关文章：[关系型数据库与 SQL 基础](#/post/db-rdb-sql) · [事务与隔离级别](#/post/db-transaction) · [缓存与 Redis](#/post/db-cache-redis)

## 参考资料链接

- SQLite, Query Planning: https://www.sqlite.org/queryplanner.html
- PostgreSQL 文档，使用 EXPLAIN: https://www.postgresql.org/docs/current/using-explain.html
- Use The Index, Luke, SQL 索引结构解析：https://use-the-index-luke.com/sql/anatomy