虚拟内存是建立在页表之上的机制，因此随着页表的大小和速度变化，会依次引出 TLB、多级页表、页面置换和抖动等问题。操作系统的全貌在 [概述](#/post/cs-os) 中已介绍，此处仅深入探讨内存相关部分。

## 转换所做的工作

进程生成的地址是虚拟地址，将其转换为物理地址的操作发生在每次内存访问时。分页机制将地址分为两部分：前半部分为虚拟页号（VPN），后半部分为页内偏移量（Offset）。通过 VPN 查找页表以获得物理帧号（PFN），然后将偏移量直接附加其后。

OSTEP 使用的一个小型示例（64 字节地址空间，每页 16 字节）如下所示。假设第 0、1、2、3 号页分别位于第 3、7、5、2 号帧中：

| 虚拟地址 | VPN | 偏移量 | PFN | 物理地址 |
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

每个进程都有一个独立的页表。页表中的每一项（PTE）除了包含帧号外，还包含若干位标志。根据 OSTEP 的描述，这些标志包括：

- valid：该翻译是否有效。将未使用区域标记为 invalid，则无需分配物理帧；若访问此类区域，会触发 OS trap。
- 保护（read/write/execute）：以不被允许的方式访问同样会触发 trap。
- present：当前是否在 RAM 中，还是已换出到磁盘。
- dirty：写入内存后是否被修改过。
- reference（accessed）：最近是否被访问过，用于页面置换算法。

## 页表过大

在 32 位地址空间中，若每页大小为 4KB，则地址被划分为 20 位 VPN 和 12 位偏移量。翻译条目数为 $2^{20}$，约为一百万个；若每个 PTE 占用 4 字节，则单个进程的页表大小约为 4MB。OSTEP 指出，若有 100 个进程，仅翻译信息就需要 400MB。

```python
print(2**32 // 4096, (2**32 // 4096) * 4)   # 1048576 4194304
```

大多数地址空间实际上是空的。代码和堆位于一端，栈位于另一端，中间区域为 invalid，但线性页表仍需占用这些空位。增大页面大小可以减少页表项数量（例如将页面扩大 4 倍，页表项数正好减少为原来的 1/4），但这会导致页内未被使用的空间增加，即内部碎片变大。因此，大多数系统采用较小的页面大小，如 4KB 或 8KB。

解决此问题的方法（多级页表、段混合）在下文详述。

<details>
<summary>多级页表，以及结合段的方案</summary>

多级页表通过将页表本身按页面大小切分，完全无效的片段则不予分配。哪个片段存在由页目录记录，而目录项（PDE）至少包含 valid 位和帧号。PDE 为 valid 表示该片段内至少有一个有效的 PTE。

其优势在于页表空间与实际使用的地址空间成正比，且页表的每个片段恰好适配一个页面，操作系统只需分配下一个空闲页面即可。然而也有代价：发生 TLB miss 时，需分别读取目录和 PTE，导致两次内存访问。OSTEP 将这种权衡称为“时间与空间的交换”。

在此之前的方案是段与分页的混合模式：通过地址高位选择段（代码、堆、栈），并为每个段设置 base 和 bounds，指向该段的专用线性页表。bounds 中记录该段的最大有效页数量，从而避免中间空闲区间占用页表空间。然而，当堆增长且呈不连续使用时，仍会留下浪费空间；同时由于各段长度不一，难以找到空闲空间，导致外部碎片再次产生。正因如此，多级页表方案得以延续。
</details>

## 慢速：TLB

要进行地址转换，必须读取页表，而页表本身也存储在内存中，因此一次访问会触及内存两次。为此，硬件中设有一个小型缓存，用于存储最近的翻译结果，即 TLB（Translation-Lookaside Buffer）。

流程十分简单：当地址到来时，首先用 VPN 查询 TLB。若命中（hit），则立即生成物理地址；若未命中（miss），则读取页表获取翻译结果并填入 TLB，随后再次尝试访问。

TLB 命中率高的原因在于局部性。时间局部性指的是“刚用过的东西还会再用”，空间局部性指的是“如果使用了 x，接下来也会使用其附近的区域”。OSTEP 的例子是顺序读取 10 个整数数组的情况。由于元素密集地分布在同一个页面中，结果呈现为 miss, hit, hit, miss, hit, hit, hit, miss, hit, hit，命中率为 70%。即使是首次读取的数组也能产生命中。

平均访问时间会随着命中率的变化而波动。这些数字是基于说明性假设得出的（TLB 查找耗时 1，内存访问耗时 100，发生缺失时额外读取一次页表）。

```python
mem, tlb = 100, 1
for hr in (0.99, 0.9, 0.5):
    print(hr, tlb + hr * mem + (1 - hr) * 2 * mem)
# 0.99 102.0 / 0.9 111.0 / 0.5 151.0
```

切换进程时 TLB 会成为问题。前一个进程的翻译对下一个进程毫无意义。一种方法是在每次上下文切换时清空 TLB。虽然安全，但每次进程重新运行时都会遭遇新的缺失。因此，部分硬件会在 TLB 条目中附加 ASID（地址空间标识符），让不同进程共享使用 TLB。ASID 的用法类似于 PID，但其位数更少（以 OSTEP 为例为 8 位对 32 位）。关于上下文切换的具体机制，请参阅 [进程与线程](#/post/os-process-thread)；关于 TLB 所属的层次结构，请参阅 [内存层次与缓存](#/post/ca-memory-hierarchy)。

## 内存不足时的情况：替换策略

当访问 present 位为 0 的页面时，会发生缺页异常。操作系统需要从磁盘加载该页面，但如果空闲帧已满，就必须淘汰一个页面。淘汰谁由替换策略决定；前文已在概述中简要比较了 FIFO 和 LRU，此处我们将探讨作为基准的最优策略以及实际实现中采用的近似算法。

最优策略是淘汰未来最晚被使用的页面。正如 Belady 所证明的那样，这种策略产生的缺失最少。但由于需要预知未来，实际上无法实现，因此它常被用作衡量新策略性能的基准线。

OSTEP 使用参考序列 0,1,2,0,1,3,0,3,1,2,1 在 3 个帧上进行了模拟。

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

在 11 次访问中，最优策略命中 6 次（54.5%），FIFO 命中 4 次（36.4%），LRU 命中 6 次，时钟算法命中 4 次。FIFO 的 36.4% 与 OSTEP 在同一示例中给出的数值一致。尽管页面 0 被多次使用，但 FIFO 仅因其最早进入就被淘汰。

LRU 淘汰的是最久未被使用的页面。由于每次访问后都要维护排序记录成本过高，实际系统采用近似方法。硬件在每次页面访问时将 use 位设为 1，而将其清零则由操作系统负责。时钟算法将页面组织成环形链表并旋转“时钟指针”：若指针指向页面的 use 位为 1，则将其清零并移至下一页；若为 0，则淘汰该页面。其优势在于无需每次遍历整个列表。在上述参考序列中，时钟算法命中次数与 FIFO 相同（均为 4 次），但仅凭这一短小输入不足以判定优劣。

还有一点：被修改过的（dirty）页面若要淘汰，必须先写回磁盘，成本较高；而未修改的（clean）页面可直接复用帧。因此，部分虚拟机系统优先淘汰 clean 页面。这正是 dirty 位存在的原因。

## 抖动

我们通过一个循环程序观察了策略在极端情况下的表现：对 5 个页面按 0,1,2,3,4 的顺序重复访问 20 次，共进行 100 次访问。

```python
loop = list(range(5)) * 20
for f in (3, 4, 5):
    print(f, lru(loop, f), fifo(loop, f), opt(loop, f))
# 3 0 0 48
# 4 0 0 72
# 5 95 95 95
```

当帧数为 5 时，命中次数为 95 次（仅前 5 次缺失）；若将帧数减至 4，LRU 和 FIFO 的命中次数则降为 0。这意味着每次淘汰的正是即将被使用的页面。在相同输入下，最优策略在 4 个帧时仍能命中 72 次。这证明了：当活跃页面集合（working set）无法完全载入内存时，性能并非缓慢下降，而是会像从悬崖跌落般急剧恶化。

这种内存需求持续超过物理内存、仅靠分页维持的状态称为“抖动”（thrashing）。OSTEP 介绍了对应的两种应对策略：早期系统通过完全不运行部分进程，使剩余进程的 working set 能装入内存（准入控制）；现代 Linux 在内存耗尽时会启动 out-of-memory killer，主动终止占用内存较多的进程。与其粗暴地一次性处理所有问题，不如采取适度但有效的措施，这才是更明智的选择。

## 常见误解

- 页面越大越好：虽然能减少页表和 TLB 的压力，但内部碎片会增大。某些 CPU 支持仅在需要时使用大页（例如 4MB），但 OSTEP 指出其主要目的并非节省页表空间，而是减轻 TLB 压力。
- 增加帧数总是更好：正如概述中提到的 Belady 现象，FIFO 算法并不一定如此。
- LRU 就足够了：在上述循环示例中，当帧数少一个时，LRU 的命中率为 0；这取决于访问模式。
- 交换很慢，最好避免使用：如果页面被换出后不再需要则没有问题，问题在于频繁来回交换导致的争用。

## 参考链接

- OSTEP, Paging: Introduction: https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf
- OSTEP, Paging: Faster Translations (TLBs): https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf
- OSTEP, Paging: Smaller Tables: https://pages.cs.wisc.edu/~remzi/OSTEP/vm-smalltables.pdf
- OSTEP, Beyond Physical Memory: Policies: https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf

← 概念图 (#/post/cs-map)

相关文章：[操作系统基础（概述）](#/post/cs-os) · [进程与线程](#/post/os-process-thread) · [内存层次与缓存](#/post/ca-memory-hierarchy) · [同步与死锁](#/post/os-sync-deadlock)