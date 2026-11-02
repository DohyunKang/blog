NoSQL is not a single technology name, but rather a term used to refer to storage methods that are not based on relational (RDB) table schemas. Each of the four types (Key-Value, Document, Column, Graph) excels at different tasks.

## What is NoSQL?

At first glance, it might seem like "a database without SQL," but in reality, it's closer to "a database that does not use the relational table model." Some products even use query languages similar to SQL. Therefore, understanding it through classification rather than strict definition is easier.

RDB stores data in tables (tables) and links them using keys. [Learn more → Relational DB and SQL Basics](#/post/db-rdb-sql) Normalization eliminates redundancy but requires joins when reading data. [Learn more → Normalization and Modeling](#/post/db-normalization) In contrast, NoSQL often adopts the approach of "storing data exactly as it is used for reading." As a trade-off, some products offer weak or no support for joins or transactions.

## The Four Types

| Type | Storage Shape | Representative Product | Strengths |
|---|---|---|---|
| Key-Value | One key to one value | Redis | Sessions, caching, counters |
| Document | JSON-like documents | MongoDB | Data read and written as a single unit |
| Column (wide-column) | Flexible rows and columns divided by partition keys | Cassandra | High-volume distributed writes |
| Graph | Nodes and relationships | Neo4j | Queries that follow relationships |

### Key-Value

It is the simplest. You insert using a key and retrieve using a key, much like a dictionary. The database often does not care about the contents of the value, making it fast and simple. Searching by value instead of key is either impossible or expensive.

Redis is a Key-Value store, but its values are not limited to simple strings. The official documentation introduces Redis as a "data structure server," noting that it provides various data structures such as strings, hashes, lists, sets, sorted sets, streams, and JSON. There is separate discussion on caching. [Learn more → Caching and Redis](#/post/db-cache-redis)

### Document

It stores entire documents in a JSON-like format. MongoDB documents can have different fields even within the same collection, and adding fields does not require rewriting existing documents or running migrations. If needed, schema validation can be used to enforce structure. In other words, it's less about "having no schema" and more about "the application manages the schema rather than the database."

As a design principle, this sentence is cited: "Store data that is accessed together together." Items always read together, such as orders and order items, are embedded within a document, while large or infrequently accessed items are stored separately and referenced. An example of this approach is showing only the five most recent reviews on a product page, while storing all reviews in a separate collection.

Comparing the same order placed in both ways reveals the difference. Here are the results after execution:

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

With the document approach, reading ends in one go, whereas with RDB, two tables must be joined. Conversely, finding "all orders for SKU A1" or changing a product name at once becomes more cumbersome if the data is scattered across documents. It is unavoidable that optimizing for one side makes the other inconvenient.

### Column (wide-column)

Due to its name, it can easily be confused with "column-oriented analytical databases." What is discussed here refers to wide-column storage systems like Cassandra. The official Cassandra documentation describes this as partitioned wide-column storage. The first part of a row's primary key serves as the partition key, which determines which node in the cluster will hold that row. Partition keys must be included for efficient queries. There is no mention of joins crossing foreign keys or partitions in documents, leading to designs where tables are created to match specific queries. Documents do not directly use this phrasing.

<details>
<summary>Designing Query-First for Column Families</summary>

RDB first organizes the data shape and then creates SQL queries later. In contrast, with a partition-key-based structure, "what query to run" comes first, and then a table matching that query is created. This can lead to storing the same data multiple times for different query purposes. This explanation is not directly from Cassandra documentation but derived from understanding the partition key structure.
</details>

### Graph

It stores nodes (people, products) and relationships (follows, purchases). According to Neo4j documentation, nodes have labels and properties, relationships have one direction and one type, and relationships can also have properties. The documentation states that while joins are expensive in RDB, graph databases store relationships directly next to nodes, making traversal fast.

"Friend of a friend" queries were tested with small datasets. Both SQLite's recursive query and adjacency-list BFS produced the same results.

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

Finding nodes within two steps is possible in SQL as well. The document suggests that while SQL works for shallow depths, graph approaches become preferable as depth increases and queries grow more complex; however, this post does not aim to benchmark speed differences on such small datasets.

## CAP with Distribution

Mentioning NoSQL inevitably brings up CAP. It's a theorem stating that in a distributed datastore, only two of the following three guarantees can be maintained: Consistency, Availability, and Partition tolerance. Eric Brewer proposed it as a conjecture in 2000, and Gilbert and Lynch provided a formal proof in 2002.

Here, consistency differs from ACID consistency. It means "you get the most recently written value (or an error)." [Read more → Transactions and Isolation Levels](#/post/db-transaction) Availability means that if you send a request to a live node, you will receive a response, but there is no guarantee it's the latest value.

The phrase "choose two out of three" can be misleading. Network partitions are unavoidable in reality, so the actual choice is whether to prioritize consistency or availability during a partition. Brewer himself later noted that this formulation is easily misunderstood and that both can be satisfied when no partition exists. In 2010, Abadi extended this with PACELC: if there's a partition, you choose between availability and consistency; otherwise, you face latency versus consistency.

Therefore, be cautious with labels like "Cassandra is AP" or "MongoDB is CP." Many products depend on configuration, and discussions on replication and sharding continue in the next post. [Read more → Replication and Sharding](#/post/db-scaling)

## Common Misconceptions

- NoSQL doesn't need SQL: This is just a classification name; some NoSQL products support SQL-like languages.
- NoSQL is faster than RDBMS: It's faster for queries that match its data model, but slower or incapable for those that don't.
- No schema means no design needed: Even document databases require decisions on embedding versus referencing; without clear design, logic scatters into application code.
- NoSQL doesn't support transactions: This varies by product.

## How to Choose

At first glance, the question shouldn't be "Should I go with NoSQL?" but rather "What shape are my queries?"

| If you're in this situation | Consider first |
|---|---|
| Many relationships, high consistency needs, frequently changing queries | RDB |
| Fast read/write by a single key, caching, sessions | Key-Value |
| Data read as a whole unit, fields change often | Document |
| Very frequent writes, accessed only via partition keys | Wide-column |
| Need to traverse relationships across multiple steps | Graph |

Unless there's a specific reason otherwise, starting with an RDBMS usually involves less overhead because it supports flexible queries and transactions. Emerging requirements like vector search are best handled with dedicated storage. [Read more → Vector DB](#/post/db-vector)

← [Concept map](#/post/db-map)

Related posts: [Indexes](#/post/db-index) · [Caching and Redis](#/post/db-cache-redis) · [Replication and Sharding](#/post/db-scaling)

## Reference Links

- MongoDB Data Modeling Introduction: https://www.mongodb.com/docs/manual/core/data-modeling-introduction/
- Redis Data Types: https://redis.io/docs/latest/develop/data-types/
- CAP Theorem (Wikipedia): https://en.wikipedia.org/wiki/CAP_theorem
- Cassandra Architecture Overview: https://cassandra.apache.org/doc/latest/cassandra/architecture/overview.html
- Neo4j Graph Database Introduction: https://neo4j.com/docs/getting-started/get-started-with-neo4j/graph-database/