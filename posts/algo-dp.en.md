DP is a method where you break down a large problem into smaller ones, solve each small problem once, and reuse the answers to avoid solving the same small problems twice again. Almost everything comes down to defining "what constitutes a small problem" and "how to connect them."

## What is DP?

The name sounds difficult, but what it does is simple. According to Wikipedia, the term was coined by Richard Bellman in the early 1950s at RAND, referring to a method for solving structures where smaller decision problems are nested within larger ones. The "programming" in the name refers more to filling out a table (plan) rather than coding.

For DP to work, two conditions must be met:

| Condition | Meaning | Example |
|---|---|---|
| Optimal Substructure | The optimal solution to the large problem is constructed from the optimal solutions of smaller problems | A part of the shortest path is also a shortest path |
| Overlapping Subproblems | The same small problems recur multiple times | Calculating fib(5) calls fib(2) multiple times |

Without the second condition, it's just divide and conquer; without the first, you can't solve it with DP. The benefit of DP lies in ensuring that when overlaps exist, each is calculated only once.

## Two Implementations

It's easiest to understand using Fibonacci. Simply implementing it recursively leads to recalculating the same values repeatedly, which becomes impossible as n grows. There are two ways to fix this:

- Memoization (top-down): Keep the recursion as is, but store computed values and retrieve them for future use.
- Tabulation (bottom-up): Fill a table iteratively starting from the smallest cases and building up.

```python
from functools import lru_cache

def fib_memo(n):
    @lru_cache(None)
    def f(k):
        return k if k < 2 else f(k - 1) + f(k - 2)
    return f(n)

def fib_tab(n):
    dp = [0, 1] + [0] * max(0, n - 1)
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]

print(fib_memo(50), fib_tab(50))  # 12586269025 12586269025
```

In coding tests, tabulation is usually preferred because you don't need to worry about recursion depth limits (Python's default limit is around 1000). However, when you're unsure which states are actually needed, memoization is often easier to use since it only computes what's necessary.

## Approach Order

After identifying that a problem can be solved with DP, I wrote down the solution in this order:

1. State Definition: Write one sentence explaining what `dp[i]` represents. If you get stuck here, everything else will likely fail too.
2. Recurrence Relation: Express how to construct `dp[i]` from smaller states.
3. Base Case: Determine the smallest value the recurrence relation depends on (e.g., `dp[0]`).
4. Computation Order: Arrange the order so that values referenced by the recurrence are computed first.
5. Answer Location: Verify whether `dp[n]` is the answer or if it's the maximum/minimum value in the entire table.

"You can usually tell if a problem is DP when it asks for a maximum/minimum/count of possibilities, and a choice made earlier affects later decisions." When exhaustive search explodes exponentially but the number of states is small, suspect DP.

## Representative Problem 1: Knapsack (0/1 Knapsack)

Programmers' "Robbery" (Dynamic Programming) problem follows the same "steal or not to steal" structure. Each house has a certain amount of money, and adjacent houses cannot be robbed together; the goal is to find the maximum value that can be stolen. The constraint is "neighbor restriction" rather than "total weight," so the recurrence relation differs, but the core idea remains: decide whether to include or exclude each item to maximize total value. Below is the solution for the classic 0/1 knapsack problem (select items with given weights and values such that total weight does not exceed K while maximizing total value).

- State: `dp[c]` = maximum value achievable with weight limit c
- Recurrence Relation: When considering an item (w, v), update as `dp[c] = max(dp[c], dp[c-w] + v)`
- Note: Since each item can only be used once, iterate c from large to small.

```python
def knapsack(items, cap):
    dp = [0] * (cap + 1)
    for w, v in items:
        for c in range(cap, w - 1, -1):   # 거꾸로 돌아야 한 물건을 한 번만 쓴다
            dp[c] = max(dp[c], dp[c - w] + v)
    return dp[cap]

print(knapsack([(6, 13), (4, 8), (3, 6), (5, 12)], 7))  # 14
```

Time complexity O(N·K), space complexity O(K). Conversely, iterating c from small to large transforms the problem into an unbounded knapsack where items can be used multiple times. It was fascinating how changing just one direction alters the problem type.

## Representative Problem 2: Longest Increasing Subsequence (LIS)

Programmers' "Integer Triangle" (Dynamic Programming) serves as practice for defining the state based on ending position, such as "maximum value of a path ending at the i-th position." Below is the solution for the classic LIS problem (find the length of the longest increasing subsequence by selecting elements while maintaining their original order).

- State: `dp[i]` = length of the longest increasing subsequence ending at the i-th element
- Recurrence Relation: `dp[i] = max(dp[j] + 1)` where j < i and a[j] < a[i]; otherwise, it's 1
- Answer: The maximum value in the entire `dp` array. It's common to mistakenly assume the last element is the answer.

```python
import bisect

def lis_n2(a):
    dp = [1] * len(a)
    for i in range(len(a)):
        for j in range(i):
            if a[j] < a[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)

def lis_fast(a):
    tails = []
    for x in a:
        p = bisect.bisect_left(tails, x)
        if p == len(tails):
            tails.append(x)
        else:
            tails[p] = x
    return len(tails)

print(lis_n2([10, 20, 10, 30, 20, 50]), lis_fast([10, 20, 10, 30, 20, 50]))  # 4 4
```

