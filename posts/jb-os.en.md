The Operating Systems section of the Information Processing Technician exam consists of equal parts concept memorization and manual calculations. Concepts are tested through terminology distinction questions, while calculations involve scheduling average time and page fault counts. Both can be summarized in one line: the operating system's method of allocating CPU and memory. Write them down in that order. Check the exam schedule and registration fee on the official website.

If you want to explore Operating Systems in more depth, I have organized detailed notes at [Details → Operating System Fundamentals](#/post/cs-os). This article is tailored to match the format of questions asked in the exam.

## Processes and Threads

A program is a file on disk, whereas a process is an entity loaded into memory and currently executing. A thread represents an execution flow within a process. Threads within the same process share code, data, and heap, while maintaining their own stack and registers.

There are five process states to memorize:

| State | Meaning | Transition To |
|---|---|---|
| New (Created) | Being created | Approved → Ready |
| Ready | Executable once CPU is assigned | Dispatched → Running |
| Running | Currently using the CPU | Time expired → Ready, I/O request → Waiting, Terminated → Terminated |
| Waiting/Blocked | Waiting for an event like I/O | Event completed → Ready |
| Terminated | Finished | - |

There are two pairs often confused. The action of assigning the CPU from Ready to Running is called dispatching (dispatch), while the action of being preempted due to time expiration from Running back to Ready is called a timeout (time out). There is no direct path from Waiting to Running; it must always pass through Ready first.

A context switch occurs when switching to an executable process: the current state (registers, program counter, etc.) is saved in the PCB, and the next process's state is loaded from its PCB. Since no work can be done during this time, it is pure overhead. A Process Control Block (PCB) contains information such as process ID, state, program counter, registers, memory information, and open file descriptors.

## CPU Scheduling

Evaluation criteria are based on three types of time:

- Waiting time: Time spent waiting in the ready queue
- Turnaround time: From arrival until completion (Waiting time + Execution time)
- Response time: From arrival until first receiving the CPU

Scheduling algorithms are divided into two categories based on whether a process can be preempted.

| Category | Algorithm | One-line Summary |
|---|---|---|
| Non-preemptive | FCFS | Executes in arrival order. If short jobs queue behind long ones, average performance degrades (convoy effect) |
| Non-preemptive | SJF | Executes shortest jobs first. Good average waiting time, but long jobs may starve |
| Non-preemptive | HRN | Prioritizes processes with higher ((Waiting Time + Execution Time) ÷ Execution Time). Reduces starvation compared to SJF |
| Non-preemptive | Priority | Executes highest priority first. Low-priority jobs may starve; solved via aging (priority increases the longer they wait) |
| Preemptive | SRT | Switches to the process with the shortest remaining time. Preemptive version of SJF |
| Preemptive | Round Robin | Rotates through processes based on a time quantum. Large quantum approaches FCFS; very small quantum increases context switches |
| Preemptive | Multilevel Queue / Feedback Queue | Uses multiple queues and moves processes based on priority or usage patterns |

Solving the same problem with three different methods reveals clear differences. Suppose arrival times and execution durations are given as follows:

| Process | Arrival Time | Execution Time |
|---|---|---|
| P1 | 0 | 6 |
| P2 | 1 | 3 |
| P3 | 2 | 1 |

These values were obtained through direct simulation.

| Method | Execution Order | Average Waiting Time | Average Turnaround Time |
|---|---|---|---|
| FCFS | P1(0~6) → P2(6~9) → P3(9~10) | 4.0 | 7.33 |
| SJF | P1(0~6) → P3(6~7) → P2(7~10) | 3.33 | 6.67 |
| SRT | P1(0~1) → P2(1~2) → P3(2~3) → P2(3~5) → P1(5~10) | 1.67 | 5.0 |

The solution procedure is always the same: draw a timeline, note who is in the ready queue at each moment, select one process according to the rule, and calculate waiting and turnaround times by subtracting arrival time from completion time when a process finishes. In SJF, the key point is that at time 6 when P1 completes, both P2 and P3 have arrived, so the shorter P3 goes first. For preemptive SRT, at the moment P2 arrives (time 1), P1's remaining time is 5, so P2 (with 3) takes the CPU.

For Round Robin, the answer may vary depending on whether newly arrived processes are placed at the front or back of the queue when arrival coincides with the time quantum. Since conditions are specified in the problem, follow those rules while constructing the queue.

In HRN priority, larger values indicate higher priority. For example, if waiting time is 5 and execution time is 5, then (5+5)/5 = 2; if waiting time is 10 and execution time is 20, then (10+20)/20 = 1.5, so the former goes first. Remember that the value increases with shorter execution times and longer waiting periods.

<details>
<summary>Verify the same calculation using Python (SRT section)</summary>

```python
P = [("P1", 0, 6), ("P2", 1, 3), ("P3", 2, 1)]
rem = {n: b for n, a, b in P}
arr = {n: a for n, a, b in P}
t, fin = 0, {}
while rem:
    ready = [n for n in rem if arr[n] <= t]
    if not ready:
        t += 1
        continue
    n = min(ready, key=lambda x: rem[x])   # 남은 시간이 가장 짧은 것
    rem[n] -= 1
    t += 1
    if rem[n] == 0:
        fin[n] = t
        del rem[n]
for n, a, b in P:
    print(n, "반환", fin[n] - a, "대기", fin[n] - a - b)
```

The results show: P1 returns after waiting 4, P2 returns after waiting 1, and P3 returns after waiting 0.
</details>

A queue-like basic data structure is used here as a ready queue. [Details → Data Structures](#/post/jb-data-structure)

## Memory Management

### Contiguous Allocation and Fragmentation

In the approach of loading programs into memory as a single contiguous block, the problem lies in determining where to place free space. The three placement strategies are named exactly what they mean:

- **First Fit**: Places the process in the first available hole found from the beginning.
- **Best Fit**: Places the process in the smallest available hole that is large enough.
- **Worst Fit**: Places the process in the largest available hole.

I manually calculated a scenario where free spaces are 120, 450, 230, 310, and 580, with requests arriving in the order 200, 400, 100, 450.

| Strategy | 200 | 400 | 100 | 450 |
|---|---|---|---|---|
| First Fit | 450 | 580 | 120 | Cannot fit |
| Best Fit | 230 | 450 | 120 | 580 |
| Worst Fit | 580 | 450 | 380 | Cannot fit |

The numbers in the cells represent the size of the free space occupied by that request (based on the time of request). In this example, only Best Fit managed to accommodate all four requests. This is not always the case; the order depends on the input.

Fragmentation comes in two types: **internal fragmentation** refers to unused space within an allocated block (when divided into fixed sizes), and **external fragmentation** refers to a situation where the total free space is sufficient but scattered, making it unusable (when variable sizes are used). External fragmentation is reduced by compaction (garbage collection).

### Paging and Segmentation

Paging divides address space into pages of equal size and physical memory into frames of equal size, allowing any page to be placed in any frame. A page table serves as a mapping from page numbers to frame numbers. Each process has its own page table.

A virtual address is split into a Page Number (VPN) and an offset. The offset represents the position within the page, so it does not change during translation; only the page number is converted to a frame number. In the OSTEP example, a 64-byte address space is divided into four 16-byte pages, where the upper 2 bits of the 6-bit address represent the VPN and the lower 4 bits represent the offset. Exams often present calculations in this format.

- If the address size is 32 bits and page size is 4KB (= $2^{12}$), the offset is 12 bits and the VPN is 20 bits.
- Consequently, the number of entries in the page table is $2^{20}$ (approximately 1 million).
- Increasing the page size reduces the table size but increases internal fragmentation.

Segmentation divides programs into segments based on semantic units like code, data, and stack, loading them with varying sizes. Since sizes are not uniform, external fragmentation occurs; however, protection and sharing become easier based on semantic units. Remember that paging is associated with internal fragmentation, while segmentation is associated with external fragmentation.

### Virtual Memory and Page Replacement

Virtual memory is a technique required to run programs larger than physical memory by loading only the necessary pages into memory. If a needed page is not in memory, a **page fault** occurs, and the page is fetched from the disk. When memory is full, one page must be evicted; the rule determining which page to evict is called a replacement algorithm.

| Algorithm | Eviction Criterion |
|---|---|
| OPT | The page that will not be used for the longest time in the future (requires knowledge of the future, so used only as a comparison benchmark) |
| FIFO | The page that entered first |
| LRU | The page used least recently |
| LFU | The page with the fewest number of uses |
| NUR | Distinguishes recently unused pages using reference and modification bits |

The following results are from running a reference string `1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5` with 3 frames and 4 frames. This string was used by OSTEP to explain Belady's anomaly.

| Number of Frames | FIFO Faults | LRU Faults | OPT Faults |
|---|---|---|---|
| 3 | 9 | 10 | 7 |
| 4 | 10 | 8 | 6 |

FIFO experienced an increase in faults from 9 to 10 when the number of frames increased from 3 to 4. This is known as **Belady's anomaly**. LRU does not exhibit this behavior because it possesses the stack property, where the content of frame N+1 includes the content of frame N. Exams often ask for the name of the phenomenon where "faults increase when the number of frames increases in FIFO."

The solution procedure involves reading the reference string one by one and recording the frame state alongside. If a page already exists, it is a hit; otherwise, it is a fault, and one page is evicted according to the rule. For LRU, it is easy to forget that the recent usage order of a page is updated even on a hit.

<details>
<summary>Verify page replacement using Python</summary>

```python
from collections import deque

def fifo(ref, n):
    m, f = deque(), 0
    for r in ref:
        if r not in m:
            f += 1
            if len(m) == n:
                m.popleft()
            m.append(r)
    return f

def lru(ref, n):
    m, f = [], 0
    for r in ref:
        if r in m:
            m.remove(r)          # 적중해도 최근 순서 갱신
        else:
            f += 1
            if len(m) == n:
                m.pop(0)
        m.append(r)
    return f

def opt(ref, n):
    m, f = [], 0
    for i, r in enumerate(ref):
        if r in m:
            continue
        f += 1
        if len(m) == n:
            later = ref[i + 1:]
            dist = [later.index(x) if x in later else 10**9 for x in m]
            m.pop(dist.index(max(dist)))   # 가장 늦게 다시 쓰는 것
        m.append(r)
    return f

ref = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]
for n in (3, 4):
    print(n, fifo(ref, n), lru(ref, n), opt(ref, n))
```

The output is `3 9 10 7`, `4 10 8 6`.
</details>

There is one more concept to distinguish in virtual memory. **Thrashing** occurs when there are too many processes, causing continuous page faults where the CPU spends all its time swapping pages instead of doing work. **Locality** refers to the property that programs tend to access memory locations close to those they recently used. A **working set** is a collection of pages frequently referenced over a certain period. Keeping at least the working set in memory reduces thrashing.

## Deadlock

A **deadlock** occurs when processes wait indefinitely for resources held by each other. It arises only when the following four conditions hold simultaneously. OSTEP also lists these same four:

| Condition | Meaning | Prevention Method to Break It |
|---|---|---|
| Mutual Exclusion | Resources are used by one at a time | Make resources shareable using lock-free data structures, etc. |
| Hold and Wait | Holding a resource while waiting for another | Acquire all needed resources at once |
| No Preemption | Held resources cannot be forcibly taken | Release held resources if they cannot be obtained and retry later |
| Circular Wait | There is a circular chain of processes waiting on each other | Assign numbers to resources and request them in order |

Exams often ask you to match these four names with "which condition is broken by this method." Assigning numbers to resources and requesting them in order breaks circular wait.

Solutions are categorized into four approaches:

- **Prevention**: Prevent one of the four conditions beforehand. Safe but reduces resource utilization.
- **Avoidance**: Calculate safety for each resource request before granting it. The classic example is Dijkstra's Banker's Algorithm, which requires knowing maximum demand in advance.
- **Detection**: Allow execution and periodically check for deadlocks (e.g., using a resource allocation graph).
- **Recovery**: After detection, terminate processes or forcibly reclaim resources to resolve the deadlock.

A **safe state** is one where at least one sequence exists allowing all processes to complete execution. An **unsafe state** does not immediately imply a deadlock. The Banker's Algorithm works by selecting a process whose maximum demand can be satisfied with currently available resources, letting it finish, and then combining its released resources to select the next process. If such a sequence can be established until completion, the state is safe.

## Synchronization

A **critical section** is a code segment that accesses shared resources and must be entered by only one process at a time. Semaphores and mutexes are tools used to guarantee this.

- **Semaphore**: Implemented using a single integer variable and P (wait, decrement) / V (signal, increment) operations. If the value is 1, it's a binary semaphore; if greater than 1, it's a counting semaphore.
- **Mutex**: A mutual exclusion tool where only the holder can release the lock.
- **Monitor**: A high-level structure that bundles shared resources and their access functions to ensure only one execution at a time.

A **race condition** occurs when multiple processes simultaneously modify shared data, causing results to vary based on execution order. Unlike deadlock, it does not stop execution but leads to incorrect values. Concurrency issues also arise in databases with similar problems. [Read more → Normalization and Transactions](#/post/jb-normalization-transaction)

## Summary of Common Question Types

| Type | Question Format | Solution Approach |
|---|---|---|
| Average Scheduling Time | Given arrival and execution time tables, calculate average waiting and turnaround times | Draw a timeline + ready queue |
| Algorithm Name Matching | Descriptions like "shortest remaining time" or "longer wait = higher priority" | Connect via keywords like SRT, HRN |
| Page Fault Count | Given reference string and number of frames | Track frame states and count only faults |
| Belady's Anomaly | Frame count increases but page faults also increase in FIFO | Answer by name |
| Deadlock 4 Conditions | Condition names and prevention methods to break them | Match using the table above |
| Fragmentation | Fixed partition vs. variable partition | Internal ↔ Fixed, External ↔ Variable |

## Related Articles

← [Concept Map](#/post/jb-map)

- [Read more → Network Basics](#/post/jb-network): Continues the flow of the same subject
- [Read more → Operating System Basics](#/post/cs-os): Concept-focused summary

## Reference Links

- [OSTEP, Scheduling: Introduction](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf)
- [OSTEP, Beyond Physical Memory: Policies](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys-policy.pdf)
- [OSTEP, Common Concurrency Problems](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf)
- [OSTEP, Paging: Introduction](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf)