[概要](#/post/cs-os) 中仅简要地将同步描述为“在共享点所需的东西”。此处将这一部分单独抽出，通过代码演示来总结：为什么数值会出错、锁和信号量分别是什么、产生死锁的条件以及避免方法。线程共享内存的前提已在 [进程与线程](#/post/os-process-thread) 中先行讨论。

## 竞争条件与临界区

多个线程同时读写同一变量时，结果会因执行顺序不同而变化。这被称为竞争条件（race condition）。`n += 1` 看似是一行代码，实际上却分解为读取、加法和写入三个步骤，在此期间其他线程可能插足。若两个线程读取了相同的值并各自加 1 后写入，则会导致一个增量丢失。不允许插入的代码段称为临界区（critical section）。

要遵守临界区，必须保证同一时间只允许一个线程进入。这被称为互斥（mutual exclusion），最常用的工具是锁（mutex）。持有锁的线程才能进入该区域，其余线程需等待锁被释放。线程何时切换由调度器决定，程序无法知晓（[CPU 调度](#/post/os-scheduling)），因此“通常没问题”的代码并无保障。

<details>
<summary>无锁 / 有锁情况下 4 个线程各累加 2000 次（已执行验证）</summary>

在读取和写入之间插入 `time.sleep(0)`，故意制造线程切换的机会。

```python
import threading, time
n = 0
def inc(k):
    global n
    for _ in range(k):
        tmp = n
        time.sleep(0)
        n = tmp + 1

def run(f, *a):
    ts = [threading.Thread(target=f, args=a) for _ in range(4)]
    [t.start() for t in ts]; [t.join() for t in ts]

run(inc, 2000); print("no lock", n)   # 2074 (실행마다 다름)

n = 0
lk = threading.Lock()
def inc2(k):
    global n
    for _ in range(k):
        with lk:
            tmp = n; time.sleep(0); n = tmp + 1

run(inc2, 2000); print("lock", n)     # 8000
```

若无锁，本应得到 8000 的值却为 2074，且该数字每次运行都会变化。使用锁的版本即使存在相同的时间间隙，结果仍为 8000。
</details>

## 信号量

如果说锁是“允许进入”或“禁止进入”的二元状态，那么信号量（semaphore）则是一个持有整数的计数器。OSTEP 教材如此解释：涉及两个操作，POSIX 名称为 `sem_wait()` 和 `sem_post()`。Dijkstra 将这两个操作称为 P() 和 V()。

- `sem_wait`：将值减 1；若减后的值为负数，则等待。
- `sem_post`：将值加 1；若有线程在等待，则唤醒其中一个。

教材还指出，当值为负数时，其绝对值代表正在等待的线程数量。初始值决定了其用途。

| 初始值 | 用途 | 示例 |
|---|---|---|
| 1 | 替代锁（二进制信号量） | 保护临界区 |
| 0 | 控制顺序 | 子进程结束后父进程继续执行 |
| N | 最多同时允许 N 个 | N 个资源、N 个空闲缓冲区位置 |

初始值为 N 时的典型问题是生产者 - 消费者（有界缓冲区）。在拥有 N 个位置的缓冲区中，一端用于放入数据，另一端用于取出数据。使用 `empty`（初始值 N，表示空位数量）、`full`（初始值 0，表示满位数量），以及保护缓冲区本身的 `mutex`。当缓冲区满时，生产者需在 `empty` 上等待；当缓冲区空时，消费者需在 `full` 上等待。异步队列也面临与此相同的结构问题（[异步处理与消息队列](#/post/be-async-queue)）。

OSTEP 中收录了该问题的错误解法：若先获取 `mutex` 再获取 `empty`/`full`，会导致死锁。若消费者持有 `mutex` 并等待 `full`，则准备插入的生产者因无法获取 `mutex` 而永远无法插入。

<details>
<summary>使用信号量实现生产者 - 消费者，以及先获取 mutex 的错误版本（已执行验证）</summary>

```python
import threading, collections
N = 3
empty = threading.Semaphore(N); full = threading.Semaphore(0); mu = threading.Lock()
buf = collections.deque(); out = []

def prod():
    for i in range(10):
        empty.acquire()                 # 빈 칸 기다림
        with mu: buf.append(i); assert len(buf) <= N
        full.release()

def cons():
    for _ in range(10):
        full.acquire()                  # 찬 칸 기다림
        with mu: out.append(buf.popleft())
        empty.release()

p = threading.Thread(target=prod); c = threading.Thread(target=cons)
p.start(); c.start(); p.join(); c.join()
print(out)   # [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```

运行四次后顺序正确，且缓冲区长度未超过 N。错误版本是将 `acquire` 调用置于 `with mu:` 内部所致。

```python
import time
def prod():
    for i in range(5):
        with mu:
            empty.acquire(); buf.append(i); full.release()
def cons():
    for _ in range(5):
        with mu:
            full.acquire(); buf.popleft(); empty.release()

c = threading.Thread(target=cons, daemon=True); p = threading.Thread(target=prod, daemon=True)
c.start(); time.sleep(.1); p.start()      # 소비자가 먼저 mu를 잡고 대기
c.join(1); p.join(1)
print("consumer alive:", c.is_alive(), "producer alive:", p.is_alive())
# consumer alive: True producer alive: True
```

即使等待 1 秒，两者均未完成。
</details>

使用初始值 0 来控制顺序的代码也很简短：若父线程在子线程调用 `release()` 之前于 `acquire()` 处等待，则日志中会先出现 `child`，后出现 `parent after`（通过运行验证）。

## 死锁

使用锁会引发新问题。例如，线程 1 持有锁 A 并等待锁 B，而线程 2 持有锁 B 并等待锁 A，此时两者均无法继续执行。这就是死锁（deadlock）。当只有一个锁时不会发生死锁；只有存在两个及以上锁且以重叠方式获取时才可能发生。

OSTEP 总结了导致死锁的四个必要条件（引用 1971 年的论文）：必须同时满足这四个条件才会产生死锁，只要打破其中任意一个，死锁就不会发生。

| 条件 | 含义 |
|---|---|
| 互斥 | 资源一次只能被一个线程独占（获取锁） |
| 占有并等待 | 在持有资源的同时等待其他资源 |
| 不可抢占 | 已持有的资源不能被他人强制剥夺 |
| 循环等待 | 线程们以环形方式互相等待对方持有的资源 |

教材举了一个看似不起眼的例子：Java 的 `Vector.addAll()`。`v1.addAll(v2)` 内部会同时获取 v1 和 v2 的锁；如果另一个线程几乎同时调用 `v2.addAll(v1)`，由于顺序错乱可能导致死锁。调用方无法察觉使用了两个锁。

<details>
<summary>以相反顺序获取两把锁会导致停止（已执行验证）</summary>

```python
import threading, time
a = threading.Lock(); b = threading.Lock()
def w1():
    with a:
        time.sleep(.1)
        with b: pass
def w2():
    with b:
        time.sleep(.1)
        with a: pass

t1 = threading.Thread(target=w1, daemon=True); t2 = threading.Thread(target=w2, daemon=True)
t1.start(); t2.start(); t1.join(2); t2.join(2)
print("alive after 2s:", t1.is_alive(), "/", t2.is_alive())
# alive after 2s: True / True
```

两秒后两者仍然存活。没有任何错误地静止不动，这就是死锁的外在表现。通过在 `sleep(.1)` 期间各自持有一把锁来对齐时机。
</details>

## 避免方法

OSTEP 总结了通过破坏四个条件之一来进行预防的方法。

- 打破循环等待：为获取锁的顺序制定全局规则。如果有 L1、L2 两把锁，始终先获取 L1。这是教材认为最实用的方法。当函数接收两个锁作为参数时，也介绍了以锁的地址值为准确定顺序的技巧。缺点是顺序仅是一种惯例；必须了解整个代码库，且只要有一处违规就会再次触发死锁。
- 打破占有并等待：一次性（原子地）获取所有需要的锁。例如在前面加一个全局锁，但需要提前知道需要哪些锁，且会降低并发度。
- 打破不可抢占：使用 `trylock` 尝试获取，失败则释放当前持有的锁并从头开始重试。两个线程持续互相退让可能导致活锁（livelock），建议在重试前加入随机延迟以减少这种情况。
- 打破互斥：利用 compare-and-swap 等硬件指令构建无锁数据结构。这并非易事。

<details>
<summary>统一代码中的顺序，并通过超时退出（已执行验证）</summary>

如果两个线程以相同顺序（先 a 后 b）获取锁，即使在上述时机下也能顺利完成。

```python
a = threading.Lock(); b = threading.Lock()
def w():
    with a:
        time.sleep(.1)
        with b: pass
ts = [threading.Thread(target=w, daemon=True) for _ in range(2)]
[t.start() for t in ts]; [t.join(2) for t in ts]
print("alive:", [t.is_alive() for t in ts])   # alive: [False, False]
```

退出方式是通过 `acquire(timeout=0.5)` 尝试获取第二把锁，若失败则放弃。

```python
a = threading.Lock(); b = threading.Lock(); log = []
def x(first, second, name):
    with first:
        time.sleep(.1)
        if second.acquire(timeout=0.5): second.release(); log.append(name + " ok")
        else: log.append(name + " gave up")
t1 = threading.Thread(target=x, args=(a, b, "t1")); t2 = threading.Thread(target=x, args=(b, a, "t2"))
t1.start(); t2.start(); t1.join(); t2.join(); print(sorted(log))
# ['t1 ok', 't2 gave up']
```

t2 放弃并释放了 b，因此 t1 得以完成。放弃后需要单独编写再次尝试的代码。
</details>

## 哲学家进餐问题

这是由 Dijkstra 提出的著名问题。五位哲学家围坐在圆桌旁，每人之间有一把叉子（共五把）。进食需要同时拿起左边和右边的叉子。OSTEP 也介绍了该问题，尽管其实用性不高但非常著名。如果所有人都先拿左边的叉子，所有人都会持有一把叉子并等待右边的叉子，从而陷入死锁——四个条件全部满足。教材的解法是改变一位哲学家（第 4 位）的获取顺序以打破循环等待，Dijkstra 本人也采用此方法解决。

<details>
<summary>全员先拿左边 vs 按编号顺序（已执行验证）</summary>

```python
def dine(ordered):
    forks = [threading.Lock() for _ in range(5)]
    meals = [0] * 5
    def ph(i):
        l, r = i, (i + 1) % 5
        first, second = (min(l, r), max(l, r)) if ordered else (l, r)
        for _ in range(3):
            with forks[first]:
                time.sleep(.05)
                with forks[second]:
                    meals[i] += 1
    ts = [threading.Thread(target=ph, args=(i,), daemon=True) for i in range(5)]
    [t.start() for t in ts]; [t.join(2) for t in ts]
    return meals

print("naive", dine(False))     # [0, 0, 0, 0, 0]
print("ordered", dine(True))    # [3, 3, 3, 3, 3]
```

“先拿左边”的方式运行四次后，第三次所有人只吃一顿饭，有一次仅一人吃了一顿饭便停止。按编号从小到大先拿叉子的方式每次都能吃完三顿饭。在此代码中，只有哲学家 4 的顺序被反转（优先拿叉子 0），其余人与“先拿左边”方式相同。
</details>

## 常见误解

- 只用锁就安全：锁反而会导致死锁。若涉及两把以上锁，必须规定顺序。
- 死锁与活锁相同：死锁是无人能行动；活锁则是持续动作但无进展。
- 无法复现即安全：上述代码仍需对齐时机才会触发。平时未触发不代表顺序正确。
- 信号量只是锁的另一种名称：初始值为 1 时可像锁一样使用，但由于它是计数器，也可用于顺序控制或数量限制。

## 参考链接

- OSTEP, 信号量（Semaphores）: https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf
- OSTEP, 常见并发问题（Common Concurrency Problems）: https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf

← 概念地图 (#/post/cs-map)

相关文章：[操作系统基础](#/post/cs-os) · [事务与隔离级别](#/post/db-transaction) · [异步处理与消息队列](#/post/be-async-queue)