재귀는 함수가 자기 자신을 불러서 문제를 더 작은 같은 문제로 줄이는 방식이고, 백트래킹은 그 재귀로 선택지를 하나씩 해 보다가 안 되면 한 칸 되돌아오는 탐색이다.

## 재귀가 뭔지

재귀 함수는 자기 안에서 자기를 다시 호출한다. 이게 끝나려면 두 가지가 있어야 한다.

- 종료 조건(base case): 더 쪼갤 필요 없이 바로 답이 나오는 경우.
- 점화식 같은 규칙(recursive case): 큰 문제를 한 단계 작은 같은 문제로 바꾸는 규칙.

팩토리얼이 제일 흔한 예다. `5! = 5 × 4!`이고 `1! = 1`이다. 종료 조건이 없거나, 호출할 때마다 문제가 작아지지 않으면 끝나지 않는다.

```python
def fact(n):
    if n <= 1:          # 종료 조건
        return 1
    return n * fact(n - 1)   # 한 단계 작은 같은 문제

print(fact(5))  # 120
```

## 호출 스택으로 보기

`fact(3)`을 부르면 `fact(2)`를 부르고, 그게 `fact(1)`을 부른다. 가장 안쪽이 값을 돌려주면 바깥쪽이 그 값을 받아 곱하고 돌려준다. 호출은 쌓이고(스택), 돌아올 때 하나씩 풀린다.

```
fact(3)
 └ fact(2)
    └ fact(1) → 1
    ← 2 * 1 = 2
 ← 3 * 2 = 6
```

그래서 재귀는 "들어갈 때 하는 일"과 "나올 때 하는 일"이 따로 있다. 백트래킹에서 되돌리는 동작이 바로 나올 때 하는 일이다.

## 재귀로 생각하는 순서

문제를 보고 이 순서로 물어봤다.

1. 이 함수가 무엇을 해 주는지 한 문장으로 정한다. (예: `dfs(i)` = i번째 선택부터 끝까지 다 해 보는 함수)
2. 가장 작은 경우의 답은 뭔가. 그게 종료 조건이다.
3. 한 단계 줄이면 같은 함수로 풀 수 있나. 그게 재귀 호출이다.
4. 호출을 믿는다. 안쪽 호출이 알아서 맞게 해 준다고 가정하고 내 단계만 쓴다.

4번이 제일 어렵다. 안쪽을 머릿속으로 끝까지 따라가면 막히니, 함수가 하는 일을 정의해 놓고 그 정의를 믿는 쪽이 편했다.

## 쓰기 전에 알아 둘 것: 중복 호출과 깊이

