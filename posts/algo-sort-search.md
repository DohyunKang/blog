정렬은 파이썬에서 거의 내장 함수로 끝나고, 정렬된 데이터가 있으면 이분 탐색으로 절반씩 버리면서 찾는다. 답이 "얼마까지 되나"를 묻는 문제도 이분 탐색으로 푼다(파라메트릭 서치).

## 정렬부터

코딩 테스트에서 정렬 알고리즘을 직접 짤 일은 드물다. `sorted()`나 `list.sort()`를 쓰면 되고, 파이썬 문서는 이 정렬이 Timsort이고 안정 정렬(stable)이라고 적는다. 안정 정렬은 키가 같은 원소끼리 원래 순서가 유지된다는 뜻이다.

그래도 원리는 알아 둘 만하다. 시간복잡도는 [시간복잡도 정리](#/post/algo-complexity)에서 다룬 Big-O 기준이다.

| 방식 | 평균 | 최악 | 메모 |
|---|---|---|---|
| 버블·선택·삽입 | O(N²) | O(N²) | 쉽지만 N이 크면 못 씀. 삽입은 거의 정렬된 데이터에서 빠름 |
| 병합 정렬 | O(N log N) | O(N log N) | 반씩 나눠 정렬하고 합침. 안정적, 추가 메모리 필요 |
| 퀵 정렬 | O(N log N) | O(N²) | 기준값으로 나눔. 기준을 잘못 잡으면 최악 |
| 계수 정렬 | O(N + K) | O(N + K) | 값 범위 K가 작을 때만. 비교를 안 함 |

내장 정렬은 O(N log N)으로 보면 된다. N이 100만이어도 파이썬에서 무리 없이 돌았다.

키를 주는 방법이 실전에서 제일 많이 쓰인다. 문자열을 "길이 순, 같으면 사전 순"으로 정렬하려면 튜플을 키로 준다.

```python
words = ["but", "i", "wont", "hesitate", "no", "more", "it"]
print(sorted(words, key=lambda w: (len(w), w)))
# ['i', 'it', 'no', 'but', 'more', 'wont', 'hesitate']
```

내림차순은 `reverse=True`, 숫자 키만 내림차순으로 하고 싶으면 `-x`를 키에 넣는다. 안정 정렬이라 "보조 키로 먼저 정렬하고, 주 키로 다시 정렬"하는 방법도 문서에 나온다.

<details>
<summary>자세한 풀이: 병합 정렬을 직접 짜면</summary>

원리 확인용이다. 반으로 쪼개고, 정렬된 두 리스트를 앞에서부터 비교하며 합친다. 같을 때 왼쪽을 먼저 넣으면 안정 정렬이 된다.

```python
def merge_sort(a):
    if len(a) <= 1:
        return a
    m = len(a) // 2
    l, r = merge_sort(a[:m]), merge_sort(a[m:])
    res, i, j = [], 0, 0
    while i < len(l) and j < len(r):
        if l[i] <= r[j]:
            res.append(l[i]); i += 1
        else:
            res.append(r[j]); j += 1
    return res + l[i:] + r[j:]
```

무작위 리스트 300개로 `sorted()`와 결과를 비교해서 같은 걸 확인했다. 쪼개는 깊이가 log N이고 각 층에서 합치는 비용이 N이라 O(N log N)이다. 공간은 O(N).

</details>

## 이분 탐색

정렬된 배열에서 값을 찾을 때, 가운데를 보고 찾는 값이 더 크면 오른쪽 절반만, 작으면 왼쪽 절반만 남긴다. 한 번에 절반씩 줄어서 O(log N)이다. 1,000만 개여도 20~30번 정도면 끝난다.

조건은 하나다. 데이터가 정렬되어 있어야 한다(또는 "어느 지점부터 조건이 참이 된다"는 단조성이 있어야 한다). 이 조건이 파라메트릭 서치에서 더 중요해진다.

직접 짜면 경계에서 자주 틀린다. 그래서 "처음으로 x 이상이 나오는 위치"를 기준으로 짜는 게 편했다. 이게 lower bound이고, 파이썬 `bisect_left`와 같다.

```python
def lower_bound(a, x):   # a[i] >= x 인 첫 i (없으면 len(a))
    lo, hi = 0, len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] < x:
            lo = mid + 1
        else:
            hi = mid
    return lo

def upper_bound(a, x):   # a[i] > x 인 첫 i
    lo, hi = 0, len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] <= x:
            lo = mid + 1
        else:
            hi = mid
    return lo
```

`bisect` 문서의 설명도 같다. `bisect_left`는 같은 값 앞쪽 삽입 위치, `bisect_right`는 같은 값 뒤쪽 삽입 위치를 돌려준다. `[1, 2, 2, 2, 3]`에서 2를 넣으면 각각 1과 4다. 그래서 값 x의 개수는 `bisect_right(a, x) - bisect_left(a, x)`로 구한다. 위 두 함수는 무작위 정렬 리스트에서 `bisect`와 결과가 같은 걸 돌려서 확인했다.

한 가지 주의할 점이 있다. bisect는 "찾아 주는" 함수가 아니라 "들어갈 위치"를 주는 함수다. 값이 있는지는 그 위치의 원소를 직접 비교해서 확인해야 한다.

## 파라메트릭 서치

답 자체를 이분 탐색하는 방식이다. "조건을 만족하는 최댓값(또는 최솟값)을 구하라" 유형에서 쓴다. 틀이 거의 같다.

1. 답의 후보 범위를 정한다(예: 0부터 가장 긴 나무 높이까지).
2. 후보 하나를 정하고 "이 값이면 조건이 되나?"를 O(N)으로 검사하는 함수를 만든다.
3. 가능하면 더 큰 쪽(또는 작은 쪽)으로 범위를 좁힌다.

되는 조건은 단조성이다. 높이 H로 잘랐을 때 가능하면, 더 낮은 H도 가능해야 한다. 이게 안 맞으면 이분 탐색을 못 쓴다.

검사에 O(N), 후보 범위가 R이면 O(N log R)이다. 범위가 20억이어도 log가 31 정도라서 N이 100만이어도 해볼 만하다.

## 대표 문제

번호와 이름만 적는다. 본문은 각 사이트에서 봐야 한다.

- 백준 2751 수 정렬하기 2: N이 크니 O(N²) 정렬이 안 되고 내장 정렬을 쓴다. 입력은 `sys.stdin`으로 빠르게 받는다.
- 백준 1920 수 찾기: 정렬해 두고 이분 탐색, 또는 집합(set)으로도 된다. 집합은 평균 O(1)이라 이 문제에서는 더 짧다. 이분 탐색을 연습하려면 직접 짜 본다.
- 백준 10816 숫자 카드 2: 개수를 세야 해서 `bisect_right - bisect_left`를 쓴다(딕셔너리 카운트도 가능).
- 백준 2805 나무 자르기: 파라메트릭 서치. 절단 높이 H를 이분 탐색한다.
- 백준 1654 랜선 자르기: 파라메트릭 서치. 랜선 길이를 이분 탐색한다.
- 프로그래머스 입국심사: 파라메트릭 서치. 시간 T를 이분 탐색한다.

## 풀이 생각 순서

1. 정렬하면 쉬워지나? 쉬워지면 정렬 후 인접한 것만 본다. 안 되면 다른 유형이다.
2. 정렬된 데이터에서 찾기만 하면 되나? 이분 탐색 또는 `bisect`.
3. "~의 최댓값/최솟값"을 묻고, 값을 하나 정하면 가능 여부를 O(N)에 알 수 있나? 파라메트릭 서치.
4. 범위(lo, hi)를 잡고, 정답을 구간 안에 둘지 밖에 둘지 먼저 정한 뒤 mid 계산과 갱신을 맞춘다. 최댓값을 찾을 땐 `mid = (lo + hi + 1) // 2`로 올림해야 무한 루프를 피한다.

## 코드

나무 자르기(2805) 형태. 높이 H로 자를 때 얻는 나무는 `H보다 큰 나무의 (높이 - H)` 합이다. 필요한 양 M 이상이 되는 최대 H를 찾는다.

```python
def tree_cut(trees, need):
    lo, hi = 0, max(trees)
    while lo < hi:
        mid = (lo + hi + 1) // 2          # 최댓값 찾기: 올림
        if sum(t - mid for t in trees if t > mid) >= need:
            lo = mid                       # 가능 -> 더 높여 본다
        else:
            hi = mid - 1                   # 불가능 -> 낮춘다
    return lo

print(tree_cut([20, 15, 10, 17], 7))        # 15
print(tree_cut([4, 42, 40, 26, 46], 20))    # 36
```

랜선 자르기(1654)는 같은 틀에서 검사만 `sum(l // mid)`로 바꾸고 `lo`는 1에서 시작한다.

```python
def lan(lines, need):
    lo, hi = 1, max(lines)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if sum(l // mid for l in lines) >= need:
            lo = mid
        else:
            hi = mid - 1
    return lo

print(lan([802, 743, 457, 539], 11))        # 200
```

입국심사는 반대로 "최솟값"이라 올림이 아니라 내림 mid를 쓴다. 시간 T일 때 처리 가능한 인원은 `sum(T // t)`다.

```python
def immigration(n, times):
    lo, hi = 1, min(times) * n
    while lo < hi:
        mid = (lo + hi) // 2               # 최솟값 찾기: 내림
        if sum(mid // t for t in times) >= n:
            hi = mid                        # 가능 -> 더 줄여 본다
        else:
            lo = mid + 1
    return lo

print(immigration(6, [7, 10]))              # 28
```

위 코드는 전부 직접 실행해서 예시 값이 맞게 나오는 걸 확인했다(예시 숫자는 각 문제의 공개된 예제 형태를 따랐지만, 문제 사이트에 제출해서 채점받은 건 아니다).

## 시간·공간 복잡도

| 작업 | 시간 | 공간 |
|---|---|---|
| `sorted()` / `list.sort()` | O(N log N) | `sort()`는 제자리, `sorted()`는 복사본 O(N) |
| 이분 탐색(정렬된 상태) | O(log N) | O(1) |
| 정렬 + 이분 탐색 N번 | O(N log N) | O(1)~O(N) |
| 파라메트릭 서치 | O(N log R) | O(1) |

`bisect.insort`는 찾는 건 O(log N)이지만 리스트에 끼워 넣는 건 O(N)이라 전체는 O(N)이다(문서에도 그렇게 나온다). 반복해서 넣어야 하면 다른 자료구조를 생각한다.

## 흔한 실수

- 정렬 안 된 배열에 이분 탐색을 한다. 에러 없이 틀린 답이 나와서 찾기 힘들다.
- `mid` 갱신을 `lo = mid`로 쓰면서 내림 mid를 써서 무한 루프에 빠진다.
- 파라메트릭 서치의 범위 끝(hi)을 너무 작게 잡는다.
- 이분 탐색이 필요 없는데 쓴다. `set`이나 `dict`가 더 간단한 경우가 많다.

## 비슷한 유형

- 정렬 후 양 끝에서 좁혀 가는 방식은 [투 포인터](#/post/algo-two-pointer).
- "가능한 값을 조건으로 줄여 가는" 사고는 [그리디](#/post/algo-greedy)와 같이 나온다. 파라메트릭 서치 검사 함수가 그리디인 경우가 많았다.
- 값 범위가 작을 때는 [배열·해시](#/post/algo-array-hash)의 카운트가 이분 탐색보다 쉽다.
- 최적화 문제 중 단조성이 없으면 [DP](#/post/algo-dp) 쪽으로 간다.

← 개념 지도로 알고리즘 유형 지도

<details>
<summary>자세한 풀이: 확인한 것과 못 한 것</summary>

확인함: 파이썬 정렬이 안정적이고 Timsort라는 것, 키 함수와 다중 키 정렬(공식 정렬 문서). `bisect_left`/`bisect_right` 의미와 `insort`의 O(n), 검색 O(log n)(bisect 문서). 코드 전부 실행 확인(병합 정렬·lower/upper bound는 무작위 비교, 파라메트릭 서치는 예시 값).

확인 못 함: 각 문제의 최신 제한 조건과 정확한 입력 형식(문제 본문을 복제하지 않아 사이트에서 다시 확인 필요). 위 코드의 사이트 제출 채점 결과. 퀵 정렬 최악 O(N²) 같은 일반 이론은 공식 문서가 아니라 일반적인 알고리즘 상식이다.

</details>

## 근거 링크

- Python 문서, Sorting Techniques: https://docs.python.org/3/howto/sorting.html
- Python 문서, bisect: https://docs.python.org/3/library/bisect.html
