Virtual memory is a device built on top of the address translation table (page table). By following how large and slow that table becomes, we encounter the TLB, multi-level tables, page replacement, and thrashing in sequence. We've already seen the big picture of the operating system in [Overview](#/post/cs-os); here, we dive only into the memory side.

## What Translation Does

The address a process produces is a virtual address, and converting it to a physical address happens on every memory access. Paging splits the address into two parts: the first part is the Virtual Page Number (VPN), and the second part is the offset within the page. Using the VPN, we look up the page table to obtain the Physical Frame Number (PFN), and then we append the offset as-is.

We ran OSTEP's small example exactly as written (64-byte address space, 16-byte pages). If pages 0, 1, 2, and 3 are placed in frames 3, 7, 5, and 2 respectively, it looks like this:

| Virtual Address | VPN | Offset | PFN | Physical Address |
|---|---|---|---|---|
| 0 | 0 | 0 | 3 | 48 |
| 21 | 1 | 5 | 7 | 117 |
| 50 | 3 | 2 | 2 | 34 |

```python
PAGE = 16
pt = {0: 3, 1: 7, 2: 5, 3: 2}
def tr(va):
    vpn, off = divmod(va, PAGE)
    return pt[vpn] * PAGE + off
print(tr(0), tr(21), tr(50))   # 48 117 34
```

Each process has its own page table. Each entry in the table (PTE) contains not just the frame number but also several bits. According to OSTEP, these include:

- valid: Is this translation valid? Marking unused regions as invalid allows us to avoid assigning a physical frame; accessing such a region triggers a trap to the OS.
- protection (read/write/execute): Accessing in an unauthorized manner also triggers a trap.
- present: Is it currently in RAM, or has it been swapped out to disk?
- dirty: Has it been modified since being loaded into memory?
- reference (accessed): Was it recently accessed? Used in page replacement algorithms.

## The Table Is Too Large

In a 32-bit address space with 4KB pages, the address is split into a 20-bit VPN and a 12-bit offset. Translation involves $2^{20}$ entries, approximately one million. If each PTE is 4 bytes, a single process's page table would be 4MB. OSTEP notes that with 100 processes, translation metadata alone would consume 400MB.

```python
print(2**32 // 4096, (2**32 // 4096) * 4)   # 1048576 4194304
```

Most of the address space is empty. Code and heap reside at one end, stack at the other, and the middle is invalid, yet a linear table still holds all those entries. Increasing page size reduces the number of entries (quadrupling the page size exactly quarters the table size), but it increases internal fragmentation—the wasted space within pages that are not fully utilized. Therefore, most systems use small pages like 4KB or 8KB.

Solutions to this problem (multi-level tables, segment mixing) are described below.

<details>
<summary>Multi-level Page Tables and Hybrid Segmentation Approaches</summary>

Multi-level tables split the page table itself into chunks of page size and do not allocate chunks that are entirely invalid. A page directory indicates which chunks exist; each directory entry (PDE) contains at least a valid bit and a frame number. A valid PDE means there is at least one valid PTE within that chunk.

The advantage is that table space scales proportionally to the actually used address space, and since each table fragment fits exactly one page, the OS can simply reuse the next free page for new fragments. There's also a cost: on a TLB miss, both the directory and the PTE must be read, requiring two memory accesses. OSTEP calls this a trade-off between time and space.

An earlier approach combined segments with paging. The upper bits of the address select a segment (code, heap, stack), and each segment has a base and bounds pointing to its own linear table. The bounds field includes the maximum number of valid pages for that segment, so gaps in between do not occupy table entries. However, as the heap grows with scattered allocations, waste remains, and external fragmentation reappears because tables vary in length, making it hard to find free space. For these reasons, multi-level approaches were pursued instead.
</details>

## Slow: TLB

To perform translation, we must read the page table, which resides in memory. A single access thus touches memory twice. To reduce this, hardware maintains a small cache of recent translations. This is the TLB (translation-lookaside buffer).

The flow is straightforward. When an address arrives, we first check the TLB using the VPN. If it's present (a hit), we immediately construct the physical address. If not (a miss), we read the page table to obtain the translation, fill the TLB, and retry.

The reason TLBs work so well is locality. Temporal locality means "use it again soon," while spatial locality means "if you use x, you'll likely use nearby addresses next." The OSTEP example involves reading an array of 10 integers sequentially. Because the elements are densely packed within a single page, the access pattern results in miss, hit, hit, miss, hit, hit, hit, miss, hit, hit, yielding a hit rate of 70%. Even though it's the first time reading the array, hits still occur.

Average access time fluctuates based on the hit rate as shown below. The numbers are hypothetical for illustration purposes (TLB lookup = 1 cycle, memory access = 100 cycles, plus one additional table read on a miss).

```python
mem, tlb = 100, 1
for hr in (0.99, 0.9, 0.5):
    print(hr, tlb + hr * mem + (1 - hr) * 2 * mem)
# 0.99 102.0 / 0.9 111.0 / 0.5 151.0
```

