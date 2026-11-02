Physical design is the stage where you decide how to place tables finalized during logical design onto actual storage devices and DBMSs. Indexes, partitioning, distributed databases, and data warehouses are all summarized in one line as "methods for reading and managing data quickly as it grows."

## Where are we in the design phase?

Database design flows in this order: requirements analysis → conceptual design (ER) → logical design (tables, keys, normalization) → physical design → implementation. The previous [Normalization and Transactions](#/post/jb-normalization-transaction) covered logical design; from here on, it's about how to store the same table structurally. Logical design remains almost identical regardless of the DBMS, but physical design depends on the specific product and hardware used.

Exams often ask questions about tasks performed during physical design. To summarize:

| Task | Description |
|---|---|
| Storage structure | Where to place tables and indexes in terms of files and space |
| Index design | Which columns to index and what type of index to create |
| Partitioning | How to split large tables based on certain criteria |
| Denormalization | Whether to intentionally reintroduce redundancy for performance |
| Transactions & Capacity | Predicting concurrent usage and data growth |

Denormalization involves merging tables split by normalization or duplicating columns due to query performance needs. However, you must manually ensure consistency during insert and update operations. This is an option considered when joins cause excessive slowness, as seen in [SQL Applications](#/post/jb-sql-basic).

## Indexes

An index is a data structure created separately to quickly locate desired rows within a table. Without indexes, the database must scan rows from the beginning; with them, retrieval takes logarithmic time. However, indexes consume additional storage space and require updates whenever rows are inserted, modified, or deleted, slowing down write operations. The basic principle is that indexes benefit read-heavy tables but impose overhead on write-intensive ones. More detailed mechanics are covered in the [Index article](#/post/db-index).

Common distinctions frequently tested include:

- **Structure**: B-tree variants (balanced trees) are most common; hash indexes also exist. Use tree-based indexes for range queries.
- **Clustered Index**: Stores table rows in index order. Only one can be created per table and is beneficial for range queries.
- **Non-clustered Index**: Points to rows via a separate sorted structure. Multiple can be created.
- **Composite Index**: Column order matters. An index built on (city, last name, first name) allows fast lookups by city but becomes inefficient when searching only by last name. Placing less frequently used columns at the front is poor practice.
- **Covering Index**: Includes all columns needed by a query, eliminating the need to read table rows.

Indexes may also be ineffective in certain scenarios. For instance, patterns like `LIKE '%abc'` with leading wildcards prevent proper index usage. Tree indexes work best when column values have low cardinality (few distinct values), while bitmap indexes suit columns with high repetition.

<details>
<summary>Order of considerations when designing indexes</summary>

1. Identify candidate columns frequently used in queries, joins, and sorting.
2. Evaluate value diversity; indexes are less effective if most values are identical.
3. Assess write frequency on the table; reduce index count if writes are frequent.
4. For composite indexes, place frequently queried columns first.
5. Verify actual usage via execution plans after creation.

</details>

## Partitioning

Partitioning is a method where a single large table is logically treated as one entity but physically divided into multiple pieces. According to PostgreSQL documentation, there are three partitioning methods:

| Method | Criteria | Example |
|---|---|---|
| Range | Value intervals | Monthly partitions by date |
| List | Explicit value enumeration | By region code |
| Hash | Remainder of hash values divided by number of partitions | Evenly distribute customer IDs |

The benefits include: if a query condition matches the partition key, only relevant partitions are scanned (partition pruning). Old data can be removed or dropped from specific partitions much faster than bulk DELETE operations. Infrequently used partitions can be moved to slower, cheaper storage. As noted in the same documentation, these advantages are valuable primarily for very large tables; indiscriminately increasing partition count is not always beneficial.

```sql
CREATE TABLE measurement (
    city_id int not null,
    logdate date not null,
    peaktemp int
) PARTITION BY RANGE (logdate);

CREATE TABLE measurement_y2006m02 PARTITION OF measurement
    FOR VALUES FROM ('2006-02-01') TO ('2006-03-01');
```

The above summarizes an example from the official PostgreSQL documentation. Since syntax varies across DBMSs, exams typically focus on "what type of partitioning (range/list/hash) and why it's used" rather than specific grammar.

## Distributed Databases

A distributed database stores data across different physical locations while presenting a unified view to users. Nodes may reside within the same data center or be geographically separated via networks. Key characteristics include loose coupling without shared components between servers, and the ability to process transactions closer to users for improved performance.

The method of splitting is described using the term "partitioning." Splitting rows results in a horizontal partition, while splitting columns results in a vertical partition. Sharding refers to distributing horizontal partitions across multiple servers. While a partition typically splits data within a single database instance, sharding differs by dividing data across multiple server instances. Due to its significantly higher complexity, the general advice is to use sharding only when other optimization methods are insufficient. The difference between sharding and replication, where the same data is copied across multiple servers to increase read capacity, is covered separately in [Replication and Sharding](#/post/db-scaling).

Replication involves keeping copies up-to-date, which is complex and resource-intensive. There is also a simpler method of duplication where one location serves as the source, and changes are made only there before being copied to others at set times.

The disadvantages of sharding are worth memorizing: SQL queries can become more complex; if a single shard fails, it can affect overall data integrity; and backups and schema changes must be performed across all shards.

## Data Warehouse

A Data Warehouse (DW) is a repository that stores data collected from various operational systems for analytical purposes. Four characteristics summarized by Bill Inmon are frequently tested.

| Characteristic | Meaning |
|---|---|
| Subject-Oriented | Organized around core subjects (e.g., customers, products) rather than transactional units of work. |
| Integrated | Names, units, and codes from various systems are standardized for consistency. |
| Time-Variant (Historical) | Stores historical data over long periods for analysis and prediction. |
| Non-Volatile | Once loaded, the data is read-only and not casually modified or deleted. |

The differences between an Operational Database (OLTP) and a DW are distinct.

| | OLTP | OLAP (DW) |
|---|---|---|
| Purpose | Handles many short input, update, and delete operations. | Performs fewer complex queries focused on aggregation. |
| Data | Current detailed data, usually in 3rd Normal Form. | Historical data with a multi-dimensional structure. |
| Performance Metric | Transactions per second. | Response time. |

The process of data entering the warehouse is called ETL: Extract from source systems, Transform (cleaning and converting), and Load into the warehouse. The reverse approach, where data is loaded first and then transformed within the warehouse, is referred to as ELT. A Data Mart is a smaller warehouse tailored to a specific department or subject; it has fewer sources and is easier to build.

A common model used in warehouses is the Star Schema. It consists of a central fact table surrounded by dimension tables. Facts are measurable values like order quantities or payment amounts that can be aggregated. Dimensions, such as order date, customer, or product, serve as the criteria for interpreting these values. Visualizing an order fact with attached date, customer, and product dimensions makes it easier to remember.

<details>
<summary>Visualizing the Star Schema in text</summary>

```
        [날짜 차원]
             |
[고객 차원]--[주문 팩트]--[상품 차원]
             |
        [지점 차원]
```

Facts contain keys pointing to dimensions along with quantities and amounts. Dimension tables are often denormalized to reduce the need for joins.

</details>

## Common Confusions

- **Partitioning vs. Sharding:** Both split data horizontally, but partitioning usually occurs within a single DBMS, whereas sharding spans multiple servers.
- **Indexes:** It is easy to think that more indexes are better, but they slow down writes and consume space.
- **Clustered Indexes:** There can only be one clustered index per table because it determines the physical order of rows; therefore, there cannot be two.
- **DW vs. Operational DB:** A DW is not a direct copy of an operational database. It differs by integrating data by subject and accumulating history.
- **Denormalization:** Denormalization is not a design mistake but a deliberate choice made after normalization to improve performance.

## When Solving Problems

Concept definition questions can be solved if you recall keywords from the tables above (Subject-Oriented, Integrated, Time-Variant, Non-Volatile, Range, List, Hash). For "What would you use in this situation?" types of questions, consider the following: if old data is frequently deleted based on dates, use range partitioning; if searching a specific column is slow, use an index; if there are too many joins causing slowness, use denormalization; and if the goal is analytical aggregation, use a warehouse. Check the exam schedule and format on the official website.

← [Information Processing Engineer Map](#/post/jb-map)

Related articles: [Normalization and Transactions](#/post/jb-normalization-transaction), [SQL Application](#/post/jb-sql-basic), [Replication and Sharding](#/post/db-scaling)

## Reference Links

- PostgreSQL official documentation, Table Partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html
- Wikipedia, Database index: https://en.wikipedia.org/wiki/Database_index
- Wikipedia, Shard (database architecture): https://en.wikipedia.org/wiki/Shard_(database_architecture)
- Wikipedia, Distributed database: https://en.wikipedia.org/wiki/Distributed_database
- Wikipedia, Data warehouse: https://en.wikipedia.org/wiki/Data_warehouse