The O(N²) solution has time complexity O(N²) and space complexity O(N). If N is as large as 1 million, you need the above `lis_fast`, which achieves O(N log N). The Wikipedia LIS article also describes an O(n log n) algorithm using binary search. `tails[k]` represents "the smallest ending value among all increasing subsequences of length k+1," and since this array remains sorted, binary search applies. Note that `tails` itself is not the actual LIS; it only matches the lengths.

<details>
<summary>Why lis_fast works (click to expand)</summary>

When encountering a new element x, find the first position in `tails` where the value is greater than or equal to x.

- If no such slot exists, x can be appended after the longest sequence, increasing the length by 1.
- If it does exist, replace the last value of that sequence with x. The smaller the last value, the more numbers can be appended afterward, so there is no penalty.

The reason for using `bisect_left` is to maintain "increase" (strictly greater) when duplicate values are encountered. For a non-decreasing sequence where equality or greater is acceptable, use `bisect_right`. We ran tests on arbitrary arrays of 300 elements to verify that `lis_n2` and `lis_fast` produce the same length.
</details>

## Representative Problem 3: Coins (Minimum Count)

Programmers' "Change" problem has the same coin structure but counts the number of combinations instead of finding the minimum count. The problem below is given a set of coins and asks for the minimum number of coins to make a sum of k (return -1 if impossible).

- State: `dp[i]` = minimum number of coins to make sum i
- Recurrence: `dp[i] = min(dp[i - c] + 1)` (for all coin denominations c)
- Initialization: `dp[0] = 0`, others set to a very large value

```python
def coin(coins, k):
    INF = 10**9
    dp = [0] + [INF] * k
    for i in range(1, k + 1):
        for c in coins:
            if i >= c and dp[i - c] + 1 < dp[i]:
                dp[i] = dp[i - c] + 1
    return dp[k] if dp[k] < INF else -1

print(coin([1, 5, 12], 15), coin([2], 3))  # 3 -1
```

Time complexity O(k × number of coin types), space complexity O(k). When making 15 with coins [1, 5, 12], a greedy approach starting from the largest coin yields 12+1+1+1 (4 coins), but the correct answer is 5+5+5 (3 coins). This is a classic example where greedy fails and DP is required, so it should be reviewed alongside [Greedy](#/post/algo-greedy) to distinguish between them.

<details>
<summary>Bonus: LCS (Longest Common Subsequence of Two Strings)</summary>

This type involves filling a 2D table, similar to Programmers' "Shortest Path Home" (Dynamic Programming). LCS also uses a 2D table. `dp[i][j]` represents the length of the LCS between the first i characters of string a and the first j characters of string b. If the two characters match, `dp[i-1][j-1] + 1`; otherwise, `max(dp[i-1][j], dp[i][j-1])`.

```python
def lcs(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[-1][-1]

print(lcs("ACAYKP", "CAPCAK"))  # 4
```

Time and space complexity O(N·M). Space can be reduced to O(M) by using only a single row.
</details>

## How to Analyze Complexity

The time complexity of DP is generally (number of states) × (number of transitions required to compute one state). For the knapsack problem, it's K states × N items; for coins, it's k states × number of coin types. Use this to estimate whether "this solution will pass within the time limit." Space complexity can often be reduced from an entire array to just a few variables if the recurrence relation only depends on the previous few slots. The Wikipedia Fibonacci example also notes that space can be reduced to a constant by keeping only the necessary values.

## Common Mistakes

- Vague state definition: Writing "dp[i] is the answer up to i" alone doesn't yield a valid recurrence. Conditions like "ending at the i-th element" or "exactly making i won" must be specified.
- Forgetting initialization: For minimum value problems, use INF; for counting combinations, set `dp[0] = 1` or other values appropriate to the problem.
- Incorrect iteration direction in knapsack: As mentioned above, 0/1 knapsack requires reverse iteration.
- Assuming DP is always the solution: Many problems can be solved with Greedy or [BFS/DFS](#/post/algo-graph-search). First check if subproblems overlap.
- Hitting recursion depth limits in memoized recursion: In Python, increase the limit with `sys.setrecursionlimit` or switch to a bottom-up approach if the depth is too large.

## Similar Types

- [Recursion](#/post/algo-recursion): The root of memoized DP. Familiarity with recursion makes top-down recurrence relations easier.
- [Greedy](#/post/algo-greedy): Problems like the coin problem often present criteria to distinguish between Greedy and DP approaches.
- [Shortest Path](#/post/algo-shortest-path): The property that a part of the shortest path is also a shortest path (optimal substructure) is directly applicable.
- [Complexity](#/post/algo-complexity): Used when estimating time based on (number of states) × (transitions).

← Concept map to [Algorithm Map](#/post/algo-map)

## Reference Links

- [Dynamic programming — Wikipedia](https://en.wikipedia.org/wiki/Dynamic_programming): Bellman's origin, optimal substructure and overlapping subproblems, memoization and tabulation, space-saving examples
- [Longest increasing subsequence — Wikipedia](https://en.wikipedia.org/wiki/Longest_increasing_subsequence): O(n log n) algorithm and the meaning of the tails array
- Programmers [Robbery](https://school.programmers.co.kr/learn/courses/30/lessons/42897) / [Integer Triangle](https://school.programmers.co.kr/learn/courses/30/lessons/43105) / [Change](https://school.programmers.co.kr/learn/courses/30/lessons/12907) / [Path to School](https://school.programmers.co.kr/learn/courses/30/lessons/42898): Check the title and type (dynamic programming) on the problem page