TLB becomes problematic when switching processes. The translation of the previous process is meaningless to the next one. One approach is to flush the TLB on every context switch. This is safe but forces the process to experience misses again upon resumption. Therefore, some hardware attaches an ASID (Address Space Identifier) to TLB entries, allowing multiple processes to share the TLB. ASIDs function similarly to PIDs but use fewer bits (e.g., 8 bits vs. 32 bits in OSTEP examples). For details on how switching occurs, see [Processes and Threads](#/post/os-process-thread), and for the hierarchy containing the TLB, refer to [Memory Hierarchy and Caches](#/post/ca-memory-hierarchy).

## When Memory Runs Out: Replacement Policies

Accessing a page with the present bit set to 0 triggers a page fault. The OS must fetch that page from disk; if no free frames are available, one must be evicted. Deciding which page to evict is the replacement policy. We briefly compared FIFO and LRU in the overview, so here we examine the optimal policy as a benchmark and the approximations used in actual implementations.

The optimal policy evicts the page that will be used least frequently in the future. As Belady demonstrated, this minimizes misses. Since knowing the future is impossible, this policy cannot be implemented directly; instead, it serves as a baseline to measure how effective new policies are.

OSTEP ran reference string 0,1,2,0,1,3,0,3,1,2,1 on three frames.

```python
def opt(refs, f):
    mem = []; h = 0
    for i, r in enumerate(refs):
        if r in mem: h += 1; continue
        if len(mem) == f:
            def nxt(p):
                try: return refs.index(p, i + 1)
                except ValueError: return 10**9
            mem.remove(max(mem, key=nxt))
        mem.append(r)
    return h

def fifo(refs, f):
    mem = []; h = 0
    for r in refs:
        if r in mem: h += 1; continue
        if len(mem) == f: mem.pop(0)
        mem.append(r)
    return h

def lru(refs, f):
    mem = []; h = 0
    for r in refs:
        if r in mem: h += 1; mem.remove(r)
        elif len(mem) == f: mem.pop(0)
        mem.append(r)
    return h

def clock(refs, f):
    fr = [None] * f; use = [0] * f; hand = 0; h = 0
    for r in refs:
        if r in fr: h += 1; use[fr.index(r)] = 1; continue
        while fr[hand] is not None and use[hand]:
            use[hand] = 0; hand = (hand + 1) % f
        fr[hand] = r; use[hand] = 1; hand = (hand + 1) % f
    return h

t = [0,1,2,0,1,3,0,3,1,2,1]
print([fn(t, 3) for fn in (opt, fifo, lru, clock)])   # [6, 4, 6, 4]
```

Out of 11 accesses, the optimal policy achieved 6 hits (54.5%), FIFO achieved 4 hits (36.4%), LRU achieved 6 hits, and Clock achieved 4 hits. The 36.4% for FIFO matches the value cited in OSTEP from the same example. Even though page 0 was referenced multiple times, FIFO still evicts it solely because it arrived first.

LRU evicts the least recently used page. Maintaining a sorted access history is expensive, so actual systems use approximations. Hardware sets the use bit to 1 on every page access, while resetting it to 0 is the OS's responsibility. The Clock algorithm arranges pages in a circular list and rotates a "hand." If the hand points to a page with use=1, it resets that bit to 0 and moves to the next; if use=0, it evicts that page. An advantage is that it doesn't need to scan the entire list every time. In the reference string above, Clock achieved 4 hits, same as FIFO, but this short input alone isn't sufficient to determine superiority.

One more point: modified (dirty) pages must be written back to disk before eviction, which is costly. Unmodified (clean) pages can simply be reused. Thus, some VM systems prioritize evicting clean pages. This explains the existence of the dirty bit.

## Thrashing

We tested how drastically policies can fail by running a program in a loop. This involved 100 accesses repeating five pages (0,1,2,3,4) twenty times each.

```python
loop = list(range(5)) * 20
for f in (3, 4, 5):
    print(f, lru(loop, f), fifo(loop, f), opt(loop, f))
# 3 0 0 48
# 4 0 0 72
# 5 95 95 95
```

With five frames, hits occur 95 times (only the first five are misses). Reducing to four frames causes LRU and FIFO to drop to zero hits—effectively evicting the very page needed immediately next. Even with the same input, the optimal policy achieves only 72 hits when using four frames. This demonstrates that if the active working set doesn't fit in memory, performance doesn't just degrade gradually; it can plummet like falling off a cliff.

When memory demand exceeds physical memory and paging continues indefinitely, this state is called thrashing. OSTEP introduces two countermeasures: older systems prevented some processes from running entirely so that the remaining processes' working sets could fit in memory (admission control). Modern Linux distributions employ an out-of-memory killer that terminates memory-hungry processes when memory is exhausted. This reflects a choice favoring doing less but correctly rather than attempting everything clumsily at once.

## Common Misconceptions

- Larger pages are better: While they reduce table and TLB overhead, they increase internal fragmentation. Some CPUs support structures that use large pages (e.g., 4MB) only where needed; however, as OSTEP notes, the primary purpose is not to save page table space but to reduce TLB pressure.
- Increasing frames is always better: As with Belady's anomaly described in the overview, this may not hold for FIFO replacement policies.
- LRU is sufficient: In the loop example above, LRU resulted in a hit rate of 0 when one frame was insufficient. Performance depends on access patterns.
- Avoid swapping since it is slow: If a page that has been swapped out is no longer needed, there is no problem; the issue arises from continuous thrashing.

## Reference Links

- OSTEP, Paging: Introduction: https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf
- OSTEP, Paging: Faster Translations (TLBs): https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf
- OSTEP, Paging: Smaller Tables: https://pages.cs.wisc.edu/~remzi/OSTEP/vm-smalltables.pdf
- OSTEP, Beyond Physical Memory: Policies: https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf

← Concept map (#/post/cs-map)

Related posts: [Operating System Fundamentals (Overview)](#/post/cs-os) · [Processes and Threads](#/post/os-process-thread) · [Memory Hierarchy and Caching](#/post/ca-memory-hierarchy) · [Synchronization and Deadlock](#/post/os-sync-deadlock)