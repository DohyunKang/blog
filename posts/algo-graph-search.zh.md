BFS 和 DFS 是遍历图中每个顶点的两种方法，它们唯一的区别在于：下一个要访问的点是放入队列还是栈中。

## 什么是图

图是由点（顶点）和连接点的线（边）组成的集合。地铁线路图、朋友关系、网页链接都是图。如果边有方向则称为有向图，没有方向则称为无向图。

代码中表示图通常使用邻接表。每个点都持有一个“与该点相连的点列表”。在 Python 中，通常用列表的列表或字典来表示。

```python
graph = {1: [2, 3, 4], 2: [5], 3: [4], 4: [], 5: []}
```

网格（二维数组）问题中，每个格子是一个点，上下左右相邻的格子是边。无需单独构建图，直接通过坐标计算 (dy, dx) 即可得到邻居。本文一半的问题都是网格问题。

[数组·哈希基础 → 数组与哈希](#/post/algo-array-hash)

## 什么是搜索

从起点出发，访问所有可达点一次的过程称为搜索。需要确定两点：从哪里开始，以及在当前点有多个邻居时先访问哪一个。第二个因素决定了是 BFS 还是 DFS。

- **BFS（广度优先）**：按距离由近及远地遍历。先访问距离为 1 的所有点，再访问距离为 2 的所有点，依此类推。由于必须先处理先发现的点，因此使用队列（FIFO）。
- **DFS（深度优先）**：沿着一条路径一直深入到底，遇到死胡同后回溯，再尝试下一条路径。因为后发现的点先被处理，所以使用栈（LIFO），递归调用本质上就是栈。

| | BFS | DFS |
|---|---|---|
| 数据结构 | 队列 | 栈（或递归） |
| 遍历顺序 | 从近到远 | 沿一条路深入 |
| 适用问题 | 最短路径（无加权边时） | 连通分量、路径存在性、区域大小 |
| 内存占用 | 队列随当前层宽度增大 | 栈随深度增大 |

以上述 `graph` 为例，从节点 1 开始，BFS 的遍历顺序为 1, 2, 3, 4, 5，而 DFS 的顺序为 1, 2, 5, 3, 4。已通过实际运行验证。

## 访问检查是关键

在两种算法中最容易遗漏的是访问检查。如果不标记已访问的点，在有环的图中会不断重复访问同一点，导致无限循环。标记的时机也很重要：在 BFS 中，应在将点加入队列时进行标记；若在弹出时才标记，则同一点可能多次进入队列。

## BFS 代码

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

队列使用 `deque`。根据 Python 文档，`deque` 的双端添加和删除操作时间复杂度为 O(1)，而列表的 `pop(0)` 需要移动其余所有元素，因此为 O(n)。虽然用列表实现队列也能得到正确结果，但在点数较多时会导致运行超时。

## DFS 代码

使用递归实现代码更简洁。

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

Python 存在递归深度限制。在本机上运行 `sys.getrecursionlimit()` 显示为 1000。如果图是包含 10 万个点的直线型图，递归版 DFS 会立即抛出 `RecursionError`。虽然可以通过 `sys.setrecursionlimit` 提高限制，但文档警告说设置过高可能导致解释器崩溃。若深度可能很大，直接使用栈更安全。

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

栈版本在弹出元素时进行访问标记。使用 `reversed` 处理邻居是为了使遍历顺序与递归版本一致。对于顺序无关的问题，可以省略这一步。两个版本在同一图上均输出 1, 2, 5, 3, 4。

[若对栈和队列本身有疑问 → 栈与队列](#/post/algo-stack-queue) / [若对递归感到困惑 → 递归](#/post/algo-recursion)

## 典型问题 1：连通分量数量

Programmers 平台的“网络”问题是：给定 n 台计算机的连接信息，统计通过直接连接或经过其他计算机间接连接而相互可达的计算机组（即网络）的数量。这本质上是在无向图中统计可以互相到达的连通分量的数量。

思路如下：

1. 若存在未访问的点，则从该点开始进行一次搜索。此次搜索会将整个连通分量全部标记为已访问。
2. 启动搜索的次数即为连通分量的数量。
3. 重复上述过程，直到没有未访问的点为止。

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

例如，6 个点及边 (1,2), (2,5), (5,1), (3,4), (4,6) 时结果为 2；若去掉最后一条边，则点 6 孤立，结果为 3。

该问题以邻接矩阵形式给出连接信息（`computers[i][j] == 1` 表示 i 和 j 相连）。若要放入上述 `components` 函数中，只需将边列表转换为邻接矩阵即可。

```python
def solution(n, computers):
    edges = [(i + 1, j + 1) for i in range(n) for j in range(i + 1, n) if computers[i][j] == 1]
    return components(n, edges)
```

已通过运行题目页面上的两个示例（`[[1,1,0],[1,1,0],[0,0,1]]` 结果为 2，`[[1,1,0],[1,1,1],[0,1,1]]` 结果为 1）验证正确性。

## 典型问题 2：迷宫最短路径

프로그래머스 "게임 맵 최단거리"는 1이 길, 0이 벽인 격자에서 왼쪽 위에서 오른쪽 아래까지 상하좌우로만 움직여 지나가는 최소 칸 수를 구하는 문제다. 도착할 수 없으면 -1 을 반환한다.

가중치 없는 격자에서 최단 거리는 BFS 가 해결한다. 층별로 탐색하기 때문에 어떤 칸에 처음 도달한 순간이 최소 거리이기 때문이다. 방문 배열 대신 거리 배열을 사용하면 방문 체크와 거리 기록이 한 번에 이루어진다.

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

거리 배열을 -1 로 초기화해 두니, 도착 칸이 끝까지 -1 이라면 그대로 "갈 수 없음"의 답이 된다. 문제 페이지의 예제 두 개를 실행하니 11 과 -1 이 나왔다. 이 문제는 DFS 로 풀면 안 되는 대표적인 사례다. DFS 는 먼저 닿은 경로가 짧다는 보장이 없다.

## 대표 문제 3: 영역 크기 세기

프로그래머스 "무인도 여행"은 바다 (`X`) 와 숫자 (1~9, 식량 양) 가 적힌 격자에서 상하좌우로 이어진 땅 덩어리마다 식량 합을 구해 오름차순으로 반환하고, 땅이 없으면 `[-1]` 을 반환하는 문제다. 최단 거리가 아니라 덩어리를 세는 것이므로 BFS든 DFS 든 상관없다. 연결 요소와 같은 구조에 덩어리 안의 값 더하기만 추가된 셈이다.

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

문제 페이지의 예제 `["X591X","X1X5X","X231X","1XXX1"]`을 넣으니 `[1, 1, 27]`, 땅이 하나도 없는 `["XXX","XXX","XXX"]`는 `[-1]` 이 나왔다. 칸 수를 세려면 `total += 1`로 바꾸면 된다. 여기서는 스택에 넣을 때 방문 표시를 했는데, 이렇게 하면 같은 칸이 중복으로 안 들어가서 순서를 신경 쓰지 않는 문제에는 이쪽이 단순하다.

## 문제 보고 고르는 순서

1. 최단 거리·최소 이동 횟수를 묻는가 → BFS.
2. 덩어리 개수·영역 크기·갈 수 있는지 여부인가 → BFS든 DFS 든 되니 더 쉬운 쪽을 선택한다.
3. 깊이가 커질 수 있는가(일직선 모양) → 파이썬이면 재귀 DFS 를 피하고 스택이나 BFS 를 사용한다.
4. 모든 경우를 해 보는 문제 (백트래킹) 인가 → DFS. 이건 이 글의 범위 밖이다.

## 시간·공간 복잡도

점이 V 개, 간선이 E 개일 때 인접 리스트 기준으로 BFS 와 DFS 는 둘 다 O(V + E)다. 점마다 한 번 꺼내고, 간선은 양 끝에서 한 번씩 훑기 때문이다. 공간도 방문 배열과 큐 (스택) 로 O(V)다. 격자라면 V 가 N×M 이고 E 는 칸당 최대 4 개라서 O(N×M)이다.

인접 행렬로 들고 있으면 이웃을 찾는 데 점마다 V 번을 보니 O(V²)이 된다. 점이 많고 간선이 적은 문제에서는 인접 리스트가 맞다.

<details>
<summary>흔한 실수 모음</summary>

- 방문 표시 시점: BFS 에서 꺼낼 때 표시하면 큐에 중복이 쌓여 느려지거나 메모리가 터진다. 넣을 때 표시한다.
- 무방향 그래프 간선을 한쪽에만 넣는다.
- 격자에서 범위 검사를 값 검사보다 뒤에 둬서 인덱스 에러가 난다. 범위 검사가 앞이다.
- 점 번호가 1 부터인데 배열을 N 크기로 만든다. N+1 로 만든다.
- 여러 시작점이 필요한 문제 (불이 여러 곳에서 번지는 격자 같은 것) 를 시작점마다 따로 BFS 돌린다. 시작점을 처음에 큐에 한꺼번에 넣고 한 번만 돌리는 게 맞다. 이 부분은 원리만 알고 있고 이 글에서 코드를 돌려 보지는 않았다.
- 표준 입력으로 큰 입력을 받는 문제에서 `input()`이 느려서 시간 초과가 난다. `sys.stdin.readline`을 쓴다.
</details>

## 비슷한 유형

가중치가 있는 그래프의 최단 거리는 BFS 로 안 되고 다익스트라 같은 걸 써야 한다. [자세히 → 최단 경로](#/post/algo-shortest-path)

트리는 사이클 없는 그래프라서 같은 탐색이 그대로 쓰인다. [자세히 → 트리와 힙](#/post/algo-tree-heap)

탐색 중 이미 계산한 값을 재활용하면 DP 로 넘어간다. [자세히 → DP](#/post/algo-dp)

## 근거 링크

- Python 문서, collections.deque: https://docs.python.org/3/library/collections.html#collections.deque
- Python 문서, sys.setrecursionlimit: https://docs.python.org/3/library/sys.html#sys.setrecursionlimit
- 네트워크: https://school.programmers.co.kr/learn/courses/30/lessons/43162
- 게임 맵 최단거리: https://school.programmers.co.kr/learn/courses/30/lessons/1844
- 무인도 여행: https://school.programmers.co.kr/learn/courses/30/lessons/154540

← [개념 map 으로](#/post/algo-map)