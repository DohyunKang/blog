Recursion is a method where a function calls itself to reduce a problem into smaller, identical problems, while backtracking is an exploration that tries options one by one using recursion and retreats one step when an option fails.

## What is Recursion?

A recursive function calls itself from within. For this to terminate, two things are required:

- **Base case**: A condition where the answer can be obtained immediately without further division.
- **Recursive case**: A rule (like a recurrence relation) that transforms a larger problem into a smaller, identical one step by step.

Factorial is the most common example. `5! = 5 × 4!` and `1! = 1`. If there is no base case or the problem does not become smaller with each call, it will never terminate.

```python
def fact(n):
    if n <= 1:          # 종료 조건
        return 1
    return n * fact(n - 1)   # 한 단계 작은 같은 문제

print(fact(5))  # 120
```

## Viewing via Call Stack

When calling `fact(3)`, it calls `fact(2)`, which in turn calls `fact(1)`. When the innermost function returns a value, the outer functions receive that value, multiply it, and return it. Calls are stacked (stack), and they are resolved one by one upon returning.

```
fact(3)
 └ fact(2)
    └ fact(1) → 1
    ← 2 * 1 = 2
 ← 3 * 2 = 6
```

Therefore, recursion has separate logic for "what to do when entering" and "what to do when exiting". The action of retreating in backtracking is exactly what happens when exiting.

## Order of Thinking with Recursion

When looking at a problem, ask the following questions in this order:

1. Define in one sentence what this function does. (Example: `dfs(i)` = a function that tries all choices from the i-th choice to the end)
2. What is the answer for the smallest case? That becomes the base case.
3. Can it be solved with the same function if reduced by one step? That is the recursive call.
4. Trust the call. Assume the inner call handles things correctly and write only your current step.

Step 4 is the most difficult. If you try to follow the inner part all the way in your head, you get stuck; it's easier to define what the function does and trust that definition.

## Things to Know Before Writing: Redundant Calls and Depth

