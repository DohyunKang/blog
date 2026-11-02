Recursion is a method where a function calls itself to reduce a problem into smaller, identical subproblems, while backtracking is an exploration strategy that tries options one by one using recursion and steps back when an option fails.

## What is Recursion?

A recursive function calls itself from within its own body. For this to terminate, two things are required:

- **Base case**: The scenario where the answer can be returned immediately without further division.
- **Recursive rule (recurrence relation)**: A rule that transforms a larger problem into a smaller, identical one step by step.

Factorial is the most common example. `5! = 5 × 4!` and `1! = 1`. Without a base case, or if the problem does not shrink with each call, the function will never terminate.

```python
def fact(n):
    if n <= 1:          # 종료 조건
        return 1
    return n * fact(n - 1)   # 한 단계 작은 같은 문제

print(fact(5))  # 120
```

## Viewing via Call Stack

When calling `fact(3)`, it calls `fact(2)`, which in turn calls `fact(1)`. Once the innermost call returns a value, the outer calls receive that value, multiply by their respective factors, and return the result. Calls are stacked up (stack), and they are resolved one by one as they unwind.

```
fact(3)
 └ fact(2)
    └ fact(1) → 1
    ← 2 * 1 = 2
 ← 3 * 2 = 6
```

Therefore, recursion has separate logic for "what to do when entering" and "what to do when exiting." The action of returning in backtracking is exactly what happens when exiting.

## Order of Thinking with Recursion

When looking at a problem, I ask myself these questions in this order:

1. Define the function's purpose in one sentence. (Example: `dfs(i)` = a function that processes everything from the i-th choice to the end)
2. What is the answer for the smallest case? That becomes the base case.
3. Can I solve it with the same function if I reduce the problem by one step? That is the recursive call.
4. Trust the call. Assume the inner call handles things correctly and write only your current step's logic.

Step 4 is the hardest. If you try to trace the inner calls all the way through in your head, you get stuck; it is easier to define what the function does and trust that definition.

## Things to Know Before Writing: Redundant Calls and Depth

