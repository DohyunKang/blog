缓存是为了减少从源头读取数据的昂贵操作，而 Redis 则是一个将数据副本以键 - 值形式存储的快速服务器。难点不在于写入数据，而在于处理数据副本与源数据不一致的情况。

## 用通俗的话来说

这就像在书桌旁常备一本参考书。无需再去图书馆（DB）查找，因此速度更快。但缺点是只能存放少量书籍，且当图书馆出版了新版时，你手中的书就变成了旧版。因此，“能存放多久”、“何时清理”、“空间满时丢弃什么”，可以被视为缓存的全部核心问题。

在后端开发中，我们通常采用如下方式：在请求处理流程（[请求处理流程](#/post/be-request-flow)）中，让处理器在调用数据库之前先检查缓存。数据库的性能也可以通过 [索引](#/post/db-index) 来提升，但两者的区别在于：索引是在数据库内部降低查找成本，而缓存则是完全避免访问数据库。

## 缓存里存的是什么

通过键（key）来查找值。常见的做法是将数据库查询结果转换为字符串（如 JSON）。键的命名应能反映其内容，例如 `user:1`。Azure 文档中的示例也采用了类似 `MyEntity:{id}` 格式的键。

读取时只有两种情况：命中（hit）或未命中（miss）。缓存的效果取决于命中率。Redis 提供了 `INFO` 命令下的 `keyspace_hits` 和 `keyspace_misses` 字段用于计算比率。Azure 文档中也提到，大多数情况下，如果请求未命中缓存，再去检查并填充缓存反而得不偿失。

## Cache-Aside

这是最常见的策略。在这种模式下，并非由缓存自动从数据库读取数据，而是应用程序代码直接负责在缓存与数据库之间进行交互。Azure Architecture Center 将其描述为三个步骤：

1. 尝试从缓存中读取。
2. 若未命中（miss），则从数据库读取。
3. 将读到的值写入缓存并返回给客户端。

更新时，需修改数据库并删除对应的缓存项（invalidate）。下一次读取会因 miss 而重新填充新值。

还有名称相近的策略：read-through、write-through、write-behind，这些是由缓存系统代为执行数据库的读写操作。文档指出，cache-aside 是指当缓存不提供该功能时，由应用程序自行模拟实现的方式。

### 亲自测试的结果

在没有安装 Redis 的情况下，我使用 Python 字典和模拟时钟实现了相同的行为逻辑。TTL 过期机制采用“读取时检查当前时间是否已超过设定时长，若是则丢弃”的方式。

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

运行结果如下：

| 情况 | 结果 |
|---|---|
| 同一用户连续读取 5 次 | 仅从数据库读取 1 次 |
| 使用 `update_user` 修改后再次读取 | 返回新值（lee），累计从数据库读取 2 次 |
| 绕过缓存直接修改数据库，并在 TTL 内读取 | 返回旧值（lee） |
| 61 秒后读取 | 返回新值（park），累计从数据库读取 3 次 |

第三行清晰地展示了 cache-aside 策略的弱点：若有人直接修改数据库，直到 TTL 过期前，系统仍会返回旧值。Azure 文档也指出，cache-aside 无法保证一致性；若外部修改了数据库，则必须等到缓存项重新加载后才会反映出新值。

<details>
<summary>如果顺序颠倒会发生什么</summary>

Azure 文档明确建议：“先更新数据库，再删除缓存”，并特别强调了顺序的重要性。若先删除缓存，则可能出现以下情况：

1. 写入方删除了缓存项。
2. 此时另一个读取请求到来，发生 miss，并从数据库中读取了旧值。
3. 写入方将数据库更新为新值。
4. 读取方将旧值写入了缓存。

通过代码模拟相同顺序的操作后，缓存中保留了 `old`，而数据库中已是 `new`。此后直到 TTL 过期前，系统将持续返回旧值。由于这是一个将并发事件压缩到单行的模拟实验，无法准确判断在实际服务器环境中此类问题的发生频率，但至少确认了顺序至关重要。

</details>

## TTL

TTL（Time To Live）表示“该键将在多少秒后被删除”。在 Redis 中，可通过 `EXPIRE key seconds` 设置过期时间，并用 `TTL key` 查看剩余时间。例如，执行 `SET mykey "Hello"` 后再接 `EXPIRE mykey 10`，则 `TTL` 返回值为 10。

文档中还列出了几点需要注意的事项。

- 使用 `SET` 命令对同一键进行覆盖时，TTL 会被清除（即 TTL 变为 -1，表示无过期时间）。如果希望在更新值的同时保留 TTL，需要重新设置。
- 像 `INCR`、`LPUSH`、`HSET` 这样修改值但不完全替换的命令，不会影响 TTL。
- 过期处理有两种方式：一种是在访问时发现已过期则删除（被动模式），另一种是为未访问的键偶尔随机选择几个进行删除（主动模式）。上述 Python 代码仅模拟了前者。
- 过期时间以绝对时间（Unix 时间戳）存储，如果计算机时钟突然变动，过期时间也会随之调整。

TTL 的长度没有标准答案。Azure 文档指出：设置过短会导致持续读取数据库，设置过长则会残留陈旧数据。应根据数据变更频率以及是否允许陈旧来决定。示例代码默认使用 5 分钟。

## 内存已满时（驱逐策略）

缓存的内存是有限的。Redis 通过 `maxmemory` 设定上限，超出后会根据 `maxmemory-policy` 删除键。在 64 位系统中，`maxmemory` 的默认值为 0，表示无限制。

| 策略 | 行为 |
|---|---|
| `noeviction` | 不删除数据。写入新数据的命令会报错，但读取操作正常 |
| `allkeys-lru` | 从最久未使用的键开始删除 |
| `allkeys-lfu` | 从使用频率最低的键开始删除 |
| `allkeys-random` | 随机删除任意键 |
| `volatile-*` | 仅对设置了 TTL 的键应用上述策略。其中 `volatile-ttl` 优先删除剩余时间较短的键 |

官方文档建议，如果存在某些键被频繁读取的情况，`allkeys-lru` 是较为稳妥的默认选择。当没有设置 TTL 的键时，`volatile-*` 策略的行为类似于 `noeviction`。该策略适用于将缓存数据和不应删除的数据共存于同一实例的场景，但文档建议尽可能将两者分离到不同实例。

LRU 并非精确计算，而是一种近似算法：随机抽取若干键，然后删除其中最久未使用的那个。根据文档示例，`maxmemory-samples` 的默认值为 5；将其提升至 10 会使结果更接近真实的 LRU 行为。

## Redis 数据结构

Redis 不仅仅是一个仅存储字符串值的存储系统，更被介绍为“数据结构服务器”。官方文档列举的主要用途类型如下：

| 类型 | 文档说明 | 应用场景 |
|---|---|---|
| String | 字节序列，最基础类型 | 缓存值、计数器 |
| Hash | 字段 - 值对的集合，类似字典 | 按字段存储单个对象 |
| List | 按插入顺序排列的字符串列表 | 最近访问列表、队列 |
| Set | 不重复的字符串集合，添加、删除、检查元素的操作复杂度与元素数量无关（O(1)） | 去重、标签 |
| Sorted set | 按分数排序的不重复字符串集合 | 排行榜 |
| Stream | 类似只追加日志的结构 | 事件记录 |

此外还有 JSON、地理空间、位图、HyperLogLog 等类型。对于缓存用途，通常只需 String 即可解决；数据结构真正发挥作用的是在 Redis 用于非缓存场景时。例如，在 EXPIRE 文档中介绍了“探索会话”模式：将用户页面访问通过 `RPUSH` 添加到 List 中，并设置 `EXPIRE ... 60`；若休息超过 60 秒，键会被删除，从而形成新的会话。

关于 Redis 在 NoSQL 数据库中的定位，可参考 [NoSQL 类型与选择](#/post/db-nosql) 继续了解。

## 常见误区

人们容易认为使用缓存就一定能提升速度。如果命中率（hit ratio）较低，则无法获得收益。只读取一次的数据或持续变化的数据并不适合缓存。

也有人认为因为有 TTL，一致性问题会自动解决。实际上，TTL 只是防止陈旧数据永久存在的“安全网”，在此期间仍会存在旧值。Azure 文档指出：如果界面需要在修改后立即显示最新值，应考虑使用 write-through 而非 cache-aside。

还有一种误区是认为敏感数据也可以存入缓存。如果多个用户或应用共享同一缓存，这可能是不合适的；因此官方建议从源头直接获取安全相关数据。

也不能武断地认为“缓存挂了服务就挂了”。文档指出：如果程序逻辑设计为优先检查缓存，在 miss 时再回退到数据库，那么即使缓存失效，服务仍能运行，只是会变慢。但此时需要特别关注数据库是否能承受突增的请求量。关于扩展数据库本身的内容，请参阅 [复制与分片](#/post/db-scaling)；而 Web 前端层的缓存则涉及 [CDN 与缓存层级](#/post/infra-cdn-cache)。

← [数据库 Map](#/post/db-map)

相关文章：[索引](#/post/db-index) · [NoSQL 类型与选择](#/post/db-nosql) · [CDN 与缓存层级](#/post/infra-cdn-cache)

## 参考链接

- [Cache-Aside Pattern, Azure Architecture Center (Microsoft Learn)](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside)
- [Redis data types (redis.io)](https://redis.io/docs/latest/develop/data-types/)
- [Key eviction (redis.io)](https://redis.io/docs/latest/develop/reference/eviction/)
- [EXPIRE (redis.io)](https://redis.io/docs/latest/commands/expire/)