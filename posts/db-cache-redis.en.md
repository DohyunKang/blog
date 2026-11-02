Cache is about keeping a copy of data in a fast location to avoid the expensive operation of reading from the source. Redis is a server that holds these copies using key-value pairs. The tricky part isn't putting data into the cache, but rather handling what happens when the cached copy diverges from the original.

## In simple terms first

It's like keeping a book you read often right next to your desk. You don't need to go to the library (the DB), so it's fast. However, you can only keep a few books, and if the library releases an updated edition, your copy becomes outdated. Therefore, deciding "how long to keep it," "when to remove it," and "what to discard when space runs out" covers everything about caching.

In the backend, this is implemented by ensuring the handler checks the cache before querying the DB within the [request processing flow](#/post/be-request-flow). While DB speed can also be improved with [indexes](#/post/db-index), indexes reduce the cost of searching *within* the DB, whereas cache prevents the need to visit the DB at all.

## What goes into the cache?

Values are retrieved using keys. Values are commonly the result of a DB query converted to a string (e.g., JSON). Keys are named to indicate their content, such as `user:1`. Azure documentation examples also use keys in the format `MyEntity:{id}`.

There are two possible outcomes when reading: a hit if the data is in the cache, or a miss if it isn't. The effectiveness depends on the hit ratio. Redis advises calculating this ratio using `keyspace_hits` and `keyspace_misses` from the `INFO` command. Azure documentation also notes that for most requests, the effort of checking and populating the cache on a miss is often counterproductive.

## Cache-aside

This is the most common strategy. The cache doesn't automatically read from the DB; instead, the application code directly interacts with both the cache and the DB. The Azure Architecture Center describes this in three steps:

1. Read from the cache.
2. If it's a miss, read from the DB.
3. Store the retrieved value in the cache and return it.

When writing, update the DB and invalidate the corresponding cache entry. The next read will result in a miss, at which point the new value is loaded.

There are similarly named strategies: read-through, write-through, and write-behind. These refer to methods where the cache system handles DB reads and writes on your behalf. As the documentation explains, with cache-aside, the application mimics these functions since the cache system doesn't provide them.

### What I tested directly

Without installing Redis, I simulated the same behavior using a Python dictionary and a fake clock. TTL expiration works by checking the current time upon read and discarding the entry if it has passed.

```python
class Clock:
    def __init__(self): self.t = 0
    def now(self): return self.t

class Cache:
    def __init__(self, clock): self.d, self.c = {}, clock
    def get(self, k):
        v = self.d.get(k)
        if v and v[1] > self.c.now(): return v[0]
        self.d.pop(k, None)
        return None
    def set(self, k, val, ttl): self.d[k] = (val, self.c.now() + ttl)
    def delete(self, k): self.d.pop(k, None)

clock = Clock(); db = {1: "kim"}; db_reads = 0; cache = Cache(clock)

def read_user(uid):
    global db_reads
    v = cache.get(f"user:{uid}")
    if v is not None: return v
    db_reads += 1
    v = db[uid]
    cache.set(f"user:{uid}", v, ttl=60)
    return v

def update_user(uid, name):
    db[uid] = name                 # DB 먼저
    cache.delete(f"user:{uid}")    # 그다음 캐시 삭제
```

The execution results were as follows:

| Situation | Result |
|---|---|
| Read the same user 5 times | DB read 1 time |
| Read after modifying with `update_user` | New value (lee), cumulative DB reads 2 times |
| Change only the DB without touching cache, then read within TTL | Old value (lee) returned |
| Read after 61 seconds | New value (park), cumulative DB reads 3 times |

The third row clearly demonstrates a weakness of caching. If someone directly modifies the DB, the stale value persists until the TTL expires. Azure documentation also states that cache-aside does not guarantee consistency and that changes made externally to the DB are not reflected until the entry is reloaded.

<details>
<summary>What happens if you reverse the order</summary>

Azure documentation advises "update the DB first, then clear the cache," explicitly noting the importance of this order. If you clear the cache first, the following scenario becomes possible:

1. The writer invalidates a cache entry.
2. In that gap, another read request arrives, resulting in a miss and reading the old value from the DB.
3. The writer updates the DB with the new value.
4. The reader inserts the old value into the cache.

Running this sequence in code leaves `old` in the cache and `new` in the DB. Stale values continue to be returned until the TTL expires. Since this is a simulation of simultaneous events presented in a single line, we don't know how frequently this occurs on actual servers; however, it confirms that order matters.

</details>

## TTL

TTL stands for "Time To Live" and represents the value indicating "delete this key after X seconds." In Redis, you set it using `EXPIRE key seconds` and check the remaining time with `TTL key`. For example, in official documentation examples, running `SET mykey "Hello"` followed by `EXPIRE mykey 10` results in a `TTL` of 10.

There are several things to keep in mind regarding this, as noted in the documentation.

- Setting the same key again with `SET` removes its TTL (setting it to -1, meaning no expiration). If you want to refresh the value while keeping the TTL, you must reapply it.
- Commands that modify values without replacing them entirely, such as `INCR`, `LPUSH`, and `HSET`, do not affect the TTL.
- Expiration is handled in two ways: a passive approach where keys are deleted upon access if they have expired, and an active approach where some keys are randomly selected for deletion even when not accessed. The Python code above mimics only the former.
- Expiration times are stored as absolute timestamps (Unix timestamps); if the system clock changes suddenly, expiration times are adjusted accordingly.

There is no single correct TTL duration. Azure documentation suggests that too short a TTL causes continuous database reads, while too long leaves stale data behind. The appropriate duration depends on how frequently data changes and whether staleness is acceptable. The example code uses a default of 5 minutes.

## When Memory Is Full (Eviction)

Cache memory is limited. Redis sets a limit using `maxmemory` and evicts keys based on the `maxmemory-policy` when the limit is exceeded. On 64-bit systems, the default value for `maxmemory` is 0, which means no limit.

| Policy | Behavior |
|---|---|
| `noeviction` | Does not evict; commands to insert new data will fail with an error, but reads still work. |
| `allkeys-lru` | Evicts the least recently used keys first. |
| `allkeys-lfu` | Evicts the least frequently used keys first. |
| `allkeys-random` | Evicts arbitrary keys randomly. |
| `volatile-*` | Applies one of the above strategies only to keys with a TTL. `volatile-ttl` evicts keys with the shortest remaining time first. |

The official documentation recommends `allkeys-lru` as a solid default for cases where some keys are read much more frequently than others. The `volatile-*` policies behave like `noeviction` if there are no keys with a TTL set. These policies are useful when storing both cacheable data and non-evictable data on the same instance, though the documentation advises separating instances whenever possible.

LRU is not an exact calculation but an approximation that randomly samples a few keys and evicts the oldest among them. According to the documentation, the default value for `maxmemory-samples` is 5; increasing it to 10 makes the behavior closer to true LRU.

## Redis Data Structures

Redis is introduced not just as a store for strings but as a data structure server. The general-purpose types highlighted in the official documentation are as follows:

| Type | Description | Use Cases |
|---|---|---|
| String | A sequence of bytes; the most basic type | Cache values, counters |
| Hash | A collection of field-value pairs, similar to a dictionary | Representing a single object by fields |
| List | Strings sorted by insertion order | Recent lists, queues |
| Set | A collection of unique strings; add, remove, and check operations are O(1) regardless of element count | Deduplication, tagging |
| Sorted set | Unique strings sorted by score | Leaderboards |
| Stream | Operates like a log that only allows appending | Event logging |

Other types include JSON, geospatial indexes, bitmaps, and HyperLogLog. For caching purposes, a single String type usually suffices; data structures become meaningful when using Redis for purposes beyond simple caching. For example, the EXPIRE documentation introduces a "navigation session" pattern where user page visits are added to a List via `RPUSH` and an expiration is set with `EXPIRE ... 60`. If a session remains idle for more than 60 seconds, the key is deleted, creating a new session.

Where Redis fits among database types will be continued in [Types of NoSQL and Selection](#/post/db-nosql).

## Common Misconceptions

It is easy to assume that using cache always improves speed. If the hit ratio is low, there is no benefit. Data read only once or data that changes constantly does not fit well with caching.

Some believe that because TTL exists, consistency issues are automatically resolved. However, TTL is merely a safety net to prevent stale values from persisting indefinitely; during the TTL period, stale values may still be served. Azure documentation advises considering `write-through` instead of `cache-aside` for screens that require the latest value immediately after modification.

There is also a misconception that sensitive data can be safely stored in cache. If multiple users or applications share a cache, this may be inappropriate; therefore, the same documentation recommends fetching security-related data directly from the source.

One cannot definitively say that if the cache dies, the service will also die. The documentation states that if the application is designed to fall back to the database on a cache miss (similar to a miss scenario), performance will degrade but functionality remains intact. However, whether the system can handle the surge of requests to the database at that moment must be evaluated separately. Scaling the database itself is covered in [Replication and Sharding](#/post/db-scaling), while caching at the web frontend layer is discussed in [CDN and Caching Layers](#/post/infra-cdn-cache).

← [Database map](#/post/db-map)

Related posts: [Index](#/post/db-index) · [NoSQL types and selection](#/post/db-nosql) · [CDN and caching layers](#/post/infra-cdn-cache)

## Reference links

- [Cache-Aside Pattern, Azure Architecture Center (Microsoft Learn)](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Redis data types (redis.io)](https://redis.io/docs/latest/develop/data-types/)
- [Key eviction (redis.io)](https://redis.io/docs/latest/develop/reference/eviction/)
- [EXPIRE (redis.io)](https://redis.io/docs/latest/commands/expire/)