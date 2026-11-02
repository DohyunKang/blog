# Replication and Sharding

As a service grows, a single database server becomes the first bottleneck. Even after fixing queries, adding [indexes](#/post/db-index), and attaching [caching](#/post/db-cache-redis), there comes a point where scaling out to multiple databases is the last resort. This approach generally falls into two categories: replication, which copies the same data across multiple servers, and sharding, which splits the data and distributes it across multiple servers.

In one sentence:

| | Replication | Sharding |
|---|---|---|
| What each server holds | A copy of all data | A portion of the data |
| What primarily increases | Read throughput, availability | Write throughput, storage capacity |
| Associated issues | Replication lag, stale data | Cross-shard joins/transactions, rebalancing |

## Read Replication

The structure is simple. There is one server that handles writes (primary; referred to as `source` in MySQL documentation), and multiple servers that receive and apply those changes (replicas, or standby). Writes go to the primary, while reads are distributed across the replicas. Since most services have significantly more reads than writes, this alone can sustain a considerable load. The part responsible for distributing requests is handled by a [load balancer](#/post/infra-load-balancer) or application connection settings.

Beyond read scaling (scale-out), MySQL's official documentation highlights other uses for replication. Running backups from a replica has no impact on the primary, heavy analytical queries can be executed on replicas, and copies can be placed in distant locations. If the primary fails, one of the replicas can be promoted to take over (failover), all within the same structure.

### Synchronous vs Asynchronous

How changes are delivered to replicas determines performance and safety.

| Method | Commit Timing | Pros | Cons |
|---|---|---|---|
| Asynchronous | Ends immediately when primary commits; delivery happens later | Fast | Recent commits may be lost during failover; replica may return stale data |
| Semi-synchronous (MySQL) | Waits until at least one replica acknowledges receipt | Guarantees data was received | Response becomes slower |
| Synchronous | Ends only when all servers commit | Prevents data loss; reads are consistent everywhere | Slow. PostgreSQL documentation notes that if the network is slow, performance can drop below half. |

MySQL defaults to asynchronous replication and does not provide full synchronous replication out of the box (in such cases, it recommends using NDB Cluster). Most systems use asynchronous replication and accept the trade-off.

### Replication Lag

The cost of asynchronous replication is replication lag. It takes anywhere from a few milliseconds to several seconds for data written to the primary to reach replicas, depending on load. Reading from a replica during this window means missing recently written data.

A common failure scenario follows this flow: a user modifies their profile (write to primary), then immediately views their profile page (read from replica). The screen shows the old value before the update. The user assumes the save failed and clicks again.

Common countermeasures include:

- Routing that user's reads to the primary for a set time after writes (read-your-writes).
- Reading only from the primary for screens that must show immediately updated data.
- Monitoring replica lag and removing lagging replicas from the read pool.

It is also worth remembering that replication does not increase write capacity. Since all replicas must apply every write from the primary, if the primary becomes a bottleneck, adding more replicas won't help. That is when sharding comes into play.

## Partitioning

Before discussing sharding, let's touch on partitioning. The terms are often mixed, but typically partitioning refers to splitting a single table into pieces, while sharding refers to placing those pieces on different servers.

According to PostgreSQL documentation, a partitioned table itself consumes no storage space; rows go into regular tables (partitions) based on the partition key. There are three partitioning methods:

- Range: Splits keys like dates into intervals. Monthly partitions are a classic example.
- List: Explicitly lists key values, such as by region code.
- Hash: Sends data based on the remainder of the key hash divided by a modulus.

The benefits include querying only relevant partitions (pruning) and being able to discard old data entirely using `DROP` or `DETACH PARTITION`. This is much faster than large `DELETE` operations and avoids VACUUM overhead. However, the documentation notes that these benefits are meaningful mainly when tables are very large (heuristically, larger than server memory). There are also constraints: all columns in primary key and unique constraints must include the partition key column.

```sql
CREATE TABLE measurement (
    city_id int not null,
    logdate date not null,
    peaktemp int
) PARTITION BY RANGE (logdate);

CREATE TABLE measurement_y2006m02 PARTITION OF measurement
    FOR VALUES FROM ('2006-02-01') TO ('2006-03-01');
```

(The SQL above is an example from the PostgreSQL documentation and has not been executed directly.)

## Sharding

Placing partitions on different servers constitutes sharding. Since each server holds only a portion of the data, both storage capacity and write throughput scale with the number of servers. However, the application (or routing layer) must determine "which shard this key belongs to."

### The Shard Key is Everything

Deciding how to split the data (the shard key) is the most critical decision. Once chosen, it is difficult to change.

| Method | Pros | Cons |
|---|---|---|
| Range | Range queries stay within a single shard | Writes concentrate on the latest range (hotspot) |
| Hash | Data is evenly distributed | Range queries must scan all shards |
| Directory (Lookup Table) | Flexible | The lookup table becomes a bottleneck and a single point of failure |

If you issue IDs sequentially and split them by range, all new writes go to the last shard. In the experiment below, dividing IDs 1–10,000 into three parts caused the latest 1,000 records to all land in the same shard (shard #2). Even though we sharded to distribute evenly, only one server ends up doing the work.

### When Server Count Changes

A common first attempt when using hashing is `hash(key) % server_count`. It's simple, but changing the number of servers causes almost all keys to move locations. Running an experiment showed that when increasing from 3 to 4 servers with 10,000 keys, about 75% had to be moved to different servers.

Consistent hashing reduces this problem. Imagine placing both servers and keys on the same hash circle; each key is assigned to the first server encountered in a clockwise direction. When adding a server, only the keys between that new server and its predecessor need to move. According to Wikipedia, adding the nth server moves approximately 1/n of the data. Placing servers as single points on the circle creates uneven intervals and load imbalance, so we use multiple points (virtual nodes) per server to distribute them evenly, assigning more virtual nodes to high-performance servers.

<details>
<summary>Code and results from my own experiment</summary>

```python
import hashlib, bisect
def h(k): return int(hashlib.md5(k.encode()).hexdigest(), 16)
keys = [f"user{i}" for i in range(10000)]

def mod(n): return {k: h(k) % n for k in keys}
a, b = mod(3), mod(4)
print("mod 3->4 moved:", sum(a[k] != b[k] for k in keys) / len(keys))

def ring(nodes, vn=100):
    r = sorted((h(f"{n}#{i}"), n) for n in nodes for i in range(vn))
    hs = [x[0] for x in r]
    def f(k):
        i = bisect.bisect(hs, h(k)) % len(r)
        return r[i][1]
    return f

f3 = ring(["A", "B", "C"])
f4 = ring(["A", "B", "C", "D"])
print("ring 3->4 moved:", sum(f3(k) != f4(k) for k in keys) / len(keys))
```

Execution results (Python 3, verified in this environment).

```
mod 3->4 moved: 0.7484
ring 3->4 moved: 0.2392
```

Only about 24% moved, which is close to the theoretical value of 1/4 (25%). I used 100 virtual nodes per server.

</details>

## What Makes Sharding Difficult

Sharding increases write capacity at the cost of taking away features that databases previously provided for free.

- Joins: Tables on different shards cannot be joined in a single operation. You must either fetch and merge them separately in the application or choose shard keys so that frequently accessed data resides on the same shard. Normalized tables ([normalization](#/post/db-normalization)) that span multiple shards increase complexity.
- Transactions: Within a single shard, transactions work as usual, but those touching multiple shards require distributed transactions (e.g., two-phase commit) or compensation logic. They are slow and complex. Therefore, it's common to design so that each transaction completes within a single shard.
- Unique constraints & auto-increment IDs: Assigning separate numbers per shard leads to duplicates. Alternative issuance methods like UUIDs or time-based IDs are needed.
- Resharding: Increasing the number of shards requires moving data. To do this without downtime, you need mechanisms like dual writes and validation.
- Operations: Backups, schema changes, and monitoring all scale multiplicatively with the number of shards.

Thus, sharding is typically a last resort. As expected from its order of consideration, you should first optimize queries and indexes, upgrade server specifications (scale-up), implement caching, and set up read replicas. Only when writes or capacity are still insufficient should you consider sharding. Starting with sharding from the beginning is usually excessive. Choosing a [NoSQL](#/post/db-nosql) database that includes sharding as a built-in feature is another option.

## Consistency Trade-offs

Once you introduce replication and sharding, the fact that "data exists in multiple places" becomes apparent, and the challenge arises of how to keep values consistent across locations. The PostgreSQL documentation summarizes this as follows: read-only data needs to be stored only once per server, but writes must propagate to all servers so that subsequent reads remain consistent; therefore, there is no single solution suitable for all workloads.

In practice, the choice usually balances these three factors:

| If you increase | What decreases |
|---|---|
| Consistency (latest value everywhere) | Write speed, availability when a server fails |
| Write speed & availability | Guarantee of latest value on read |
| Storage & write scalability (sharding) | Convenience of joins and transactions |

For critical data like bank balances where errors are unacceptable, lean toward consistency. For less critical data like post view counts or feeds where a few seconds of delay is acceptable, lean toward speed and scalability. Even within a single service, different data may require different trade-offs.

## Common Misconceptions

- Replication makes writes faster too: No. The primary node handles all write operations, while replicas apply those changes asynchronously; therefore, write throughput remains unchanged.
- A replica is a backup: No. If data is accidentally deleted on the primary, it will also be reflected on the replica unless you use delayed replication or maintain separate backups.
- Partitioning and sharding are the same thing: Not exactly. Partitioning typically refers to splitting data within a single server, whereas sharding involves distributing data across multiple servers. Relying solely on partitioning cannot overcome the limitations of a single server.
- It's better to plan sharding in advance: Choosing an inappropriate shard key makes future changes difficult and immediately increases operational complexity. It is generally better to implement sharding only after confirming the need.

## Summary

If reads are heavy, use replication; if you hit capacity or write limits, consider sharding; and if you want to simplify managing large tables within a single server, use partitioning. In either case, once data is distributed across multiple locations, you must decide how much consistency you are willing to compromise.

## Reference Links

- MySQL 8.0 Reference Manual, Replication: https://dev.mysql.com/doc/refman/8.0/en/replication.html
- PostgreSQL Documentation, High Availability, Load Balancing, and Replication: https://www.postgresql.org/docs/current/high-availability.html
- PostgreSQL Documentation, Table Partitioning: https://www.postgresql.org/docs/current/ddl-partitioning.html
- Wikipedia, Consistent hashing: https://en.wikipedia.org/wiki/Consistent_hashing

← [Concept Map](#/post/db-map)

Related posts: [Indexes](#/post/db-index) · [Caching and Redis](#/post/db-cache-redis) · [Load Balancers](#/post/infra-load-balancer)