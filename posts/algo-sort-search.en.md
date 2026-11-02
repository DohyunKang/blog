Sorting is almost entirely handled by built-in functions in Python, and binary search is used to find elements by discarding half of the data at a time when sorted data is available. Problems asking "how much is possible" are also solved using binary search (parametric search).

## From Sorting

It is rare to implement sorting algorithms directly in coding tests. You can use `sorted()` or `list.sort()`, and the Python documentation states that this sort is Timsort and is stable. A stable sort means that elements with the same key maintain their original relative order.

The principle is still worth understanding. The time complexity follows the Big-O standard discussed in [Time Complexity Summary](#/post/algo-complexity).

| Method | Average | Worst Case | Memory |
|---|---|---|---|
| Bubble, Selection, Insertion | O(N²) | O(N²) | Easy to implement but not suitable for large N. Insertion is fast on nearly sorted data. |
| Merge Sort | O(N log N) | O(N log N) | Divides in half, sorts each part, and merges them. Stable, requires additional memory. |
| Quick Sort | O(N log N) | O(N²) | Partitions around a pivot value. Poor pivot choice leads to worst-case performance. |
| Counting Sort | O(N + K) | O(N + K) | Only when the value range K is small. Does not involve comparisons. |

Built-in sorting can be considered O(N log N). Python handles N up to 1 million without issues.

The most common practical approach is providing a key. To sort strings by "length first, then lexicographically if lengths are equal," you provide a tuple as the key.

```python
words = ["but", "i", "wont", "hesitate", "no", "more", "it"]
print(sorted(words, key=lambda w: (len(w), w)))
# ['i', 'it', 'no', 'but', 'more', 'wont', 'hesitate']
```

For descending order, use `reverse=True`. If you want to sort only numeric keys in descending order, pass `-x` as the key. The documentation also mentions that since it's a stable sort, you can "sort by a secondary key first, then re-sort by the primary key."

<details>
<summary>Detailed explanation: Implementing Merge Sort manually</summary>

This is for verifying the principle. Split the list in half and merge two sorted lists by comparing from the front. If elements are equal, inserting from the left ensures stability.

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

We compared `sorted()` with results on 300 random lists to verify they match. The depth of splitting is log N, and the cost of merging at each level is N, resulting in O(N log N). Space complexity is O(N).

</details>

## Binary Search

When finding a value in a sorted array, check the middle: if the target is larger, keep only the right half; if smaller, keep only the left half. Reducing by half each time yields O(log N). Even with 10 million elements, it finishes in about 20–30 steps.

There is one condition: the data must be sorted (or there must be monotonicity, meaning "from some point onward, the condition becomes true"). This condition becomes even more important in parametric search.

Implementing it manually often leads to errors at boundaries. Therefore, it's easier to implement based on "the first position where x or greater appears." This is the lower bound and corresponds to Python's `bisect_left`.

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

This matches the explanation in the `bisect` documentation. `bisect_left` returns the insertion point before equal values, while `bisect_right` returns the insertion point after equal values. In `[1, 2, 2, 2, 3]`, inserting 2 yields positions 1 and 4 respectively. Thus, the count of value x is calculated as `bisect_right(a, x) - bisect_left(a, x)`. We verified that these two functions return results consistent with `bisect` on randomly sorted lists.

One thing to note: `bisect` is not a function that "finds" a value but rather provides the "insertion position." You must directly compare the element at that position to check if the value exists.

## Parametric Search

This approach uses binary search on the answer itself. It's used for problems of the type "find the maximum (or minimum) value satisfying a condition." The structure is almost identical.

1. Define the candidate range for the answer (e.g., from 0 to the height of the tallest tree).
2. Create a function that checks whether a given candidate satisfies the condition in O(N).
3. Narrow the range toward larger (or smaller) values as much as possible.

The enabling condition is monotonicity. If cutting at height H is feasible, then any lower height must also be feasible. Without this, binary search cannot be applied.

If the check takes O(N) and the candidate range is R, the complexity is O(N log R). Even with a range of 2 billion (log ≈ 31), it's worthwhile if N is up to 1 million.

## Representative Problems

Only problem numbers and names are listed; refer to each site for details. All are from Programmers.

- [K-th Number](https://school.programmers.co.kr/learn/courses/30/lessons/42748): Cut the array into segments, sort them, and extract the k-th value. This is the most basic problem using built-in sorting directly.
- [Largest Number](https://school.programmers.co.kr/learn/courses/30/lessons/42746): Concatenate numbers to form the largest possible number. The sorting criterion explicitly asks to compare by concatenating two numbers as `a+b` and `b+a`.
- [Rank Search](https://school.programmers.co.kr/learn/courses/30/lessons/72412): Sort score lists by condition and count occurrences using binary search for each query. It's a practice exercise for finding "count of x or greater" using `bisect`.
- [Bridge Construction](https://school.programmers.co.kr/learn/courses/30/lessons/43236): Remove n rocks to maximize the minimum distance between remaining rocks. This is a parametric search (maximization) problem where we perform binary search on the distance threshold.
- [Passport Control](https://school.programmers.co.kr/learn/courses/30/lessons/43238): Parametric search (minimization). Perform binary search on time T.

## Reasoning Steps for Solution

1. Does sorting make it easier? If yes, sort and examine only adjacent elements; otherwise, it's a different type of problem.
2. Do we just need to find something in sorted data? Use binary search or `bisect`.
3. Are we asked for the "maximum/minimum value" of something, and can we determine feasibility in O(N) once a value is chosen? This indicates parametric search.
4. Define a range (lo, hi), decide whether the answer lies within or outside the interval first, then adjust mid calculation and updates. When finding a maximum, use `mid = (lo + hi + 1) // 2` with ceiling to avoid infinite loops.

## Code

For the type of problem "determining the cut height H", the wood obtained when cutting at height H is the sum of `(height - H)` for all trees taller than H. We find the maximum H such that the required amount M or more is obtained.

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

For the type "cut into pieces of length L to make K or more", use the same framework but change the check to `sum(l // mid)` and start `lo` from 1.

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

Passport Control is the opposite: since it seeks a "minimum value", use floor for mid instead of ceiling. The number of people processable at time T is `sum(T // t)`.

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

Bridge Construction seeks a maximum value, so use ceiling for mid, and the check counts how many rocks need to be moved starting from the front if we shift rocks closer than the threshold. It's feasible if the count of moved rocks is less than n.

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

The sorting criterion for Largest Number is provided using `cmp_to_key`.

```python
from functools import cmp_to_key

def biggest(nums):
    s = sorted(map(str, nums),
               key=cmp_to_key(lambda a, b: (a + b < b + a) - (a + b > b + a)))
    return str(int("".join(s)))             # 앞의 0이 몰려 "000"이 되는 경우 처리

print(biggest([6, 10, 2]))                  # 6210
print(biggest([3, 30, 34, 5, 9]))           # 9534330
```

All the above code snippets were executed directly to confirm they produce correct results for example values. The outputs for Passport Control (6, [7, 10] → 28) and Bridge Construction (25, [2, 14, 11, 21, 17], 2 → 4) match the input/output examples on the Programmers problem page. These were not submitted to the problem site for official grading.

## Time and Space Complexity

| Operation | Time | Space |
|---|---|---|
| `sorted()` / `list.sort()` | O(N log N) | `sort()` is in-place; `sorted()` creates a copy O(N) |
| Binary search (on sorted data) | O(log N) | O(1) |
| Sorting + N binary searches | O(N log N) | O(1)~O(N) |
| Parametric search | O(N log R) | O(1) |

`bisect.insort` has a find time of O(log N), but inserting into the list takes O(N), making the overall complexity O(N) (as documented). If repeated insertions are needed, consider other data structures.

## Common Mistakes

- Performing binary search on an unsorted array. It may return incorrect answers without raising errors, making it hard to detect.
- Using floor for mid while updating with `lo = mid`, leading to an infinite loop.
- Setting the upper bound (hi) of the parametric search range too small.
- Using binary search when unnecessary; cases often simplify with `set` or `dict`.

## Similar Types

- Approaches narrowing down from both ends after sorting are covered in [Two Pointers](#/post/algo-two-pointer).
- Thinking in terms of "reducing possible values based on conditions" appears alongside [Greedy](#/post/algo-greedy). The check function in parametric search is often greedy.
- When value ranges are small, counting with [arrays or hash maps](#/post/algo-array-hash) is simpler than binary search.
- For optimization problems lacking monotonicity, move towards [DP](#/post/algo-dp).

← Concept map to [Algorithm Type Map](#/post/algo-map)

## Reference Links

- Python documentation, Sorting Techniques: https://docs.python.org/3/howto/sorting.html
- Python documentation, bisect: https://docs.python.org/3/library/bisect.html
- Problems used (Programmers): K-th Number https://school.programmers.co.kr/learn/courses/30/lessons/42748 · Largest Number https://school.programmers.co.kr/learn/courses/30/lessons/42746 · Rank Search https://school.programmers.co.kr/learn/courses/30/lessons/72412 · Stepping Stones https://school.programmers.co.kr/learn/courses/30/lessons/43236 · Immigration Checkpoint https://school.programmers.co.kr/learn/courses/30/lessons/43238