피보나치를 `fib(n) = fib(n-1) + fib(n-2)`로 그대로 쓰면 같은 값을 여러 번 다시 계산한다. 호출이 대략 두 갈래로 계속 갈라져서 n이 커지면 감당이 안 된다. 한 번 구한 값을 저장(메모이제이션)하면 각 값을 한 번만 계산한다. 이쪽은 [자세히 → 동적 계획법](#/post/algo-dp)에서 이어진다.

```python
def fib(n, memo={}):
    if n < 2:
        return n
    if n not in memo:
        memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

print(fib(50))  # 12586269025
```

깊이 제한도 있다. 파이썬은 재귀 깊이에 상한이 있어서(내 환경에서 `sys.getrecursionlimit()`은 1000이었다) 넘으면 `RecursionError`가 난다. 파이썬 문서는 이 제한이 무한 재귀로 C 스택이 넘쳐 인터프리터가 죽는 걸 막는 장치라고 하고, `setrecursionlimit`으로 올릴 수는 있지만 너무 높이면 크래시가 날 수 있다고 경고한다. 코딩 테스트에서 깊이가 수만 이상이면 반복문이나 명시적 스택으로 바꾸는 쪽이 안전하다.

## 백트래킹이 뭔지

백트래킹은 선택지를 하나 고르고, 그 뒤를 재귀로 끝까지 해 본 다음, 선택을 취소하고 다음 선택지를 해 보는 방식이다. 틀이 거의 같다.

```
def dfs(상태):
    if 끝났다:          # 답 하나 완성
        기록; return
    for 선택지 in 후보들:
        if 못 고르는 선택지: continue   # 가지치기
        선택하기
        dfs(다음 상태)
        선택 되돌리기      # 이게 백트래킹
```

모든 경우를 빠짐없이 보되, 가능성이 없다고 판단되는 가지는 일찍 잘라서(가지치기) 줄이는 것이 핵심이다. 완전탐색과 다른 점은 이 가지치기다. 선택 → 재귀 → 되돌리기 세 줄이 반복되는 모양이라 한 번 익숙해지면 문제만 바꿔 끼운다.

## 대표 문제

번호·이름만 적고 본문은 옮기지 않는다. 전부 프로그래머스 문제다.

- [피로도](https://school.programmers.co.kr/learn/courses/30/lessons/87946): 던전을 방문하는 순서를 모두 따져 가장 많이 탐험하는 경우를 찾는다. 순열 백트래킹이다.
- [모음사전](https://school.programmers.co.kr/learn/courses/30/lessons/84512): 모음 A, E, I, O, U로 만든 길이 5 이하 단어를 사전순으로 나열할 때 주어진 단어가 몇 번째인지 구한다. 사전순으로 하나씩 만들어 가는 재귀다.
- [메뉴 리뉴얼](https://school.programmers.co.kr/learn/courses/30/lessons/72411): 주문 목록에서 메뉴 조합을 뽑아 가장 많이 함께 주문된 조합을 찾는다. 조합 나열에 해시를 붙인다.
- [N-Queen](https://school.programmers.co.kr/learn/courses/30/lessons/12952): N×N 판에 퀸 N개를 서로 공격하지 않게 놓는 경우의 수.
- [타겟 넘버](https://school.programmers.co.kr/learn/courses/30/lessons/43165): 각 숫자에 +/- 부호를 붙여 합이 목표값이 되는 경우의 수. 숫자마다 둘로 갈라지는 재귀라서 아래 "넣거나 안 넣거나" 틀과 같다.

## 코드

### 순열: 순서가 의미 있고 중복 없이

```python
def permutations_of(n, m):
    res, path, used = [], [], [False] * (n + 1)
    def dfs():
        if len(path) == m:
            res.append(tuple(path)); return
        for i in range(1, n + 1):
            if used[i]: continue
            used[i] = True; path.append(i)
            dfs()
            path.pop(); used[i] = False   # 되돌리기
    dfs()
    return res
```

### 조합: 앞으로만 가서 중복을 막는다

```python
def combinations_of(n, m):
    res, path = [], []
    def dfs(start):
        if len(path) == m:
            res.append(tuple(path)); return
        for i in range(start, n + 1):
            path.append(i)
            dfs(i + 1)       # 다음은 i 뒤에서만 고른다
            path.pop()
    dfs(1)
    return res
```

실행해서 `itertools.permutations(range(1,5), 2)`와 `itertools.combinations(range(1,6), 3)`의 결과와 같은 순서로 같은 값이 나오는 것을 확인했다(각각 12개, 10개).

### 넣거나 안 넣거나(부분수열의 합, 타겟 넘버)

```python
def count_subsets(a, target):
    cnt = 0
    def dfs(i, s):
        nonlocal cnt
        if i == len(a):
            if s == target: cnt += 1
            return
        dfs(i + 1, s + a[i])   # a[i]를 넣는다
        dfs(i + 1, s)          # 안 넣는다
    dfs(0, 0)
    return cnt
```

타겟 넘버는 "안 넣는다" 자리를 "뺀다(`s - a[i]`)"로 바꾼 같은 틀이다. 프로그래머스 입출력 예 `[1, 1, 1, 1, 1], 3 → 5`와 `[4, 1, 2, 1], 4 → 2`를 돌려 같은 값이 나오는 걸 확인했다.

```python
def target_number(a, target):
    cnt = 0
    def dfs(i, s):
        nonlocal cnt
        if i == len(a):
            if s == target: cnt += 1
            return
        dfs(i + 1, s + a[i])   # 더한다
        dfs(i + 1, s - a[i])   # 뺀다
    dfs(0, 0)
    return cnt
```

피로도는 순열 틀에 "지금 피로도로 들어갈 수 있나"만 가지치기로 붙인 것이다. 입출력 예 `k=80, [[80,20],[50,40],[30,10]] → 3`이 나오는 걸 확인했다.

```python
def max_dungeons(k, dungeons):
    best, used = 0, [False] * len(dungeons)
    def dfs(k, cnt):
        nonlocal best
        best = max(best, cnt)
        for i, (need, cost) in enumerate(dungeons):
            if used[i] or k < need: continue   # 못 들어가면 가지치기
            used[i] = True
            dfs(k - cost, cnt + 1)
            used[i] = False                    # 되돌리기
    dfs(k, 0)
    return best
```

### N-Queens: 행마다 하나씩, 열·대각선 검사

```python
def n_queens(n):
    cols, d1, d2 = set(), set(), set()
    cnt = 0
    def dfs(r):
        nonlocal cnt
        if r == n:
            cnt += 1; return
        for c in range(n):
            if c in cols or (r - c) in d1 or (r + c) in d2:
                continue            # 가지치기
            cols.add(c); d1.add(r - c); d2.add(r + c)
            dfs(r + 1)
            cols.remove(c); d1.remove(r - c); d2.remove(r + c)
    dfs(0)
    return cnt
```

n=1~9에 대해 돌려 보니 1, 0, 0, 2, 10, 4, 40, 92, 352가 나왔다. n=8이 92인 것은 위키피디아의 8퀸 문서에 적힌 값(서로 다른 해 92개)과 같다.

<details>
<summary>자세한 풀이: N-Queens 검사를 왜 이렇게 하나</summary>

퀸은 같은 행·열·대각선을 공격한다. 행을 한 줄씩 내려가며 하나만 놓으면 행 충돌은 처음부터 없다. 남은 건 열과 두 방향 대각선이다.

- 열: `c`가 같으면 충돌.
- `↘` 대각선: 같은 대각선 위의 칸은 `r - c`가 같다.
- `↙` 대각선: 같은 대각선 위의 칸은 `r + c`가 같다.

이 세 값을 집합에 넣어 두면 충돌 검사가 한 번에 된다. 배열 전체를 훑어 비교하는 방식보다 훨씬 빠르다. 되돌릴 때는 넣은 값을 똑같이 빼야 한다. 빼는 걸 하나라도 빠뜨리면 다음 가지 탐색이 조용히 틀린다.

</details>

## 시간·공간 복잡도

| 문제 | 시간 | 공간(호출 깊이 + 보조) |
|---|---|---|
| 팩토리얼 | O(n) | O(n) |
| 피보나치(메모 없음) | 지수 | O(n) |
| 피보나치(메모) | O(n) | O(n) |
| 순열 nPm 나열 | O(nPm × m) 안팎 | O(n) |
| 조합 nCm 나열 | O(nCm × m) 안팎 | O(m) |
| 부분수열 합 | O(2ⁿ) | O(n) |
| N-Queens | 최악 O(n!)에 가깝지만 가지치기로 훨씬 적게 본다 | O(n) |

결과를 다 나열해야 하는 문제는 결과 개수만큼은 반드시 걸린다. 백트래킹은 입력이 작을 때(N이 10~20 안팎) 쓰는 풀이라고 보면 된다. N이 크면 다른 접근이 필요하다. 가지치기가 얼마나 줄이는지는 문제마다 달라서 위 N-Queens의 "훨씬 적게"는 일반 공식이 아니라 방향만 말한 것이다.

## 흔한 실수

- 되돌리기를 빠뜨린다. `path.pop()`이나 `used[i] = False` 한 줄이 없으면 다음 가지가 오염된다.
- 결과 리스트에 `path` 자체를 넣는다. 나중에 바뀌니까 `tuple(path)`나 `path[:]`로 복사해서 넣어야 한다.
- 종료 조건이 늦다. 이미 불가능한데 끝까지 내려가면 시간 초과가 난다. 가능한 한 일찍 자른다.
- 기본 인자로 넣은 빈 딕셔너리(`memo={}`)는 호출 사이에 공유된다. 위 피보나치에서는 일부러 그렇게 썼지만, 다른 곳에서는 의도치 않은 버그가 되기 쉽다.

## 비슷한 유형

- 모든 경우를 그래프 위에서 다닐 때: [자세히 → 그래프 탐색(BFS·DFS)](#/post/algo-graph-search)
- 같은 부분 문제가 겹칠 때: [자세히 → 동적 계획법](#/post/algo-dp)
- 시간 복잡도를 어림잡는 법: [자세히 → 시간·공간 복잡도](#/post/algo-complexity)
- 호출 스택 구조가 궁금하면 [자세히 → 스택·큐](#/post/algo-stack-queue)

← [개념 지도로](#/post/algo-map)

관련 글: [그래프 탐색](#/post/algo-graph-search) · [동적 계획법](#/post/algo-dp) · [그리디](#/post/algo-greedy)

## 근거 링크

- Python 문서, sys.setrecursionlimit: https://docs.python.org/3/library/sys.html#sys.setrecursionlimit
- Wikipedia, Eight queens puzzle: https://en.wikipedia.org/wiki/Eight_queens_puzzle
- 사용한 문제(프로그래머스): 피로도 https://school.programmers.co.kr/learn/courses/30/lessons/87946 · 모음사전 https://school.programmers.co.kr/learn/courses/30/lessons/84512 · 메뉴 리뉴얼 https://school.programmers.co.kr/learn/courses/30/lessons/72411 · N-Queen https://school.programmers.co.kr/learn/courses/30/lessons/12952 · 타겟 넘버 https://school.programmers.co.kr/learn/courses/30/lessons/43165
