Time complexity describes how quickly the number of operations grows as the input size increases. In coding tests, it is used to estimate whether a solution will pass within the time limit based solely on the input size.

## What is Time Complexity?

Even for the same problem, different code implementations take different amounts of time. Since measuring in seconds varies by computer, we only look at how the number of operations scales with the input size $n$. This is expressed using Big-O notation.

- Scanning an array once performs about $n$ operations: $O(n)$.
- A nested loop performs $n \times n$ operations: $O(n^2)$.
- Halving each time performs $\log n$ operations: $O(\log n)$.

Constant factors and lower-order terms are discarded. Both $3n+5$ and $100n$ are $O(n)$. Although there is actually a 100-fold difference, we group them together because the shape of the curve is the same as $n$ grows. Typically, we use the worst-case scenario as the standard.

## Estimating Based on Input Size

Coding test servers are generally assumed to perform tens of millions of simple operations per second in Python. This figure varies by grading environment, so it's an estimate rather than an exact value. However, this estimate is enough to determine which solutions are feasible for a given range of $n$.

| Maximum Value of $n$ | Approximate Allowed Complexity | What to Consider |
|---|---|---|
| 10~20 | $O(2^n)$, $O(n!)$ | Brute force, backtracking |
| 500 | $O(n^3)$ | Triple loops, Floyd-Warshall |
| 5,000 | $O(n^2)$ | Double loops, simple DP |
| 100,000~1,000,000 | $O(n \log n)$ | Sorting, binary search, heaps |
| 10,000,000 or more | $O(n)$ or $O(\log n)$ | Single pass, formulas |

The table is an estimate and not exact. However, if you write a double loop for an input size of 100,000, you'll immediately realize it involves $10^{10}$ operations and will result in a Time Limit Exceeded (TLE). Developing the habit of doing this calculation before writing code is the most valuable practice.

## Common Complexities

