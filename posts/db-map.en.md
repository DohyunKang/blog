DB study begins with tables and SQL, progressing to how to quickly find data, use it concurrently, structure schemas, explore different DB types, implement caching, and scale across multiple servers. While each concept might seem confusing when viewed in isolation, I've listed the eight topics one per line and provided links for those who want to dive deeper. The recommended order is: Basics → Speed → Safety → Structure → Types → Scaling.

## Overview of Relationships

```
관계형 DB (테이블 + 키 + SQL)
 ├─ 읽기를 빠르게   → 인덱스 (DB 안에서 찾는 비용을 줄임)
 ├─ 동시에 써도 안전하게 → 트랜잭션·격리 수준
 └─ 테이블을 어떻게 나누나 → 정규화·모델링
관계형이 아닌 저장 방식 → NoSQL, 임베딩을 담는 벡터 DB
DB까지 가지 않게 → 캐시(Redis)
DB 한 대가 모자랄 때 → 복제·샤딩
```

## 1. Basics

**Relational DBs and SQL**: A method that stores data in multiple tables linked by keys, using a language to retrieve and modify rows within those tables. With just two tables and a few queries, you can start experimenting directly.
[Learn more → Relational DBs and SQL basics](#/post/db-rdb-sql)

## 2. Fast, Safe, and Well-Structured

**Indexes**: Separate structures that store sorted values, allowing immediate retrieval of matching rows without scanning from the beginning. However, they must be updated alongside data changes, so choosing where to create them is a key consideration.
[Learn more → Indexes](#/post/db-index)

**Transactions and Isolation Levels**: Transactions group multiple queries to ensure they either all succeed or all fail. Isolation levels determine how much concurrent transactions can see each other's changes; locks and deadlocks also stem from this concept.
[Learn more → Transactions and isolation levels](#/post/db-transaction)

**Normalization and Modeling**: The principle of storing the same fact in only one place, with 1NF through 3NF representing progressive steps toward this goal. ERDs and denormalization are also covered in the same article.
[Learn more → Normalization and modeling](#/post/db-normalization)

## 3. Beyond Relational Storage

**NoSQL**: Not a rejection of SQL, but rather a collection of storage methods adapted to different data usage patterns. It includes four main types: Key-Value, Document, Column, and Graph. Distributed systems introduce the CAP theorem discussion.
[Learn more → NoSQL types and selection](#/post/db-nosql)

**Vector DBs**: Databases that store embeddings and quickly retrieve items similar to a given query. They trade some accuracy for speed using approximate search structures, with comparisons between options like pgvector and dedicated vector databases. Embeddings themselves are covered in [Embeddings and Vector Search](#/post/ai-embedding), while attaching search results to LLMs is discussed in [RAG](#/post/ai-rag).
[Learn more → Vector DBs](#/post/db-vector)

## 4. When Things Grow

**Caching and Redis**: Caching involves copying frequently accessed data closer to the application; Redis is a server that stores these copies as key-value pairs. The complexity arises when handling discrepancies between cached and original data. While indexes reduce search costs within the DB, caching eliminates the need to access the DB altogether for certain operations.
[Learn more → Caching and Redis](#/post/db-cache-redis)

**Replication and Sharding**: When a single DB instance reaches its limits, read operations can be distributed via replication (copying data across multiple instances), while write capacity and storage are managed through sharding (splitting data). However, increasing the number of partitions often compromises consistency and convenience.
[Learn more → Replication and sharding](#/post/db-scaling)

## Where to Start Reading

If you're new to this, read from top to bottom. If you already know SQL but are facing performance issues in your service, follow the order: Indexes → Caching → Replication and Sharding, which mirrors the troubleshooting sequence. If you're unsure how to partition your data, reviewing Normalization and NoSQL together will provide useful comparisons.

← [Concept Map](#/post/ai-map)

Related articles: [Request Processing Flow](#/post/be-request-flow) · [Load Balancer](#/post/infra-load-balancer) · [AI Service Serving Architecture](#/post/infra-ai-serving)