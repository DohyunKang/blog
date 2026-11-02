배열·문자열 문제는 대부분 "같은 걸 또 세지 말고 한 번 세어서 적어 두자"로 풀렸고, 그 적어 두는 자리가 누적합 배열이거나 해시(dict, set)였다.

## 어떤 유형인가

코딩 테스트에서 제일 많이 만나는 입력이 배열과 문자열이다. 처음엔 이중 for문으로 다 비교하면 되겠다고 생각하게 되는데, 입력이 커지면 시간 초과가 난다. 이 유형은 그 이중 반복을 한 번의 반복으로 줄이는 연습이다. 줄이는 도구는 둘이다.

- 누적합(prefix sum): 앞에서부터 합을 미리 쌓아 두고, 구간 합을 뺄셈 한 번으로 구한다.
- 해시: 값을 키로 넣어 두고 "이 값 있었나?"를 바로 확인한다. 개수 세기에도 쓴다.

[복잡도가 왜 중요한지는 → 시간·공간 복잡도](#/post/algo-complexity)에서 따로 정리했다. 여기서는 "O(n²)를 O(n)으로 바꾼다"는 정도로만 쓴다.

## 해시가 왜 빠른가

파이썬의 dict와 set은 해시 테이블이다. 키를 해시 함수에 넣어 나온 값으로 저장 위치를 바로 찾는다. 그래서 키로 찾거나 있는지 확인하는 연산이 평균 O(1)이다. 파이썬 공식 문서의 시간복잡도 표는 이렇다.

| 자료형 | 연산 | 평균 | 최악 |
|---|---|---|---|
| list | `x in l` | O(n) | O(n) |
| list | `l[k]` | O(1) | O(1) |
| dict | `key in d`, `d[key]` | O(1) | O(n) |
| set | `x in s` | O(1) | O(n) |

문서는 이 O(1)이 평균이라고 못 박는다. 해시 함수가 충분히 튼튼해서 충돌이 드물고, 키가 고르게 퍼져 있다고 가정한 값이다. 모든 키가 같은 해시값이면 O(n)이 된다. 코딩 테스트의 일반적인 입력에서는 평균으로 보고 풀면 된다.

list에서 `in`을 쓰면 O(n)이라는 점이 실수 포인트다. 반복문 안에서 `if x in 리스트`를 쓰면 겉보기엔 한 줄인데 속으로 이중 반복이 돈다. 이럴 때 리스트를 set으로 바꾸는 게 첫 번째 수정이다.

## 대표 문제 세 개

번호와 이름만 적는다. 본문은 프로그래머스 문제 페이지에서 읽는 게 맞다.

| 문제 | 한 줄 요약 | 쓰는 도구 |
|---|---|---|
| 프로그래머스 파괴되지 않은 건물 | 격자의 여러 직사각형 구간에 값을 더하고 빼는 작업이 아주 많이 들어온다 | 누적합(구간에 더할 값을 끝에만 적어 두고 마지막에 한 번 누적) |
| 프로그래머스 완주하지 못한 선수 | 참가자 명단과 완주자 명단에서 빠진 한 명을 찾는다 (동명이인 있음) | 해시(Counter) |
| 프로그래머스 의상 | 의상 이름과 종류가 주어지고, 종류별로 하나씩만 입을 때 가능한 조합의 수를 구한다 | 종류별 개수 세기(Counter) |

세 문제 모두 프로그래머스 문제 페이지를 열어 제목과 요약을 확인했다. 아래 설명은 "작업이 아주 많이 들어온다", "명단이 길 수 있다" 정도의 일반적인 이유로 쓴다.

- [파괴되지 않은 건물](https://school.programmers.co.kr/learn/courses/30/lessons/92344)
- [완주하지 못한 선수](https://school.programmers.co.kr/learn/courses/30/lessons/42576)
- [의상](https://school.programmers.co.kr/learn/courses/30/lessons/42578)

## 풀이 생각 순서

### 1. 누적합: 구간마다 다시 더하지 않는다

먼저 기본형이다. 구간 합을 여러 번 물어보는 경우, 질문이 올 때마다 구간을 for문으로 더하면 구간 길이가 n, 질문이 m번일 때 O(n·m)이다. 질문이 많으면 느리다.

고쳐 생각하면 이렇다. 물어보기 전에 앞에서부터 누적해서 한 번만 쌓아 둔다. `p[i]`를 "앞에서 i개의 합"이라고 하면 i번째부터 j번째 구간 합은 `p[j] - p[i-1]`이다. 쌓는 데 O(n), 질문 하나에 O(1)이다.

파괴되지 않은 건물은 이 발상을 거꾸로 쓴다. 공격·회복이 들어올 때마다 구간 전체를 고치면 느리니까, 구간의 시작에 +v, 끝 다음 칸에 -v만 적어 둔다(차이 배열). 모든 작업을 적은 뒤 누적합을 한 번 내면 칸마다 최종 값이 나온다. 문제는 2차원 격자라 네 모서리에 적지만, 1차원에서 하는 방식이 같다. 아래 코드는 1차원 기본형이다.

### 2. 완주하지 못한 선수: 명단에서 하나씩 지운다고 생각한다

참가자마다 완주자 명단을 뒤져서 있으면 지우는 방법이 먼저 떠오른다. list에서 찾으면 O(n), 그걸 참가자 수만큼 반복하니 O(n²)이다.

동명이인이 있어서 set으로는 부족하다. 이름별 인원수를 세는 dict(Counter)가 맞다. 참가자 이름은 +1, 완주자 이름은 -1을 하고 마지막에 개수가 남아 있는 이름이 답이다.

### 3. 의상: 이름은 상관없고 종류별 개수만 본다

의상 이름은 조합의 수에 영향이 없다. 종류(머리 장식, 안경 등)마다 몇 개 있는지만 중요하다. 종류별 개수를 Counter로 센다. 종류 하나에서 고를 수 있는 건 "그 종류의 의상 중 하나" 또는 "아무것도 안 입기"라서 (개수 + 1)가지다. 종류마다 (개수 + 1)을 곱하고, 하루에 한 벌은 입어야 하니 아무것도 안 입는 경우 1을 뺀다.

세 문제가 다 같은 틀이다. 먼저 한 번 훑어서 정보를 적어 두고, 그 정보로 답을 바로 낸다.

## Python 코드

아래 코드는 전부 직접 돌려서 예시 입력에 맞는 결과가 나오는 걸 확인했다. 프로그래머스에 실제로 제출해 본 건 아니다.

```python
from collections import Counter

# 1) 구간 합 (누적합 기본형)
def range_sums(a, queries):
    p = [0]                      # p[i] = 앞에서 i개의 합
    for x in a:
        p.append(p[-1] + x)
    return [p[j] - p[i - 1] for i, j in queries]   # 1-indexed 구간

print(range_sums([5, 4, 3, 2, 1], [(1, 3), (2, 4), (5, 5)]))
# [12, 9, 1]

# 1-2) 구간에 값 더하기 (차이 배열 + 누적합, 파괴되지 않은 건물의 1차원 버전)
def apply_updates(n, updates):
    d = [0] * (n + 1)
    for l, r, v in updates:      # 0-indexed, l..r에 v를 더한다
        d[l] += v
        d[r + 1] -= v
    res, s = [], 0
    for i in range(n):
        s += d[i]                # 누적하면 칸마다 최종 값
        res.append(s)
    return res

print(apply_updates(5, [(0, 2, 3), (1, 3, -1), (4, 4, 5)]))
# [3, 2, 2, -1, 5]

# 2) 완주하지 못한 선수 (프로그래머스 방식)
def not_finished(participant, completion):
    c = Counter(participant)
    c.subtract(completion)       # 완주자는 -1
    return next(name for name, cnt in c.items() if cnt > 0)

print(not_finished(["leo", "kiki", "eden"], ["eden", "kiki"]))
# leo
print(not_finished(["mislav", "stanko", "mislav", "ana"],
                   ["stanko", "ana", "mislav"]))
# mislav   (동명이인)

# 3) 의상 (종류별 개수 세기)
def outfits(clothes):
    c = Counter(kind for _, kind in clothes)
    ans = 1
    for cnt in c.values():
        ans *= cnt + 1          # 종류마다 '안 입기' 포함
    return ans - 1              # 아무것도 안 입는 경우 제외

print(outfits([["yellow_hat", "headgear"], ["blue_sunglasses", "eyewear"],
               ["green_turban", "headgear"]]))   # 5
print(outfits([["crow_mask", "face"], ["blue_sunglasses", "face"],
               ["smoky_makeup", "face"]]))       # 3
```

Counter는 dict의 하위 클래스이고, 문서에 따르면 개수가 0이나 음수여도 된다. 완주하지 못한 선수 풀이의 `subtract()`는 음수 결과를 그대로 남겨서 맞다. 반대로 `c - d` 연산자는 양수만 남기므로 이 풀이에는 쓰면 안 된다. 없는 키를 조회하면 KeyError 대신 0이 나온다는 것도 편하다.

<details>
<summary>해시로 두 수의 합 찾기 (Two Sum 유형)</summary>

"합이 target이 되는 두 수의 위치"를 찾는 유형이다. 이중 for문은 O(n²)다. 해시로는 한 번 훑으면서 `target - x`가 이미 본 값에 있는지만 확인한다.

```python
def two_sum(nums, target):
    seen = {}                    # 값 -> 위치
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i

print(two_sum([2, 7, 11, 15], 9))   # [0, 1]
```

확인하고 나서 넣는 순서가 중요하다. 넣고 나서 확인하면 같은 원소를 두 번 쓸 수 있다. 직접 돌려서 위 결과가 나왔다.
</details>

## 시간·공간 복잡도

| 풀이 | 시간 | 공간 | 비고 |
|---|---|---|---|
| 구간 합, 매번 더하기 | O(n·m) | O(1) | n=구간 길이, m=질문 수 |
| 구간 합, 누적합 | O(n + m) | O(n) | 쌓는 데 n, 질문 m번 |
| 구간 값 더하기, 구간마다 고치기 | O(n·m) | O(1) | m=작업 수 |
| 구간 값 더하기, 차이 배열 | O(n + m) | O(n) | 작업마다 두 칸만 적고 마지막에 누적 |
| 완주 선수, list 지우기 | O(n²) | O(1) | 찾을 때마다 O(n) |
| 완주 선수, Counter | O(n) | O(n) | 해시 평균 O(1) 가정 |
| 의상, Counter | O(n) | O(종류 수) | 의상을 한 번 훑어 종류별로 센다 |

해시 풀이는 공통으로 시간을 줄이는 대신 메모리를 쓴다. 시간을 공간으로 바꿨다고 보면 된다. 해시 시간은 위에서 본 대로 평균 기준이다.

## 흔한 실수

- 누적합 인덱스: 1부터 세는 문제인데 0부터 쓰다가 한 칸씩 어긋난다. `p`의 맨 앞에 0을 넣어 두면 `i-1`이 0이 되는 경우도 안전하다.
- 리스트에 `in`: 위에서 말한 대로 O(n)이다. 반복문 안이면 set이나 dict로 바꾼다.
- 동명이인에 set 사용: set은 중복을 지운다. 개수가 중요하면 Counter다.
- 문자열 `+=` 반복: 큰 문자열을 계속 이어 붙이면 느릴 수 있다. 이 부분은 이번에 문서로 확인하지 않아서 단정하지 않는다. 리스트에 모아서 `"".join()` 하는 게 보통 쓰는 방식이다.
- dict를 순회하면서 크기 바꾸기: 순회 중에 키를 지우거나 넣으면 오류가 난다. 복사본을 돌리거나 나중에 한꺼번에 지운다.

## 비슷한 유형

- 정렬해 두고 양 끝에서 좁혀 가는 풀이는 [자세히 → 투 포인터](#/post/algo-two-pointer)에서 같은 두 수의 합 류를 다른 방식으로 푼다.
- 정렬한 뒤 값을 찾는 건 [자세히 → 정렬·탐색](#/post/algo-sort-search).
- 먼저 들어온 걸 먼저 꺼내거나 나중 걸 먼저 꺼내는 구조는 [자세히 → 스택·큐](#/post/algo-stack-queue).
- 누적해서 쌓는 발상이 반복되는 문제는 [자세히 → 동적 계획법](#/post/algo-dp)으로 이어진다.

## 확인 못 함

- 세 문제(프로그래머스 파괴되지 않은 건물, 완주하지 못한 선수, 의상)의 제출 통과 여부. 파괴되지 않은 건물은 2차원이라 위 1차원 코드를 그대로 낼 수는 없다.
- 문자열 `+=` 반복이 느린지에 대한 공식 문서 근거.
- CPython이 해시 충돌을 내부에서 어떻게 처리하는지(문서 표의 평균·최악 수치만 확인).

## 근거 링크

- [Python 문서: Time complexity of built-in types](https://docs.python.org/3/builtins/time-complexity.html)
- [Python 문서: collections — Counter](https://docs.python.org/3/library/collections.html)
- 사용한 문제: [파괴되지 않은 건물](https://school.programmers.co.kr/learn/courses/30/lessons/92344) · [완주하지 못한 선수](https://school.programmers.co.kr/learn/courses/30/lessons/42576) · [의상](https://school.programmers.co.kr/learn/courses/30/lessons/42578) (문제 페이지를 열어 제목·유형 확인)

← 개념 지도로 ([알고리즘 지도](#/post/algo-map))

관련 글: [시간·공간 복잡도](#/post/algo-complexity) · [투 포인터](#/post/algo-two-pointer) · [스택·큐](#/post/algo-stack-queue)