- $O(1)$: Accessing values by index, finding keys in a dictionary (average case).
- $O(\log n)$: Binary search on a sorted array. [Learn more → Sorting and Binary Search](#/post/algo-sort-search)
- $O(n)$: Scanning a list once, summing elements, finding the maximum value.
- $O(n \log n)$: Sorting. Python's `sort()` falls into this category.
- $O(n^2)$: Double loops comparing all pairs.
- $O(2^n)$: Considering all subsets where each element is either "included" or "excluded". [Learn more → Recursion and Backtracking](#/post/algo-recursion)

Space complexity is expressed similarly. If the additional memory used grows proportionally to the input size, it is $O(n)$. While time is usually the primary concern in coding tests, if you allocate an $n \times n$ DP table, memory usage also becomes a factor.

## Example: Two Sum

Consider a problem like "Find the positions of two elements in an array whose sum equals target." Using a double loop to check all pairs results in $O(n^2)$. However, by storing previously seen values in a dictionary and checking only if `target - x` already exists, you achieve $O(n)$.

```python
def two_sum_slow(a, t):          # O(n^2)
    n = len(a)
    for i in range(n):
        for j in range(i + 1, n):
            if a[i] + a[j] == t:
                return (i, j)

def two_sum_fast(a, t):          # O(n), 공간 O(n)
    seen = {}
    for i, x in enumerate(a):
        if t - x in seen:
            return (seen[t - x], i)
        seen[x] = i
```

Running the code directly shows that both approaches yield the same answer `(2998, 2999)` for inputs from `1..3000`. The slower version took 0.25 seconds at $n=5,000$, while the faster version took 0.025 seconds at $n=200,000$. Even though the input size was 40 times larger, the faster version was 10 times quicker. The absolute numbers are meaningless based on my PC, but the gap is significant. Reducing time often comes at the cost of memory; this trade-off is why hash maps are used. [Learn more → Arrays, Strings, and Hashing](#/post/algo-array-hash)

<details>
<summary>View Big-O definition as a formula</summary>

$f(n)$ being $O(g(n))$ means there exists a positive constant $c$ such that $f(n) \le c \cdot g(n)$ for sufficiently large $n$. For example, if $f(n) = 3n^2 + 10n + 7$, then for $n \ge 1$, $f(n) \le 20n^2$, so it is $O(n^2)$.

Even within the same $O(n)$ class, actual runtime can differ significantly if the work done per iteration varies. While constant factors are usually ignored in coding tests, they can become critical in problems with tight limits.
</details>

## Areas Where Python Can Be Slow

Complexity is not just an algorithmic issue; it also applies to data structure operations. In Python, there are several operations that appear to be a single line but are actually $O(n)$ internally.

| Task | Slow Approach | Fast Approach |
|---|---|---|
| Remove from front | `list.pop(0)` $O(n)$ | `deque.popleft()` $O(1)$ |
| Check existence | `x in list` $O(n)$ | `x in set` average $O(1)$ |
| String concatenation | Repeated `s += t` | Accumulate in list, then `"".join()` |
| Access middle element | `deque[i]` $O(n)$ | `list[i]` $O(1)$ |

According to the official `collections.deque` documentation, lists incur O(n) memory movement costs for `pop(0)` and `insert(0, v)`, whereas deques allow adding and removing elements from both ends in O(1). The same document also notes that deque index access is O(1) at the ends but O(n) in the middle. Use a deque if you need a queue, and use a list if you frequently access by index. [Details → Stack·Queue·Deque](#/post/algo-stack-queue)

The values I observed on my PC are as follows; execution time varies by environment, so refer only to the ratios.

| Experiment | Time |
|---|---|
| `pop(0)` 50,000 times on a list of 100,000 items | 0.36 seconds |
| `popleft()` 50,000 times on a deque of the same size | 0.001 seconds |
| `in` 2,000 times on a list of 20,000 items | 0.12 seconds |
| `in` 2,000 times on 20,000 sets | 0.0001 seconds |

Regarding strings, the Python official documentation (sequence types) states that repeatedly concatenating immutable sequences incurs quadratic time relative to the total length. It also advises collecting strings in a list and joining them once using `join`.

The documentation notes that `sort()` and `sorted()` perform stable sorts, meaning they preserve the original order of equal elements. This property is useful when sorting based on multiple criteria. You can simply remember that sorting itself is O(n log n).

## Basic Input/Output for Competitive Programming

In problems with large inputs, `input()` can be slow and cause time limit exceeded errors. Therefore, it's common to start like this:

```python
import sys
input = sys.stdin.readline

n, m = map(int, input().split())
arr = list(map(int, input().split()))
print(n, m, arr)
```

Testing with inputs `3 5` and `1 2 3` yields `3 5 [1, 2, 3]` as expected. Since `readline` reads the newline character at the end of the line, append `.rstrip()` when using the string as-is; this is unnecessary when converting to numbers.

In problems involving deep recursion, you often need to increase the default recursion limit with `sys.setrecursionlimit`. We will cover that in a separate article on recursion. The code snippets above are what I have directly tested here.

If output is large, do not call `print` repeatedly; instead, collect items in a list and output them at once using `"\n".join(...)`. This is based on the same reasoning as string concatenation.

<details>
<summary>When unsure how many integers appear per line</summary>

- One integer per line: `n = int(input())`
- Multiple integers per line into variables: `a, b = map(int, input().split())`
- Multiple integers per line into a list: `arr = list(map(int, input().split()))`
- Grid format with multiple lines: `grid = [list(map(int, input().split())) for _ in range(n)]`
- String containing numbers (e.g., `10110`): `list(map(int, input().rstrip()))`

With the `readline` method above, `int()` handles trailing newlines automatically, while string lines require `.rstrip()`.
</details>

## Common Misconceptions

- Low complexity always means fast: For very small n, a simple O(n²) algorithm can be faster than a complex O(n log n) one. This approximation holds when n is large.
- Nested loops always mean O(n²): If the inner loop runs a constant number of times, it's O(n). You must examine what the inner loop range depends on.
- All Python built-in functions are O(1): `in`, `list.index`, `list.count`, and slicing all take time proportional to the length. Don't assume they are lightweight just because they are one line.
- Average and worst cases are the same: The O(1) for dictionaries and sets refers to the average case; performance can degrade if hash collisions occur frequently.

The reason for using indexes in databases is similar: instead of scanning all data in O(n), you traverse a tree to find items in O(log n). This is covered in [Details → Index](#/post/db-index).

I plan to organize how algorithms are broadly categorized in a map article. [Details → Algorithm Type Map](#/post/algo-map)

Most time limit exceeded errors occur not because the code was written late, but because n was not considered before writing the code.

← Concept Map (#/post/algo-map)

Related articles: [Array·String·Hash](#/post/algo-array-hash) · [Sorting and Binary Search](#/post/algo-sort-search) · [Stack·Queue·Deque](#/post/algo-stack-queue)

## Reference Links

- Python official documentation, collections.deque (list's `pop(0)` is O(n), deque at both ends is O(1), middle index is O(n)): https://docs.python.org/3/library/collections.html#collections.deque
- Python official documentation, built-in type sequence items (immutable sequence concatenation is quadratic time, `join` recommended, `sort()` stable sort): https://docs.python.org/3/library/stdtypes.html