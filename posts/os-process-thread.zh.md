进程与线程的区别几乎可以归结为是否共享地址空间。创建开销、切换成本、通信方式以及一方终止时的影响范围，都由此衍生出来。操作系统的全貌在 [概述](#/post/cs-os) 中已有介绍，此处将深入探讨这两者。

## 进程所拥有的资源

程序是存储在磁盘上的指令集合，当操作系统将其加载到内存并执行时，它就变成了进程。OSTEP 将进程定义为“正在执行的程序”，要理解进程，必须查看其机器状态。机器状态包括可访问的内存（地址空间）、寄存器（包含程序计数器、栈指针等）以及打开的文件等输入输出信息。

操作系统在将程序创建为进程时也会执行一系列固定操作：将代码和静态数据加载到内存，分配栈并填充 `main()` 的参数（argc, argv），进行输入输出设置，然后跳转到 `main()`。现代操作系统并非一次性完成所有这些操作，而是采用按需加载（lazy loading）的方式，仅在需要时加载相应的片段。相关内容可参见 [内存管理与虚拟内存](#/post/os-memory)。

操作系统为每个进程维护一个包含其信息的结构体（PCB，进程控制块），其中存储了寄存器值、状态和内存信息。

## 进程的状态

OSTEP 将进程状态分为三类：

| 状态 | 含义 |
|---|---|
| Running | 正在 CPU 上执行指令 |
| Ready | 可以执行，但操作系统当前选择了其他进程 |
| Blocked | 已启动如磁盘读取等 I/O 操作，直到该操作完成前无法执行 |

```
Ready --(스케줄러가 고름)--> Running --(I/O 요청)--> Blocked
Ready <--(시간이 다 됨)----- Running
Ready <--(I/O 끝남)--------- Blocked
```

单独设立 Blocked 状态是有意义的。向等待 I/O 的进程分配 CPU 会造成资源浪费，此时转而运行其他进程更为高效。选择将哪个进程设为 Running 状态是 [CPU 调度](#/post/os-scheduling) 的主题。实际操作系统中的状态比这更多（教材的描述也进行了简化）。

## 线程所拥有的资源

在 OSTEP 中，线程被定义为“进程内的另一个执行点”。若有多个线程，则存在多个程序计数器。每个线程拥有独立的寄存器集合，但共享相同的地址空间，从而访问相同的数据。

总结如下：

| | 进程之间 | 同一进程内的线程之间 |
|---|---|---|
| 地址空间（代码、堆、全局变量） | 独立 | 共享 |
| 栈 | 独立 | 每个线程独立 |
| 寄存器·程序计数器 | 独立 | 每个线程独立 |
| 打开的文件 | 独立（可继承） | 共享 |
| 状态记录位置 | PCB | TCB（线程控制块），每个进程有多个 |

栈为每个线程独立存在，是因为函数调用记录和局部变量存储于此。若两个线程共享同一个栈，它们的调用流程便会相互干扰。因此，创建线程时会在地址空间内增加一个独立的栈。

<details>
<summary>线程可见全局变量而进程不可见（已验证执行）</summary>

分别让线程和子进程修改了全局变量 `counter`。在 Windows 上使用 Python 3.13 运行测试。

```python
import threading, multiprocessing as mp, os

counter = 0
def bump():
    global counter
    counter += 1

def child_bump(q):
    global counter
    counter += 100
    q.put(counter)

if __name__ == "__main__":
    t = threading.Thread(target=bump); t.start(); t.join()
    print("after thread: counter =", counter)
    q = mp.Queue()
    p = mp.Process(target=child_bump, args=(q,)); p.start()
    print("child saw", q.get()); p.join()
    print("after process: counter =", counter)
    print(mp.get_start_method())
```

输出结果如下：

```
after thread: counter = 1
child saw 100
after process: counter = 1
spawn
```

线程增加的 1 被父进程看到，而子进程增加的 100 仅在子进程内部可见。为了接收结果，必须使用 `Queue`。进程之间需要建立专门的通道（如管道、队列、套接字、共享内存等）。[套接字与 Web 套接字](#/post/net-socket) 也是此类通道之一。

输出末尾的 `spawn` 表示 Python 文档中所述的 Windows 和 macOS 默认启动方式：父进程启动新的 Python 解释器进程，子进程仅继承运行 `run()` 所需的资源。根据文档，`fork` 仅在 POSIX 系统中使用，且子进程以与父进程几乎完全相同的状态启动。
</details>

## 上下文切换中的差异

OSTEP 对 CPU 从执行进程 A 切换到 B 的过程描述如下：当定时器中断发生时，硬件将 A 的用户寄存器保存到 A 的内核栈中，并进入内核。操作系统决定从 A 切换到 B 后，`switch()` 例程将 A 的内核寄存器保存到 A 的进程结构体中，恢复 B 的寄存器，并将内核栈切换为 B 的。最后，通过返回陷阱（return-from-trap）恢复 B 的寄存器，B 开始执行。教材指出寄存器保存发生了两次（一次由硬件完成，一次由软件完成）。

线程之间的切换过程几乎相同，但有一点不同：虽然都是保存 T1 的寄存器并恢复 T2 的寄存器，但由于地址空间保持不变，因此无需更改页表。OSTEP 所提到的进程切换与线程切换的最大区别就在于此。

改变地址空间为何代价高昂，可以通过 [内存管理与虚拟内存](#/post/os-memory) 和 [内存层次结构与缓存](#/post/ca-memory-hierarchy) 来理解。这是因为地址转换信息和驻留在缓存中的数据对新进程而言已无用。不过，实测的成本数值因环境而异。教材使用名为 lmbench 的工具进行测量：在 1996 年的 200MHz 机器上，上下文切换约为 6 微秒；而如今的机器在 2~3GHz 频率下，耗时不足 1 微秒。

## 创建的成本

不仅切换不同，创建过程也不同。线程只需创建栈和 TCB（线程控制块），而进程则需要准备整个地址空间。我在自己的 PC（Windows, Python 3.13）上进行了测试：分别以线程和进程的形式创建一个什么都不做的函数，并重复运行直到结束，以此测量其耗时。

<details>
<summary>创建成本对比（已执行验证）</summary>

```python
import threading, multiprocessing as mp, time
def noop(): pass

if __name__ == "__main__":
    N = 100
    t0 = time.perf_counter()
    for _ in range(N):
        t = threading.Thread(target=noop); t.start(); t.join()
    th = (time.perf_counter() - t0) / N
    N2 = 20
    t0 = time.perf_counter()
    for _ in range(N2):
        p = mp.Process(target=noop); p.start(); p.join()
    pr = (time.perf_counter() - t0) / N2
    print(f"thread {th*1e6:.0f} us, process {pr*1e3:.1f} ms, ratio {pr/th:.0f}x")
```

运行两次后得到了如下结果：

```
thread 788 us, process 596.1 ms, ratio 757x
thread 1939 us, process 258.0 ms, ratio 133x
```

每次运行的数值波动较大。可以明确的是，进程方向的开销高出两到三个数量级。需要注意的是，该进程数值中包含了 `spawn` 启动新解释器的时间，因此并非仅衡量操作系统层面的进程创建成本。
</details>

## UNIX 中的进程创建：fork、exec、wait

UNIX 在创建进程时将调用拆分为两部分。根据 OSTEP 的解释，`fork()` 会创建被调用进程的副本（子进程），而 `exec()` 则将当前进程的代码和静态数据覆盖为另一个可执行文件的内容。`exec()` 并不会创建新进程，而是将正在运行的程序替换为另一个程序；若成功，则不会返回。`wait()` 则使父进程等待子进程结束。

在 `fork()` 之后，父进程和子进程均可执行，因此谁先输出是不确定的。教材指出，加入 `wait()` 后输出顺序便变得确定。

为何要将其分为两部分？这是因为 shell 可以在 `fork()` 和 `exec()` 之间插入代码。例如，`wc p3.c > newfile.txt` 这样的重定向是通过子进程在调用 `exec()` 之前关闭标准输出并打开 `newfile.txt` 来实现的。由于打开的文件描述符在 `exec()` 之后仍然保留，因此 `wc` 会 unaware 自己的输出是否已重定向到文件而继续运行。这种机制也是理解 [Docker 与容器](#/post/cloud-docker) 等进程隔离的基础背景。

## 使用线程的原因及其代价

OSTEP 提出的线程优势在于支持并行执行，并且即使在因 I/O 操作而暂停时，程序也能继续处理其他任务。由于共享相同的数据，这种分工协作变得容易实现。

其代价则如书中计数器示例所示：向共享变量加 1 的代码在机器语言层面包含读取、加法和写入三个步骤。如果线程 1 读取了值并执行加法后，在写入前被切换，而线程 2 读取了相同的旧值并进行写入，那么当线程 1 继续执行写入时，增量就会丢失。这种依赖于执行时序的情况称为竞态条件（race condition），解决方法是互斥机制。详细内容请参见 [同步与死锁](#/post/os-sync-deadlock)。

<details>
<summary>若在读写之间发生切换，增量将丢失（已执行验证）</summary>

在 Python 3.13 中直接运行 `n += 1` 并未重现该问题。因此，我们将读取和写入操作分开，并在其间使用 `time.sleep(0)` 主动让出 CPU，从而人为制造切换发生的场景。

```python
import threading, time
n = 0
def inc(k, yield_):
    global n
    for _ in range(k):
        tmp = n
        if yield_: time.sleep(0)
        n = tmp + 1

for y in (False, True):
    n = 0
    ts = [threading.Thread(target=inc, args=(20000, y)) for _ in range(4)]
    [t.start() for t in ts]; [t.join() for t in ts]
    print("yield" if y else "plain", n, "expected 80000")

n = 0; lock = threading.Lock()
def inc2(k):
    global n
    for _ in range(k):
        with lock:
            tmp = n; time.sleep(0); n = tmp + 1
ts = [threading.Thread(target=inc2, args=(20000,)) for _ in range(4)]
[t.start() for t in ts]; [t.join() for t in ts]
print("locked", n)
```

```
plain 80000 expected 80000
yield 20134 expected 80000
locked 80000
```

加入让出操作后，原本应为 80000 的值下降到了 20134。若对相同代码加锁，即使有让出操作，结果仍为 80000。在没有让出的情况下得到 80000，并非因为代码本身安全，而是因为切换并未在此期间发生。
</details>

相反，由于进程的内存是隔离的，这类问题会减少，但若进程间需要交换数据，则必须建立通信通道并付出复制数据的成本。

## Python 中观察到的一个现象

即使将占用 CPU 的计算任务分配给四个线程，速度也可能不会提升。Python 文档指出，`multiprocessing` 模块使用子进程而非线程来避免全局解释器锁（GIL），从而能够充分利用多核处理器。

<details>
<summary>对比顺序执行、多线程与多进程下的 CPU 计算（已执行验证）</summary>

我们测量了四次处理相同计算（300 万次求和）的时间。这台 PC 拥有 24 个逻辑核心。

```python
import threading, time, multiprocessing as mp, sys
def work(n):
    s = 0
    for i in range(n): s += i*i
    return s
N = 3_000_000
if __name__ == "__main__":
    t0 = time.perf_counter(); [work(N) for _ in range(4)]; seq = time.perf_counter() - t0
    ts = [threading.Thread(target=work, args=(N,)) for _ in range(4)]
    t0 = time.perf_counter(); [t.start() for t in ts]; [t.join() for t in ts]; th = time.perf_counter() - t0
    ps = [mp.Process(target=work, args=(N,)) for _ in range(4)]
    t0 = time.perf_counter(); [p.start() for p in ps]; [p.join() for p in ps]; pr = time.perf_counter() - t0
    print(f"seq {seq:.2f}s thread {th:.2f}s process {pr:.2f}s")
    print("gil enabled:", sys._is_gil_enabled())
```

```
seq 0.41s thread 0.38s process 0.23s
gil enabled: True
```

线程的运行时间与顺序执行几乎相同，而进程反而更快。尽管进程耗时中包含了启动解释器的时间，结果依然如此。如果计算量更大，差异会更加明显。如果是等待 I/O 的场景，使用线程也会有所帮助。
</details>

## 常见误区

- 线程只是轻量级的进程：共享地址空间这一区别改变了安全性和通信方式。“轻量”是由此产生的结果。
- 进程总是比线程慢：虽然创建和切换开销较大，但在需要隔离或利用多个核心时（如上述 CPU 计算实验），使用进程更为合适。
- `fork()` 会启动新程序：它仅创建副本，运行其他程序的是 `exec()`。
- 增加线程数就能提速：一旦超过核心数量，上下文切换会增加，且共享数据需要加锁。
- Blocked 状态的进程仍占用 CPU 等待：在等待期间，CPU 会被分配给其他进程。

## 参考链接

- OSTEP, The Abstraction: The Process: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf
- OSTEP, Interlude: Process API: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf
- OSTEP, Mechanism: Limited Direct Execution: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf
- OSTEP, Concurrency: An Introduction: https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf
- Python 文档，multiprocessing: https://docs.python.org/3/library/multiprocessing.html

← 概念地图 (#/post/cs-map)

相关文章：[CPU 调度](#/post/os-scheduling) · [同步与死锁](#/post/os-sync-deadlock) · [内存管理与虚拟内存](#/post/os-memory)