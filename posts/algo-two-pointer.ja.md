# Two Pointers, Sliding Window, and Prefix Sums

Problems asking about "continuous subarrays" in arrays are common. Examples include finding how many subarrays have a sum of M, or finding the subarray of length K with the largest sum. The first thing that comes to mind is iterating through all start and end points with nested for loops, which results in O(N²). Even if N is 10 million, this amounts to 10 billion operations, leading to a time limit exceeded error. All three methods in this article reduce the complexity to O(N) by reusing previously calculated values without discarding them.

If you are unfamiliar with Big O notation, start with [Details → Time Complexity and Python Basics](#/post/algo-complexity).

## Three Types

| Type | Core Idea | When to Use |
|---|---|---|
| Two Pointers | Moves two indices in only one direction based on conditions. | Finding sums in sorted arrays, subarrays satisfying sum conditions. |
| Sliding Window | Shifts a window of fixed length (or length changing based on conditions) by one step. | Sum/max of subarrays of length K, longest substring without repeating characters. |
| Prefix Sums | Stores cumulative sums from the beginning to calculate subarray sums via subtraction. | When multiple queries for subarray sums are needed. |

The distinction between two pointers and sliding windows is sometimes blurry. Since both move the boundaries of a range only to the right, they belong to the same family; however, "narrowing in from both ends" is typically called two pointers, while "shifting a single interval forward" is called sliding window.

## 1. Two Pointers: Narrowing from Both Ends

A representative problem is Programmers' "Lifeboat". Given a weight limit for one boat that can carry at most two people, find the minimum number of boats needed to save everyone. The basic framework is similar to "finding pairs with a sum equal to target". After sorting, place pointers at the left end (l) and right end (r). First, let's look at the framework for finding pairs with a sum equal to target.

- If the sum is less than X, move l to the right (we need a larger number).
- If the sum is greater than X, move r to the left.
- If they are equal, we found it.

The core idea is that since the array is sorted, there is no need to revisit candidates once discarded. This property does not hold for problems where sorting is not possible or where negative numbers mix such that the sum is not monotonic; in such cases, this method should not be used.

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

Lifeboat uses the same framework but changes the conditions. After sorting, look at the lightest person (l) and the heaviest person (r). If their combined weight is within the limit, take them together (move l); otherwise, the heaviest person cannot ride with anyone, so they must go alone. In either case, the heaviest person (r) rides in this boat and is removed from consideration.

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

Time complexity is O(N log N) for sorting + O(N) for search; space complexity is O(1). If the input is already sorted, only the search takes O(N) (Lifeboat requires sorting as it is not pre-sorted).

## 2. Two Pointers: Expanding and Shrinking Ranges

A representative problem is Programmers' "Sum of Continuous Subarrays" (finding the shortest continuous subarray with sum k in a non-decreasing sequence). The code below counts the number of continuous subarrays with sum M using the same framework, followed by the solution to this specific problem. The condition that all values in the sequence are at least 1 is important. Since positive numbers mean the sum increases as the range expands and decreases as it shrinks, there is no need to move pointers backward.

The order of thinking about the solution is as follows:

1. Hold the sum of the range [l, r] in a variable (s).
2. Increment r by one step and add a[r].
3. If the sum exceeds M, move l forward while subtracting a[l] until the sum is at most M.
4. If the sum equals M, count it.

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

For "Sum of Continuous Subarrays", instead of counting occurrences, we find the start and end indices of the "shortest subarray with sum k". Using the same approach, update the shortest one every time a subarray with sum k is encountered.

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

Since l and r each move at most N times, the overall complexity is O(N). Although there is a while loop inside the for loop which might look like O(N²), l never moves backward. The total number of executions of the inner while loop does not exceed N. Space complexity is O(1). The problem page's limit is an array length of up to 1 million, so O(N²) is not feasible; this approach is necessary.

<details>
<summary>A bit more detail on why it is O(N)</summary>

The outer for loop runs N times. The inner while loop runs once every time l increases. Since l starts at 0 and increases up to a maximum of N without decreasing, the total number of executions of the while body is N in aggregate. Therefore, the total operations are approximately N + N = 2N, which is O(N). Counting the total sum rather than each individual loop iteration is called amortized analysis.

</details>

## 3. Sliding Window

長さの可変なウィンドウに関する代表的な問題は、프로그래머스「보석 쇼핑」（すべての種類の宝石を少なくとも 1 つ含む最も短い区間）と LeetCode 3「Longest Substring Without Repeating Characters」です。長さが K で固定されたウィンドウは、「連続した K 日分の和の最大値」といった問題の基本形であり、프로그래머스「연속 부분 수열 합의 개수」では長さを 1 から N まで変えながらすべての連続区間の和を見る問題なので、ウィンドウを動かすという発想そのままに適用できます。

### 固定長ウィンドウ

最初 K 個を加算しておき、1 つずらす際に新しく入ってくる値を加え、外れる値を引きます。毎回 K 個ずつ加算すると O(NK) ですが、このようにすれば O(N) になります。

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

### 長さ可変ウィンドウ

重複のない最も長い部分文字列は、ウィンドウの長さが決まっていません。右端 (r) を 1 つずつ増やしながら、すでにウィンドウ内にある文字が現れると左端 (l) をその文字の直前の位置に移動させます。各文字の最後の位置を辞書に保存しておきます。

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

`last[ch] >= l` の条件を見逃すと "abba" で失敗します。すでにウィンドウ外に出た古い位置に戻ってしまったり、l が逆方向に動いてしまうためです。時間は O(N)、空間は文字の種類数分なので O(min(N, 文字種類)) です。

## 4. 累積和

代表的な問題は 프로그래머스「연속 부분 수열 합의 개수」です。円形配列（最後から最初へ続く）において、連続部分配列の和がいくつあるか数えます。円形は配列を 2 つ連結して長さ 2N の配列とすれば通常の区間になります。長さ L、開始点 i の区間の和を各クエリごとに再計算すると O(L) なので全体で O(N³) です。代わりに先頭からの和を一度に用意しておきます。

prefix[i] = a[0] + ... + a[i-1] と定義すれば（prefix[0] = 0）、区間 [i, j] の和は prefix[j+1] - prefix[i] という 1 回の引き算で求められます。先頭に 0 を一つ追加しておけば、i が 0 の場合を別途処理する必要はありません。

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

前処理 O(N)、クエリ 1 つあたり O(1)、空間 O(N) です。円形配列の問題に適用すると以下のようになります。

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

区間の和を O(1) で求めるため全体は O(N²) です。問題ページの制約が要素数 1,000 以下なので十分です。区間に値を加算する作業が多い問題（프로그래머스「파괴되지 않은 건물」）では、累積和の逆運用である差分配列が登場します。詳細は [詳しく → 配列・文字列・ハッシュ](#/post/algo-array-hash) で扱っています。Python には `itertools.accumulate` が用意されており、`list(accumulate(a, initial=0))` で同じ配列を作成できます。

### 累積和 + ハッシュ：和が K である区間の個数

負数が混ざると 2 つの二ポインタでは通用しません（区間を広げても和が増えるとは保証されないため）。この場合は累積和と辞書を併用します。現在の累積和を s とすると、和が K である区間で終わる開始点は「累積和が s-K であった過去の時点」の個数です。過去の累積和の値を辞書でカウントしておきます。

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

`seen[0] = 1` を見逃すと最初から始まる区間を見落としてしまいます。時間 O(N)、空間 O(N) です。

<details>
<summary>コードが正しいか確認する方法</summary>

上記の関数は Python で実際に実行しました。二重 for ループによる完全探索の結果と、ランダムな入力 500 回ずつを比較して一致するか確認しました（区間の和の個数 2 つ、重複のない部分文字列）。代表例の出力値はコードのコメントに記述したものと一致しました。

</details>

## どれを選ぶべきか

| 状況 | 選ぶもの |
|---|---|
| ソートされた配列での 2 数の和 | 両端二ポインタ |
| 正数配列で和が条件を満たす連続区間 | 増やして減らす二ポインタ |
| 長さ K の固定区間の和・最大値 | スライディングウィンドウ |
| 区間の和のクエリが複数ある | 累積和 |
| 負数が含まれ、和が K である区間の個数 | 累積和 + ハッシュ |

## よくある間違い

- 二ポインタを使うのに配列がソートされていないか、負数が含まれていて単調性を仮定する。条件から確認する。
- 累積和配列の長さを N と捉えてインデックスを 1 つずらして使う。先頭に 0 を付けて長さ N+1 にすれば混乱しにくい。
- スライディングウィンドウでウィンドウが空になった場合 (l > r) を処理しない。
- 入力が大きい問題で `input()` を使うと遅い。`sys.stdin.readline` を使う。

同様のタイプには、[ソートと二分探索](#/post/algo-sort-search)(ソート済み配列という同じ前提を使用)、[配列・文字列・ハッシュ](#/post/algo-array-hash)(累積和＋ハッシュの辞書側)、[スタック・キュー・デッキ](#/post/algo-stack-queue)(デッキを用いてウィンドウ内の最大値を O(N) で維持する問題が続く)、[グリーディ法](#/post/algo-greedy) があります。ウィンドウではなくケース数を数える場合は、[動的計画法](#/post/algo-dp) に移行することが多いです。

## 根拠リンク

- Prefix sum (Wikipedia): https://en.wikipedia.org/wiki/Prefix_sum (累積和の定義と線形時間計算を確認)
- itertools.accumulate (Python 公式ドキュメント): https://docs.python.org/3/library/itertools.html (accumulate と initial オプションを確認)
- 使用した問題: 구명보트 https://school.programmers.co.kr/learn/courses/30/lessons/42885 · 연속된 부분 수열의 합 https://school.programmers.co.kr/learn/courses/30/lessons/178870 · 보석 쇼핑 https://school.programmers.co.kr/learn/courses/30/lessons/67258 · 연속 부분 수열 합의 개수 https://school.programmers.co.kr/learn/courses/30/lessons/131701 · 파괴되지 않은 건물 https://school.programmers.co.kr/learn/courses/30/lessons/92344 · LeetCode 3 https://leetcode.com/problems/longest-substring-without-repeating-characters/

← 概念マップへ (#/post/algo-map)