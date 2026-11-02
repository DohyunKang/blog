The CPU is fast, but memory is slow. To hide this difference, we stack small, fast storage layers in front of large storage; this structure is called the memory hierarchy, and the intermediate layers are caches. We discussed virtual memory and page faults in [Introduction to Operating Systems](#/post/cs-os), but this article looks at the same problem from a lower level: hardware.

## The Shape of Hierarchy

Moving upward, things become faster, smaller, and more expensive. Moving downward, they become slower, larger, and cheaper.

| Layer | Approximate Characteristics |
|---|---|
| Registers | Inside the CPU; fastest, but very few in number |
| L1, L2, L3 Cache | SRAM inside or outside the CPU; layers get larger and slower as you go down |
| Main Memory (RAM) | Where programs are actually loaded |
| Disk (SSD, HDD) | High-capacity storage that persists even when power is off |

Registers are where instructions directly read and write, as seen in [CPU and Instructions](#/post/ca-cpu). Layers below registers are not directly managed by the program; hardware automatically fills and evicts them. Therefore, caches are invisible in code but have a significant impact on performance.

## Why Caches Work: Locality

Small caches can mimic the speed of large memory because programs do not access memory uniformly. This property is called locality of reference.

- **Temporal Locality**: Data that has been used recently is likely to be used again soon. Variables in loops are an example.
- **Spatial Locality**: If one address is accessed, nearby addresses are also likely to be accessed soon. Iterating through an array from start to finish is an example.

Due to spatial locality, caches fetch data in blocks rather than just the 1 byte needed. This block is called a cache line. The Wikipedia document on CPU caches notes, for example, that Pentium 4 and K8 L1 data caches use 64-byte lines. The simulation below also aligns with 64 bytes.

## Hits, Misses, and Average Access Time

If the CPU finds the data in the cache, it's a hit; otherwise, it's a miss. A miss requires fetching from a lower layer, which takes longer. When the hit rate is $h$, average access time is typically expressed as:

Average Access Time = Hit Time + (1 − h) × Miss Penalty

Assuming a hit takes 1 unit of time and a miss takes an additional 100 units (these numbers are hypothetical and not actual hardware values), we calculated the results.

| Hit Rate | Average Access Time |
|---|---|
| 99% | 2 |
| 95% | 6 |
| 90% | 11 |

A mere 9% drop in hit rate more than doubles the average access time. This formula explains why everyone is so sensitive to the hit rate percentage in cache discussions.

<details>
<summary>Solution for Calculating Average Access Time</summary>

We set hit time to 1 and miss penalty to 100, then calculated using Python.

```python
for h in (0.99, 0.95, 0.9):
    print(h, 1 + (1 - h) * 100)
# 0.99 2.0 / 0.95 6.0 / 0.9 11.0
```

(Note: Actual output may show values like 2.000000000000001 due to floating-point precision.)
</details>

## Where to Place Data in the Cache

There are three ways to decide where to place a memory address in the cache:

- **Direct-mapped**: Each address maps to exactly one location. It is simple and fast, but addresses that map to the same location continuously evict each other.
- **Set-associative**: An address can be placed in any of $N$ locations within a set. This is called $N$-way associativity.
- **Fully associative**: An address can go anywhere. It offers the best miss rate but is only practical when the number of entries is small.

According to the Wikipedia document, a 2-way cache achieves a hit rate similar to a direct-mapped cache twice its size, while going beyond 4-way yields diminishing returns.

There are two write policies:
- **Write-through**: Writes to both the cache and memory simultaneously.
- **Write-back**: Writes only to the cache line and marks it as 'dirty'; the data is written to memory when that line is evicted.

## Simulating Directly

We simulated a small cache (1KB, 64-byte lines) in Python and varied access patterns. When the cache lines fill up, the least recently used item is evicted.

```python
def sim(addrs, size=1024, line=64, ways=1):
    sets = size // line // ways
    st = [[] for _ in range(sets)]
    hit = 0
    for a in addrs:
        b = a // line
        s = b % sets
        if b in st[s]:
            hit += 1
            st[s].remove(b); st[s].append(b)
        else:
            if len(st[s]) >= ways:
                st[s].pop(0)
            st[s].append(b)
    return hit / len(addrs)

print(sim([i * 4 for i in range(4096)]))      # 0.9375
print(sim([i * 64 for i in range(4096)]))     # 0.0
```

Reading 4-byte integers sequentially fills one line (64 bytes) with 16 integers, so only the first access is a miss, and the next 15 are hits. The hit rate is 15/16 = 0.9375. Conversely, skipping by 64 bytes each time accesses new lines every time, resulting in a hit rate of 0. Reading the same number of items yields such different results depending on order.

We also tested alternating reads between addresses 0 and 1024, 1000 times. Since these two addresses map to the same location, direct-mapping resulted in a hit rate of 0.0, while 2-way mapping achieved 0.998. The mutual eviction (conflict miss) described above actually manifests like this.

## Row-Major vs. Column-Major Array Access

We also examined differences based on array direction using the same simulator. Assuming a 64x64 integer array stored in row-major order, we ran it with a 4KB 4-way cache.

| Iteration Method | Hit Rate |
|---|---|
| Row-major (in storage order) | 0.9375 |
| Column-major (skipping) | 0.0 |

The Wikipedia article on Locality of Reference also explains that since C stores arrays in row-major order, row-wise iteration reads from contiguous memory and is more efficient, while column-wise iteration jumps around distant locations, leading to more misses. It is also noted that the difference diminishes if the matrix fits entirely within the cache.

<details>
<summary>Time measured on an actual computer</summary>

Using NumPy, I computed the row sum and column sum of a 5000x5000 int32 array (stored in row-major order) five times each and selected the fastest result. On my PC, the row-wise operation took approximately 0.029 seconds, while the column-wise operation took about 0.086 seconds—a roughly threefold difference. These values are specific to this PC and NumPy implementation and may vary in other environments.

```python
import numpy as np, time
a = np.ones((5000, 5000), dtype=np.int32)
def best(f):
    r = []
    for _ in range(5):
        t = time.perf_counter(); f(); r.append(time.perf_counter() - t)
    return min(r)
rows = best(lambda: [a[i].sum() for i in range(5000)])
cols = best(lambda: [a[:, j].sum() for j in range(5000)])
print(rows, cols, cols / rows)
```
</details>

## Common Misconceptions

- A larger cache is always faster: As caches grow, the time to locate data increases, which is why they are organized into multiple levels.
- Cache behavior is independent of programmers: While hardware manages cache automatically, changing access patterns—as demonstrated above—can significantly affect hit rates.
- RAM and virtual memory disk swapping are different from caching: The underlying principle is similar. Viewing RAM as a form of disk cache is possible, and page replacement policies raise the same questions as cache replacement policies.

## Reference Links

- Wikipedia, CPU cache: https://en.wikipedia.org/wiki/CPU_cache
- Wikipedia, Locality of reference: https://en.wikipedia.org/wiki/Locality_of_reference

← Concept map (#/post/cs-map)

Related articles: [CPU and Instructions](#/post/ca-cpu) · [Operating System Basics](#/post/cs-os) · [I/O and Buses](#/post/ca-io-bus)