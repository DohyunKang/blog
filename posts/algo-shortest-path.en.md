# Shortest Path, Union-Find, and Topological Sort

We've learned how to traverse graphs using [BFS·DFS](#/post/algo-graph-search). This article covers three algorithms that frequently appear on top of those: Dijkstra's algorithm for finding the cheapest path when edges have costs, Union-Find for quickly determining which elements belong to the same group, and Topological Sort for ordering tasks with precedence relationships. All three have short codebases, but figuring out "when to use each one" is often more challenging.

## Quick Comparison

| Algorithm | When to Use | Key Tool | Time Complexity |
|---|---|---|---|
| Dijkstra | Finding the minimum cost from one point to another in a graph with non-negative weights | Priority Queue | O(E log V) |
| Union-Find | Determining if two elements are in the same set or merging sets | Parent Array | Nearly O(1) per operation |
| Topological Sort | Ordering tasks with precedence relationships or detecting cycles | In-degree + Queue | O(V+E) |

## Shortest Path: Dijkstra

### Problem Type Explanation

BFS only provides the shortest distance when each edge counts as 1 unit. When edges have different costs, the criterion must be the "sum of costs" rather than the "number of edges." Dijkstra's algorithm confirms nodes starting from the closest ones to the source point.

The principle is as follows: Initialize the distance from the start node to 0 and all others to infinity. Extract the unconfirmed node with the smallest distance, confirm it, and check if neighbors become closer via this node. If they are closer, update them. Since costs are non-negative, once a node is extracted, its distance is already minimal, so no re-evaluation is needed. A heap (priority queue) is used to efficiently extract the smallest element.

If negative edges exist, this assumption breaks. Using a Wikipedia example where s→a = 2, s→b = 5, and b→a = -10, Dijkstra would confirm a at distance 2, but the path s→b→a is actually -5. In such cases, use Bellman-Ford.

### Representative Problems

- **Programmers Delivery**: Given N villages connected by bidirectional roads, count how many villages can be reached from village 1 within K hours. Compute the shortest distance from village 1 to all others and count those with distance ≤ K.
- **Programmers Shared Taxi Fare**: Determine how to split shared segments between a starting point and two destinations to minimize cost; solve by running Dijkstra multiple times.

### Solution Thinking Steps

1. Check if edges have costs and whether they are non-negative. If all costs are 1, BFS is sufficient.
2. Determine if you need distances from one start node to all nodes (single-source) or between all pairs. If it's all-pairs and the number of vertices is small (hundreds), consider Floyd-Warshall as an alternative.
3. Build an adjacency list, initialize a distance array with infinity, and push `(0, start_node)` into the heap.
4. If the distance extracted from the heap is greater than the currently recorded distance for that node, it's an outdated entry; skip it.
5. Update neighbors and push them into the heap.

### Python Code

```python
import heapq

def dijkstra(n, graph, start):
    INF = float('inf')
    dist = [INF] * (n + 1)
    dist[start] = 0
    pq = [(0, start)]
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:        # 이미 더 짧은 길로 처리된 낡은 항목
            continue
        for v, w in graph[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return dist
```

After adding edges (1,2,2), (1,3,5), (2,3,1), (2,4,7), (3,4,2), (4,5,1) as bidirectional and running from node 1, the result is `[inf, 0, 2, 3, 5, 6]` (node 0 is unused). You can see that the path 1→2→3 is cheaper than a direct 5-unit edge.

### Complexity

With a heap, it's O((V+E) log V), which simplifies to O(E log V) for connected graphs. The code above pushes new entries on every update and discards outdated ones upon extraction—a method also recommended by Wikipedia instead of using `decrease-key`. Space complexity is O(V+E).

<details>
<summary>Python Input Tips</summary>

For problems with many edges, use `sys.stdin.readline` instead of `input()`. Python's `heapq` implements a min-heap, and tuples are compared element-by-element from the front, so you must push `(distance, vertex)` to sort by distance. This part often causes mistakes. If you need to reconstruct the path itself, store `prev[v] = u` during updates and backtrack from the destination node.
</details>

## Union-Find

### Problem Type Explanation

Use this when repeatedly asked questions like "Are A and B in the same group?" or "Merge these two groups." Each element points to a parent; following parents leads to the root, which represents the group representative. If roots match, the elements are in the same group.

A naive implementation can create a long, skewed tree where `find` takes O(n). Therefore, two optimizations are applied: path compression attaches visited nodes directly to the root during `find`, and union by size (or rank) attaches the smaller tree under the larger one. Using both together yields Θ(m·α(n)) for m operations, where α is the inverse Ackermann function, which is ≤ 4 for practical n values—effectively treated as a constant.

- Programmers Network: Given information about computer connections, count the number of connected groups. This is the basic form of grouping; simply merge them and count how many roots exist.
- Programmers Hotel Room Assignment: If a room matching the guest's preference is occupied, assign the smallest available room with a higher number. We use Union-Find by maintaining a pointer to the "next available room" each time a room is filled.
- Programmers Connecting Islands: Given bridge construction costs, find the minimum cost to make all islands reachable from one another. This involves sorting edges by cost and selecting those that do not form cycles using Kruskal's algorithm, which incorporates Union-Find.

### Reasoning Steps for Solution

