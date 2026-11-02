스케줄링은 실행 준비가 된 프로세스가 여러 개일 때 CPU를 누구에게 얼마나 줄지 정하는 일이다. 개요 글([운영체제 기초](#/post/cs-os))에서는 FIFO, SJF, Round Robin을 한 줄씩만 훑었고, 여기서는 알고리즘마다 어떤 지표를 좋게 하려고 만든 건지, 그리고 지표끼리 왜 부딪히는지를 숫자로 따라간다.

## 먼저 지표 두 개

스케줄링을 비교하려면 잣대가 있어야 한다. OSTEP(교재)은 두 가지를 쓴다.

- 반환 시간(turnaround): 작업이 도착해서 끝날 때까지. 완료 시각 − 도착 시각이다.
- 반응 시간(response): 작업이 도착해서 처음 CPU를 받을 때까지. 처음 실행 시각 − 도착 시각이다.

배치 시스템이면 반환 시간이 중요하고, 터미널 앞에 사람이 앉아 있으면 반응 시간이 중요하다. 교재는 시분할 컴퓨터가 나오면서 반응 시간이라는 지표가 생겼다고 설명한다. 이 둘이 한 알고리즘에서 같이 좋아지기 어렵다는 게 이 글의 줄거리다.

선점(preemptive)이라는 말도 먼저 정리해 둔다. 비선점 스케줄러는 한 작업을 끝까지 돌리고 다음으로 넘어간다. 선점 스케줄러는 실행 중인 작업을 멈추고 다른 작업으로 바꿀 수 있고, 그러려면 컨텍스트 스위칭이 필요하다. 교재는 요즘 스케줄러는 사실상 전부 선점형이라고 적는다. 컨텍스트 스위칭 자체는 [프로세스와 스레드](#/post/os-process-thread)에서 다룬다.

## FCFS(FIFO)와 호송 효과

도착한 순서대로 처리한다. 구현이 가장 쉽다. 작업 A(100초), B(10초), C(10초)가 이 순서로 동시에 도착했다고 하자.

- 완료 시각: A 100, B 110, C 120
- 평균 반환 시간: (100+110+120)/3 = 110

짧은 B와 C가 긴 A 뒤에서 기다린다. 교재는 이 현상을 호송 효과(convoy effect)라 부른다.

## SJF와 STCF

가장 짧은 작업부터 돌리면 어떨까. 같은 입력에서 B, C, A 순으로 돌리면 완료 시각이 10, 20, 120이 되고 평균 반환 시간은 50이다. 110에서 50으로 줄었다. 모든 작업이 동시에 도착한다는 가정 아래에서는 SJF가 최적이라고 교재는 적는다.

그런데 가정 하나를 풀면 무너진다. A가 0초에, B와 C가 10초에 도착하면, 비선점 SJF는 이미 돌고 있는 A를 끝까지 기다린다. 평균 반환 시간은 다시 103.33이다. 해결책이 STCF(Shortest Time-to-Completion First, 선점형 SJF)다. 새 작업이 들어올 때마다 남은 시간이 가장 짧은 작업을 고른다. B와 C가 오면 A를 멈추고 그것들을 먼저 돌려서 평균 반환 시간이 50으로 돌아온다.

SJF 계열에는 현실적인 약점이 있다. 작업이 얼마나 오래 걸릴지 미리 알아야 한다. 운영체제는 보통 그걸 모른다. 그래서 나온 게 아래의 MLFQ다.

## Round Robin과 반응 시간

SJF 계열은 반응 시간이 나쁘다. A, B, C가 각각 5초이고 동시에 도착하면 SJF의 반응 시간은 0, 5, 10이라 평균 5다. Round Robin은 작업을 시간 조각(quantum)만큼만 돌리고 다음 작업으로 넘어간다. 조각이 1초면 처음 실행 시각이 0, 1, 2라서 평균 반응 시간이 1이다.

대가는 반환 시간이다. 같은 입력에서 RR은 A가 13, B가 14, C가 15에 끝나 평균 14이고, SJF는 5, 10, 15로 평균 10이다. 교재는 RR을 반환 시간 기준으로 거의 최악에 가까운 정책이라고 부른다. 작업을 최대한 길게 늘여 놓는 방식이기 때문이다. 더 일반적으로, 짧은 시간 단위에서 CPU를 공평하게 나누는 정책은 반환 시간이 나쁘다. 공평함과 반환 시간은 맞바꾸는 관계다.

조각 길이는 또 다른 맞바꿈이다. 너무 짧으면 컨텍스트 스위칭 비용이 지배한다. 교재 예시로 조각이 10ms이고 전환에 1ms가 들면 시간의 약 10%를 전환에 쓰고, 조각을 100ms로 늘리면 1% 아래로 내려간다. 스위칭은 레지스터만 바꾸는 게 아니라 CPU 캐시와 TLB에 쌓인 상태도 버리게 만들기 때문에 비용이 더 크다는 설명도 있다.

<details>
<summary>지표를 직접 계산해 보기 (실행 확인함)</summary>

1초 단위로 시뮬레이션하는 코드로 위 숫자를 다시 만들었다. 정책마다 "다음에 누구를 돌릴지"만 바뀐다.

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

| 입력 | 정책 | 평균 반환 | 평균 반응 |
|---|---|---|---|
| A100·B10·C10 동시 도착 | FCFS | 110 | 70 |
| 같은 입력 | SJF | 50 | 10 |
| A는 0, B·C는 10에 도착 | SJF(비선점) | 103.33 | 63.33 |
| 같은 입력 | STCF | 50 | 3.33 |
| 5·5·5 동시 도착 | SJF | 10 | 5 |
| 같은 입력 | RR(조각 1) | 14 | 1 |
</details>

<details>
<summary>RR 조각 길이를 바꾸면 (실행 확인함)</summary>

위 코드의 `rr(J1, q)`에 조각 길이를 바꿔 넣어 A100·B10·C10 입력을 돌렸다.

| 조각 | 평균 반환 | 평균 반응 |
|---|---|---|
| 1 | 59.67 | 1.00 |
| 5 | 58.33 | 5.00 |
| 10 | 56.67 | 10.00 |
| 50 | 83.33 | 36.67 |
| 100 | 110.00 | 70.00 |

조각이 가장 긴 100이면 모든 작업이 한 번에 끝나니 FCFS와 똑같은 숫자가 나온다. 조각을 줄일수록 반응은 좋아진다. 이 시뮬레이션에는 전환 비용이 없어서 반환 시간이 계속 좋아 보이지만, 실제로는 위에서 말한 전환 비용이 반대편에서 당긴다.
</details>

## 우선순위 스케줄링

작업마다 우선순위를 두고 높은 것부터 돌린다. SJF는 "짧을수록 우선순위가 높다"고 정한 우선순위 스케줄링의 한 종류로 볼 수 있다. 비선점이면 돌던 작업이 끝나야 바뀌고, 선점이면 더 높은 작업이 들어오는 순간 CPU를 가져간다.

P1(24), P2(3), P3(3)이 동시에 도착하고 우선순위가 P2 > P3 > P1이라고 하자. 비선점으로 돌리면 완료 시각이 P2 3, P3 6, P1 30이고 평균 반환 시간은 13이다. 같은 입력을 FCFS(P1, P2, P3 순)로 돌리면 24, 27, 30이라 평균 27이다.

약점은 높은 우선순위 작업이 계속 들어오면 낮은 작업이 영영 CPU를 못 받는 기아(starvation)다. 다음 절의 MLFQ가 이 문제를 정면으로 다룬다.

## MLFQ: 미리 모르는 채로 SJF에 가까이

MLFQ(Multi-Level Feedback Queue)는 우선순위가 다른 큐 여러 개를 두고, 작업이 어떻게 행동하는지 관찰해서 우선순위를 바꾼다. 교재는 이 알고리즘이 풀려는 문제를 이렇게 적는다. 작업 길이를 모르는데, 짧은 작업에게는 빠른 반응을 주고 긴 작업은 불필요하게 막지 않으면서 반환 시간을 줄이고 싶다.

기본 규칙은 이렇다.

- 규칙 1: 우선순위가 높은 작업이 돈다.
- 규칙 2: 우선순위가 같으면 Round Robin.
- 규칙 3: 새 작업은 가장 높은 큐에서 시작한다.
- 규칙 4: 한 레벨에서 할당량(allotment)을 다 쓰면 한 칸 내려간다.
- 규칙 5: 일정 시간 S마다 모든 작업을 가장 높은 큐로 올린다(priority boost).

처음엔 모든 작업을 짧은 작업일 거라고 가정해 맨 위에 둔다. 진짜 짧으면 거기서 끝나고, 길면 조금씩 내려가 낮은 큐에 자리 잡는다. 작업 길이를 몰라도 행동으로 SJF를 근사하는 방식이다. 대화형 작업은 I/O가 잦아서 위에 머무르고, CPU만 쓰는 긴 작업은 아래로 내려간다.

규칙 4를 "할당량을 쓰기 전에 I/O로 CPU를 내놓으면 그 레벨에 남는다"로 두면 두 가지 문제가 생긴다고 교재는 짚는다. 하나는 기아다. 대화형 작업이 계속 들어오면 아래 큐의 긴 작업은 CPU를 못 받는다. 다른 하나는 스케줄러 속이기다. 할당량이 거의 끝날 때 짧은 I/O를 일부러 호출하면 계속 최상위에 남는다. 규칙 5(주기적 boost)가 기아를 막고, 레벨별로 쓴 총 시간을 기준으로 강등하는 규칙 4가 속이기를 막는다. 교재는 S가 너무 크면 긴 작업이 굶고 너무 작으면 대화형 작업이 제 몫을 못 받는다고 적는다. 그래서 이런 값들은 저절로 정해지지 않는 조절 손잡이다.

구현은 시스템마다 다르다. 교재에 따르면 Solaris의 시분할 클래스는 기본 60개 큐, 20ms에서 수백 ms로 늘어나는 시간 조각, 약 1초마다 boost를 쓰는 표 방식이다. FreeBSD 4.3 스케줄러는 표 대신 CPU 사용량을 시간이 지나면서 줄여 가는 수식으로 우선순위를 계산한다.

<details>
<summary>MLFQ 기아와 boost 직접 확인 (실행 확인함)</summary>

큐 3개, 할당량 10ms로 단순화한 시뮬레이터다. 긴 작업 L은 0ms에 도착하고, 10ms짜리 짧은 작업이 20ms부터 10ms마다 하나씩 계속 도착한다(CPU가 계속 꽉 찬다).

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

300ms 동안 L이 받은 CPU는 boost가 없으면 20ms, 100ms마다 boost하면 40ms였다. 20ms는 짧은 작업이 오기 전에 혼자 돌던 시간이고, 그 뒤로는 새 작업이 끊이지 않아 한 번도 못 돌았다. boost를 넣으면 100ms, 200ms 지점에서 L이 최상위로 올라와 10ms씩 얻는다. 아주 작은 몫이지만 굶지는 않는다는 게 요점이다.
</details>

## 흔한 오해

- SJF가 제일 좋다: 평균 반환 시간이 제일 좋은 것이지 반응 시간이 좋은 건 아니다. 5·5·5 입력에서 SJF의 평균 반응은 5, RR은 1이었다.
- RR이 공평하니까 항상 낫다: 반환 시간은 나빠질 수 있다. 5·5·5 입력에서 RR은 평균 14, SJF는 10이었다.
- 시간 조각은 짧을수록 좋다: 반응은 좋아지지만 전환 비용이 올라간다.
- 선점이면 더 빠르다: 도착 시각이 제각각일 때 STCF가 SJF보다 나았던 건 맞지만, 선점은 컨텍스트 스위칭이라는 비용을 낸다.
- 우선순위가 높으면 언젠가는 돈다: 낮은 쪽은 높은 작업이 계속 오면 못 돈다. 그래서 MLFQ에 boost가 있다.

메모리가 모자랄 때 벌어지는 일은 [메모리 관리와 가상 메모리](#/post/os-memory)에서 이어진다.

## 근거 링크

- OSTEP, Scheduling: Introduction: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched.pdf
- OSTEP, Scheduling: The Multi-Level Feedback Queue: https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf

← 개념 map으로 (#/post/cs-map)

관련 글: [운영체제 기초](#/post/cs-os) · [프로세스와 스레드](#/post/os-process-thread) · [동기화와 교착상태](#/post/os-sync-deadlock)
