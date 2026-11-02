Tree problems are half about whether you can directly write the traversal order in code, and heaps are tools for solving "repeatedly extract the smallest (or largest) element" problems.

## What is a Tree?

A tree is a structure where nodes are connected via parent-child relationships. The top node is the root, and a node with no children is a leaf. There are no cycles, and there is exactly one path from the root to any node. A binary tree is defined as having at most two children per node. In coding tests, trees are almost always binary trees or general trees given as edge lists. General trees are typically stored using adjacency lists and solved similarly to [graph traversal](#/post/algo-graph-search).

You only need to know a few terms:

| Term | Meaning |
|---|---|
| Depth | Number of edges from the root to that node |
| Height | Depth from the root to the deepest leaf (whether counted by nodes or edges varies by problem, so check accordingly) |
| Subtree | The entire structure below a given node when treated as the root |

Almost all tree problems stem from the property that "a subtree is also a tree." You can solve the left subtree with the same function, solve the right subtree, and combine them. That's why they pair well with [recursion](#/post/algo-recursion).

## Binary Tree Traversal

Traversal is categorized by when the root is visited.

| Traversal | Order | Usage |
|---|---|---|
| Preorder | Root → Left → Right | Copying a tree, printing structure |
| Inorder | Left → Root → Right | Sorted order in binary search trees |
| Postorder | Left → Right → Root | Aggregating children results to compute parent values (height, sum) |
| Level | Layer by layer from top | Shortest depth, per-layer processing |

The first three are Depth-First Search (DFS), implemented with recursion, while level-order traversal is Breadth-First Search (BFS) using a [queue](#/post/algo-stack-queue). Below is the direct implementation.

```
        1
      /   \
     2     3
    / \     \
   4   5     6
```

```python
from collections import deque

class N:
    def __init__(s, v, l=None, r=None):
        s.v, s.l, s.r = v, l, r

t = N(1, N(2, N(4), N(5)), N(3, None, N(6)))

def pre(n):  return [] if not n else [n.v] + pre(n.l) + pre(n.r)
def ino(n):  return [] if not n else ino(n.l) + [n.v] + ino(n.r)
def post(n): return [] if not n else post(n.l) + post(n.r) + [n.v]

def level(n):
    q, out = deque([n]), []
    while q:
        x = q.popleft()
        out.append(x.v)
        if x.l: q.append(x.l)
        if x.r: q.append(x.r)
    return out

def height(n): return 0 if not n else 1 + max(height(n.l), height(n.r))
```

Execution results (verified by running directly).

```
전위 [1, 2, 4, 5, 3, 6]
중위 [4, 2, 5, 1, 3, 6]
후위 [4, 5, 2, 6, 3, 1]
레벨 [1, 2, 3, 4, 5, 6]
높이 3
```

Time complexity is O(N) since each node is visited once, and space complexity is O(height) due to recursion depth. For skewed trees where height reaches N, this may hit Python's default recursion limit (around 1000). In such cases, increase the limit with `sys.setrecursionlimit` or switch to an iterative stack-based approach.

## Heaps and Priority Queues

A priority queue is a "queue that outputs elements based on priority rather than insertion order." A heap is the data structure used to implement it. They are often used interchangeably, but one refers to the role and the other to the implementation.

A min-heap is a complete binary tree where every parent is less than or equal to its children. The smallest value is always at the root. It is not fully sorted; only the parent-child relationships are maintained.

Python's `heapq` uses a list as a heap. According to the official documentation, `heap[0]` holds the smallest value, and for index `k`, the children are at indices `2k+1` and `2k+2`. Thus, no separate tree structure is needed—a single array suffices.

| Function | Action | Time Complexity |
|---|---|---|
| `heappush(h, x)` | Insert | O(log N) |
| `heappop(h)` | Extract minimum | O(log N) |
| `h[0]` | View minimum | O(1) |
| `heapify(list)` | Convert list to heap | O(N) |

The fact that `heapify` is O(N) is noted in the documentation as "linear time." Since pushing N times would take O(N log N), using `heapify` is preferable when all data is already available.

```python
import heapq
a = [5, 3, 8, 1, 9, 2]
heapq.heapify(a)
print(a)  # [1, 3, 2, 5, 9, 8]  (직접 실행 확인)
```

You can see that the result is not sorted. However, `a[0]` is 1. Popping one by one yields `[1, 2, 3, 5, 8, 9]`.

### Max-Heap via Sign Inversion

`heapq` only provided min-heaps for a long time. According to the documentation, Python 3.14 added `_max` functions like `heappush_max`. For earlier versions, it's common in coding tests to prepend `-` to values and invert them upon extraction.

```python
m = []
for x in [5, 3, 8]:
    heapq.heappush(m, -x)
print(-heapq.heappop(m))  # 8
```

When tuples are inserted, comparison is based on the first element. The documentation notes that if priorities are equal, comparison should proceed to the second element; otherwise, an error occurs, so a counter is often added.

## Representative Problems

Only numbers and names are listed here. For full details, refer to each respective site.

- Programmers Find Path Game: Constructs a binary tree using node coordinates and returns the results of pre-order and post-order traversals. The pre-order traversal function is used as-is.
- Programmers Dual Priority Queue: Handles "insert," "delete max," and "delete min" commands, returning the remaining max and min values. This is practice in handling both a min-heap and a max-heap (by flipping signs).
- Programmers Overtime Index: Reduces work within N hours to minimize the sum of squares of remaining work. This is a max-heap problem where you repeatedly extract the largest value, reduce it by one, and re-insert it.
- Programmers Disk Controller: Processes tasks based on shortest duration; if durations are equal, the earlier request time takes precedence; if those are also equal, the smaller task number is processed first. Since there are multiple criteria, a heap storing tuples is used.
- Programmers Make It Spicy: Mixes the two least spicy items and re-inserts the new value. This follows the greedy pattern of always extracting the two smallest values to combine them, with a heap attached.

## Thinking Order for Solution

1. Check if the problem involves repeatedly extracting the "smallest (or largest)" item and inserting a new intermediate value. If so, it's a heap problem. Problems solvable with a single sort can be finished using [Sorting](#/post/algo-sort-search).
2. To get the maximum, flip the sign. If there are multiple criteria, insert them as a tuple `(criteria1, criteria2)`.
3. Verify if a new value is created from the extracted item and re-inserted. "Make It Spicy" follows this pattern.
4. For tree problems: choose post-order if calculating parents from children's results, pre-order if passing parent information down, or level-order if depth matters.

### Code View

```python
import heapq

# 더 맵게와 비슷한 형태: 가장 작은 둘을 합치며 비용 누적
def merge_cost(cards):
    heapq.heapify(cards)
    total = 0
    while len(cards) > 1:
        s = heapq.heappop(cards) + heapq.heappop(cards)
        total += s
        heapq.heappush(cards, s)
    return total

print(merge_cost([10, 20, 40]))  # 100

# K번째로 큰 수: 크기 K짜리 최소 힙을 유지
def kth_largest(nums, k):
    h = []
    for x in nums:
        heapq.heappush(h, x)
        if len(h) > k:
            heapq.heappop(h)
    return h[0]

print(kth_largest([3, 2, 1, 5, 6, 4], 2))  # 5

# 기준이 둘인 힙 형태(디스크 컨트롤러처럼): (절댓값, 원래 값) 튜플
def abs_heap(ops):
    h, out = [], []
    for x in ops:
        if x:
            heapq.heappush(h, (abs(x), x))
        else:
            out.append(heapq.heappop(h)[1] if h else 0)
    return out

print(abs_heap([1, -1, 0, 0, 0, 2, -2, 0]))  # [-1, 1, 0, -2]
```

All three functions were executed directly to verify the output.

## Complexity

| Operation | Time | Space |
|---|---|---|
| Tree traversal (pre/in/post/level) | O(N) | Recursion O(height) / Level uses queue O(width) |
| Heap push/pop for N items | O(N log N) | O(N) |
| K-th largest number (heap of size K) | O(N log K) | O(K) |

For the K-th largest number, full sorting takes O(N log N), but by grouping into a heap of size K, the complexity becomes O(N log K). The difference is significant when K is small.

## Common Misconceptions

- A heap is a sorted array: No. As seen above, `heapify` does not result in a sorted array; it only guarantees the root property.
- You can find intermediate values in a heap: Searching for anything other than the minimum value takes O(N). Problems requiring removal of specific values should consider lazy deletion or alternative structures.
- Binary trees and binary search trees are the same: A binary search tree has the additional condition that left < root < right. A heap is a binary tree but lacks this ordering condition.
- Recursion is used for level-order traversal: It's possible, but queues are typically used.

## Similar Types

- Problems solved by processing one by one after sorting fall under [Sorting & Search](#/post/algo-sort-search).
- Weighted graph problems where the heap is a core tool involve [Shortest Path](#/post/algo-shortest-path) (Dijkstra).
- Greedy approaches that always select the minimum value belong to [Greedy](#/post/algo-greedy).

<details>
<summary>Detailed explanation: What happens when adding to and removing from a heap</summary>

Push appends a new value to the end of the array, then compares it with its parent, moving it up until the parent is smaller (for a min-heap) or larger. If the condition isn't met, it stops. Since tree height is log N, it moves up at most that many levels. Pop removes the root, moves the last element to the root position, then compares it with its children, moving down to the smaller child (for a min-heap). Similarly, it descends at most the height of the tree.

This explanation describes the logic based on reading and understanding the implementation; the exact internal implementation of CPython's `heapq` has not been inspected this time.

</details>

← [Concept Map](#/post/algo-map)

Related posts: [Graph Search](#/post/algo-graph-search) · [Stack & Queue](#/post/algo-stack-queue) · [Greedy](#/post/algo-greedy)

## Reference Links

- Python documentation, heapq: https://docs.python.org/3/library/heapq.html
- Wikipedia, Tree traversal: https://en.wikipedia.org/wiki/Tree_traversal
- Find Path Game: https://school.programmers.co.kr/learn/courses/30/lessons/42892
- Dual Priority Queue: https://school.programmers.co.kr/learn/courses/30/lessons/42628
- Overtime Index: https://school.programmers.co.kr/learn/courses/30/lessons/12927
- Disk Controller: https://school.programmers.co.kr/learn/courses/30/lessons/42627
- Make It Spicy: https://school.programmers.co.kr/learn/courses/30/lessons/42626