Greedy algorithms make the locally optimal choice at each step and do not revisit previous decisions. The code is often short, but verifying whether this approach yields the correct answer constitutes most of the problem-solving effort.

## What is Greedy?

Also known as a greedy algorithm. According to Wikipedia, it is an algorithm that makes the locally optimal choice at each stage without reconsidering prior choices. The same article describes it as an extreme form of dynamic programming (DP), where only one partial solution is carried forward. While DP keeps and compares multiple candidates, greedy discards all but one.

Therefore, it is fast. However, it can be incorrect. The path following the largest number might lead to a dead end at the end.

## When does it work?

Two conditions must be met:

| Condition | Meaning |
| --- | --- |
| Greedy choice property | Even if we make the currently best-looking choice, an optimal solution including that choice exists. |
| Optimal substructure | The remaining problem after making that choice is of the same type, and combining its optimal solution with the current choice yields the overall optimal solution. |

Wikipedia does not directly use these terms but explains them using an exchange argument. If swapping a greedy choice for the corresponding choice in an optimal solution at the point where they first differ does not worsen the result, induction concludes that greedy is optimal.

In coding tests, we don't write full proofs. We pick a sorting criterion, manually find counterexamples for a few cases, and proceed with that criterion if no counterexamples appear. Finding no counterexample doesn't mean it's proven, so we submit with some unease.

## Representative Problems

I list only the problem name and a one-line description without copying the full problem statement.

- Programmers Surveillance Camera: Given entry and exit points for each vehicle, place the minimum number of cameras such that every vehicle passes by at least one camera. This has the same structure as the Meeting Room Allocation problem, where intervals are sorted by end time.
- Programmers Create Largest Number: Remove k digits from a string of numbers to form the largest possible number. This is greedy, keeping larger digits from the front.
- Programmers Disk Controller: Given request times and durations for tasks, minimize average return time. This uses a heap alongside a greedy strategy of picking shorter tasks first.
- Programmers Lifeboat: Use the minimum number of boats, each carrying at most two people within the weight limit.

## Order of Thinking About Solutions

1. Determine if it's an optimization problem (maximize or minimize).
2. List candidate sorting criteria, such as start time, end time, duration, or unit price.
3. Draw counterexamples for each criterion; small inputs of 3–4 items usually filter out incorrect ones.
4. If no counterexamples remain, consider the exchange argument once more.
5. If still uneasy, compare with DP or brute force on small inputs.

For Meeting Room Allocation, the correct approach is to schedule the meeting that ends earliest first. Picking from those that start earliest fails because (1, 10) would block (2, 3) and (4, 5). Picking by shortest duration also has counterexamples. The exchange argument proceeds as follows: even if we replace the first meeting in an optimal solution with the one ending earliest, there is no overlap and the count remains the same, proving that an optimal solution including the greedy choice exists. This problem appears in Wikipedia's activity selection problem document using the same reasoning.

## Python Code

All code below has been executed to verify values. For Meeting Room Allocation, I also compared against brute force results on random small inputs of 300 items.

```python
def max_meetings(iv):
    iv.sort(key=lambda x: (x[1], x[0]))   # 끝나는 시각, 같으면 시작 시각
    cnt, end = 0, -1
    for s, e in iv:
        if s >= end:
            cnt += 1
            end = e
    return cnt

print(max_meetings([(1,4),(3,5),(0,6),(5,7),(3,8),(5,9),(6,10),(8,11),(8,12),(2,13),(12,14)]))  # 4
```

When end times are equal, sorting by start time is necessary to avoid errors with meetings that have identical start and end times (duration 0). Such inputs can occur in meeting room allocation problems, so the start time is included in the sorting criterion.

The coin change problem becomes greedy because denominations are multiples of each other.

```python
def coin_greedy(coins, k):
    cnt = 0
    for v in sorted(coins, reverse=True):
        cnt += k // v
        k %= v
    return cnt if k == 0 else -1

print(coin_greedy([500, 100, 50, 10], 1260))  # 6
```

Many problems also use heaps. One example is counting how many meetings overlap simultaneously to determine the number of rooms needed.

```python
import heapq

def min_rooms(iv):
    iv.sort()                      # 시작 시각순
    h = []                         # 쓰고 있는 방들의 끝나는 시각
    for s, e in iv:
        if h and h[0] <= s:
            heapq.heapreplace(h, e)   # 비는 방 재사용
        else:
            heapq.heappush(h, e)      # 새 방
    return len(h)

print(min_rooms([(0, 30), (5, 10), (15, 20)]))  # 2
```

