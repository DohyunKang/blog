Arrays and strings problems are mostly solved by "don't count the same thing again; count it once and store it," where the storage location is either a prefix sum array or a hash (dict, set).

## What kind of problem is this?

The most common inputs encountered in coding tests are arrays and strings. Initially, one might think to compare everything using nested for loops, but this leads to a time limit exceeded error when the input size grows. This type of problem is practice in reducing a double loop into a single loop. There are two tools for doing so:

- Prefix sum: Pre-calculate sums from the beginning and compute range sums with a single subtraction.
- Hash: Store values as keys to immediately check "was this value present?" It's also used for counting occurrences.

[Why complexity matters → Time & Space Complexity](#/post/algo-complexity) is covered separately. Here, we'll just focus on transforming "O(n²) into O(n)".

## Why are hashes fast?

Python's `dict` and `set` are hash tables. By inserting the key into a hash function, you can directly find the storage location using the resulting value. Therefore, operations to look up or check for a key have an average time complexity of O(1). The Python official documentation's table of time complexities is as follows:

| Data Type | Operation | Average | Worst Case |
|---|---|---|---|
| list | `x in l` | O(n) | O(n) |
| list | `l[k]` | O(1) | O(1) |
| dict | `key in d`, `d[key]` | O(1) | O(n) |
| set | `x in s` | O(1) | O(n) |

The documentation emphasizes that this O(1) is an average. This value assumes the hash function is robust enough to rarely cause collisions and that keys are evenly distributed. If all keys produce the same hash value, it becomes O(n). For typical coding test inputs, you can solve assuming the average case.

Using `in` on a list takes O(n), which is a common pitfall. Using `if x in 리스트` inside a loop looks like one line but internally performs a double iteration. In such cases, converting the list to a set is the first modification.

## Three Representative Problems

I'll only write down the problem number and title. The full content should be read from the Programmers problem page.

| Problem | One-line Summary | Tool Used |
|---|---|---|
| 프로그래머스 파괴되지 않은 건물 (Programmers: Destroyed Building) | Many operations involve adding and subtracting values across multiple rectangular grid intervals | Prefix sum (store values to add at the end of the interval and accumulate once at the end) |
| 프로그래머스 완주하지 못한 선수 (Programmers: Missing Runner) | Find the one person missing from the runner list given participant and finisher lists (duplicates allowed) | Hash (Counter) |
| 프로그래머스 의상 (Programmers: Outfit) | Given outfit names and types, find the number of possible combinations when wearing at most one item per type | Count occurrences by type (Counter) |

I checked the titles and summaries on the Programmers problem pages for all three. The explanations below use general reasons such as "many operations involved" or "lists can be long".

- [Destroyed Building](https://school.programmers.co.kr/learn/courses/30/lessons/92344)
- [Missing Runner](https://school.programmers.co.kr/learn/courses/30/lessons/42576)
- [Outfit](https://school.programmers.co.kr/learn/courses/30/lessons/42578)

## Reasoning Steps for Solutions

### 1. Prefix Sum: Don't re-sum each interval

First, the basic case. When asked to compute range sums multiple times, summing the interval with a loop every time the query arrives results in O(n·m) when the interval length is n and there are m queries. This becomes slow if there are many queries.

Reframing it: accumulate from the beginning once before answering any query. If `p[i]` represents "the sum of the first i elements," then the range sum from index i to j is `p[j] - p[i-1]`. Accumulating takes O(n), and each query takes O(1).

The Destroyed Building problem reverses this concept. Since modifying the entire interval every time an attack or recovery occurs is slow, only record +v at the start of the interval and -v at the cell immediately after the end (difference array). After recording all operations, compute the prefix sum once to get the final value for each cell. The problem involves a 2D grid, so values are recorded at the four corners, but the method is the same as in 1D. The code below shows the 1D basic version.

### 2. Missing Runner: Think of removing one by one from the list

The first thought is to search through the finisher list for each participant and remove them if found. Looking up in a list takes O(n), and repeating this for the number of participants results in O(n²).

Since there can be duplicate names, a set is insufficient. Using a dict (Counter) to count people by name is correct. Increment +1 for participant names and -1 for finisher names; the name with a remaining count at the end is the answer.

### 3. Outfit: Names don't matter; only look at counts per type

衣装の名前は組み合わせの数に影響しません。重要なのは種類（頭飾り、眼鏡など）ごとの個数です。種類ごとに Counter で個数をカウントします。ある種類のうちから選ぶのは「その種類の衣装の一つ」または「何も着ない」の 2 つなので、(個数 + 1) の選択肢があります。各々について (個数 + 1) を掛け合わせ、毎日 1 着は着用しなければならないため、何も着ない場合は 1 を引きます。

3 つの問題もすべて同じ枠組みです。まず一度情報を確認して記録し、その情報を使って答えを導き出します。

## Python コード

以下のコードはすべて実際に実行して、サンプル入力で正しい結果が得られることを確認しました。Programmers に実際に提出したわけではありません。

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

Counter は dict のサブクラスであり、ドキュメントによると個数が 0 または負でも問題ありません。「完走しなかった選手」の解説にある `subtract()` は負の結果をそのまま残すため適切です。逆に `c - d` オペレーターは正の数しか残さないため、この解法では使用できません。存在しないキーを検索しても KeyError ではなく 0 が返されるのも便利です。

<details>
<summary>ハッシュを使って 2 つの数の和を見つける（Two Sum タイプ）</summary>

「target になる 2 つの数の位置」を見つけるタイプです。二重 for ループは O(n²) です。ハッシュを使えば、一度スキャンして `target - x` がすでに確認した値に含まれているかだけをチェックできます。

```python
def two_sum(nums, target):
    seen = {}                    # 값 -> 위치
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i

print(two_sum([2, 7, 11, 15], 9))   # [0, 1]
```

確認してから追加する順序が重要です。追加してから確認すると、同じ要素を 2 回使用してしまう可能性があります。実際に実行して上記の結果が出ました。
</details>

## 時間・空間計算量

| 解法 | 時間 | 空間 | 備考 |
|---|---|---|---|
| 区間和、毎回足し算 | O(n·m) | O(1) | n=区間の長さ、m=質問数 |
| 区間和、累積和 | O(n + m) | O(n) | 蓄積に n、質問 m 回 |
| 区間値の加算、各区間で修正 | O(n·m) | O(1) | m=操作数 |
| 区間値の加算、差分配列 | O(n + m) | O(n) | 各操作で 2 つの要素を書き込み、最後に累積 |
| 完走選手、リスト削除 | O(n²) | O(1) | 探すたびに O(n) |
| 完走選手、Counter | O(n) | O(n) | ハッシュの平均 O(1) を仮定 |
| 衣装、Counter | O(n) | O(種類数) | 衣装を一度スキャンして種類別にカウント |

ハッシュを使う解法は共通して時間を削減する代わりにメモリを使用します。時間を空間に変換したと考えることができます。ハッシュの時間は前述の通り平均値に基づいています。

## よくある間違い

- 累積和のインデックス：1 から数える問題なのに 0 から始めてずれてしまうことがあります。`p` の先頭に 0 を入れておけば、`i-1` が 0 になる場合でも安全です。
- リストに `in`：前述のように O(n) です。ループ内であれば set や dict に変更します。
- 同名人物への set の使用：set は重複を削除します。個数が重要なら Counter を使います。
- 文字列の `+=` 反復：大きな文字列を続けて連結すると遅くなる可能性があります。リストにまとめて `"".join()` するのが一般的な方法です。
- dict を巡回中にサイズを変更する：巡回中にキーを削除したり追加したりするとエラーになります。コピーを回すか、後で一度に削除します。

## 似たようなタイプ

- ソートして両端から狭めていく解法は [詳細 → ツーポインタ](#/post/algo-two-pointer) で、同じ 2 つの数の和などの問題を別の方法で扱います。
- ソートした後に値を探すのは [詳細 → ソート・検索](#/post/algo-sort-search)。
- 先に入ったものを先に外すか、後から入ったものを先に外す構造は [詳細 → スタック・キュー](#/post/algo-stack-queue)。
- 累積して蓄積する発想が繰り返される問題は [詳細 → 動的計画法](#/post/algo-dp) に繋がります。

## 参照リンク

- [Python ドキュメント: ビルトイン型の時間計算量](https://docs.python.org/3/builtins/time-complexity.html)
- [Python ドキュメント: collections — Counter](https://docs.python.org/3/library/collections.html)
- 使用した問題：[破壊되지 않은 건물](https://school.programmers.co.kr/learn/courses/30/lessons/92344) · [완주하지 못한 선수](https://school.programmers.co.kr/learn/courses/30/lessons/42576) · [의상](https://school.programmers.co.kr/learn/courses/30/lessons/42578)（問題ページを開いてタイトル・タイプを確認）

← 概念マップで ([アルゴリズムマップ](#/post/algo-map))

関連記事：[時間・空間計算量](#/post/algo-complexity) · [2 本指ポインタ](#/post/algo-two-pointer) · [スタック・キュー](#/post/algo-stack-queue)