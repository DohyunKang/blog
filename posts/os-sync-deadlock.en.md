[Overview](#/post/cs-os) briefly dismissed synchronization as "what's needed at shared points." Here, we isolate that topic to explore why values become incorrect, explain what locks and semaphores are, and examine the conditions for deadlocks along with avoidance strategies through code. The premise that threads share memory was first covered in [Processes and Threads](#/post/os-process-thread).

## Race Conditions and Critical Sections

When multiple threads read and modify the same variable, the result depends on the execution order. This is called a race condition. Although `n += 1` appears to be a single line, it actually consists of read, add, and write operations; another thread can intervene between these steps. If two threads read the same value and each increment by one before writing back, an increment is lost. Code segments that must not be interrupted are called critical sections.

To protect a critical section, only one thread should enter at a time. This is known as mutual exclusion, and the most common tool for this is a lock (mutex). Only the thread holding the lock can enter the section; others wait until the lock is released. The scheduler determines when threads switch, which programs cannot predict ([CPU Scheduling](#/post/os-scheduling)). Therefore, code that "usually works" has no guarantee.

<details>
<summary>Addition by 4 threads 2000 times each (without lock / with lock) (execution verified)</summary>

We intentionally inserted `time.sleep(0)` between read and write to create opportunities for thread switching.

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

Without a lock, the expected value of 8000 became 2074. This number varies with each execution. With a lock, the result was consistently 8000 even when given the same opportunity for interleaving.
</details>

## Semaphores

While a lock answers "can I enter or not?", a semaphore (semaphore) is a counter holding an integer. The OSTEP textbook explains it this way: there are two operations, with POSIX names `sem_wait()` and `sem_post()`. Dijkstra referred to these as P() and V().

- `sem_wait`: Decreases the value by 1; if the resulting value is negative, the thread waits.
- `sem_post`: Increases the value by 1; if threads are waiting, one is woken up.

The textbook also notes that when the value is negative, its absolute value represents the number of waiting threads. The initial value determines the usage.

| Initial Value | Usage | Example |
|---|---|---|
| 1 | As a lock (binary semaphore) | Protecting a critical section |
| 0 | Enforcing order | Parent continues execution after child finishes |
| N | Allows up to N simultaneously | N resources, N empty buffer slots |

A representative problem for an initial value of N is the producer-consumer (bounded buffer). One side inserts into a buffer with N slots while the other removes. We use `empty` (initial value N, number of empty slots), `full` (initial value 0, number of full slots), and a `mutex` to protect the buffer itself. When full, the producer waits on `empty`; when empty, the consumer waits on `full`. Asynchronous queues face similar concerns with this structure ([Asynchronous Processing and Message Queues](#/post/be-async-queue)).

OSTEP also includes an incorrect solution for this problem. Acquiring the mutex before `empty`/`full` leads to a deadlock. If the consumer holds the mutex while waiting on `full`, the producer cannot acquire the mutex and can never insert.

<details>
<summary>Producer-consumer with semaphores, and the incorrect version acquiring mutex first (execution verified)</summary>

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

Even after running four times, the output appeared in order, and the buffer length never exceeded N. The incorrect version changed `acquire` to be called inside `with mu:`.

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

Neither completed even after waiting for 1 second.
</details>

Enforcing order with an initial value of 0 is also concise. If the parent thread waits in `acquire()` until the child thread calls `release()`, the log shows `child` appearing first and `parent after` later (verified by execution).

## Deadlocks

Using locks introduces new problems. If Thread 1 holds Lock A and waits for B, while Thread 2 holds B and waits for A, neither can move. This is a deadlock. Deadlocks do not occur with a single lock; they arise when there are two or more locks that are acquired in an overlapping manner.

OSTEP summarizes the four conditions for deadlock (citing a 1971 paper). All four must hold simultaneously for a deadlock to occur; breaking any one prevents it.

| Condition | Meaning |
|---|---|
| Mutual Exclusion | A resource is exclusively held by one thread at a time (locks are acquired). |
| Hold and Wait | Holding a resource while waiting for another. |
| No Preemption | Resources cannot be forcibly taken away from the holder. |
| Circular Wait | Threads wait in a circle for resources held by each other. |

The textbook uses an example that is not immediately obvious: Java's `Vector.addAll()`. When calling `v1.addAll(v2)`, both locks on v1 and v2 are acquired internally; if another thread almost simultaneously calls `v2.addAll(v1)`, the order gets reversed, potentially leading to a deadlock. From the caller's perspective, it is not apparent that two locks are being used.

<details>
<summary>Deadlock occurs when acquiring two locks in reverse order (verified by execution)</summary>

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

Both threads were still alive after 2 seconds. Standing idle without errors is the outward appearance of a deadlock. The timing was synchronized so that each thread held one lock during `sleep(.1)`.
</details>

## How to Avoid It

OSTEP summarizes prevention strategies by breaking one of the four conditions.

- Breaking Circular Wait: Enforce a global rule on the order in which locks are acquired. If there are two locks, L1 and L2, always acquire L1 first. The textbook cites this as the most practical method. When a function takes two locks as arguments, it also introduces a technique to determine order based on the lock's address value. However, the drawback is that this is merely a convention; you must understand the entire codebase, and violating it even once will cause the issue to recur.
- Breaking Hold and Wait: Acquire all necessary locks at once (atomically). This involves placing a single global lock beforehand, but requires knowing in advance which locks are needed, thereby reducing concurrency.
- Breaking No Preemption: Attempt to acquire with `trylock`; if it fails, release the held lock and start over from the beginning. A livelock can occur where two threads continuously yield to each other; introducing a random delay before retrying is said to mitigate this.
- Breaking Mutual Exclusion: Create lock-free data structures using hardware instructions like compare-and-swap. This is not an easy task.

<details>
<summary>Unify the order within the same code and retreat using timeouts (verified by execution)</summary>

If both threads acquire locks in the same order (a then b), they complete even with the previous timing scenario.

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

The retreat method acquires the second lock with `acquire(timeout=0.5)` and gives up if it fails.

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

Thread t2 gave up and released b, allowing t1 to finish. Separate code is required for the side that gives up to retry later.
</details>

## Dining Philosophers

A famous problem proposed by Dijkstra. Five philosophers sit around a round table with one fork between each (total of 5). To eat, both the left and right forks are needed. OSTEP also introduces this as famous, though noting its low practicality. If everyone picks up the left fork first, they all hold one fork while waiting for the right, resulting in a deadlock where all four conditions are met. The textbook's solution is to reverse the order for just one philosopher (number 4) to break the circular wait; Dijkstra himself wrote that he solved it this way.

<details>
<summary>All left first vs. by number order (verified by execution)</summary>

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

In the "left first" approach, running it four times resulted in three instances where everyone ate 0 meals, and one instance where only one person ate 1 meal before stopping. The method of picking up forks starting from the smaller number resulted in everyone eating 3 meals every time. In this code, only philosopher 4 had their order reversed (picking fork 0 first); the rest behaved like the "left first" approach.
</details>

## Common Misconceptions

- Using locks ensures safety: Deadlocks can still occur due to locks. If more than one lock is used, an order must be established.
- Deadlock and livelock are the same: In a deadlock, no one can move; in a livelock, everyone keeps moving but makes no progress.
- If it cannot be reproduced, it is safe: The code above still requires precise timing to trigger the issue. Just because it doesn't usually happen does not mean the order is correct.
- Semaphores are just another name for locks: While they can be used like a lock with an initial value of 1, they are counters and are also used for ordering and limiting counts.

## Reference Links

- OSTEP, Semaphores: https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf
- OSTEP, Common Concurrency Problems: https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf

← Concept Map (#/post/cs-map)

Related posts: [Operating System Basics](#/post/cs-os) · [Transactions and Isolation Levels](#/post/db-transaction) · [Async Processing and Message Queues](#/post/be-async-queue)