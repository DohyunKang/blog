操作系统（OS）是管理者，它让多个程序共享 CPU 和内存等有限资源。进程、调度、虚拟内存和同步都是从这个单一任务的不同侧面来看的名字。

## 从定义开始

程序是磁盘上的文件，而进程是该文件正在运行的状态。进程拥有自己独立的内存空间（代码、数据、堆、栈）以及打开的文件等资源。运行一次程序就会产生一个进程。

线程是在进程内部仅拥有独立执行流的单元。同一进程内的线程共享堆和代码，但各自拥有自己的栈和寄存器。因此，线程之间容易交换数据，但也可能同时操作同一份数据而导致混乱。而进程之间由于内存隔离，即使其中一个崩溃，另一个受到的影响也较小。

| | 进程 | 线程 |
|---|---|---|
| 内存 | 各自独立 | 在进程内共享（仅栈独立） |
| 创建和切换开销 | 相对较大 | 相对较小 |
| 数据共享 | 需要专用通道 | 直接访问同一变量 |
| 若一个崩溃 | 其他进程通常无恙 | 同一进程内的所有线程均处于危险中 |

## 分配 CPU 的方法：调度

由于进程数量远多于核心，操作系统会轮流分配 CPU。决定先给谁的是调度器。OSTEP（教材）将返回时间（从作业到达至完成的时间）作为性能指标，但也指出这往往与公平性相冲突。响应时间（从到达至首次执行的时间）则更接近用户感知的速度。

- FIFO：按到达顺序执行。虽然简单，但如果前面有长任务，后面的短任务就要等待很久。
- SJF（短作业优先）：平均返回时间更优。但需要提前知道作业长度。教材将其比作超市的“10 件以下结账台”。
- Round Robin：轮流执行固定时间片（quantum），然后切换到下一个作业。响应时间较好，但返回时间可能变差。

如果时间片设置过短，切换开销会显著增加。以教材为例，若时间片为 10ms，切换开销为 1ms，则约 10% 的时间被用于切换。增大时间片可减少该开销（amortization），但响应速度会变慢。

<details>
<summary>Round Robin 亲自动手运行（已验证执行）</summary>

对作业 A(5)、B(3)、C(8) 使用时间片 2 进行轮转，并记录各自完成时刻。

```python
from collections import deque

def rr(jobs, q):
    d = deque(jobs); t = 0; done = {}
    while d:
        name, r = d.popleft()
        run = min(q, r); t += run; r -= run
        if r: d.append((name, r))
        else: done[name] = t
    return done

print(rr([("A", 5), ("B", 3), ("C", 8)], 2))
# {'B': 9, 'A': 12, 'C': 16}
```

虽然看起来三个作业几乎同时在进行，但最短的作业 B 也直到第 9 才结束。如果单独运行本应在第 3 结束。这就是轮流执行的代价。
</details>

## 分配内存的方法：虚拟内存

虚拟内存让每个进程都相信“我独占了整个内存”。进程看到的地址是虚拟地址，将其转换为实际 RAM 位置（物理地址）的工作由操作系统和硬件共同完成。OSTEP 将虚拟内存的目标归纳为三点：

- 透明性：程序无需知道内存已被虚拟化。
- 效率：在时间和空间上都要尽量减少浪费（需要硬件支持）。
- 保护：一个进程无法触碰其他进程或操作系统的内存。教材将此称为进程间的隔离。

分页是将内存划分为固定大小的块（页），并将虚拟页与物理帧配对的方式。配对关系存储在页表中。并非所有页面都需要驻留在 RAM 中，不用的页面会被换出到磁盘，需要时再换入。当访问的页面不在 RAM 中时会发生缺页异常（page fault），此时 OS 会从磁盘加载该页面。如果 RAM 已满，则需决定淘汰哪个页面，这就是页面置换策略。

<details>
<summary>FIFO vs LRU 及其反直觉结果（已验证执行）</summary>

按引用顺序 1,2,3,4,1,2,5,1,2,3,4,5 改变帧数并统计缺页次数。

