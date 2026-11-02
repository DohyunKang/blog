Sorting, searching, and complexity are chapters where you can score well with just one cheat sheet to memorize and a few hands-on practice sessions. For each sorting algorithm, pair its time complexity with its stability, and draw out the operations for binary search and hashing at least once. Check exam schedules and registration fees on the official site.

## What This Chapter Covers

There are four main parts.

| Part | Question Type |
|---|---|
| Time Complexity | Choosing Big-O notation for code or algorithms, ordering by O notation size |
| Sorting | Average/worst-case complexity per algorithm, choosing stable sorts, array state after one step |
| Searching | Number of comparisons in linear and binary search, prerequisites for binary search |
| Hashing | Hash function calculation, handling collisions |

Data structures are covered separately in the [data structure post](#/post/jb-data-structure), and Python-specific insights are in [Time Complexity and Python Basics](#/post/algo-complexity).

## Time Complexity

This is a method for describing how the number of operations increases as input size n grows. Ignore constant multipliers and lower-order terms; usually, we base it on the worst case. For exams, memorizing the order of magnitude makes things easier.

```
O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)
```

When presented with code, just look at the loop structure.

- Single loop: runs n times → O(n)
- Nested loops (two levels), both running n times → O(n²)
- Halving a variable each iteration (e.g., i = i // 2) → O(log n)
- Outer loop runs n times, inner halves each time → O(n log n)
- If loops are sequential, keep only the larger one. If O(n) is followed by O(n²), the result is O(n²)

Besides Big-O, also know the names of Ω (best case) and Θ (average/precise bound).

## Sorting Comparison Table

This is the most frequently tested table. Stability refers to whether the original order of equal elements is preserved.

| Algorithm | Average | Worst | Stable | One-Liner Description |
|---|---|---|---|---|
| Bubble | O(n²) | O(n²) | Stable | Compares and swaps adjacent elements; largest value moves to the end each pass |
| Selection | O(n²) | O(n²) | Unstable | Finds minimum among remaining and swaps with front position |
| Insertion | O(n²) | O(n²) | Stable | Inserts into already sorted prefix; nearly O(n) for almost-sorted input |
| Shell | Varies by gap | O(n²) | Unstable | Repeatedly applies insertion sort with decreasing gaps |
| Quick | O(n log n) | O(n²) | Unstable | Partitions around pivot recursively; worst case if first element is pivot on already sorted input |
| Merge | O(n log n) | O(n log n) | Stable | Splits in half, sorts each, then merges; requires auxiliary space |
| Heap | O(n log n) | O(n log n) | Unstable | Builds heap and extracts root one by one |
| Radix | O(d(n+k)) | Same | Stable | Distributes by digit; no comparisons needed |

Common exam points: comparison-based sorts cannot beat average O(n log n), merge and heap have worst case O(n log n), and quick sort hits O(n²) in the worst case.

### Memory Tips

- Group stable sorts as "버삽병기" (Bubble, Insertion, Merge, Radix); treat others as unstable.
- Algorithms with O(n log n) average are Quick (average), Merge, and Heap; among these, only Quick has a worst case of O(n²).

## Tracing Sorting by Hand

Exams often ask for "array state after one step." For example, sorting [5, 1, 4, 2, 8] in ascending order using bubble sort results in:

```
시작     5 1 4 2 8
1회전    1 4 2 5 8   (5가 끝으로 이동)
2회전    1 2 4 5 8   (4와 2 교환, 이후 정렬 완료)
```

For selection sort, the first pass swaps the minimum value (1) with the front element (5). Even with the same input, intermediate states differ per algorithm, so you must read both the step number and the algorithm name together.

<details>
<summary>Python Implementation and Verification (Bubble, Selection, Insertion, Merge, Quick)</summary>

The code below compares results against Python's built-in `sorted()` on 200 random arrays to verify correctness.

```python
def bubble(a):
    a = a[:]
    n = len(a)
    for i in range(n - 1):
        changed = False
        for j in range(n - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                changed = True
        if not changed:
            break
    return a

def selection(a):
    a = a[:]
    for i in range(len(a) - 1):
        m = min(range(i, len(a)), key=a.__getitem__)
        a[i], a[m] = a[m], a[i]
    return a

def insertion(a):
    a = a[:]
    for i in range(1, len(a)):
        key = a[i]
        j = i - 1
        while j >= 0 and a[j] > key:
            a[j + 1] = a[j]
            j -= 1
        a[j + 1] = key
    return a

def merge_sort(a):
    if len(a) <= 1:
        return a
    mid = len(a) // 2
    left, right = merge_sort(a[:mid]), merge_sort(a[mid:])
    out, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            out.append(left[i]); i += 1
        else:
            out.append(right[j]); j += 1
    return out + left[i:] + right[j:]

def quick(a):
    if len(a) <= 1:
        return a
    p = a[len(a) // 2]
    return (quick([x for x in a if x < p])
            + [x for x in a if x == p]
            + quick([x for x in a if x > p]))
```

In merge sort, using `<=` ensures left elements are extracted first when values are equal, preserving stability. In bubble sort, the `changed` flag allows early termination on already-sorted input, achieving best-case O(n).
</details>

## Searching

Linear search checks elements sequentially from the start. It works regardless of whether the data is sorted. Worst case: n comparisons; average case: approximately (n+1)/2 comparisons. Time complexity: O(n).

Binary search halves the search space by comparing with the middle element. The data must be sorted—a prerequisite frequently tested. Time complexity: O(log n). With 1,000 elements, comparisons end in at most 10 steps (2¹⁰ = 1,024).

```python
def binary_search(a, target):
    lo, hi = 0, len(a) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if a[mid] == target:
            return mid
        if a[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1

binary_search([1, 3, 5, 7, 9, 11], 7)   # 3
```

The function above verified correctness by including both present and absent values in a randomly sorted array. The order of binary search is: "if the middle value is greater than the target, go left; if smaller, go right." In exams, writing down how the interval [lo, hi] shrinks line by line will solve it. For practical usage in Python, see [Sorting and Binary Search](#/post/algo-sort-search).

## Hashing

By inserting keys into a hash function to directly calculate storage positions, lookup is achieved in O(1) on average. However, collisions occur when different keys map to the same position, slowing down performance; in the worst case, it degrades to O(n). Python's official documentation time complexity table also states that dict lookups/insertions/deletions and set's `in` operator are O(1) on average, while hashing becomes O(n) when all hashes collide. In contrast, list's `x in l` is a sequential search, thus O(n).

Hash function types are grouped by name and meaning:

| Method | Description |
|---|---|
| Division (Modulo) | Remainder of key divided by table size |
| Mid-Square | Square the key and use middle digits |
| Folding | Split key into parts, sum or XOR them |
| Digit Analysis | Use only evenly distributed digit positions from the key |
| Radix Transformation | Utilize values converted to a different base |

Collision resolution has two approaches:

- Open addressing: Find an empty slot and insert there. Includes linear probing, quadratic probing, and double hashing.
- Chaining (Separate chaining): Link items in the same slot using a linked list.

As an example with division method: inserting 12, 17, 22, and 7 into a table of size 5 all yield remainder 2. With chaining, these would be linked sequentially at index 2 (12 → 17 → 22 → 7). This scenario represents the worst case where hashing degrades to O(n).

## Common Mistakes

- Binary search is O(log n), but sorting must come first; it cannot be used on unsorted data.
- Many memorize only "average n log n" for quicksort and overlook the worst-case O(n²).
- Stability is independent of time complexity; even with similar averages (e.g., quicksort vs. mergesort), stability differs.
- Hashing is not "always O(1)" but rather O(1) on average.
- Even with nested loops, if the inner range halves each time, it's not O(n²).

← Concept map ([#/post/jb-map])

Related posts: [Data Structures](#/post/jb-data-structure) · [Time Complexity and Python Basics](#/post/algo-complexity) · [Arrays, Strings, Hashes](#/post/algo-array-hash)

## Reference Links

- Python official documentation, Time complexity of built-in types (dict·set average O(1), worst-case O(n); list `x in l` O(n)): https://docs.python.org/3/builtins/time-complexity.html
- Python official documentation, Sorting Techniques (Python sorting is stable and uses Timsort): https://docs.python.org/3/howto/sorting.html