ソートは Python ではほぼ内蔵関数で完結し、ソート済みのデータがある場合、二分探索を用いて半分ずつ切り捨てながら検索します。答えが「最大いくつまでか」と問われる問題も二分探索で解きます（パラメトリックサーチ）。

## ソートから

コーディングテストでソートアルゴリズムを直接実装することは稀です。`sorted()`や`list.sort()`を使えばよく、Python のドキュメントではこのソートが Timsort で安定ソート (stable) であると記載されています。安定ソートとは、キーが同じ要素同士は元の順序が維持されることを意味します。

原理を知っておくのも悪くないでしょう。時間計算量は [時間計算量の整理](#/post/algo-complexity) で扱った Big-O の基準です。

| 方式 | 平均 | 最悪 | メモ |
|---|---|---|---|
| バブル・選択・挿入 | O(N²) | O(N²) | シンプルだが N が大きければ使えない。挿入ソートはほぼソート済みのデータでは高速 |
| マージソート | O(N log N) | O(N log N) | 半分に分けてソートし、統合する。安定性あり、追加メモリが必要 |
| クイックソート | O(N log N) | O(P²) | ピボットで分割する。ピボットの選び方が悪ければ最悪ケースになる |
| カウンティングソート | O(N + K) | O(N + K) | 値の範囲 K が小さい場合のみ。比較を行わない |

内蔵ソートを O(N log N) と見なせば十分です。N が 100 万でも Python では問題なく動作しました。

キーを与える方法は実戦で最もよく使われます。文字列を「長さ順、同じ場合は辞書順」でソートするにはタプルをキーとして与えます。

```python
words = ["but", "i", "wont", "hesitate", "no", "more", "it"]
print(sorted(words, key=lambda w: (len(w), w)))
# ['i', 'it', 'no', 'but', 'more', 'wont', 'hesitate']
```

降順は `reverse=True`、数字のキーだけを降順にしたい場合は `-x` をキーに入れます。安定ソートなので、「補助キーで先にソートし、主キーで再度ソート」という方法もドキュメントに出てきます。

<details>
<summary>詳しい解説：マージソートを直接実装すると</summary>

原理確認用です。半分に分け、ソート済みの 2 つのリストを先頭から比較しながら統合します。左側を先に入れると安定ソートになります。

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

ランダムなリスト 300 個で `sorted()` と結果を比較して同一であることを確認しました。分割の深さは log N で、各階層での統合コストは N なので O(N log N) です。空間は O(N)。

</details>

## 二分探索

ソート済みの配列から値を探す場合、中央を見て探している値が大きい場合は右半分のみ、小さい場合は左半分のみを残します。毎回半分ずつ減らすので O(log N) です。1,000 万個でも 20〜30 回程度で終わります。

条件は一つです。データがソートされている必要があります（または「ある地点から以降が条件を満たす」という単調性がある必要があります）。この条件はパラメトリックサーチにおいてさらに重要になります。

直接実装すると境界付近で頻繁に失敗します。そのため、「最初に出てくる x 以上になる位置」を基準に実装するのが楽でした。これが lower bound で、Python の `bisect_left` と同じです。

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

`bisect` ドキュメントの説明も同様です。`bisect_left` は同じ値の左側の挿入位置、`bisect_right` は同じ値の右側の挿入位置を返します。`[1, 2, 2, 2, 3]` で 2 を探すとそれぞれ 1 と 4 です。したがって、値 x の個数は `bisect_right(a, x) - bisect_left(a, x)` で求めます。上記の 2 つの関数はランダムにソートされたリストで `bisect` と結果が同じであることを確認しました。

注意すべき点があります。bisect は「見つけてくれる」関数ではなく、「挿入位置」を与える関数です。値が存在するかどうかは、その位置の要素を直接比較して確認する必要があります。

## パラメトリックサーチ

答え自体を二分探索する方法です。「条件を満たす最大値（または最小値）を求めよ」というタイプで使います。枠組みはほぼ同じです。

1. 答えの候補範囲を決める（例：0 から最も高い木の高さまで）。
2. 候補の一つを選び、「この値なら条件を満たすか？」を O(N) で検査する関数を作る。
3. 可能であれば大きい方（または小さい方）に範囲を絞る。

成り立つのは単調性です。高さ H で切った場合が可能なら、より低い H も可能である必要があります。これが成り立たなければ二分探索が使えません。

検査が O(N)、候補範囲が R なら O(N log R) です。範囲が 20 億でも log が 31 程度なので、N が 100 万でも挑戦に値します。

## 代表的な問題

番号と名前のみ記載します。本文は各サイトで確認してください。すべて 프로그래머스 (Programmers) の問題です。

- [K번째수](https://school.programmers.co.kr/learn/courses/30/lessons/42748): 배열의 구간을 잘라 정렬한 뒤 k 번째 값을 꺼낸다. 내장 정렬을 그대로 쓰는 가장 기본 문제다.
- [가장 큰 수](https://school.programmers.co.kr/learn/courses/30/lessons/42746): 숫자를 이어 붙여 가장 큰 수를 만든다. 두 수를 `a+b`와 `b+a`로 이어 붙여 비교하는 정렬 기준을 직접 준다.
- [순위 검색](https://school.programmers.co.kr/learn/courses/30/lessons/72412): 조건별 점수 목록을 정렬해 두고 질의마다 이분 탐색으로 개수를 센다. `bisect`로 "x 이상인 개수"를 구하는 연습용이다.
- [징검다리](https://school.programmers.co.kr/learn/courses/30/lessons/43236): 바위를 n 개 빼고 남은 바위 사이 거리의 최솟값을 최대로 만든다. 파라메트릭 서치 (최댓값) 다. 거리 기준값을 이분 탐색한다.
- [입국심사](https://school.programmers.co.kr/learn/courses/30/lessons/43238): 파라메트릭 서치 (최솟값). 시간 T 를 이분 탐색한다.

## 풀이 생각 순서

1. 정렬하면 쉬워지나? 쉬워지면 정렬 후 인접한 것만 본다. 안 되면 다른 유형이다.
2. 정렬된 데이터에서 찾기만 하면 되나? 이분 탐색 또는 `bisect`.
3. "~의 최댓값/최솟값"을 묻고, 값을 하나 정하면 가능 여부를 O(N) 에 알 수 있나? 파라메트릭 서치.
4. 범위 (lo, hi) 를 잡고, 정답을 구간 안에 둘지 밖에 둘지 먼저 정한 뒤 mid 계산과 갱신을 맞춘다. 최댓값을 찾을 땐 `mid = (lo + hi + 1) // 2` 로 올림해야 무한 루프를 피한다.

## 코드

"절단 높이 H 를 정하는" 유형. 높이 H 로 자를 때 얻는 나무는 `H 보다 큰 나무의 (높이 - H)` 합이다. 필요한 양 M 이상이 되는 최대 H 를 찾는다.

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

"길이 L 로 잘라 K 개 이상 만들기" 유형은 같은 틀에서 검사만 `sum(l // mid)`로 바꾸고 `lo`는 1 에서 시작한다.

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

입국심사는 반대로 "최솟값"이라 올림이 아니라 내림 mid 를 쓴다. 시간 T 일 때 처리 가능한 인원은 `sum(T // t)`다.

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

징검다리는 최댓값 찾기라서 올림 mid 를 쓰고, 검사는 "기준값보다 가까운 바위를 치우면 몇 개 치워야 하나"를 앞에서부터 센다. 치운 개수가 n 이하면 가능하다.

```python
def bridge(distance, rocks, n):
    pts = [0] + sorted(rocks) + [distance]
    lo, hi = 1, distance
    while lo < hi:
        mid = (lo + hi + 1) // 2           # 최댓값 찾기: 올림
        removed, prev = 0, 0
        for p in pts[1:]:
            if p - prev < mid:
                removed += 1               # 너무 가까운 바위는 치운다
            else:
                prev = p
        if removed <= n:
            lo = mid                        # n개 이하로 치워도 됨 -> 기준을 키운다
        else:
            hi = mid - 1
    return lo

print(bridge(25, [2, 14, 11, 21, 17], 2))   # 4
```

가장 큰 수의 정렬 기준은 `cmp_to_key`로 준다.

```python
from functools import cmp_to_key

def biggest(nums):
    s = sorted(map(str, nums),
               key=cmp_to_key(lambda a, b: (a + b < b + a) - (a + b > b + a)))
    return str(int("".join(s)))             # 앞의 0이 몰려 "000"이 되는 경우 처리

print(biggest([6, 10, 2]))                  # 6210
print(biggest([3, 30, 34, 5, 9]))           # 9534330
```

위 코드는 전부 직접 실행해서 예시 값이 맞게 나오는 걸 확인했다. 입국심사 (6, [7, 10] → 28) 와 징검다리 (25, [2, 14, 11, 21, 17], 2 → 4) 는 프로그래머스 문제 페이지의 입출력 예와 같은 값이다. 문제 사이트에 제출해서 채점받은 건 아니다.

## 시간·공간 복잡도

| 작업 | 시간 | 공간 |
|---|---|---|
| `sorted()` / `list.sort()` | O(N log N) | `sort()`는 제자리, `sorted()`는 복사본 O(N) |
| 이분 탐색 (정렬된 상태) | O(log N) | O(1) |
| 정렬 + 이분 탐색 N 번 | O(N log N) | O(1)~O(N) |
| 파라메트릭 서치 | O(N log R) | O(1) |

`bisect.insort`는 찾는 건 O(log N)이지만 리스트에 끼워 넣는 건 O(N)이라 전체는 O(N)이다 (문서에도 그렇게 나온다). 반복해서 넣어야 하면 다른 자료구조를 생각한다.

## 흔한 실수

- 정렬 안 된 배열에 이분 탐색을 한다. 에러 없이 틀린 답이 나와서 찾기 힘들다.
- `mid` 갱신을 `lo = mid`로 쓰면서 내림 mid 를 써서 무한 루프에 빠진다.
- 파라메트릭 서치의 범위 끝 (hi) 을 너무 작게 잡는다.
- 이분 탐색이 필요 없는데 쓴다. `set`이나 `dict`가 더 간단한 경우가 많다.

## 비슷한 유형

- 정렬 후 양 끝에서 좁혀 가는 방식은 [투 포인터](#/post/algo-two-pointer).
- "가능한 값을 조건으로 줄여 가는" 사고는 [그리디](#/post/algo-greedy)와 같이 나온다. 파라메트릭 서치 검사 함수가 그리디인 경우가 많았다.
- 값 범위가 작을 때는 [배열·해시](#/post/algo-array-hash)의 카운트가 이분 탐색보다 쉽다.
- 최적화 문제 중 단조성이 없으면 [DP](#/post/algo-dp) 쪽으로 간다.

← 개념 map 으로 [알고리즘 유형 map](#/post/algo-map)

## 근거 링크

- Python 文書、ソート技術: https://docs.python.org/3/howto/sorting.html
- Python 文書、bisect: https://docs.python.org/3/library/bisect.html
- 使用した問題 (Programmers): K 番目の数 https://school.programmers.co.kr/learn/courses/30/lessons/42748 · 最も大きな数 https://school.programmers.co.kr/learn/courses/30/lessons/42746 · 順位検索 https://school.programmers.co.kr/learn/courses/30/lessons/72412 · 石橋 https://school.programmers.co.kr/learn/courses/30/lessons/43236 · 入国審査 https://school.programmers.co.kr/learn/courses/30/lessons/43238