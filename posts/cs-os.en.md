An operating system (OS) acts as a manager that allows multiple programs to share limited resources like the CPU and memory. Terms such as processes, scheduling, virtual memory, and synchronization are simply different perspectives on this single task.

## Definitions First

A program is a file stored on disk, while a process is that file in execution. A process possesses its own memory space (code, data, heap, stack) and open files like resources. Running the same program twice results in two processes.

A thread is a unit within a process that holds only an execution flow. Threads within the same process share the heap and code but have their own stacks and registers. Therefore, threads can easily exchange data with each other, but they may also get tangled if manipulating the same data simultaneously. Processes are separated by memory; thus, if one dies, the others suffer less damage.

| | Process | Thread |
|---|---|---|
| Memory | Separate for each | Shared within the process (only stack is separate) |
| Cost to create/change | Relatively high | Relatively low |
| Data sharing | Requires a separate channel | Just look at the same variable |
| If one fails | Other processes are usually safe | All threads in the same process are at risk |

## Dividing the CPU: Scheduling

Since there are far more processes than cores, the OS alternates giving the CPU to them. The scheduler decides who gets it first. OSTEP (textbook) prioritizes turnaround time (from arrival until completion) as a performance metric, noting that it often conflicts with fairness. Response time (from arrival until first execution) is closer to what users perceive as speed.

- FIFO: In the order they arrive. Simple, but if a long job is ahead, short jobs behind wait longer.
- SJF (Shortest Job First): Improves average turnaround time. However, it requires knowing job lengths in advance. The textbook compares this to a supermarket's "express lane for 10 items or fewer."
- Round Robin: Rotates through tasks by a time quantum before moving to the next task. It offers good response time but can worsen turnaround time.

If the time quantum is too short, context-switching costs increase. Using an example from the textbook where the quantum is 10ms and the switching cost is 1ms, about 10% of the time is spent on switching. Increasing the quantum reduces this cost (amortization), but response slows down accordingly.

<details>
<summary>Round Robin hands-on demo (execution verified)</summary>

Tasks A(5), B(3), C(8) were rotated with a quantum of 2, and their completion times were measured.

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

Although the three tasks appear to run almost simultaneously, even the shortest task B finishes at 9. If it ran alone, it would have finished at 3. This is the price of alternating execution.
</details>

## Dividing Memory: Virtual Memory

Virtual memory convinces each process that "I am using the entire memory alone." The addresses a process sees are virtual addresses, and the OS and hardware translate them to actual RAM locations (physical addresses). OSTEP summarizes the goals of virtual memory as follows:

- Transparency: Programs do not need to know that memory is virtualized.
- Efficiency: Waste should be minimized in both time and space (hardware assistance is required).
- Protection: One process cannot touch the memory of another process or the OS. The textbook refers to this as isolation between processes.

Paging is a method where memory is sliced into equal-sized chunks (pages) and virtual pages are paired with physical frames. This pairing table is called the page table. Not all pages need to be in RAM; unused pages are swapped out to disk and brought back when needed. If an accessed page is not in RAM, a page fault occurs, and the OS retrieves it from the disk. When RAM is full, a decision must be made on who to evict; this is the page replacement policy.

<details>
<summary>FIFO vs LRU, and strange results (execution verified)</summary>

Fault counts were measured while changing the number of frames with reference sequences 1,2,3,4,1,2,5,1,2,3,4,5.

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

FIFO increased faults from 9 to 10 when frames increased from 3 to 4. This is known as Belady's anomaly. LRU (evicting the least recently used) decreased faults from 10 to 8 with 4 frames and from 3 to something else. In this input, LRU was worse than FIFO with 3 frames, so do not memorize that "LRU is always better."
</details>

When RAM is insufficient and page faults continue to occur, the state is called thrashing.

## Problems Arising from Shared Use: Synchronization

If two threads execute `n += 1` on the same variable, it is broken down into three stages: read, add, and write. If both threads read the same value and each adds 1 before writing, one increment gets lost. This phenomenon is called a race condition. The basic tool to prevent this is a lock (mutex). Only the thread that holds the lock can enter that section (the critical section), while others wait. This flow reappears in [transactions and isolation levels](#/post/db-transaction) of databases, and similar concerns continue in [asynchronous processing and message queues](#/post/be-async-queue) where tasks are distributed.

Using locks introduces a new problem. If Thread 1 holds lock A and waits for B, while Thread 2 holds B and waits for A, neither can ever move forward. This is a deadlock.

<details>
<summary>Reproducing deadlock with and without locks (execution verified)</summary>

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

Even running without locks, my PC produced 400000, so I never observed incorrect values. Therefore, this code failed as an example demonstrating a race condition. It might be due to the implementation details of CPython. We definitely learned that just because a race condition exists doesn't mean it will always occur. However, not being able to reproduce it does not make the code safe.

Deadlock was reproduced using two threads with timeouts set.

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

Running this produced only one line: "t2 stuck". If one thread releases its lock due to a timeout, the other is freed, and neither gets stuck. Without timeouts, both stop completely. I did not run the version without timeouts.
</details>

## Looking further

If drawn in one line, it looks like this. Processes are the execution units, the scheduler divides CPU time, virtual memory divides address spaces, and synchronization is needed where things are shared. Containers ([Docker and containers](#/post/cloud-docker)) ultimately seem to boil down to how the OS divides and presents processes, though I haven't studied that aspect in detail yet.

## Common Misconceptions

- Increasing threads always makes it faster: If the number of threads exceeds the number of cores, context switching costs increase, and lock contention arises.
- Virtual memory means more RAM: The core concept is providing independent address spaces for each process (isolation), not capacity expansion. Swapping to disk is a feature layered on top of that.
- Using locks alone ensures safety: Locks can cause deadlocks.
- Shorter time slices are always better: While responsiveness improves, context switching costs increase.

## Reference Links

- OSTEP, Introduction to Virtual Memory (The Abstraction: Address Spaces): https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf
- OSTEP, Introduction to CPU Scheduling (Scheduling: Introduction): https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf

← Concept map ([#/post/cs-map])

Related posts: [Docker and containers](#/post/cloud-docker) · [Asynchronous processing and message queues](#/post/be-async-queue) · [Transactions and isolation levels](#/post/db-transaction)