<details>
<summary>Merging Huffman Coding Costs (Priority Queue Greedy)</summary>

Continuously merge the two smallest items. Wikipedia notes that Huffman trees are constructed this way. The total merging cost is calculated as follows:

```python
import heapq

def merge_cost(ws):
    h = list(ws)
    heapq.heapify(h)
    total = 0
    while len(h) > 1:
        a, b = heapq.heappop(h), heapq.heappop(h)
        total += a + b
        heapq.heappush(h, a + b)
    return total

print(merge_cost([10, 20, 30, 40]))  # 190
```

10+20=30, 30+30=60, 40+60=100, total 190.
</details>

## Time and Space Complexity

Sorting dominates. For Meeting Room Allocation, sorting takes O(n log n) and a single pass takes O(n), resulting in overall O(n log n). If sorting is done in-place, space complexity is O(1) (though Python's `sort` uses auxiliary space internally). Problems using heaps also achieve O(n log n) since push and pop operations are O(log n). [How to read time complexity → Time Complexity and Python Basics](#/post/algo-complexity)

## Common Misconceptions and Counterexamples

A classic example where a greedy approach fails is the coin change problem. If coins are worth 1, 4, and 5 units, and you need to make 8 units, the greedy strategy would use 5 + 1 + 1 + 1 (four coins), but the optimal solution is 4 + 4 (two coins). The `coin_greedy` code above only works when denominations are in a multiple relationship; it should not be used for this input. Such problems are solved using [dynamic programming](#/post/algo-dp), as confirmed by the DP code below, which yields the correct answer of 2.

```python
def coin_dp(coins, k):
    INF = 10**9
    d = [0] + [INF] * k
    for i in range(1, k + 1):
        for v in coins:
            if i >= v:
                d[i] = min(d[i], d[i - v] + 1)
    return d[k] if d[k] < INF else -1

print(coin_dp([1, 4, 5], 8))  # 2
```

The knapsack problem follows a similar structure. If items can be divided (fractional knapsack), the greedy strategy of selecting items with the highest value per unit weight is correct. However, if items cannot be divided (0-1 knapsack), the greedy approach fails. For example, with items having (weight, value) = (10, 60), (20, 100), and (30, 120), and a capacity of 50, the fractional version yields a total value of 240, while the 0-1 version yields 220. The Wikipedia page notes that the 0-1 knapsack problem is NP-hard. These two values were verified using code.

Another point: adding weights breaks the greedy approach for meeting room scheduling as well. The Wikipedia article on the activity selection problem states that no greedy solution exists for the weighted version and suggests solving it with dynamic programming.

A common misconception is that sorting alone implies a greedy algorithm. Sorting is merely a tool; there must be justification that the chosen sort order leads to an optimal solution for the greedy approach. When a greedy strategy comes to mind first while solving a problem, it's better to also check whether dynamic programming can be applied or if a counterexample exists.

There are many algorithms where the greedy approach is valid. Dijkstra's algorithm (when there are no negative edges), Kruskal's and Prim's minimum spanning tree algorithms, and Huffman coding are cited as greedy examples on Wikipedia. Edmonds proved that greedy strategies yield optimal solutions for problems with matroid structures, and this concept was later generalized to greedoids.

[다익스트라 → 최단 경로·유니온 파인드·위상 정렬](#/post/algo-shortest-path) / [힙 → 트리·힙·우선순위 큐](#/post/algo-tree-heap) / [정렬 → 정렬과 이분 탐색](#/post/algo-sort-search)

## Reference Links

- [Greedy algorithm — Wikipedia](https://en.wikipedia.org/wiki/Greedy_algorithm) (definition, exchange argument, matroids, knapsack, Dijkstra·Huffman·Kruskal examples)
- [Activity selection problem — Wikipedia](https://en.wikipedia.org/wiki/Activity_selection_problem) (end-time criterion, proof idea, weighted version)
- Programmers: [Camera Surveillance](https://school.programmers.co.kr/learn/courses/30/lessons/42884) / [Create Maximum Number](https://school.programmers.co.kr/learn/courses/30/lessons/42883) / [Disk Controller](https://school.programmers.co.kr/learn/courses/30/lessons/42627) / [Lifeboat](https://school.programmers.co.kr/learn/courses/30/lessons/42885): Check the problem title and type on the respective pages

← [Concept Map](#/post/algo-map)

Related articles: [Dynamic Programming (DP)](#/post/algo-dp) / [Sorting and Binary Search](#/post/algo-sort-search) / [Trees, Heaps, and Priority Queues](#/post/algo-tree-heap)