```python
def fifo(refs, f):
    mem = []; miss = 0
    for r in refs:
        if r not in mem:
            miss += 1
            if len(mem) == f: mem.pop(0)
            mem.append(r)
    return miss

def lru(refs, f):
    mem = []; miss = 0
    for r in refs:
        if r in mem: mem.remove(r)
        else:
            miss += 1
            if len(mem) == f: mem.pop(0)
        mem.append(r)
    return miss

refs = [1,2,3,4,1,2,5,1,2,3,4,5]
print(fifo(refs,3), fifo(refs,4), lru(refs,3), lru(refs,4))
# 9 10 10 8
```

FIFO 在帧数从 3 增加到 4 时，缺页次数反而从 9 增加到 10。这就是著名的 Belady 异常现象。LRU（淘汰最久未使用的页面）在帧数为 3 时有 10 次缺页，4 个帧时为 8 次。在此输入下，当帧数为 3 时 LRU 的表现甚至不如 FIFO，因此不能简单记住"LRU 总是更好”。
</details>

当 RAM 不足导致持续发生缺页异常的状态称为抖动（thrashing），

## 共享使用带来的问题：同步

当两个线程对同一个变量执行 `n += 1` 操作时，该操作在内存中会被分解为读取、加法和写入三个阶段。如果两个线程同时读取相同的值并各自加 1 后写入，就会导致其中一个结果丢失。这种现象被称为**竞态条件（race condition）**。防止它的基本工具是锁（mutex）。只有获取了锁的线程才能进入该代码段（临界区），其他线程则需等待。这一概念在数据库的 [事务与隔离级别](#/post/db-transaction) 中再次出现，而在将任务分发给多个协程的 [异步处理与消息队列](#/post/be-async-queue) 中也面临同样的问题。

使用锁会引发新问题。例如，线程 1 持有锁 a 并等待锁 b，而线程 2 持有锁 b 并等待锁 a，此时两者将永远无法继续运行。这种情况称为**死锁（deadlock）**。

<details>
<summary>有锁与无锁时的死锁复现（已执行验证）</summary>

```python
import threading, time
n = 0
def inc(k):
    global n
    for _ in range(k): n += 1

ts = [threading.Thread(target=inc, args=(100000,)) for _ in range(4)]
[t.start() for t in ts]; [t.join() for t in ts]
print("no lock", n)   # 내 환경(Python 3.13)에서는 400000
```

即使不加锁运行，在我的 PC 上也未观察到出现 400000 这样的错误值。因此，这段代码未能成功演示竞态条件。这可能是 CPython 实现层面的原因。可以确定的是，存在竞态条件并不意味着每次都会触发。复现失败并不代表代码是安全的。

死锁是通过设置超时机制的两个线程复现的。

```python
a = threading.Lock(); b = threading.Lock()
def w1():
    with a:
        time.sleep(.1)
        if b.acquire(timeout=1): b.release()
        else: print("t1 stuck")
def w2():
    with b:
        time.sleep(.1)
        if a.acquire(timeout=1): a.release()
        else: print("t2 stuck")
```

运行后仅输出了 "t2 stuck" 一行。当其中一个线程因超时而释放锁时，另一个线程得以继续执行，从而避免双方都陷入 stuck 状态。若不使用超时机制，则两者都会停止运行。此处未测试无超时版本的行为。
</details>

## 进一步探讨

用一条线串联起来大致如下：进程是执行的基本单位，调度器将 CPU 时间片分配给各个进程，虚拟内存为每个进程划分独立的地址空间，而在共享同一资源的地方则需要同步机制。容器（[Docker 与容器](#/post/cloud-docker)）本质上也是操作系统如何划分和呈现进程的问题，这方面我尚未深入研究透彻。

## 常见误解

- **增加线程数总能提升性能**：当线程数超过核心数时，上下文切换开销会增加，并可能引发锁竞争。
- **虚拟内存等同于增加 RAM**：关键在于为每个进程提供独立的地址空间（即隔离），而非单纯扩大容量；将数据写入磁盘是附加功能。
- **仅使用锁就足够安全**：锁可能导致死锁。
- **时间片越短越好**：虽然响应更快，但会增加上下文切换成本。

## 参考链接

- OSTEP，虚拟内存介绍（The Abstraction: Address Spaces）：https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf
- OSTEP，CPU 调度介绍（Scheduling: Introduction）：https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf

← [概念地图](#/post/cs-map)

相关文章：[Docker 与容器](#/post/cloud-docker) · [异步处理与消息队列](#/post/be-async-queue) · [事务与隔离级别](#/post/db-transaction)