1. Check if the question asks only "are they connected?" without requiring a specific path. If so, Union-Find is simpler than BFS.
2. Determine if merging operations occur dynamically during the process. If the structure is built once and finished, DFS is also viable.
3. Use path compression for `find` and union by rank/size for `union`.
4. In Kruskal's algorithm, discard an edge when `union` returns `False` (indicating the nodes are already in the same group), as this edge would form a cycle.

### Python Code

```python
def find(p, x):
    while p[x] != x:
        p[x] = p[p[x]]     # 경로 반으로 줄이기(path halving)
        x = p[x]
    return x

def union(p, size, a, b):
    a, b = find(p, a), find(p, b)
    if a == b:
        return False       # 이미 같은 집합
    if size[a] < size[b]:
        a, b = b, a
    p[b] = a
    size[a] += size[b]
    return True
```

Merging elements (1,2), (2,3), (1,3), and (4,5) sequentially yields `True, True, False, True`. The third result is `False` because 1 and 3 are already in the same set; in Kruskal's algorithm, this signals that the edge creates a cycle. Finally, we verified that 1 and 3 belong to the same set, while 1 and 4 belong to different sets.

Using recursion for `find` can hit Python's recursion limit, so implementing it iteratively as shown above is safer.

### Complexity

Time complexity per operation is nearly O(1) (precisely inverse Ackermann function O(α(n))), with space complexity O(n). Wikipedia notes that this lower bound has been proven and cannot be reduced further.

## Topological Sort

### Type Description

Topological sort arranges nodes in a linear order such that all edges point from earlier to later positions in the sequence, given a directed graph representing precedence relationships like "to do B, A must be done first." Typical applications include course prerequisites, build dependencies, and task ordering. This is only possible on Directed Acyclic Graphs (DAGs). The resulting order may not be unique.

Kahn's algorithm is the most common approach: enqueue nodes with an in-degree of 0, dequeue one node to append it to the result, remove its outgoing edges, and enqueue any neighbors whose in-degree becomes 0. If the final result length is less than n, a cycle exists; thus, this method also detects cycles.

### Representative Problems

- LeetCode 210 Course Schedule II: Given course prerequisites, return one valid order to take all courses, or an empty array if impossible. This follows Kahn's algorithm directly.
- LeetCode 207 Course Schedule: With the same input, determine only whether it is possible to take all courses (i.e., whether a cycle exists), without needing a specific order.
- If additional conditions require outputting smaller-numbered nodes first when precedence relations are equal, the solution becomes a variant using a heap instead of a queue (see Reasoning Step 6 below).

### Reasoning Steps for Solution

1. Look for keywords like "order," "prerequisite," or "must be done first."
2. Determine edge directions correctly (from prerequisite to dependent). A common mistake is reversing the direction.
3. Create an in-degree array.
4. Enqueue nodes with in-degree 0, dequeue them, and decrement neighbors' in-degrees.
5. If the result count is not equal to n, a cycle exists.
6. If additional ordering conditions apply (e.g., prefer smaller numbers), replace the queue with a heap.

### Python Code

```python
from collections import deque

def topo(n, edges):
    g = [[] for _ in range(n + 1)]
    indeg = [0] * (n + 1)
    for a, b in edges:          # a를 먼저 해야 b
        g[a].append(b)
        indeg[b] += 1
    q = deque(i for i in range(1, n + 1) if indeg[i] == 0)
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in g[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    return order if len(order) == n else None   # None이면 사이클
```

Running with edges (1,2), (1,3), (2,4), (3,4) produces `[1, 2, 3, 4]`. Adding a cycle like 1→2→3→1 results in `None`.

### Complexity

Time: O(V+E), Space: O(V+E).

## Common Confusions

- Dijkstra's algorithm is greedy, always extracting the smallest distance. Its failure with negative edges stems from this property.
- If all edge weights are equal or 0/1, there is no need for Dijkstra; BFS or 0-1 BFS suffices.
- Union-Find only merges groups and never splits them. Problems involving edge deletion are often solved by reversing time and using merge operations instead.
- Topological sort results may not be unique; if the problem requires a specific order, additional rules (like using a heap) must be applied.

## Related Types

- Unweighted shortest path and search: [BFS, DFS, and Graphs](#/post/algo-graph-search)
- The heap used in Dijkstra: [Trees, Heaps, Priority Queues](#/post/algo-tree-heap)
- Making the best choice at each step: [Greedy Algorithms](#/post/algo-greedy)
- Solving shortest path problems with recurrence relations: [Dynamic Programming (DP)](#/post/algo-dp)
- Time complexity calculations: [Time Complexity and Python Basics](#/post/algo-complexity)

## Reference Links

- Delivery: https://school.programmers.co.kr/learn/courses/30/lessons/12978
- Carpooling Taxi Fare: https://school.programmers.co.kr/learn/courses/30/lessons/72413
- Network: https://school.programmers.co.kr/learn/courses/30/lessons/43162
- Hotel Room Assignment: https://school.programmers.co.kr/learn/courses/30/lessons/64063
- Connecting Islands: https://school.programmers.co.kr/learn/courses/30/lessons/42861
- LeetCode Course Schedule II: https://leetcode.com/problems/course-schedule-ii/
- LeetCode Course Schedule: https://leetcode.com/problems/course-schedule/
- Dijkstra's algorithm (Wikipedia): https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm
- Disjoint-set data structure (Wikipedia): https://en.wikipedia.org/wiki/Disjoint-set_data_structure
- Topological sorting (Wikipedia): https://en.wikipedia.org/wiki/Topological_sorting

← [Concept Map](#/post/algo-map)