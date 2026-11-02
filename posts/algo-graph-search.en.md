BFS and DFS are two methods for traversing every vertex in a graph exactly once; the only difference between them is whether the next vertex to visit is pushed onto a queue or a stack.

## What is a Graph?

A graph is a collection of vertices (points) and edges (lines connecting points). Subway maps, friendship networks, and webpage links are all graphs. If the edges have direction, it's called a directed graph; otherwise, it's an undirected graph.

The typical way to represent a graph in code is using an adjacency list. This means each vertex holds a "list of connected vertices." In Python, this is usually implemented as a list of lists or a dictionary.

```python
graph = {1: [2, 3, 4], 2: [5], 3: [4], 4: [], 5: []}
```

For grid (2D array) problems, each cell is a vertex, and adjacent cells (up, down, left, right) are edges. There's no need to build a separate graph; you can directly find neighbors using coordinate calculations (dy, dx). Half of the problems in this article involve grids.

[Basic knowledge on arrays and hash maps → Arrays and Hashes](#/post/algo-array-hash)

## What is Traversal?

Traversal means visiting every reachable vertex from a starting point exactly once. Two things must be decided: where to start, and when there are multiple neighbors of the current vertex, which one to visit first. The second decision determines whether you use BFS or DFS.

- **BFS (Breadth-First Search)**: Visits vertices in order of distance from the start. It visits all vertices at distance 1 from the start, then all at distance 2, and so on. Since vertices must be processed in the order they are discovered, a queue (FIFO) is used.
- **DFS (Depth-First Search)**: Goes as deep as possible along one path before backtracking to explore another path. Vertices discovered later are processed first, so a stack (LIFO) is used; recursive calls effectively act as a stack.

| | BFS | DFS |
|---|---|---|
| Data Structure | Queue | Stack (or recursion) |
| Traversal Order | From nearest vertices | Deep along one path |
| Suitable Problems | Shortest distance (when edges are unweighted) | Connected components, path existence, area size |
| Memory Usage | Queue grows with the width of each layer | Stack grows with depth |

Starting from vertex 1 in the `graph` above, BFS visits vertices in the order 1, 2, 3, 4, 5, while DFS visits them in the order 1, 2, 5, 3, 4. I verified this by running the code directly.

## Visited Check is Crucial

The most common mistake when implementing these algorithms is forgetting to mark vertices as visited. If you don't mark a vertex after visiting it, you'll get stuck in an infinite loop on a graph with cycles by repeatedly revisiting the same vertex. The timing of marking is also important: in BFS, you should mark a vertex when adding it to the queue. If you mark it when popping from the queue, the same vertex may be added multiple times to the queue.

## BFS Code

```python
from collections import deque

def bfs(graph, start):
    seen = {start}
    order = []
    q = deque([start])
    while q:
        v = q.popleft()
        order.append(v)
        for nxt in graph[v]:
            if nxt not in seen:
                seen.add(nxt)      # 넣을 때 표시
                q.append(nxt)
    return order
```

Use `deque` for the queue. According to Python documentation, adding or removing elements from both ends of a deque is O(1), whereas `pop(0)` on a list requires shifting all remaining elements, making it O(n). You can use a list as a queue and get correct results, but with many vertices, performance will degrade significantly.

## DFS Code

Using recursion makes the code concise.

```python
def dfs(graph, start):
    seen = set()
    order = []
    def go(v):
        seen.add(v)
        order.append(v)
        for nxt in graph[v]:
            if nxt not in seen:
                go(nxt)
    go(start)
    return order
```

Python has a limit on recursion depth. On this PC, `sys.getrecursionlimit()` returned 1000. If you have a straight-line graph with 100,000 vertices, recursive DFS will immediately raise a `RecursionError`. You can increase the limit using `sys.setrecursionlimit`, but the documentation warns that setting it too high may crash the interpreter. If depth might be large, using an explicit stack is safer.

```python
def dfs_stack(graph, start):
    seen = set()
    order = []
    st = [start]
    while st:
        v = st.pop()
        if v in seen:
            continue
        seen.add(v)
        order.append(v)
        for nxt in reversed(graph[v]):
            if nxt not in seen:
                st.append(nxt)
    return order
```

In the stack version, mark vertices as visited when popping from the stack. Using `reversed` for neighbors ensures the same traversal order as the recursive version. For problems where order doesn't matter, you can omit it. Both versions produced the sequence 1, 2, 5, 3, 4 on the same graph.

[If you're curious about stacks and queues themselves → Stacks and Queues](#/post/algo-stack-queue) / [If recursion is confusing → Recursion](#/post/algo-recursion)

## Representative Problem 1: Number of Connected Components

The "Network" problem on Programmers gives connection information for n computers and asks how many groups of mutually connected computers (networks) exist, whether directly or via other computers. This is essentially a connected components problem in an undirected graph: count the number of separate groups where vertices can reach each other.

The approach is as follows:

1. If there are unvisited vertices, start a traversal from one of them. The entire connected component will be visited during this traversal.
2. The number of times you start a traversal equals the number of components.
3. Repeat while there are unvisited vertices remaining.

```python
from collections import deque

def components(n, edges):
    g = [[] for _ in range(n + 1)]
    for a, b in edges:
        g[a].append(b)
        g[b].append(a)          # 무방향이라 양쪽에 넣는다
    seen = [False] * (n + 1)
    cnt = 0
    for s in range(1, n + 1):
        if seen[s]:
            continue
        cnt += 1
        seen[s] = True
        q = deque([s])
        while q:
            v = q.popleft()
            for w in g[v]:
                if not seen[w]:
                    seen[w] = True
                    q.append(w)
    return cnt
```

With 6 vertices and edges (1,2), (2,5), (5,1), (3,4), (4,6), there are 2 components. Removing the last edge leaves vertex 6 isolated, resulting in 3 components.

In this problem, connection information is given as an adjacency matrix (`computers[i][j] == 1` means vertices i and j are connected). To use it with `components`, you only need to convert it to a list of edges.

```python
def solution(n, computers):
    edges = [(i + 1, j + 1) for i in range(n) for j in range(i + 1, n) if computers[i][j] == 1]
    return components(n, edges)
```

I verified the solution by running the two examples from the problem page (`[[1,1,0],[1,1,0],[0,0,1]]` yields 2, and `[[1,1,0],[1,1,1],[0,1,1]]` yields 1).

## Representative Problem 2: Shortest Distance in a Maze

Programmers "Game Map Shortest Distance" is a problem where you find the minimum number of cells to travel from top-left to bottom-right in a grid where 1 represents a path and 0 represents a wall, moving only up, down, left, or right. If the destination is unreachable, return -1.

In an unweighted grid, BFS solves the shortest distance problem because visiting each layer ensures that the first time you reach a cell, it is via the minimum distance. Using a distance array instead of a visited array allows you to perform both visit checking and distance recording simultaneously.

```python
from collections import deque

def maze(grid):
    n, m = len(grid), len(grid[0])
    dist = [[-1] * m for _ in range(n)]
    dist[0][0] = 1
    q = deque([(0, 0)])
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < n and 0 <= nx < m and grid[ny][nx] == 1 and dist[ny][nx] == -1:
                dist[ny][nx] = dist[y][x] + 1
                q.append((ny, nx))
    return dist[n - 1][m - 1]
```

By initializing the distance array with -1, if the destination remains -1 at the end, it directly indicates "unreachable." Running the examples from the problem page yields 11 and -1. This is a classic case where DFS should not be used; there is no guarantee that the first path reached is the shortest.

## Representative Problem 3: Counting Area Sizes

Programmers "Uninhabited Island Travel" is a problem where you calculate the sum of food amounts (numbers 1~9) for each connected land mass in a grid containing sea (`X`) and numbers, then return them in ascending order. If there is no land, return `[-1]`. Since this involves counting masses rather than finding shortest distances, either BFS or DFS works; it's essentially the same structure as counting connected components with added value summation within each component.

```python
def islands(maps):
    n, m = len(maps), len(maps[0])
    seen = [[False] * m for _ in range(n)]
    sums = []
    for i in range(n):
        for j in range(m):
            if maps[i][j] != 'X' and not seen[i][j]:
                seen[i][j] = True
                st = [(i, j)]
                total = 0
                while st:
                    y, x = st.pop()
                    total += int(maps[y][x])
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < n and 0 <= nx < m and maps[ny][nx] != 'X' and not seen[ny][nx]:
                            seen[ny][nx] = True
                            st.append((ny, nx))
                sums.append(total)
    return sorted(sums) if sums else [-1]
```

Inputting the example from the problem page `["X591X","X1X5X","X231X","1XXX1"]` yields `[1, 1, 27]`, while a grid with no land at all `["XXX","XXX","XXX"]` returns `[-1]`. To count the number of cells, simply change it to `total += 1`. Here, we mark visited cells when pushing onto the stack; this prevents duplicate entries for the same cell, making this approach simpler for problems where order doesn't matter.

## Order of Choosing Based on Problem Reading

1. Does it ask for shortest distance or minimum moves? → BFS.
2. Is it about counting masses, area sizes, or reachability? → Either BFS or DFS works; choose the easier one.
3. Can the depth become large (e.g., straight lines)? → In Python, avoid recursive DFS and use a stack or BFS instead.
4. Is it a problem requiring checking all cases (backtracking)? → DFS. This is outside the scope of this article.

## Time and Space Complexity

When there are V vertices and E edges, both BFS and DFS based on an adjacency list have a time complexity of O(V + E). This is because each vertex is processed once, and each edge is traversed twice (once from each end). The space complexity is also O(V) using a visited array and a queue or stack. For grids, V equals N×M, and since each cell has at most 4 edges, E is proportional to N×M, resulting in O(N×M).

If using an adjacency matrix, finding neighbors requires checking all V vertices for each vertex, leading to O(V²). For problems with many vertices but few edges, an adjacency list is appropriate.

<details>
<summary>Common Mistakes</summary>

- **Timing of visit marking**: Marking visited when popping from the queue in BFS causes duplicates to accumulate in the queue, slowing it down or causing memory issues. Mark when pushing instead.
- **Undirected graph edges**: Add edges only once per connection.
- **Grid boundary checks**: Perform range checks before value checks to avoid index errors; place range checks first.
- **Vertex numbering**: If vertices are numbered from 1, create an array of size N+1, not N.
- **Multiple starting points**: For problems requiring multiple start points (e.g., fire spreading from multiple locations in a grid), run BFS separately for each start point is incorrect; instead, add all start points to the queue at once and run BFS once. I understand the principle but haven't tested this code here.
- **Large inputs via standard input**: Using `input()` can be slow and lead to time limit exceeded errors on large inputs; use `sys.stdin.readline` instead.
</details>

## Similar Types

Shortest paths in weighted graphs cannot be solved with BFS; you must use algorithms like Dijkstra's. [Details → Shortest Path](#/post/algo-shortest-path)

Trees are acyclic graphs, so the same traversal methods apply directly. [Details → Trees and Heaps](#/post/algo-tree-heap)

If you reuse values already calculated during exploration, it transitions to Dynamic Programming (DP). [Details → DP](#/post/algo-dp)

## Reference Links

- Python documentation, collections.deque: https://docs.python.org/3/library/collections.html#collections.deque
- Python documentation, sys.setrecursionlimit: https://docs.python.org/3/library/sys.html#sys.setrecursionlimit
- Network: https://school.programmers.co.kr/learn/courses/30/lessons/43162
- Game Map Shortest Distance: https://school.programmers.co.kr/learn/courses/30/lessons/1844
- Uninhabited Island Travel: https://school.programmers.co.kr/learn/courses/30/lessons/154540

← [Concept Map](#/post/algo-map)