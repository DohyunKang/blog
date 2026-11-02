# 투 포인터·슬라이딩 윈도우·누적합

배열에서 "연속된 구간"을 묻는 문제는 많다. 합이 M인 구간이 몇 개인지, 길이 K짜리 구간 중 합이 제일 큰 건 뭔지 같은 것들이다. 가장 먼저 떠오르는 건 시작점과 끝점을 이중 for문으로 다 돌아보는 방법인데, 이러면 O(N²)이다. N이 10만만 돼도 100억 번이라 시간 초과가 난다. 이 글의 세 가지는 전부 "이미 계산한 걸 버리지 않고 재사용한다"는 한 가지 생각으로 O(N)에 줄이는 방법이다.

복잡도 표기가 낯설면 [자세히 → 시간복잡도와 파이썬 기본](#/post/algo-complexity)부터 보면 된다.

## 세 가지 유형

| 유형 | 핵심 | 언제 쓰나 |
|---|---|---|
| 투 포인터 | 두 인덱스를 조건에 따라 한 방향으로만 움직인다 | 정렬된 배열에서 합 찾기, 합이 조건을 만족하는 구간 |
| 슬라이딩 윈도우 | 길이가 고정(또는 조건에 따라 늘고 주는) 창을 한 칸씩 민다 | 길이 K 구간의 합·최댓값, 중복 없는 가장 긴 부분 문자열 |
| 누적합 | 앞에서부터의 합을 미리 저장해 두고 뺄셈으로 구간 합을 구한다 | 구간 합 질의가 여러 번 나올 때 |

투 포인터와 슬라이딩 윈도우는 경계가 흐리다. 구간의 양 끝을 둘 다 오른쪽으로만 민다는 점에서 같은 계열이고, 보통 "양쪽 끝에서 좁혀 오는 것"을 투 포인터, "구간 하나를 밀고 가는 것"을 슬라이딩 윈도우라고 부른다.

## 1. 투 포인터: 양끝에서 좁히기

대표 문제는 프로그래머스 「구명보트」다. 보트 한 대에 최대 2명이 타고 무게 제한이 있을 때, 모두 구하는 데 필요한 보트의 최소 수를 구한다. 기본 틀은 "합이 target인 쌍 찾기"와 같다. 정렬해 두고 왼쪽 끝(l)과 오른쪽 끝(r)에 포인터를 둔다. 먼저 틀을 합이 target인 쌍 찾기로 보자.

- 합이 X보다 작으면 l을 오른쪽으로 민다(더 큰 수가 필요하니까).
- 합이 X보다 크면 r을 왼쪽으로 민다.
- 같으면 찾은 것.

정렬돼 있기 때문에 한 번 버린 후보는 다시 볼 필요가 없다는 게 핵심이다. 이 성질이 깨지는 문제(정렬이 안 되거나 음수가 섞여 합이 단조롭지 않은 구간 문제)에는 쓰면 안 된다.

```python
def two_sum_sorted(a, target):
    l, r = 0, len(a) - 1
    while l < r:
        s = a[l] + a[r]
        if s == target:
            return (l, r)
        if s < target:
            l += 1
        else:
            r -= 1
    return None

print(two_sum_sorted([1, 2, 3, 4, 5, 6], 9))  # (2, 5)
```

구명보트는 같은 틀에서 조건만 바뀐다. 정렬한 뒤 가장 가벼운 사람(l)과 가장 무거운 사람(r)을 본다. 둘의 합이 제한 이하면 같이 태우고(l을 민다), 아니면 무거운 사람은 누구와도 못 타니 혼자 태운다. 어느 쪽이든 가장 무거운 사람(r)은 이번 보트에 타고 빠진다.

```python
def boats(people, limit):
    a = sorted(people)
    l, r, cnt = 0, len(a) - 1, 0
    while l <= r:
        if a[l] + a[r] <= limit:
            l += 1               # 가장 가벼운 사람도 같이 탄다
        r -= 1                   # 가장 무거운 사람은 이번 보트에 탄다
        cnt += 1
    return cnt

print(boats([70, 50, 80, 50], 100))  # 3
print(boats([70, 80, 50], 100))      # 3
```

시간은 정렬 O(N log N) + 탐색 O(N), 공간은 O(1)이다. 이미 정렬된 입력이면 탐색만 O(N)이다(구명보트는 정렬되어 있지 않아서 정렬이 필요하다).

## 2. 투 포인터: 구간을 늘였다 줄였다

대표 문제는 프로그래머스 「연속된 부분 수열의 합」(비내림차순으로 정렬된 수열에서 합이 k인 연속 구간 중 가장 짧은 것)이다. 아래 코드는 같은 틀로 "합이 M인 연속 구간의 개수"를 세고, 이어서 이 문제의 풀이를 붙였다. 수열의 값이 모두 1 이상이라는 조건이 중요하다. 양수면 구간을 늘릴수록 합이 커지고 줄일수록 작아져서, 포인터를 되돌릴 일이 없다.

풀이 생각 순서는 이렇다.

1. 구간 [l, r]의 합을 변수 하나(s)로 들고 있는다.
2. r을 한 칸 늘리면서 a[r]을 더한다.
3. 합이 M보다 커졌으면 l을 밀면서 a[l]을 뺀다. 합이 M 이하가 될 때까지.
4. 합이 M과 같으면 개수를 센다.

```python
def count_sub(a, m):
    l = s = cnt = 0
    for r in range(len(a)):
        s += a[r]
        while s > m and l <= r:
            s -= a[l]
            l += 1
        if s == m:
            cnt += 1
    return cnt

print(count_sub([1, 2, 3, 2, 5, 1, 1, 1, 2], 5))  # 4
```

연속된 부분 수열의 합은 개수가 아니라 "합이 k인 가장 짧은 구간"의 시작·끝 인덱스를 구한다. 같은 방식으로 합이 k인 구간을 만날 때마다 가장 짧은 것을 갱신한다.

```python
def shortest_k(seq, k):
    l = s = 0
    best = None
    for r, x in enumerate(seq):
        s += x
        while s > k:
            s -= seq[l]
            l += 1
        if s == k and (best is None or r - l < best[1] - best[0]):
            best = (l, r)
    return list(best)

print(shortest_k([1, 2, 3, 4, 5], 7))           # [2, 3]
print(shortest_k([1, 1, 1, 2, 3, 4, 5], 5))     # [6, 6]
print(shortest_k([2, 2, 2, 2, 2], 6))           # [0, 2]
```

l과 r은 각각 최대 N번만 움직이므로 전체 O(N)이다. for문 안에 while이 있어서 O(N²)처럼 보이지만, l은 한 번도 뒤로 가지 않는다. 안쪽 while의 총 실행 횟수가 N을 넘지 않는다. 공간은 O(1). 문제 페이지의 제한은 수열 길이 최대 100만이라 O(N²)로는 안 되고 이 방식이 필요하다.

<details>
<summary>왜 O(N)인지 조금 더 자세히</summary>

바깥 for문은 N번 돈다. 안쪽 while은 l이 올라갈 때마다 한 번씩 돈다. l의 값은 0에서 시작해 최대 N까지만 올라가고 내려오지 않으니, while 본문이 실행되는 횟수는 전체를 합쳐서 N번 이하다. 그래서 총 연산은 N + N = 2N 정도, 즉 O(N)이다. 이런 식으로 반복문 한 번 한 번이 아니라 전체 합계로 세는 걸 상각(amortized) 분석이라고 부른다.

</details>

## 3. 슬라이딩 윈도우

길이가 변하는 창의 대표 문제는 프로그래머스 「보석 쇼핑」(모든 종류의 보석을 하나 이상 포함하는 가장 짧은 구간)과 LeetCode 3 「Longest Substring Without Repeating Characters」다. 길이 K가 고정인 창은 "연속된 K일 합의 최댓값" 같은 문제의 기본형이고, 프로그래머스 「연속 부분 수열 합의 개수」는 길이를 1부터 N까지 바꿔 가며 모든 연속 구간의 합을 보는 문제라 창을 미는 발상이 그대로 쓰인다.

### 고정 길이 창

처음 K개를 더해 두고, 한 칸 밀 때 새로 들어오는 값을 더하고 빠지는 값을 뺀다. 매번 K개를 새로 더하면 O(NK)지만, 이렇게 하면 O(N)이다.

```python
def max_window(a, k):
    s = sum(a[:k])
    best = s
    for i in range(k, len(a)):
        s += a[i] - a[i - k]
        best = max(best, s)
    return best

print(max_window([2, 1, 5, 1, 3, 2], 3))  # 9
```

### 길이가 변하는 창

중복 없는 가장 긴 부분 문자열은 창의 길이가 정해져 있지 않다. 오른쪽 끝(r)을 한 칸씩 늘리다가, 이미 창 안에 있는 문자가 나오면 왼쪽 끝(l)을 그 문자의 이전 위치 다음으로 옮긴다. 각 문자의 마지막 위치를 딕셔너리에 저장해 둔다.

```python
def longest_distinct(s):
    last = {}
    l = best = 0
    for r, ch in enumerate(s):
        if ch in last and last[ch] >= l:
            l = last[ch] + 1
        last[ch] = r
        best = max(best, r - l + 1)
    return best

print(longest_distinct("abcabcbb"))  # 3
print(longest_distinct("abba"))      # 2
```

`last[ch] >= l` 조건을 빼먹으면 "abba"에서 틀린다. 이미 창 밖으로 나간 옛 위치로 l이 거꾸로 돌아가기 때문이다. 시간 O(N), 공간은 문자 종류 수만큼이라 O(min(N, 문자 종류))다.

## 4. 누적합

대표 문제는 프로그래머스 「연속 부분 수열 합의 개수」다. 원형 수열(마지막 다음에 처음이 이어진다)에서 연속 부분 수열의 합이 몇 종류인지 센다. 원형은 수열을 두 번 이어 붙여 길이 2N 배열로 두면 일반 구간이 된다. 길이 L, 시작점 i인 구간의 합은 질의마다 새로 더하면 O(L)이라 전체가 O(N³)이다. 대신 앞에서부터의 합을 한 번 만들어 둔다.

prefix[i] = a[0] + ... + a[i-1] 으로 정의하면(prefix[0] = 0), 구간 [i, j]의 합은 prefix[j+1] - prefix[i] 한 번의 뺄셈이다. 앞에 0을 하나 붙여 두면 i가 0일 때를 따로 처리하지 않아도 된다.

```python
def build(a):
    p = [0]
    for x in a:
        p.append(p[-1] + x)
    return p

p = build([10, 20, 30, 40, 50])
print(p)            # [0, 10, 30, 60, 100, 150]
print(p[4] - p[1])  # 20+30+40 = 90
```

전처리 O(N), 질의 하나당 O(1), 공간 O(N)이다. 원형 수열 문제에 적용하면 이렇다.

```python
def count_sums(e):
    n = len(e)
    d = e + e                    # 원형을 두 번 이어 붙임
    p = [0]
    for x in d:
        p.append(p[-1] + x)
    sums = set()
    for length in range(1, n + 1):
        for i in range(n):
            sums.add(p[i + length] - p[i])
    return len(sums)

print(count_sums([7, 9, 1, 1, 4]))  # 18
```

구간 합을 O(1)로 구하니 전체는 O(N²)다. 문제 페이지의 제한은 원소 수 1,000 이하라 충분하다. 구간에 값을 더하는 작업이 아주 많은 문제(프로그래머스 「파괴되지 않은 건물」)에서는 누적합을 거꾸로 쓰는 차이 배열이 나온다. 자세한 건 [자세히 → 배열·문자열·해시](#/post/algo-array-hash)에서 다뤘다. 파이썬에는 `itertools.accumulate`가 있어서 `list(accumulate(a, initial=0))`로 같은 배열을 만들 수 있다.

### 누적합 + 해시: 합이 K인 구간 개수

음수가 섞이면 2번의 투 포인터가 안 통한다(구간을 늘려도 합이 커진다는 보장이 없다). 이럴 때는 누적합과 딕셔너리를 같이 쓴다. 현재까지의 누적합이 s라면, 합이 K인 구간으로 끝나는 시작점은 "누적합이 s-K였던 과거 시점"의 개수다. 과거의 누적합 값을 딕셔너리로 세 둔다.

```python
from collections import defaultdict

def count_k(a, k):
    seen = defaultdict(int)
    seen[0] = 1          # 아무것도 안 더한 상태
    s = res = 0
    for x in a:
        s += x
        res += seen[s - k]
        seen[s] += 1
    return res

print(count_k([1, 2, 3, -3, 3], 3))  # 5
```

`seen[0] = 1`을 빼면 처음부터 시작하는 구간을 놓친다. 시간 O(N), 공간 O(N).

<details>
<summary>코드가 맞는지 확인한 방법</summary>

위 함수들은 파이썬에서 실제로 실행했다. 이중 for문으로 만든 완전 탐색 결과와 무작위 입력 500번씩 비교해서 같은 걸 확인했다(합 구간 개수 두 가지, 중복 없는 부분 문자열). 대표 예제의 출력값은 코드 주석에 적은 것과 같았다.

</details>

## 어떤 걸 고를까

| 상황 | 고를 것 |
|---|---|
| 정렬된 배열에서 두 수의 합 | 양끝 투 포인터 |
| 양수 배열에서 합이 조건인 연속 구간 | 늘였다 줄이는 투 포인터 |
| 길이 K 고정 구간의 합·최대 | 슬라이딩 윈도우 |
| 구간 합 질의가 여러 번 | 누적합 |
| 음수가 있고 합이 K인 구간 개수 | 누적합 + 해시 |

## 흔한 실수

- 투 포인터를 쓰려는데 배열이 정렬 안 돼 있거나 음수가 있는데 단조성을 가정한다. 조건부터 확인한다.
- 누적합 배열 길이를 N으로 잡고 인덱스를 한 칸씩 어긋나게 쓴다. 맨 앞에 0을 붙여 N+1 길이로 만들면 덜 헷갈린다.
- 슬라이딩 윈도우에서 창이 비었을 때(l > r)를 처리하지 않는다.
- 입력이 큰 문제에서 `input()`을 쓰면 느리다. `sys.stdin.readline`을 쓴다.

비슷한 유형으로는 [정렬과 이분 탐색](#/post/algo-sort-search)(정렬된 배열이라는 같은 전제를 쓴다), [배열·문자열·해시](#/post/algo-array-hash)(누적합 + 해시의 딕셔너리 쪽), [스택·큐·덱](#/post/algo-stack-queue)(덱으로 창 안의 최댓값을 O(N)에 유지하는 문제가 이어진다), [그리디](#/post/algo-greedy)가 있다. 창이 아니라 경우의 수를 센다면 [동적 계획법](#/post/algo-dp)으로 넘어가는 경우가 많다.

## 근거 링크

- Prefix sum (Wikipedia): https://en.wikipedia.org/wiki/Prefix_sum (누적합의 정의와 선형 시간 계산을 확인)
- itertools.accumulate (Python 공식 문서): https://docs.python.org/3/library/itertools.html (accumulate와 initial 옵션을 확인)
- 사용한 문제: 구명보트 https://school.programmers.co.kr/learn/courses/30/lessons/42885 · 연속된 부분 수열의 합 https://school.programmers.co.kr/learn/courses/30/lessons/178870 · 보석 쇼핑 https://school.programmers.co.kr/learn/courses/30/lessons/67258 · 연속 부분 수열 합의 개수 https://school.programmers.co.kr/learn/courses/30/lessons/131701 · 파괴되지 않은 건물 https://school.programmers.co.kr/learn/courses/30/lessons/92344 · LeetCode 3 https://leetcode.com/problems/longest-substring-without-repeating-characters/

← 개념 map으로 (#/post/algo-map)
