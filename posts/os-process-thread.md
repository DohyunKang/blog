프로세스와 스레드의 차이는 주소 공간을 같이 쓰느냐 따로 쓰느냐 하나로 거의 정리된다. 생성 비용, 전환 비용, 통신 방법, 한쪽이 죽었을 때의 피해 범위가 전부 거기서 따라 나왔다. 운영체제 전체 그림은 [개요](#/post/cs-os)에 있으니 여기서는 이 둘만 깊게 본다.

## 프로세스가 가진 것

프로그램은 디스크에 있는 명령어 덩어리이고, OS가 그걸 메모리에 올려 실행시키면 프로세스가 된다. OSTEP은 프로세스를 "실행 중인 프로그램"이라 정의하고, 프로세스를 이해하려면 머신 상태를 봐야 한다고 한다. 머신 상태는 접근 가능한 메모리(주소 공간), 레지스터(프로그램 카운터, 스택 포인터 포함), 열어 둔 파일 같은 입출력 정보다.

OS가 프로그램을 프로세스로 만들 때 하는 일도 정해져 있다. 코드와 정적 데이터를 메모리에 올리고, 스택을 할당해서 `main()`의 인자(argc, argv)를 채우고, 입출력 설정을 한 뒤 `main()`으로 점프한다. 현대 OS는 이걸 한꺼번에 하지 않고 필요한 조각만 그때그때 올리는 방식(lazy loading)이라고 한다. 이쪽은 [메모리 관리와 가상 메모리](#/post/os-memory)로 이어진다.

OS는 프로세스마다 정보를 모아 둔 구조체(PCB, 프로세스 제어 블록)를 하나씩 들고 있다. 레지스터 값, 상태, 메모리 정보가 거기 들어간다.

## 프로세스의 상태

OSTEP은 상태를 셋으로 설명한다.

| 상태 | 뜻 |
|---|---|
| Running | CPU에서 명령어를 실행 중 |
| Ready | 실행할 수 있지만 OS가 지금은 다른 프로세스를 골랐음 |
| Blocked | 디스크 읽기 같은 I/O를 시작해서, 그 일이 끝날 때까지 실행할 수 없음 |

```
Ready --(스케줄러가 고름)--> Running --(I/O 요청)--> Blocked
Ready <--(시간이 다 됨)----- Running
Ready <--(I/O 끝남)--------- Blocked
```

Blocked가 따로 있는 이유가 쓸모 있다. I/O를 기다리는 프로세스에 CPU를 주면 낭비라서, 그 사이에 다른 프로세스를 돌릴 수 있다. 누구를 Running으로 올릴지는 [CPU 스케줄링](#/post/os-scheduling)의 주제다. 실제 OS는 이보다 상태가 더 많다(교재의 설명도 단순화한 것이다).

## 스레드가 가진 것

OSTEP에서 스레드는 "프로세스 하나 안의 또 다른 실행 지점"이다. 스레드가 여럿이면 프로그램 카운터도 여럿이다. 각 스레드는 자기 레지스터 집합을 따로 가지고, 같은 주소 공간을 공유해서 같은 데이터에 접근한다.

정리하면 이렇다.

| | 프로세스끼리 | 같은 프로세스의 스레드끼리 |
|---|---|---|
| 주소 공간(코드·힙·전역 변수) | 따로 | 공유 |
| 스택 | 따로 | 스레드마다 따로 |
| 레지스터·프로그램 카운터 | 따로 | 스레드마다 따로 |
| 열린 파일 | 따로(상속은 가능) | 공유 |
| 상태를 적어 두는 곳 | PCB | TCB(스레드 제어 블록), 프로세스당 여러 개 |

스택이 스레드마다 따로인 이유는 함수 호출 기록과 지역 변수가 거기 쌓이기 때문이다. 두 스레드가 스택을 같이 쓰면 서로의 호출 흐름이 섞인다. 그래서 스레드를 만들면 주소 공간 안에 스택이 하나씩 더 생긴다.

<details>
<summary>같은 변수를 스레드는 보고 프로세스는 못 본다 (실행 확인함)</summary>

전역 변수 `counter`를 스레드와 자식 프로세스가 각각 건드려 봤다. Windows에서 Python 3.13으로 돌렸다.

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

출력은 이랬다.

```
after thread: counter = 1
child saw 100
after process: counter = 1
spawn
```

스레드가 올린 1은 부모에서 보였고, 자식 프로세스가 100을 더한 건 자식 안에서만 보였다. 결과를 돌려받으려고 `Queue`를 써야 했다. 프로세스끼리는 이렇게 통로(파이프, 큐, 소켓, 공유 메모리 등)를 따로 만들어야 한다. [소켓과 웹소켓](#/post/net-socket)도 그런 통로 중 하나다.

출력 마지막의 `spawn`은 Python 문서가 Windows와 macOS의 기본 시작 방식이라고 적은 것과 같다. 이 방식은 부모가 새 Python 인터프리터 프로세스를 시작하고, 자식은 `run()`에 필요한 자원만 물려받는다. 문서에 따르면 `fork`는 POSIX에서만 쓰고, 자식이 부모와 사실상 똑같은 상태로 시작한다.
</details>

## 컨텍스트 스위칭에서 달라지는 점

CPU 하나가 프로세스 A를 돌리다 B로 넘어가는 과정을 OSTEP은 이렇게 설명한다. 타이머 인터럽트가 걸리면 하드웨어가 A의 사용자 레지스터를 A의 커널 스택에 저장하고 커널로 들어간다. OS가 A에서 B로 바꾸기로 하면 `switch()` 루틴이 A의 커널 레지스터를 A의 프로세스 구조체에 저장하고, B의 것을 복원하고, 커널 스택을 B의 것으로 바꾼다. 마지막에 return-from-trap이 B의 레지스터를 복원하며 B가 달린다. 교재는 레지스터 저장이 두 번(하드웨어가 하나, 소프트웨어가 하나) 일어난다는 점을 짚는다.

스레드 사이의 전환은 거의 같은 과정이지만 한 가지가 다르다. T1의 레지스터를 저장하고 T2의 레지스터를 복원하는 건 같은데, 주소 공간이 그대로라서 페이지 테이블을 바꿀 필요가 없다. OSTEP이 말하는 프로세스 전환과 스레드 전환의 가장 큰 차이가 이것이다.

주소 공간을 바꾸면 왜 비싼지는 [메모리 관리와 가상 메모리](#/post/os-memory)와 [메모리 계층과 캐시](#/post/ca-memory-hierarchy)를 보면 이해가 된다. 주소 변환 정보와 캐시에 올라가 있던 데이터가 새 프로세스에는 쓸모가 없어지기 때문이다. 다만 이 비용을 실측한 숫자는 환경마다 다르다. 교재는 lmbench라는 도구로 측정하는데, 1996년 200MHz 기계에서 컨텍스트 스위치가 약 6마이크로초였고 요즘 기계는 2~3GHz에서 1마이크로초 미만이라고 한다.

## 만드는 비용

전환만이 아니라 생성도 다르다. 스레드는 스택과 TCB 정도만 만들면 되지만, 프로세스는 주소 공간 전체를 준비해야 한다. 내 PC(Windows, Python 3.13)에서 아무 일도 안 하는 함수를 스레드로, 프로세스로 만들어 끝날 때까지 기다리는 걸 반복해 쟀다.

<details>
<summary>생성 비용 비교 (실행 확인함)</summary>

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

두 번 돌렸더니 이렇게 나왔다.

```
thread 788 us, process 596.1 ms, ratio 757x
thread 1939 us, process 258.0 ms, ratio 133x
```

실행마다 숫자가 크게 흔들렸다. 확실히 말할 수 있는 건 프로세스 쪽이 두세 자릿수 비싸게 나왔다는 것 정도다. 이 프로세스 값에는 `spawn`이 새 인터프리터를 띄우는 시간이 통째로 들어 있어서, OS의 프로세스 생성 비용만 잰 숫자가 아니다.
</details>

## UNIX의 프로세스 만들기: fork, exec, wait

UNIX는 프로세스를 만들 때 호출을 둘로 쪼갠다. OSTEP 설명으로는 `fork()`가 호출한 프로세스의 복사본(자식)을 만들고, `exec()`는 지금 프로세스의 코드와 정적 데이터를 다른 실행 파일 것으로 덮어쓴다. `exec()`는 새 프로세스를 만들지 않고 돌고 있던 프로그램을 다른 프로그램으로 바꾸며, 성공하면 돌아오지 않는다. `wait()`는 부모가 자식이 끝날 때까지 기다린다.

`fork()` 직후에는 부모와 자식이 둘 다 실행 가능해서 누가 먼저 출력하는지는 정해져 있지 않다. 교재는 `wait()`를 넣으면 출력 순서가 결정적이 된다고 설명한다.

왜 굳이 둘로 나눴을까. 셸이 `fork()`와 `exec()` 사이에 코드를 끼워 넣을 수 있기 때문이다. `wc p3.c > newfile.txt` 같은 리다이렉션은, 자식이 `exec()` 전에 표준 출력을 닫고 `newfile.txt`를 열어 두는 것으로 구현된다. 열린 파일 디스크립터는 `exec()` 뒤에도 유지되니, `wc`는 자기 출력이 파일로 가는지 모른 채 돈다. 이 동작은 [Docker와 컨테이너](#/post/cloud-docker) 같은 프로세스 격리를 이해할 때도 기본 배경이 된다.

## 스레드를 쓰는 이유와 대가

OSTEP이 드는 스레드의 이점은 병렬 실행과, I/O 때문에 멈추는 동안에도 프로그램이 다른 일을 계속할 수 있다는 점이다. 같은 데이터를 공유하니 이런 분업이 쉽다.

대가는 같은 책의 카운터 예제가 보여 준다. 공유 변수에 1을 더하는 코드는 기계어로는 읽기, 더하기, 쓰기 세 단계다. 스레드 1이 값을 읽고 더한 뒤 쓰기 직전에 전환되어 스레드 2가 같은 값을 읽고 쓰면, 스레드 1이 이어서 쓸 때 증가분 하나가 사라진다. 이런 결과가 실행 타이밍에 달린 상황을 경쟁 상태(race condition)라 하고, 막는 방법이 상호 배제다. 자세한 건 [동기화와 교착상태](#/post/os-sync-deadlock)로 넘긴다.

<details>
<summary>읽기-쓰기 사이에 전환이 끼면 증가분이 사라진다 (실행 확인함)</summary>

Python 3.13에서 그냥 `n += 1`을 돌리면 문제가 재현되지 않았다. 대신 읽기와 쓰기를 나눠 쓰고 그 사이에 `time.sleep(0)`으로 CPU를 양보하게 만들어 전환이 끼는 상황을 일부러 만들었다.

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

양보를 끼우자 80000이 되어야 할 값이 20134로 떨어졌다. 같은 코드에 락을 걸면 양보가 끼어도 80000이 나왔다. 양보 없이 80000이 나온 것은 코드가 안전해서가 아니라 전환이 그 사이에 끼지 않았기 때문이다.
</details>

반대로 프로세스는 메모리가 갈라져 있어서 이런 문제가 줄지만, 데이터를 주고받으려면 통로를 만들고 복사 비용을 내야 한다.

## 파이썬에서 보이는 한 가지

CPU를 오래 쓰는 계산을 스레드 넷으로 나눠도 빨라지지 않는 경우가 있다. Python 문서는 `multiprocessing`이 스레드 대신 하위 프로세스를 써서 전역 인터프리터 락(GIL)을 피하고, 그래서 여러 프로세서를 온전히 쓸 수 있다고 적는다.

<details>
<summary>CPU 계산을 순차·스레드·프로세스로 (실행 확인함)</summary>

같은 계산(300만 번 제곱 합)을 네 번 처리하는 시간을 쟀다. 이 PC는 논리 코어가 24개다.

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

스레드는 순차와 거의 같았고, 프로세스는 빨랐다. 프로세스 쪽 시간에는 인터프리터를 띄우는 시간이 들어 있는데도 그랬다. 계산이 더 길면 차이가 더 벌어질 것이다. I/O를 기다리는 일이면 스레드도 도움이 된다.
</details>

## 흔한 오해

- 스레드는 가벼운 프로세스일 뿐이다: 주소 공간을 공유한다는 차이가 안전성과 통신 방식을 바꾼다. 가볍다는 건 그 결과다.
- 프로세스는 스레드보다 항상 느리다: 생성·전환은 비싸지만, 격리와 코어 활용이 필요하면 프로세스가 맞는 경우가 있다(위 CPU 계산 실험).
- `fork()`는 새 프로그램을 실행한다: 복사본을 만들 뿐이고, 다른 프로그램을 돌리는 건 `exec()`다.
- 스레드를 늘리면 빨라진다: 코어 수를 넘으면 전환이 늘고, 공유 데이터에는 락이 필요해진다.
- Blocked 프로세스가 CPU를 잡고 기다린다: 기다리는 동안 CPU는 다른 프로세스에게 넘어간다.

## 근거 링크

- OSTEP, The Abstraction: The Process: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf
- OSTEP, Interlude: Process API: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf
- OSTEP, Mechanism: Limited Direct Execution: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf
- OSTEP, Concurrency: An Introduction: https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf
- Python 문서, multiprocessing: https://docs.python.org/3/library/multiprocessing.html

← 개념 지도로 (#/post/cs-map)

관련 글: [CPU 스케줄링](#/post/os-scheduling) · [동기화와 교착상태](#/post/os-sync-deadlock) · [메모리 관리와 가상 메모리](#/post/os-memory)
