调度是在有多个已准备好执行的进程时，决定将 CPU 分配给谁以及分配多少的工作。概述文章（[操作系统基础](#/post/cs-os)）中仅简要浏览了 FIFO、SJF 和 Round Robin，而本文将通过数字追踪每个算法旨在优化哪些指标，以及这些指标之间为何会产生冲突。

## 首先看两个指标

要比较调度算法，必须有衡量标准。OSTEP（教材）使用了以下两个指标：

- **周转时间 (turnaround)**：从作业到达直到结束的时间。即完成时刻 − 到达时刻。
- **响应时间 (response)**：从作业到达直到首次获得 CPU 的时间。即首次执行时刻 − 到达时刻。

在批处理系统中，周转时间很重要；而在有人坐在终端前的交互式系统中，响应时间则更为关键。教材解释说，随着分时计算机的出现，响应时间这一指标应运而生。这两个指标难以在同一算法中同时优化，这正是本文的主旨。

先简要说明一下“抢占式 (preemptive)"的概念。非抢占调度器会一直运行一个作业直到其结束才切换到下一个。而抢占式调度器可以暂停正在运行的作业并切换到其他作业，这需要上下文切换。教材指出，如今的调度器实际上几乎全是抢占式的。关于上下文切换本身，将在 [进程与线程](#/post/os-process-thread) 中讨论。

## FCFS (FIFO) 与护航效应

按照到达顺序进行处理。实现最简单。假设作业 A（100 秒）、B（10 秒）、C（10 秒）按此顺序同时到达：

- **完成时刻**：A 为 100，B 为 110，C 为 120
- **平均周转时间**：(100+110+120)/3 = 110

较短的 B 和 C 在较长的 A 之后等待。教材将这种现象称为“护航效应 (convoy effect)"。

## SJF 与 STCF

如果从最短的作业开始运行呢？在相同输入下，按 B、C、A 的顺序运行，完成时刻分别为 10、20、120，平均周转时间为 50。相比之前的 110，降至了 50。教材指出，在所有作业同时到达的假设下，SJF 是最优的。

然而，一旦打破这一假设，情况就会崩溃。如果 A 在 0 秒到达，而 B 和 C 在 10 秒到达，非抢占式 SJF 会等待已经运行的 A 完成。平均周转时间再次变为 103.33。解决方案是 STCF（Shortest Time-to-Completion First，抢占式 SJF）。每当有新作业到达时，选择剩余时间最短的作业。当 B 和 C 到达时，暂停 A 并优先运行它们，从而使平均周转时间回到 50。

SJF 系列存在一个现实中的弱点：必须预先知道作业需要多长时间。操作系统通常无法获知这一点。因此出现了下面的 MLFQ。

## Round Robin 与响应时间

SJF 系列的响应时间较差。假设 A、B、C 各需 5 秒且同时到达，SJF 的响应时间分别为 0、5、10，平均为 5。Round Robin 仅让作业运行一个时间片 (quantum) 便切换到下一个作业。若时间片为 1 秒，则首次执行时刻分别为 0、1、2，平均响应时间为 1。

代价是周转时间。在相同输入下，RR 的完成时刻分别为 A:13、B:14、C:15，平均为 14；而 SJF 为 5、10、15，平均为 10。教材称 RR 是基于周转时间的几乎最差的策略。这是因为其试图尽可能延长作业的运行时间。更一般地说，在短时间单位内公平分配 CPU 的策略会导致较差的周转时间。公平性与周转时间是相互权衡的关系。

时间片长度是另一个权衡。过短则上下文切换成本占主导地位。以教材示例为例，若时间片为 10ms，而切换耗时 1ms，则约 10% 的时间用于切换；若将时间片增至 100ms，则降至 1% 以下。也有解释指出，切换不仅涉及寄存器更改，还会导致 CPU 缓存和 TLB 中积累的状态被丢弃，因此成本更高。

<details>
<summary>手动计算指标（已验证运行）</summary>

使用按秒模拟的代码重新生成了上述数字。各策略仅改变“接下来运行谁”的逻辑。

```python
from collections import deque

def metrics(jobs, first, done):
    ta = {n: done[n]-jobs[n][0] for n in jobs}
    rt = {n: first[n]-jobs[n][0] for n in jobs}
    return ta, rt, sum(ta.values())/len(ta), sum(rt.values())/len(rt)

def simulate(jobs, pick):
    rem = {n: l for n, (a, l) in jobs.items()}
    first, done = {}, {}
    t = 0; running = None
    while len(done) < len(jobs):
        ready = [n for n in jobs if jobs[n][0] <= t and n not in done]
        if not ready:
            t += 1; continue
        n = pick(ready, rem, running, jobs)
        first.setdefault(n, t)
        rem[n] -= 1; t += 1; running = n
        if rem[n] == 0:
            done[n] = t; running = None
    return metrics(jobs, first, done)

def fifo(ready, rem, running, jobs):
    return running if running in ready else min(ready, key=lambda n: jobs[n][0])
def sjf(ready, rem, running, jobs):   # 비선점
    return running if running in ready else min(ready, key=lambda n: jobs[n][1])
def stcf(ready, rem, running, jobs):  # 선점
    return min(ready, key=lambda n: rem[n])

def rr(jobs, q):
    rem = {n: l for n, (a, l) in jobs.items()}
    first, done = {}, {}; t = 0; queue = deque(); arrived = set()
    def admit(t):
        for n in jobs:
            if jobs[n][0] <= t and n not in arrived:
                arrived.add(n); queue.append(n)
    admit(0)
    while len(done) < len(jobs):
        if not queue:
            t += 1; admit(t); continue
        n = queue.popleft(); first.setdefault(n, t)
        run = min(q, rem[n]); t += run; rem[n] -= run
        admit(t)
        if rem[n]: queue.append(n)
        else: done[n] = t
    return metrics(jobs, first, done)

J1 = {"A": (0, 100), "B": (0, 10), "C": (0, 10)}
J2 = {"A": (0, 100), "B": (10, 10), "C": (10, 10)}
J3 = {"A": (0, 5), "B": (0, 5), "C": (0, 5)}
print(simulate(J1, fifo)[2:])   # (110.0, 70.0)
print(simulate(J1, sjf)[2:])    # (50.0, 10.0)
print(simulate(J2, sjf)[2:])    # (103.33, 63.33)
print(simulate(J2, stcf)[2:])   # (50.0, 3.33)
print(simulate(J3, sjf)[2:])    # (10.0, 5.0)
print(rr(J3, 1)[2:])            # (14.0, 1.0)
```

| 输入 | 策略 | 平均周转 | 平均响应 |
|---|---|---|---|
| A100·B10·C10 同时到达 | FCFS | 110 | 70 |
| 相同输入 | SJF | 50 | 10 |
| A 在 0 秒，B·C 在 10 秒到达 | SJF(非抢占) | 103.33 | 63.33 |
| 相同输入 | STCF | 50 | 3.33 |
| 5·5·5 同时到达 | SJF | 10 | 5 |
| 相同输入 | RR(时间片 1) | 14 | 1 |
</details>

<details>
<summary>改变 RR 时间片长度（已验证运行）</summary>

将上述代码中的 `rr(J1, q)` 替换为块大小，并运行了 A10·B10·C10 的输入。

| 块大小 | 平均周转时间 | 平均响应时间 |
|---|---|---|
| 1 | 59.67 | 1.00 |
| 5 | 58.33 | 5.00 |
| 10 | 56.67 | 10.00 |
| 50 | 83.33 | 36.67 |
| 100 | 110.00 | 70.00 |

当块大小最大为 100 时，所有任务一次性完成，因此得出的数值与 FCFS 相同。随着块大小减小，响应时间越好。该模拟中没有切换开销，因此周转时间看起来一直在改善；但实际上，正如上文所述，切换开销在另一端产生拉力。
</details>

## 优先级调度

为每个任务分配优先级，并优先执行高优先级的任务。SJF 可被视为一种“越短优先级越高”的优先级调度算法。非抢占式调度中，当前运行的任务必须完成后才能切换；而抢占式调度中，一旦有更高优先级的任务到达，CPU 会立即让出。

假设 P1(24)、P2(3)、P3(3) 同时到达，且优先级顺序为 P2 > P3 > P1。若采用非抢占式调度，完成时间为：P2 为 3、P3 为 6、P1 为 30，平均周转时间为 13。若使用相同的输入但以 FCFS（P1, P2, P3 顺序）运行，则完成时间分别为 24、27、30，平均值为 27。

其缺点是：如果高优先级任务持续到达，低优先级任务将永远无法获得 CPU，导致饥饿（starvation）。下一节 MLFQ 将正面解决这一问题。

## MLFQ：在不知情的情况下接近 SJF

MLFQ（多级反馈队列）维护多个具有不同优先级的队列，并根据任务的行为动态调整其优先级。教材对试图解决的问题描述如下：在不了解任务长度的情况下，希望为短任务提供快速响应，同时避免不必要地阻塞长任务，并减少周转时间。

基本规则如下：

- 规则 1：高优先级任务优先运行。
- 规则 2：若优先级相同，则采用轮转（Round Robin）。
- 规则 3：新任务从最高优先级队列开始执行。
- 规则 4：若在某一层级用尽分配量（allotment），则降级到下一层。
- 规则 5：每隔固定时间 S，将所有任务提升回最高优先级队列（priority boost）。

最初假设所有任务都是短任务，因此将其置于顶层。真正短的任务会在此结束；长任务则会逐步降级并停留在较低队列中。即使不知道任务长度，也能通过行为近似实现 SJF。交互式任务因频繁进行 I/O 而停留在上层，仅使用 CPU 的长任务则下沉到底层。

若将规则 4 修改为“在分配量用完之前，若因 I/O 释放 CPU，则保留在当前层级”，教材指出会产生两个问题：一是饥饿；二是欺骗调度器。如果交互式任务持续到达，底层队列中的长任务将无法获得 CPU。另一个问题是：当分配量即将耗尽时，故意调用短 I/O 操作可使其长期停留在顶层。规则 5（周期性提升）可防止饥饿，而基于各层级累计使用时间的降级规则 4 则可防止欺骗行为。教材指出，若 S 过大，长任务会挨饿；若 S 过小，交互式任务则无法获得应有的份额。因此，这些参数并非自动确定，而是需要手动调节的旋钮。

实现方式因系统而异。根据教材，Solaris 的时分片类默认使用 60 个队列，时间块从 20ms 增加到数百 ms，并约每 1 秒进行一次提升（boost）。FreeBSD 4.3 调度器不使用表格，而是通过公式随时间推移降低 CPU 使用量来计算优先级。

<details>
<summary>直接验证 MLFQ 中的饥饿与提升（已执行验证）</summary>

这是一个简化版的模拟器：包含 3 个队列，分配量为 10ms。长任务 L 在 0ms 到达，从 20ms 开始，每 10ms 有一个短任务（长度为 10ms）持续到达（CPU 始终保持满载）。

```python
from collections import deque

def mlfq(jobs, levels=3, allot=10, boost=None, T=300):
    q = [deque() for _ in range(levels)]
    rem = {n: v[1] for n, v in jobs.items()}
    used = {n: 0 for n in jobs}; lvl = {}; cpu = {n: 0 for n in jobs}
    for t in range(T):
        for n, (a, l) in jobs.items():
            if a == t: lvl[n] = 0; q[0].append(n)
        if boost and t > 0 and t % boost == 0:      # 규칙 5
            for L in range(1, levels):
                while q[L]: q[0].append(q[L].popleft())
            for n in lvl: lvl[n] = 0; used[n] = 0
        n = next((q[L][0] for L in range(levels) if q[L]), None)
        if n is None: continue
        L = lvl[n]
        cpu[n] += 1; rem[n] -= 1; used[n] += 1
        if rem[n] == 0:
            q[L].popleft()
        elif used[n] >= allot:                       # 할당량 소진 -> 강등
            q[L].popleft(); used[n] = 0
            lvl[n] = min(L + 1, levels - 1); q[lvl[n]].append(n)
    return cpu

jobs = {"L": (0, 1000)}
for i in range(30):
    jobs[f"i{i}"] = (20 + i * 10, 10)

print(mlfq(jobs, boost=None)["L"])   # 20
print(mlfq(jobs, boost=100)["L"])    # 40
```

在 300ms 内，若无提升，L 获得的 CPU 时间为 20ms；若每 100ms 进行一次提升，则获得 40ms。20ms 是短任务到达前 L 独自运行的时间，此后因新任务不断涌入而从未再次运行。加入提升后，在 100ms 和 200ms 时点，L 被提升至顶层并获得 10ms 的 CPU 时间。虽然份额很小，但关键在于它不再挨饿。
</details>

## 常见误解

- SJF 效果最佳：平均周转时间最优，但并非响应时间最好。在 5·5·5 输入场景下，SJF 的平均响应时间为 5，而 RR 为 1。
- RR 公平性高因此总是更优：但其周转时间可能变差。在 5·5·5 输入场景下，RR 的平均值为 14，SJF 为 10。
- 时间片越短越好：响应性能会提升，但上下文切换开销随之增加。
- 抢占式调度更快：当到达时间各不相同的场合，STCF 确实优于 SJF，但抢占意味着付出上下文切换的成本。
- 高优先级任务终将运行：低优先级任务若持续有高优先级任务到来则无法运行，因此 MLFQ 中引入了提升（boost）机制。

内存不足时发生的情况将在 [内存管理与虚拟内存](#/post/os-memory) 中继续讲解。

## 参考链接

- OSTEP, Scheduling: Introduction: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf
- OSTEP, Scheduling: The Multi-Level Feedback Queue: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf

← 概念图 (#/post/cs-map)

相关文章：[操作系统基础](#/post/cs-os) · [进程与线程](#/post/os-process-thread) · [同步与死锁](#/post/os-sync-deadlock)