NoSQL 并非单一的技术名称，而是指除关系型（RDB）表结构之外的所有存储方式的统称。这四种类型（Key-Value、Document、Column、Graph）各自擅长的领域各不相同。

## NoSQL 是什么？

仅从名字看，它似乎像是“没有 SQL 的数据库”，但实际上更接近于“非关系型表模型的数据库”。有些产品甚至使用类似 SQL 的查询语言。因此，与其纠结定义，不如通过分类来理解更为容易。

RDB 将数据存入表中并通过键进行关联。[详情 → 关系型数据库与 SQL 基础](#/post/db-rdb-sql) 经过规范化处理后，虽然消除了冗余，但在读取时需要重新执行连接操作以合并数据。[详情 → 规范化与建模](#/post/db-normalization) NoSQL 方面则倾向于“按读取时的形态直接存储”。作为代价，有些产品对连接或事务的支持较弱，甚至完全不支持。

## 四种类型

| 类型 | 存储形态 | 代表产品 | 擅长领域 |
|---|---|---|---|
| Key-Value | 一个键对应一个值 | Redis | 会话、缓存、计数器 |
| Document | 类似 JSON 的文档 | MongoDB | 以整体形式读写的数据 |
| Column (wide-column) | 按分区键划分的行，列具有灵活性 | Cassandra | 高写入量的大规模分布式存储 |
| Graph | 节点与关系 | Neo4j | 追踪关系的查询 |

### Key-Value

最为简单。就像字典（dict）一样，通过键插入数据，也通过键取出数据。数据库通常不关心值内部的结构，因此速度很快且逻辑简单。无法通过值进行查找，或者成本很高。

Redis 虽然是 Key-Value 类型，但其存储的值并不限于简单的字符串。官方文档介绍 Redis 为“数据结构服务器”，并提供多种数据结构作为值，包括字符串、哈希（hash）、列表、集合、有序集合（sorted set）、流（stream）以及 JSON 等。关于缓存的讨论另有所述。[详情 → 缓存与 Redis](#/post/db-cache-redis)

### Document

完整存储类似 JSON 格式的文档。MongoDB 允许在同一集合中，每个文档拥有不同的字段；在添加字段时，无需重写现有文档或执行迁移操作。如有需要，也可以通过模式验证（schema validation）来强制规定结构。也就是说，与其说是“没有模式”，不如说是“由应用程序而非数据库管理模式”。

设计原则中包含这样一句话：“共同访问的数据应共同存储。”对于像订单和订单项这样总是同时读取的数据，将其嵌入（embedding）到同一个文档中；而对于体积较大或偶尔读取的数据，则单独存放并通过引用（referencing）关联。例如，商品页面仅展示最近的 5 条评论，而将所有评论存储在单独的集合中，便是此类做法的示例。

将同一订单以两种方式存储进行对比，差异便显现出来。以下是实际运行验证的结果：

```python
import json, sqlite3

order = {"id": 1, "user": "kim", "items": [{"sku": "A1", "qty": 2}, {"sku": "B7", "qty": 1}]}
print(json.dumps(order, ensure_ascii=False))
# {"id": 1, "user": "kim", "items": [{"sku": "A1", "qty": 2}, {"sku": "B7", "qty": 1}]}

db = sqlite3.connect(":memory:")
db.executescript("""
create table orders(id int primary key, user text);
create table order_items(order_id int, sku text, qty int);
insert into orders values (1,'kim');
insert into order_items values (1,'A1',2),(1,'B7',1);
""")
print(db.execute("""select o.user, i.sku, i.qty
  from orders o join order_items i on i.order_id=o.id where o.id=1""").fetchall())
# [('kim', 'A1', 2), ('kim', 'B7', 1)]
```

文档型数据库只需一次读取操作即可完成，而 RDB 则需要连接两张表。反之，若要查找“购买过 SKU A1 的所有订单”或一次性更改商品名称，若数据分散在文档中，反而会更加繁琐。为了优化读取性能而调整形态，导致其他方面变得不便，这是不可避免的权衡。

### Column (wide-column)

由于名称原因，容易与“列式分析数据库”混淆。此处指的是像 Cassandra 这样的宽列存储系统。Cassandra 官方文档将其描述为分区宽列存储（partitioned wide-column storage）。行的基本键的第一部分作为分区键，该值决定了该行由集群中的哪个节点持有。高效的查询必须包含分区键。文档中并未提及存在跨越外键或分区的连接操作，因此设计思路通常是“根据查询需求构建表”。文档本身也未直接使用此类表述。

<details>
<summary>先为查询设计列式结构</summary>

RDB 是先整理好数据形态，随后再用 SQL 编写查询；而在基于分区键的结构中，顺序则相反：首先确定“要发出何种查询”，然后构建符合该查询的表。这甚至会导致同一份数据为了不同的查询用途而被存储多次。此说明并非直接引用自 Cassandra 文档，而是基于对分区键结构的理解得出的结论。
</details>

### Graph

存储节点（如人、商品）和关系（如关注、购买）。根据 Neo4j 文档，节点具有标签和属性；关系具有方向和类型，且关系本身也可以拥有属性。文档指出，与 RDB 中昂贵的 JOIN 操作相比，图数据库将关系直接存储在节点旁边，从而使得追踪关系的速度更快。

"朋友的朋友"查询在小规模数据上进行了测试。SQLite 的递归查询与邻接列表 BFS 得出了相同的结果。

```python
db.executescript("""
create table follows(a text, b text);
insert into follows values ('kim','lee'),('lee','park'),('lee','choi'),('park','jung');
""")
q = """
with recursive reach(person, depth) as (
  select 'kim', 0
  union
  select f.b, r.depth+1 from reach r join follows f on f.a=r.person where r.depth<2
)
select person, min(depth) from reach where depth>0 group by person order by 2,1
"""
print(db.execute(q).fetchall())
# [('lee', 1), ('choi', 2), ('park', 2)]
```

寻找两步以内的关系，SQL 也可以做到。文档的主旨是：当层级加深、查询变复杂时，图数据库更为合适；而此处仅用小规模数据对比速度差异并非重点。

## 分布式带来的权衡：CAP

提到 NoSQL，CAP 定理便随之而来。这是一个关于在分布式存储系统中只能保证以下三项中的两项的结论：一致性（Consistency）、可用性（Availability）和分区容错性（Partition tolerance）。该理论由 Eric Brewer 于 2000 年提出猜想，后由 Gilbert 和 Lynch 于 2002 年正式证明。

此处的“一致性”与 ACID 中的原子性、隔离性等概念不同。它指的是：“读取时返回的是最近写入的值（或报错）”。可用性则指：只要向存活的节点发起请求，就能收到响应，但并不保证返回的是最新值。

“三者选其二”的说法容易引发误解。网络分区在现实中无法避免，因此实际的选择是在发生分区期间是选择一致性还是可用性。Brewer 本人后来也指出，这种表述容易引起误导；在没有分区的情况下，系统可以同时满足一致性和可用性。2010 年，Abadi 在此基础上提出了 PACELC 模型：当存在分区时，需在可用性与一致性之间权衡；即使没有分区，也需在高延迟与一致性之间做出取舍。

因此，对于"Cassandra 是 AP，MongoDB 是 CP"这类标签需谨慎看待。许多产品的行为取决于配置，关于复制和分片的内容将在下一篇文章中继续探讨。[详情 → 复制与分片](#/post/db-scaling)

## 常见误区

- NoSQL 不需要 SQL：这只是一个分类名称；许多 NoSQL 产品也支持类 SQL 语言。
- NoSQL 比 RDB 快：仅在查询模式匹配时更快；在不匹配的查询场景下，反而更慢甚至无法处理。
- 没有 Schema 就不用设计：文档型数据库仍需决定采用嵌入还是引用策略；若不明确定义，会导致逻辑散落在应用代码中。
- NoSQL 不支持事务：不同产品情况各异。

## 如何选择

初看似乎是在问“是否该转向 NoSQL"，但更关键的问题应是：“我的查询是什么样的？”

| 此类场景 | 建议优先考虑 |
|---|---|
| 关系复杂、强一致性要求高、查询模式频繁变化 | RDB |
| 需通过单一键快速读写、用于缓存或会话存储 | Key-Value |
| 数据以整体块形式读取、字段经常变更 | Document |
| 写操作极多，且仅能通过分区键查找 | Wide-column |
| 需要跨多个层级追踪关系 | Graph |

若无特殊理由，建议从 RDB 起步。因其查询灵活性强且支持事务。像向量检索这类新兴需求，可单独使用专用存储系统处理。[详情 → 向量数据库](#/post/db-vector)

← [概念图谱](#/post/db-map)

相关文章：[索引](#/post/db-index) · [缓存与 Redis](#/post/db-cache-redis) · [复制与分片](#/post/db-scaling)

## 参考资料链接

- MongoDB 数据建模介绍：https://www.mongodb.com/docs/manual/core/data-modeling-introduction/
- Redis 数据类型：https://redis.io/docs/latest/develop/data-types/
- CAP 定理（Wikipedia）：https://en.wikipedia.org/wiki/CAP_theorem
- Cassandra 架构概览：https://cassandra.apache.org/doc/latest/cassandra/architecture/overview.html
- Neo4j 图数据库介绍：https://neo4j.com/docs/getting-started/get-started-with-neo4j/graph-database/