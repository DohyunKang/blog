Scheduling is the process of deciding how much CPU time to allocate to each ready-to-run process when multiple processes are waiting. The overview article ([Operating System Fundamentals](#/post/cs-os)) briefly touched on FIFO, SJF, and Round Robin. Here, we follow the numbers to understand what metrics each algorithm aims to optimize and why these metrics often conflict with one another.

## First, Two Metrics

To compare scheduling algorithms, we need benchmarks. OSTEP (the textbook) uses two:

- **Turnaround time**: The time from job arrival until completion. Completion time − Arrival time.
- **Response time**: The time from job arrival until it first receives the CPU. First execution time − Arrival time.

In batch systems, turnaround time is important; for users sitting in front of a terminal, response time matters more. The textbook explains that with the advent of time-sharing computers, response time emerged as a metric. The core narrative of this article is that these two metrics are difficult to improve simultaneously within a single algorithm.

We also clarify the term **preemptive**. A non-preemptive scheduler runs a job to completion before moving to the next. A preemptive scheduler can interrupt a running job and switch to another, which requires context switching. The textbook notes that modern schedulers are essentially all preemptive. Context switching itself is covered in [Processes and Threads](#/post/os-process-thread).

## FCFS (FIFO) and the Convoy Effect

Jobs are processed in the order they arrive. This is the easiest to implement. Suppose jobs A (100s), B (10s), and C (10s) arrive simultaneously in that order:

- Completion times: A 100, B 110, C 120
- Average turnaround time: (100+110+120)/3 = 110

Short jobs B and C wait behind the long job A. The textbook calls this phenomenon the **convoy effect**.

## SJF and STCF

What if we run the shortest jobs first? With the same input, running in order B, C, A yields completion times of 10, 20, 120 and an average turnaround time of 50. This drops from 110 to 50. Under the assumption that all jobs arrive simultaneously, the textbook states SJF is optimal.

However, relaxing one assumption breaks this optimality. If A arrives at 0s and B and C arrive at 10s, non-preemptive SJF waits for A already running to finish. The average turnaround time rises again to 103.33. The solution is STCF (Shortest Time-to-Completion First, preemptive SJF). Whenever a new job arrives, the scheduler selects the job with the shortest remaining time. When B and C arrive, A is preempted, they run first, and the average turnaround time returns to 50.

The SJF family has a practical weakness: it must know in advance how long a job will take. Operating systems usually do not know this. That is why MLFQ was developed below.

## Round Robin and Response Time

SJF-based algorithms have poor response times. If A, B, and C each take 5s and arrive simultaneously, SJF yields response times of 0, 5, 10, averaging 5. Round Robin runs a job for only a time quantum before switching to the next. With a quantum of 1s, first execution times are 0, 1, 2, yielding an average response time of 1.

The trade-off is turnaround time. With the same input, RR finishes A at 13, B at 14, and C at 15 (average 14), whereas SJF finishes them at 5, 10, 15 (average 10). The textbook calls RR nearly the worst policy based on turnaround time because it extends job lengths as much as possible. More generally, policies that fairly divide CPU time in short intervals tend to have poor turnaround times. Fairness and turnaround time are inversely related.

Quantum size is another trade-off. If too small, context switching costs dominate. As an example from the textbook: if the quantum is 10ms and switching takes 1ms, about 10% of time is spent on switching; increasing the quantum to 100ms drops this below 1%. There is also the explanation that switching incurs higher costs because it not only changes registers but also invalidates state accumulated in CPU caches and TLBs.

<details>
<summary>Calculate metrics yourself (execution verified)</summary>

We recreated the above numbers using code that simulates execution in 1-second intervals. Only the "who runs next" logic changes per policy.

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

| Input | Policy | Avg Turnaround | Avg Response |
|---|---|---|---|
| A100·B10·C10 simultaneous arrival | FCFS | 110 | 70 |
| Same input | SJF | 50 | 10 |
| A arrives at 0, B·C at 10 | SJF (non-preemptive) | 103.33 | 63.33 |
| Same input | STCF | 50 | 3.33 |
| 5·5·5 simultaneous arrival | SJF | 10 | 5 |
| Same input | RR (quantum 1) | 14 | 1 |
</details>

<details>
<summary>Changing RR quantum size (execution verified)</summary>

In the code above, I replaced the chunk size in `rr(J1, q)` and ran simulations with inputs A100·B10·C10.

| Chunk | Avg Turnaround | Avg Response |
|---|---|---|
| 1 | 59.67 | 1.00 |
| 5 | 58.33 | 5.00 |
| 10 | 56.67 | 10.00 |
| 50 | 83.33 | 36.67 |
| 100 | 110.00 | 70.00 |

When the chunk is as long as 100, all jobs finish in a single go, yielding the same numbers as FCFS. Reducing the chunk size improves response time. In this simulation, since there are no context-switching costs, turnaround times appear to keep improving; however, in reality, the context-switching costs mentioned above pull in the opposite direction.
</details>

## Priority Scheduling

Each job is assigned a priority, and higher-priority jobs are executed first. SJF can be viewed as a type of priority scheduling where "shorter duration implies higher priority." In non-preemptive mode, a running job must finish before another can switch; in preemptive mode, the CPU is immediately taken by a newly arrived higher-priority job.

Suppose P1(24), P2(3), and P3(3) arrive simultaneously, with priorities ordered as P2 > P3 > P1. Running them non-preemptively yields completion times of 3 for P2, 6 for P3, and 30 for P1, resulting in an average turnaround time of 13. Running the same input under FCFS (order: P1, P2, P3) gives completion times of 24, 27, and 30, respectively, for an average of 27.

A drawback is starvation: if high-priority jobs keep arriving, low-priority jobs may never receive CPU time. The next section on MLFQ addresses this issue head-on.

## MLFQ: Approximating SJF Without Prior Knowledge

MLFQ (Multi-Level Feedback Queue) uses multiple queues with different priorities and adjusts job priorities based on observed behavior. The textbook describes the problem MLFQ aims to solve as follows: without knowing job lengths, we want to provide fast response for short jobs while avoiding unnecessary blocking of long jobs, thereby reducing turnaround time.

The basic rules are:

- Rule 1: Higher-priority queues run first.
- Rule 2: If priorities are equal, use Round Robin.
- Rule 3: New jobs start in the highest-priority queue.
- Rule 4: Once a job exhausts its allotment at a level, it moves down one level.
- Rule 5: Every S time units, all jobs are boosted back to the highest queue (priority boost).

Initially, all jobs are assumed to be short and placed at the top. If a job is truly short, it finishes there; if long, it gradually descends to lower queues. This approach approximates SJF based on behavior rather than prior knowledge of job length. Interactive jobs, which involve frequent I/O, stay near the top, while CPU-bound long jobs sink downward.

If Rule 4 is interpreted as "if a job performs I/O before exhausting its allotment, it remains at that level," the textbook notes two resulting problems: starvation and scheduler deception. Starvation occurs when continuously arriving interactive jobs prevent long jobs in lower queues from receiving CPU time. Scheduler deception happens when a job deliberately invokes short I/O just before its allotment is nearly exhausted to remain at the top. Rule 5 (periodic boost) prevents starvation, while Rule 4 (demotion based on total time spent per level) counters deception. The textbook states that if S is too large, long jobs starve; if too small, interactive jobs cannot get their fair share. Thus, these values are tuning knobs that cannot be set automatically.

Implementation varies across systems. According to the textbook, Solaris's time-sharing classes use a table-based approach with 60 base queues, chunk sizes ranging from 20ms to several hundred ms, and boosts occurring approximately every second. FreeBSD 4.3's scheduler calculates priority using a formula that gradually reduces CPU usage over time instead of a table.

<details>
<summary>Direct verification of MLFQ starvation and boost (execution confirmed)</summary>

A simplified simulator with 3 queues and an allotment of 10ms. Long job L arrives at 0ms, and short jobs of 10ms arrive one every 10ms starting from 20ms (keeping the CPU fully busy).

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

Over 300ms, without boost, L receives 20ms of CPU; with boosts every 100ms, it receives 40ms. The 20ms corresponds to the time L runs alone before new jobs arrive; afterward, continuous job arrivals prevent any execution. With boosts, L ascends to the top at 100ms and 200ms, gaining 10ms each time. While the share is small, the key point is that it does not starve.
</details>

## Common Misconceptions

- SJF is the best: It minimizes average turnaround time, not response time. For a 5·5·5 input, SJF's average response time was 5, while RR's was 1.  
- RR is fair, so it's always better: Turnaround time can suffer. For a 5·5·5 input, RR had an average of 14, whereas SJF had 10.  
- Smaller time slices are better: Response improves, but context-switching costs increase.  
- FCFS is faster: When arrival times vary, STCF performs better than SJF, but FCFS incurs the cost of context switching.  
- Higher priority tasks eventually run: Lower-priority tasks may starve if higher-priority ones keep arriving. That's why MLFQ includes boosting.  

What happens when memory runs out continues in [Memory Management and Virtual Memory](#/post/os-memory).

## Reference Links

- OSTEP, Scheduling: Introduction: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf  
- OSTEP, Scheduling: The Multi-Level Feedback Queue: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf  

← Concept map (#/post/cs-map)

Related posts: [Operating System Fundamentals](#/post/cs-os) · [Processes and Threads](#/post/os-process-thread) · [Synchronization and Deadlock](#/post/os-sync-deadlock)