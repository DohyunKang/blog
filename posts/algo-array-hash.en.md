Array and string problems are mostly solved by the principle of "don't count the same thing multiple times; count it once and store it," where the storage location is either a prefix sum array or a hash structure (dict, set).

## What kind of problem is this?

In coding tests, arrays and strings are the most common inputs. Initially, one might think to compare everything using nested for-loops, but this leads to a time limit exceeded error when the input size grows. This type of problem is practice in reducing double loops into a single loop. There are two tools for doing so:

- **Prefix sum**: Pre-calculate sums from the beginning and compute range sums with a single subtraction.
- **Hash**: Store values as keys to immediately check "was this value present?" It's also used for counting frequencies.

[Why complexity matters is covered separately → Time & Space Complexity](#/post/algo-complexity). Here, we'll focus only on transforming "O(n²) into O(n)".

## Why are hashes fast?

Python's `dict` and `set` are hash tables. By inserting the key into a hash function, we directly find the storage location using the resulting value. Therefore, operations to look up or check existence by key have an average time complexity of O(1). Python's official documentation states the time complexities as follows:

| Data Type | Operation | Average | Worst Case |
|---|---|---|---|
| list | `x in l` | O(n) | O(n) |
| list | `l[k]` | O(1) | O(1) |
| dict | `key in d`, `d[key]` | O(1) | O(n) |
| set | `x in s` | O(1) | O(n) |

The documentation emphasizes that this O(1) is an average. It assumes the hash function is robust enough to minimize collisions and that keys are evenly distributed; if all keys produce the same hash value, it degrades to O(n). For typical coding test inputs, solving based on the average case is acceptable.

A key pitfall is using `in` with a list, which is O(n). Writing `if x in 리스트` inside a loop may look like a single line, but it actually performs nested iteration internally. In such cases, converting the list to a set is the first optimization step.

## Three Representative Problems

Only the problem number and title are listed here; the full details should be read from the Programmers problem pages.

| Problem | One-line Summary | Tool Used |
|---|---|---|
| 프로그래머스 파괴되지 않은 건물 (Programmers: Destroyed Building) | Involves many operations of adding and subtracting values across multiple rectangular regions on a grid | Prefix sum (add values only at the end of each range, then accumulate once at the end) |
| 프로그래머스 완주하지 못한 선수 (Programmers: Runners Who Did Not Finish) | Find the one missing person from the participant list compared to the finisher list (duplicates allowed) | Hash (Counter) |
| 프로그래머스 의상 (Programmers: Outfit) | Given outfit names and types, calculate the number of possible combinations where only one item per type is worn | Count items by type (Counter) |

All three problems were verified on their respective Programmers problem pages for titles and summaries. The explanations below use general reasons such as "many operations involved" or "long lists."

- [Destroyed Building](https://school.programmers.co.kr/learn/courses/30/lessons/92344)
- [Runners Who Did Not Finish](https://school.programmers.co.kr/learn/courses/30/lessons/42576)
- [Outfit](https://school.programmers.co.kr/learn/courses/30/lessons/42578)

## Approach to Solving

### 1. Prefix Sum: Avoid Re-summing for Each Range

This is the basic form. When multiple range sum queries are asked, naively summing each range with a loop results in O(n·m) when there are n elements and m queries. This becomes slow with many queries.

The improved approach is to pre-calculate cumulative sums from the beginning once before answering any query. If `p[i]` represents the sum of the first i elements, then the sum from index i to j is `p[j] - p[i-1]`. Building the prefix sum takes O(n), and each query takes O(1).

The "Destroyed Building" problem applies this idea in reverse: instead of updating the entire range for each attack or recovery event (which would be slow), we only record +v at the start of the range and -v at the position immediately after the end (difference array). After processing all operations, a single prefix sum pass yields the final value for each cell. Since the problem involves a 2D grid, values are recorded at the four corners, but the underlying method is identical to the 1D case. The code below demonstrates the 1D basic form.

### 2. Runners Who Did Not Finish: Think in Terms of Removing from the List

The initial thought might be to iterate through the finisher list for each participant and remove if found. Looking up in a list is O(n), and repeating this for all participants results in O(n²).

Since duplicate names exist, a set is insufficient. Using a `dict` (Counter) to count occurrences by name is correct: increment +1 for each participant and -1 for each finisher; the name with a remaining count at the end is the answer.

### 3. Outfit: Ignore Names, Focus on Counts per Type

The outfit name does not affect the number of combinations; only the count per category (e.g., headwear, glasses) matters. We use a `Counter` to tally the number of items for each category. For each category, you can either choose one of the available outfits or wear nothing at all, giving `(count + 1)` options. Since you must wear exactly one outfit per day, we subtract 1 from the case where you wear nothing.

All three problems follow the same structure: first scan through once to record information, then compute the answer directly using that data.

## Python Code

The code below has been run locally and verified to produce correct results for the example inputs. It has not yet been submitted on Programmers.

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

`Counter` is a subclass of `dict`, and according to the documentation, it can handle counts of zero or negative values. The `subtract()` method in the "Incomplete Race" solution correctly retains negative results. In contrast, the `c - d` operator only keeps positive values, so it should not be used in this solution. It is also convenient that accessing a missing key returns 0 instead of raising a `KeyError`.

<details>
<summary>Find two numbers whose sum equals a target (Two Sum type)</summary>

This type involves finding the positions of two numbers whose sum equals the target. A nested loop approach runs in O(n²). Using a hash map allows us to check in a single pass whether `target - x` has already been seen.

```python
def two_sum(nums, target):
    seen = {}                    # 값 -> 위치
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i

print(two_sum([2, 7, 11, 15], 9))   # [0, 1]
```

The order of operations—checking before inserting—is crucial. If you insert first and then check, you might use the same element twice. Running this locally produced the results shown above.
</details>

## Time and Space Complexity

| Solution | Time | Space | Notes |
|---|---|---|---|
| Range sum, adding each time | O(n·m) | O(1) | n = range length, m = number of queries |
| Range sum, prefix sums | O(n + m) | O(n) | n for building, m for queries |
| Range value addition, correction per range | O(n·m) | O(1) | m = number of operations |
| Range value addition, difference array | O(n + m) | O(n) | Record two entries per operation; accumulate at the end |
| Incomplete race, list removal | O(n²) | O(1) | O(n) each time we search |
| Incomplete race, Counter | O(n) | O(n) | Assumes average O(1) for hash operations |
| Outfits, Counter | O(n) | O(number of categories) | Scan outfits once and count by category |

Hash-based solutions trade memory for speed. You can think of it as converting time into space. The time complexity for hashes is based on the average case as described above.

## Common Mistakes

- **Prefix sum index**: In problems that count from 1, using 0-based indexing causes off-by-one errors. Prepending a `0` to `p` makes cases where `i-1` becomes 0 safe.
- **Using `in` on lists**: As mentioned earlier, this is O(n). Inside loops, replace with `set` or `dict`.
- **Using `set` for duplicate names**: `set` removes duplicates. Use `Counter` if counts matter.
- **Repeated string `+=`**: Continuously concatenating large strings can be slow. Collect in a list and use `" cant join()"` instead.
- **Modifying dict size during iteration**: Deleting or adding keys while iterating causes errors. Iterate over a copy or perform modifications after the loop.

## Related Problem Types

- Solutions that sort and narrow down from both ends are covered in [Two Pointers → Detailed](#/post/algo-two-pointer), which solves "two numbers with same sum" types differently.
- Finding values after sorting is covered in [Sorting & Search → Detailed](#/post/algo-sort-search).
- Structures that extract first-in or last-in items are covered in [Stack & Queue → Detailed](#/post/algo-stack-queue).
- Problems involving accumulation lead to [Dynamic Programming → Detailed](#/post/algo-dp).

## Reference Links

- [Python documentation: Time complexity of built-in types](https://docs.python.org/3/builtins/time-complexity.html)
- [Python documentation: collections — Counter](https://docs.python.org/3/library/collections.html)
- Problems used: [Destroying Buildings](https://school.programmers.co.kr/learn/courses/30/lessons/92344) · [Incomplete Race](https://school.programmers.co.kr/learn/courses/30/lessons/42576) · [Outfits](https://school.programmers.co.kr/learn/courses/30/lessons/42578) (Open problem pages to check title and type)

← Concept map ([Algorithm Map](#/post/algo-map))

Related posts: [Time & Space Complexity](#/post/algo-complexity) · [Two Pointers](#/post/algo-two-pointer) · [Stack & Queue](#/post/algo-stack-queue)