If you use Fibonacci as `fib(n) = fib(n-1) + fib(n-2)` directly, you recalculate the same values multiple times. Since calls branch roughly into two paths, it becomes unmanageable as n grows. Storing computed values once (memoization) ensures each value is calculated only once. This leads to [Dynamic Programming → details](#/post/algo-dp).

```python
def fib(n, memo={}):
    if n < 2:
        return n
    if n not in memo:
        memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

print(fib(50))  # 12586269025
```

There are also depth limits. Python has a limit on recursion depth (in my environment, `sys.getrecursionlimit()` was 1000); exceeding it raises a `RecursionError`. The Python documentation states this limit prevents infinite recursion from overflowing the C stack and killing the interpreter. While you can raise it with `setrecursionlimit`, warning is given that making it too high may cause crashes. In coding tests, if depth exceeds tens of thousands, it's safer to switch to iteration or an explicit stack.

## What is Backtracking?

Backtracking is a method where you choose one option, explore the rest recursively to the end, then undo the choice and try the next option. The structure is almost identical.

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

The core is to examine all cases exhaustively but prune branches early when they are deemed impossible (pruning). The difference from brute force is this pruning. Since the pattern repeats "choose → recurse → backtrack", once you get used to it, you just swap out the problem.

## Representative Problems

Only numbers and names are listed; full content is not moved. All are Programmers problems.

- [Fatigue](https://school.programmers.co.kr/learn/courses/30/lessons/87946): Find the case that explores the most by checking all orders of visiting dungeons. This is permutation backtracking.
- [Dictionary of Vowels](https://school.programmers.co.kr/learn/courses/30/lessons/84512): When listing words of length 5 or less made from vowels A, E, I, O, U in dictionary order, find the index of the given word. This is recursion that builds one by one in dictionary order.
- [Menu Renewal](https://school.programmers.co.kr/learn/courses/30/lessons/72411): From an order list, extract menu combinations and find the combination ordered most frequently together. Hash is attached to combinations enumeration.
- [N-Queen](https://school.programmers.co.kr/learn/courses/30/lessons/12952): The number of ways to place N queens on an N×N board so that none attack each other.
- [Target Number](https://school.programmers.co.kr/learn/courses/30/lessons/43165): Attach +/- signs to each number and find the number of cases where the sum equals the target value. Since recursion branches into two for each number, it matches the "include or exclude" template below.

## Code

### Permutation: Order matters, no duplicates

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

### Combination: Go forward only to prevent duplicates

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

実行して、`itertools.permutations(range(1,5), 2)` と `itertools.combinations(range(1,6), 3)` の結果と同じ順序で同じ値が出力されることを確認した（それぞれ 12 個、10 個）。

### 入れる・入れない（部分列の和、ターゲットナンバー）

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

ターゲットナンバーは、「入れない」位置を「引いた (`s - a[i]`）」という同じ枠組みである。プログラ머스の入出力例 `[1, 1, 1, 1, 1], 3 → 5` と `[4, 1, 2, 1], 4 → 2` を回して同じ値が得られることを確認した。

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

疲労度は、順列の枠組みに「今の疲労度で入ってよかろうか」という条件を剪定として付けたものである。入出力例 `k=80, [[80,20],[50,40],[30,10]] → 3` が得られることを確認した。

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

### N-Queens: 各行に一つずつ、列・対角線検査

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

n=1~9 について回してみたところ、1, 0, 0, 2, 10, 4, 40, 92, 352 が得られた。n=8 が 92 のことは、ウィキペディアの 8 クイーンの記事に書かれた値（互いに異なる解 92 個）と一致する。

<details>
<summary>詳しい解説: N-Queens の検査をなぜこれほど行うのか</summary>

クイーンは同じ行・列・対角線を攻撃する。行を一行ずつ下りて一つだけ置けば、行の衝突は最初からない。残るのは列と二方向の対角線である。

- 列: `c` が同じなら衝突。
- `↘` 対角線: 同じ対角線上のマスでは `r - c` が等しい。
- `↙` 対角線: 同じ対角線上のマスでは `r + c` が等しい。

この三つの値を集合に入れておけば、衝突検査が一度で済む。配列全体を回って比較する方式よりもはるかに速い。戻すときは入れた値を同じように引かなければならない。引くのを一つでも忘れると、次の枝の探索が静かに間違ってしまう。

</details>

## 時間・空間計算量

| 問題 | 時間 | 空間（呼び出し深さ + 補助） |
|---|---|---|
| ファクトリアル | O(n) | O(n) |
| フィボナッチ（メモなし） | 指数 | O(n) |
| フィボナッチ（メモあり） | O(n) | O(n) |
| 順列 nPm の列挙 | O(nPm × m) 内外 | O(n) |
| 組合せ nCm の列挙 | O(nCm × m) 内外 | O(m) |
| 部分列の和 | O(2ⁿ) | O(n) |
| N-Queens | 最悪 O(n!) に近いが剪定ではるかに少ないだけを見る | O(n) |

結果をすべて列挙しなければならない問題は、結果の数分には必ずかかる。バックトラッキングは入力が小さい場合（N が 10~20 内外）に使う解法とみなしてよい。N が大きければ別のアプローチが必要である。剪定がどれだけ減らすかは問題ごとに異なるため、上記 N-Queens の「はるかに少ない」は一般的な公式ではなく方向のみを述べたものである。

## よくある間違い

- 戻す処理を忘れる。`path.pop()` や `used[i] = False` の一行がないと次の枝が汚染される。
- 結果リストに `path` そのものを挿入する。後で変わるため、`tuple(path)` や `path[:]` でコピーして入れる必要がある。
- 終了条件が遅い。すでに不可能なのに最後まで下りてしまうと時間超過になる。できるだけ早く切る。
- 基本引数として渡した空の辞書 (`memo={}`) は呼び出し間で共有される。上記フィボナッチでは意図的にそうしたが、他の場所では意図しないバグになりやすい。

## 似たようなタイプ

- すべてのケースをグラフ上で回るとき: [詳しく → グラフ探索 (BFS・DFS)](#/post/algo-graph-search)
- 同じ部分問題が重なる場合: [詳しく → 動的計画法](#/post/algo-dp)
- 時間計算量を推測する方法: [詳しく → 時間・空間計算量](#/post/algo-complexity)
- 呼び出しスタック構造が気になるなら [詳しく → スタック・キュー](#/post/algo-stack-queue)

← [概念マップで](#/post/algo-map)

関連記事: [グラフ探索](#/post/algo-graph-search) · [動的計画法](#/post/algo-dp) · [グリーディ](#/post/algo-greedy)

## 根拠リンク

- Python 文書、sys.setrecursionlimit: https://docs.python.org/3/library/sys.html#sys.setrecursionlimit
- Wikipedia, Eight queens puzzle: https://en.wikipedia.org/wiki/Eight_queens_puzzle
- 使用した問題 (Programmers): 피로도 https://school.programmers.co.kr/learn/courses/30/lessons/87946 · 모음사전 https://school.programmers.co.kr/learn/courses/30/lessons/84512 · 메뉴 리뉴얼 https://school.programmers.co.kr/learn/courses/30/lessons/72411 · N-Queen https://school.programmers.co.kr/learn/courses/30/lessons/12952 · 타겟 넘버 https://school.programmers.co.kr/learn/courses/30/lessons/43165