If you implement Fibonacci as `fib(n) = fib(n-1) + fib(n-2)` directly, you recalculate the same values multiple times. Since calls branch roughly into two paths, it becomes unmanageable as n grows. Storing computed values (memoization) ensures each value is calculated only once. This topic continues in [Dynamic Programming → Detailed](#/post/algo-dp).

```python
def fib(n, memo={}):
    if n < 2:
        return n
    if n not in memo:
        memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

print(fib(50))  # 12586269025
```

There are also depth limits. Python has a limit on recursion depth (in my environment, `sys.getrecursionlimit()` was 1000); exceeding it raises a `RecursionError`. The Python documentation states this limit prevents infinite recursion from overflowing the C stack and killing the interpreter. While you can raise it with `setrecursionlimit`, doing so too high may cause crashes. In coding tests, if depth exceeds tens of thousands, it is safer to switch to iteration or an explicit stack.

## What is Backtracking?

Backtracking is a method where you choose an option, recursively explore all the way to the end with that choice, then undo the choice and try the next option. The structure is almost identical.

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

The core idea is to examine every case thoroughly but prune branches early when they are deemed impossible (pruning). The difference from brute force is this pruning. Since the pattern repeats "choose → recurse → backtrack," once you get used to it, you just swap out the problem logic.

## Representative Problems

I list only the number and name; I do not move the full text. All are Programmers problems.

- [Fatigue](https://school.programmers.co.kr/learn/courses/30/lessons/87946): Find the order of visiting dungeons that maximizes exploration by checking all permutations. This is a permutation backtracking problem.
- [Dictionary of Vowels](https://school.programmers.co.kr/learn/courses/30/lessons/84512): When listing words of length 5 or less made from vowels A, E, I, O, U in dictionary order, find the index of a given word. This is recursion that generates words one by one in dictionary order.
- [Menu Renewal](https://school.programmers.co.kr/learn/courses/30/lessons/72411): From an order list, extract menu combinations and find the most frequently ordered combination using hashing for combinations.
- [N-Queen](https://school.programmers.co.kr/learn/courses/30/lessons/12952): The number of ways to place N queens on an N×N board so that none attack each other.
- [Target Number](https://school.programmers.co.kr/learn/courses/30/lessons/43165): Attach +/- signs to each number and find the number of cases where the sum equals the target value. Since recursion branches into two for each number, it matches the "include or exclude" template below.

## Code

### Permutations: Order matters, no duplicates

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

### Combinations: Move forward only to prevent duplicates

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

Running the code confirmed that `itertools.permutations(range(1,5), 2)` and `itertools.combinations(range(1,6), 3)` produce results in the same order with identical values (12 items and 10 items, respectively).

### Include or Exclude (Subset Sum, Target Number)

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

The "Target Number" problem is essentially the same framework as "Exclude," but treating the "exclude" positions by subtracting (`s - a[i]`). I verified that running inputs like `[1, 1, 1, 1, 1], 3 → 5` and `[4, 1, 2, 1], 4 → 2` yields the same results.

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

Fatigue is simply a pruning condition added to the permutation framework: "Can I enter with this current fatigue level?" I verified that inputs like `k=80, [[80,20],[50,40],[30,10]] → 3` produce the expected output.

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

### N-Queens: One per Row, Check Columns and Diagonals

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

Running this for n from 1 to 9 yielded 1, 0, 0, 2, 10, 4, 40, 92, and 352 respectively. The value of 92 for n=8 matches the number of distinct solutions (92) listed in the Wikipedia article on the 8-Queens problem.

<details>
<summary>Detailed Explanation: Why check N-Queens this way</summary>

A queen attacks all squares in the same row, column, and diagonal. By placing only one queen per row as we iterate downwards, row conflicts are inherently avoided from the start. We are left to check only columns and the two diagonal directions.

- **Column**: A conflict occurs if `c` is the same.
- **↘ Diagonal**: Squares on the same diagonal have an equal `r - c`.
- **↙ Diagonal**: Squares on the same diagonal have an equal `r + c`.

Storing these three values in a set allows for conflict checking in a single operation, which is significantly faster than iterating through the entire board to compare. When backtracking, we must remove the value exactly as it was added; omitting even one removal causes subsequent branch explorations to fail silently.

</details>

## Time and Space Complexity

| Problem | Time | Space (Recursion Depth + Auxiliary) |
|---|---|---|
| Factorial | O(n) | O(n) |
| Fibonacci (no memoization) | Exponential | O(n) |
| Fibonacci (with memoization) | O(n) | O(n) |
| Permutations nPm enumeration | O(nPm × m) roughly | O(n) |
| Combinations nCm enumeration | O(nCm × m) roughly | O(m) |
| Subset Sum | O(2ⁿ) | O(n) |
| N-Queens | Close to worst-case O(n!) but pruning reduces the search space significantly | O(n) |

Problems requiring the enumeration of all results will inevitably take time proportional to the number of results. Backtracking is generally considered a solution approach for small inputs (N around 10–20). For larger N, different approaches are required. The extent to which pruning reduces the search space varies by problem; thus, the "significantly less" mentioned for N-Queens above refers only to the direction of improvement rather than a general formula.

## Common Mistakes

- **Forgetting to backtrack**: Without lines like `path.pop()` or `used[i] = False`, subsequent branches become contaminated.
- **Appending `path` directly to the results list**: Since `path` changes later, you must copy it using `tuple(path)` or `path[:]` before adding it.
- **Delayed termination condition**: Continuing to traverse even when a state is already impossible leads to Time Limit Exceeded (TLE). Prune as early as possible.
- **Mutable default arguments**: An empty dictionary passed as a default argument (e.g., `memo={}`) is shared across calls. While this was intentional in the Fibonacci example above, it often leads to unintended bugs elsewhere.

## Related Types

- **Traversing all cases on a graph**: [Details → Graph Search (BFS·DFS)](#/post/algo-graph-search)
- **When subproblems overlap**: [Details → Dynamic Programming](#/post/algo-dp)
- **Estimating time complexity**: [Details → Time and Space Complexity](#/post/algo-complexity)
- **Curious about call stack structure**: [Details → Stack and Queue](#/post/algo-stack-queue)

← [Concept Map](#/post/algo-map)

Related articles: [Graph Search](#/post/algo-graph-search) · [Dynamic Programming](#/post/algo-dp) · [Greedy Algorithms](#/post/algo-greedy)

## Reference Links

- Python documentation, sys.setrecursionlimit: https://docs.python.org/3/library/sys.html#sys.setrecursionlimit
- Wikipedia, Eight queens puzzle: https://en.wikipedia.org/wiki/Eight_queens_puzzle
- Problems used (Programmers): Fatigue https://school.programmers.co.kr/learn/courses/30/lessons/87946 · Dictionary of Vowels https://school.programmers.co.kr/learn/courses/30/lessons/84512 · Menu Renewal https://school.programmers.co.kr/learn/courses/30/lessons/72411 · N-Queen https://school.programmers.co.kr/learn/courses/30/lessons/12952 · Target Number https://school.programmers.co.kr/learn/courses/30/lessons/43165