# Two Pointers, Sliding Window, and Prefix Sums

There are many problems asking about "continuous subarrays" in arrays, such as finding how many subarrays have a sum of M or finding the subarray of length K with the maximum sum. The first thing that comes to mind is using nested for loops to iterate over all start and end points, which results in O(N²). Even if N is 10 million, this would require 100 billion operations, leading to a Time Limit Exceeded error. All three techniques discussed here reduce the complexity to O(N) by reusing previously calculated values without discarding them.

If you are unfamiliar with Big O notation, start with [Details → Time Complexity and Python Basics](#/post/algo-complexity).

## Three Types

| Type | Core Idea | When to Use |
|---|---|---|
| Two Pointers | Moves two indices in only one direction based on conditions | Finding sums in sorted arrays, subarrays satisfying sum conditions |
| Sliding Window | Shifts a window of fixed length (or length that expands/contracts based on conditions) by one position at a time | Sum or maximum value of subarrays of length K, longest substring without repeating characters |
| Prefix Sums | Precomputes sums from the beginning to answer range sum queries via subtraction | When multiple range sum queries are needed |

The distinction between two pointers and sliding windows is sometimes blurry. Since both move the boundaries of a range only to the right, they belong to the same family; however, "narrowing from both ends" is typically called two pointers, while "pushing a single interval forward" is called a sliding window.

## 1. Two Pointers: Narrowing from Both Ends

A representative problem is Programmers' "Lifeboat". Given a weight limit per boat where at most two people can board, find the minimum number of boats required to save everyone. The basic framework is similar to "finding pairs that sum to target". After sorting, place pointers at the left end (l) and right end (r). First, let's look at the template for finding pairs that sum to target:

- If the sum is less than X, move l to the right (we need a larger number).
- If the sum is greater than X, move r to the left.
- If they are equal, we found a pair.

Because the array is sorted, there is no need to reconsider candidates once discarded. This property breaks down in problems where sorting is not possible or where negative numbers mix such that the sum is not monotonic; do not use this technique in those cases.

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

The Lifeboat problem uses the same framework but with modified conditions. After sorting, examine the lightest person (l) and the heaviest person (r). If their combined weight is within the limit, they board together (move l); otherwise, the heaviest person cannot board with anyone else, so they go alone. In either case, the heaviest person (r) boards this boat and is removed from consideration.

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

Time complexity is O(N log N) for sorting + O(N) for search; space complexity is O(1). If the input is already sorted, only the search takes O(N) (Lifeboat requires sorting since the input is not sorted).

## 2. Two Pointers: Expanding and Shrinking Ranges

A representative problem is Programmers' "Sum of Continuous Subarrays" (finding the shortest continuous subarray with sum k in a non-decreasing sequence). The code below uses the same template to count "the number of continuous subarrays with sum M", followed by the solution for this specific problem. The condition that all values in the sequence are at least 1 is crucial. Since positive numbers cause the sum to increase as the range expands and decrease as it shrinks, there is no need to move pointers backward.

The order of thought for the solution is as follows:

1. Hold the sum of the range [l, r] in a single variable (s).
2. Increment r by one position and add a[r].
3. If the sum exceeds M, move l to the right while subtracting a[l] until the sum is less than or equal to M.
4. If the sum equals M, increment the count.

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

For "Sum of Continuous Subarrays", instead of counting occurrences, we find the start and end indices of the "shortest subarray with sum k". Using the same approach, update the shortest subarray every time a range with sum k is encountered.

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

Since l and r each move at most N times, the overall complexity is O(N). Although there is a while loop inside a for loop which might look like O(N²), l never moves backward. The total number of executions of the inner while loop does not exceed N. Space complexity is O(1). The problem page's limit allows array lengths up to 1 million, so an O(N²) approach is insufficient; this method is necessary.

<details>
<summary>More details on why it is O(N)</summary>

The outer for loop runs N times. The inner while loop runs once every time l increments. Since l starts at 0 and increases up to a maximum of N without decreasing, the total number of executions of the while body across all iterations is N. Therefore, the total operations are approximately N + N = 2N, which is O(N). This method of counting the total sum rather than each individual loop iteration is called amortized analysis.

</details>

## 3. Sliding Window

The representative problems for windows with variable lengths are Programmers "Jewelry Shopping" (the shortest segment containing at least one of each type of jewel) and LeetCode 3 "Longest Substring Without Repeating Characters". A window with a fixed length K is the basic form for problems like "Maximum Sum of Continuous K Days", while Programmers "Number of Continuous Subarray Sums" involves calculating sums for all continuous segments by varying the length from 1 to N, where the concept of sliding the window applies directly.

### Fixed-Length Window

Initially, sum the first K elements; when shifting one position, add the new incoming value and subtract the outgoing value. Recalculating the sum of K elements each time would take O(NK), but doing it this way achieves O(N).

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

### Variable-Length Window

The longest substring without repeating characters does not have a fixed window length. Increment the right end (r) one position at a time; if a character already exists in the window, move the left end (l) to the position immediately after the previous occurrence of that character. Store the last position of each character in a dictionary.

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

If you omit the condition `last[ch] >= l`, it will fail on "abba" because l would incorrectly revert to an old position outside the current window. The time complexity is O(N), and space complexity is O(min(N, number of character types)).

## 4. Prefix Sums

A representative problem is Programmers "Number of Continuous Subarray Sums". Count how many distinct sums exist for continuous subarrays in a circular array (where the last element connects to the first). By concatenating the array with itself to form an array of length 2N, circular segments become regular intervals. Calculating the sum of a segment with length L and starting point i fresh for each query takes O(L), leading to an overall complexity of O(N³). Instead, precompute the cumulative sums from the beginning.

Define `prefix[i] = a[0] + ... + a[i-1]` (with `prefix[0] = 0`). Then the sum of segment [i, j] is simply `prefix[j+1] - prefix[i]`, requiring only one subtraction. By appending a 0 at the beginning, you avoid special handling when i is 0.

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

Preprocessing takes O(N), each query takes O(1), and space usage is O(N). Applying this to circular array problems works as follows:

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

Since segment sums can be computed in O(1), the overall complexity becomes O(N²). This is sufficient given the problem constraints on the number of elements (up to 1,000) found on the problem page. For problems involving many updates adding values to segments (e.g., Programmers "Buildings That Aren't Destroyed"), a difference array using prefix sums in reverse is employed. Details are covered in [Array·String·Hash → Detailed](#/post/algo-array-hash). Python provides `itertools.accumulate`, allowing you to create the same array via `list(accumulate(a, initial=0))`.

### Prefix Sums + Hash: Counting Segments with Sum K

If negative numbers are mixed in, two-pointer approaches fail because increasing the segment length does not guarantee an increase in sum. In such cases, use prefix sums combined with a dictionary. If the current cumulative sum is s, the starting points of segments ending with sum K correspond to past positions where the cumulative sum was `s - K`. Store historical cumulative sum values in a dictionary.

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

Omitting `seen[0] = 1` causes you to miss segments starting from the beginning. Time complexity is O(N), space complexity is O(N).

<details>
<summary>How to Verify Code Correctness</summary>

The functions above were actually executed in Python. Their correctness was verified by comparing results against exhaustive search using nested loops and 500 random inputs for each case (counting sum segments and longest substrings without repeating characters). The output values for representative examples matched those noted in the code comments.

</details>

## Which One to Choose?

| Situation | Choice |
|---|---|
| Two-sum in a sorted array | Two pointers from both ends |
| Continuous segment with sum condition in an array of positive numbers | Shrinking/expanding two pointers |
| Sum or maximum of fixed-length K segments | Sliding window |
| Multiple queries for segment sums | Prefix sums |
| Counting segments with sum K when negatives exist | Prefix sums + hash map |

## Common Mistakes

- Assuming monotonicity when using two pointers even if the array isn't sorted or contains negative numbers. Always verify conditions first.
- Setting the prefix sum array length to N and misaligning indices by one position. Appending a 0 at the start to create an N+1 length array reduces confusion.
- Failing to handle cases where the window is empty (l > r) in sliding window implementations.
- Using `input()` for large inputs results in slow performance; use `sys.stdin.readline` instead.

Similar types include [Sorting and Binary Search](#/post/algo-sort-search)(which assumes a sorted array), [Arrays, Strings, and Hashes](#/post/algo-array-hash)(covering prefix sums and hash-based dictionary approaches), [Stacks, Queues, and Deques](#/post/algo-stack-queue)(where problems involving maintaining the maximum value in a sliding window using a deque follow), and [Greedy algorithms](#/post/algo-greedy). If instead of a window you're counting cases, it often leads to [Dynamic Programming](#/post/algo-dp).

## Reference Links

- Prefix sum (Wikipedia): https://en.wikipedia.org/wiki/Prefix_sum (definition of prefix sums and linear-time computation)
- itertools.accumulate (Python official documentation): https://docs.python.org/3/library/itertools.html (check the `accumulate` function and `initial` option)
- Problems used: Lifeboat https://school.programmers.co.kr/learn/courses/30/lessons/42885 · Sum of contiguous subarrays https://school.programmers.co.kr/learn/courses/30/lessons/178870 · Gem Shopping https://school.programmers.co.kr/learn/courses/30/lessons/67258 · Number of Contiguous Subarray Sums https://school.programmers.co.kr/learn/courses/30/lessons/131701 · Buildings That Aren't Destroyed https://school.programmers.co.kr/learn/courses/30/lessons/92344 · LeetCode 3 https://leetcode.com/problems/longest-substring-without-repeating-characters/

← Concept map (#/post/algo-map)