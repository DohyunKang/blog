[개요](#/post/cs-os)에서는 동기화를 "같이 쓰는 지점에서 필요한 것" 정도로 짧게 넘겼다. 여기서는 그 부분만 떼어서, 왜 값이 틀어지는지, 락과 세마포어가 각각 무엇인지, 교착상태가 생기는 조건과 피하는 방법까지 코드로 돌려 보면서 정리한다. 스레드가 메모리를 공유한다는 전제는 [프로세스와 스레드](#/post/os-process-thread)에서 먼저 다뤘다.

## 경쟁 상태와 임계 구역

스레드 여럿이 같은 변수를 읽고 고쳐 쓰면 결과가 실행 순서에 따라 달라진다. 이걸 경쟁 상태(race condition)라고 한다. `n += 1`은 한 줄이지만 실제로는 읽기, 더하기, 쓰기로 나뉘고, 그 사이에 다른 스레드가 끼어들 수 있다. 두 스레드가 같은 값을 읽고 각자 1을 더해 쓰면 증가분 하나가 사라진다. 끼어들면 안 되는 코드 구간을 임계 구역(critical section)이라 부른다.

임계 구역을 지키려면 한 번에 한 스레드만 들어가게 해야 한다. 이걸 상호 배제(mutual exclusion)라 하고, 가장 흔한 도구가 락(mutex)이다. 락을 잡은 스레드만 구역에 들어가고, 나머지는 락이 풀릴 때까지 기다린다. 스레드가 언제 바뀔지는 스케줄러가 정하고 프로그램은 알 수 없다([CPU 스케줄링](#/post/os-scheduling)). 그래서 "보통은 괜찮다"는 코드는 보장이 없다.

<details>
<summary>락 없이 / 락 있이 4개 스레드가 2000번씩 더하기 (실행 확인함)</summary>

읽기와 쓰기 사이에 `time.sleep(0)`을 넣어 스레드가 바뀔 틈을 일부러 만들었다.

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

락이 없으면 8000이 나와야 할 값이 2074였다. 이 숫자는 실행마다 달라진다. 락을 쓴 쪽은 같은 틈이 있어도 8000이 나왔다.
</details>

## 세마포어

락이 "들어가도 되나, 안 되나" 둘 중 하나라면, 세마포어(semaphore)는 정수 하나를 들고 있는 카운터다. OSTEP 교재는 이렇게 설명한다. 연산은 둘이고 POSIX 이름은 `sem_wait()`와 `sem_post()`다. Dijkstra는 이 둘을 P()와 V()라고 불렀다.

- `sem_wait`: 값을 1 줄이고, 줄인 값이 음수면 기다린다.
- `sem_post`: 값을 1 늘리고, 기다리는 스레드가 있으면 하나를 깨운다.

교재는 값이 음수일 때 그 절댓값이 기다리는 스레드 수라는 점도 짚는다. 초기값이 쓰임새를 정한다.

| 초기값 | 쓰임 | 예 |
|---|---|---|
| 1 | 락 대신 (이진 세마포어) | 임계 구역 보호 |
| 0 | 순서 맞추기 | 자식이 끝난 뒤에 부모가 이어서 실행 |
| N | 동시에 N개까지만 허용 | 자원 N개, 버퍼 빈 칸 N개 |

초기값 N인 경우의 대표 문제가 생산자-소비자(bounded buffer)다. 칸이 N개인 버퍼에 한쪽은 넣고 한쪽은 꺼낸다. `empty`(초기값 N, 빈 칸 수)와 `full`(초기값 0, 찬 칸 수), 그리고 버퍼 자체를 지키는 `mutex`를 쓴다. 꽉 차면 생산자가 `empty`에서, 비면 소비자가 `full`에서 기다린다. 비동기 큐가 이 구조와 같은 고민을 한다([비동기 처리와 메시지 큐](#/post/be-async-queue)).

OSTEP에는 이 문제의 틀린 풀이도 실려 있다. mutex를 `empty`/`full`보다 먼저 잡으면 교착상태가 된다. 소비자가 mutex를 잡은 채 `full`을 기다리면, 넣어 줄 생산자는 mutex를 못 잡아서 영영 못 넣는다.

<details>
<summary>세마포어로 생산자-소비자, 그리고 mutex를 먼저 잡은 틀린 버전 (실행 확인함)</summary>

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

네 번 돌려도 순서대로 나왔고, 버퍼 길이가 N을 넘지 않았다. 틀린 버전은 `with mu:` 안에서 `acquire`를 부르게 바꾼 것이다.

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

1초를 기다려도 둘 다 끝나지 않았다.
</details>

초기값 0으로 순서를 맞추는 것도 짧다. 자식 스레드가 `release()`를 부르기 전까지 부모가 `acquire()`에서 기다리게 하면, 로그에 `child`가 먼저, `parent after`가 나중에 찍혔다(실행해서 확인함).

## 교착상태

락을 쓰면 새 문제가 생긴다. 스레드 1이 락 A를 잡고 B를 기다리는데 스레드 2는 B를 잡고 A를 기다리면 둘 다 못 움직인다. 교착상태(deadlock)다. 락이 하나일 때는 안 생기고, 락이 둘 이상이고 겹쳐 잡을 때 생긴다.

OSTEP이 정리한 교착상태의 네 가지 조건은 다음과 같다(1971년 논문을 인용한다). 넷이 동시에 성립해야 교착상태가 되고, 하나라도 깨지면 생기지 않는다.

| 조건 | 뜻 |
|---|---|
| 상호 배제 | 자원을 한 번에 한 스레드만 독점한다(락을 잡음) |
| 점유와 대기 | 이미 자원을 쥔 채로 다른 자원을 기다린다 |
| 비선점 | 쥔 자원을 남이 강제로 뺏을 수 없다 |
| 순환 대기 | 스레드들이 원형으로 서로 상대가 쥔 자원을 기다린다 |

교재는 눈에 안 띄게 생기는 예로 Java의 `Vector.addAll()`을 든다. `v1.addAll(v2)`는 안에서 v1과 v2 락을 둘 다 잡는데, 다른 스레드가 거의 동시에 `v2.addAll(v1)`을 부르면 순서가 엇갈려 교착상태가 될 수 있다. 호출하는 쪽에서는 락이 둘 쓰인다는 게 안 보인다.

<details>
<summary>락 두 개를 반대 순서로 잡으면 멈춘다 (실행 확인함)</summary>

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

2초 뒤에도 둘 다 살아 있었다. 에러도 없이 그냥 서 있는 것이 교착상태의 겉모습이다. `sleep(.1)` 동안 각자 락 하나씩을 쥐게 해서 타이밍을 맞춘 것이다.
</details>

## 피하는 방법

OSTEP은 네 조건 중 하나를 깨는 방식으로 예방책을 정리한다.

- 순환 대기 깨기: 락을 잡는 순서에 전체 규칙을 둔다. 락이 L1, L2 둘이면 항상 L1을 먼저 잡는다. 교재가 가장 실용적이라고 꼽는 방법이다. 함수가 락 두 개를 인자로 받을 때는 락의 주소 값을 기준으로 순서를 정하는 요령도 소개한다. 단점은 순서가 관례일 뿐이라는 점이다. 코드베이스 전체를 알아야 하고, 한 군데만 어겨도 다시 걸린다.
- 점유와 대기 깨기: 필요한 락을 한꺼번에(원자적으로) 잡는다. 앞에 전역 락 하나를 두는 식인데, 어떤 락이 필요한지 미리 알아야 하고 동시성이 줄어든다.
- 비선점 깨기: `trylock`으로 잡아 보고 실패하면 쥐고 있던 락을 놓고 처음부터 다시 한다. 두 스레드가 계속 서로 양보만 하는 활락(livelock)이 생길 수 있고, 재시도 전에 무작위 지연을 두면 줄어든다고 한다.
- 상호 배제 깨기: compare-and-swap 같은 하드웨어 명령으로 락 없는 자료구조를 만든다. 쉬운 일은 아니다.

<details>
<summary>같은 코드에서 순서만 통일하기, 그리고 타임아웃으로 물러나기 (실행 확인함)</summary>

두 스레드가 같은 순서(a 다음 b)로 잡게 하면 위와 같은 타이밍에서도 끝난다.

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

물러나기 방식은 두 번째 락을 `acquire(timeout=0.5)`로 잡고 실패하면 포기한다.

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

t2가 포기하면서 b를 놓았고, 그 덕에 t1이 끝났다. 포기한 쪽이 다시 시도하는 코드는 따로 써야 한다.
</details>

## 식사하는 철학자

Dijkstra가 낸 유명한 문제다. 철학자 5명이 원탁에 앉아 있고 사이사이에 포크가 하나씩 있다(총 5개). 먹으려면 왼쪽과 오른쪽 포크가 둘 다 필요하다. OSTEP도 실용성은 낮지만 유명하다고 소개한다. 모두 왼쪽 포크부터 집으면, 전원이 포크 하나씩 쥔 채 오른쪽을 기다리며 멈춘다. 네 조건이 전부 갖춰진 교착상태다. 교재의 해법은 철학자 한 명(4번)만 집는 순서를 반대로 바꿔서 순환 대기를 끊는 것이고, Dijkstra 본인도 이렇게 풀었다고 쓴다.

<details>
<summary>전원 왼쪽 먼저 vs 번호 순서 (실행 확인함)</summary>

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

왼쪽 먼저 방식은 4번 돌려서 3번은 전원 0끼니, 한 번은 한 명만 1끼니를 먹고 멈췄다. 번호가 작은 포크부터 집는 방식은 매번 모두 3끼니를 먹었다. 이 코드에서 순서가 뒤집히는 사람은 철학자 4뿐이고(포크 0을 먼저), 나머지는 왼쪽 먼저와 같다.
</details>

## 흔한 오해

- 락만 쓰면 안전하다: 락 때문에 교착상태가 생긴다. 락이 둘 이상이면 순서를 정해야 한다.
- 교착상태와 활락은 같다: 교착상태는 아무도 못 움직이는 것이고, 활락은 계속 움직이는데 진전이 없는 것이다.
- 재현이 안 되면 안전하다: 위 코드에서도 타이밍을 맞춰 줘야 걸렸다. 평소에 안 걸린다고 순서가 맞는 코드는 아니다.
- 세마포어는 락의 다른 이름이다: 초기값 1이면 락처럼 쓰이지만, 카운터라서 순서 맞추기나 개수 제한에도 쓴다.

## 근거 링크

- OSTEP, 세마포어(Semaphores): https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf
- OSTEP, 흔한 동시성 문제(Common Concurrency Problems): https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf

← 개념 지도로 (#/post/cs-map)

관련 글: [운영체제 기초](#/post/cs-os) · [트랜잭션과 격리 수준](#/post/db-transaction) · [비동기 처리와 메시지 큐](#/post/be-async-queue)
