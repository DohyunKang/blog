# 最短路径、并查集与拓扑排序

我们已经学会了如何使用 [BFS 和 DFS](#/post/algo-graph-search) 遍历图。本文介绍在此基础上常用的三种算法：当边有权重时寻找最便宜路径的迪杰斯特拉（Dijkstra）、快速判断两个元素是否属于同一集合的并查集（Union-Find），以及按先后顺序排列存在依赖关系任务的拓扑排序。这三种算法的代码都很简短，但更难的是弄清楚“何时使用它们”。

## 一目了然的对比

| 算法 | 适用场景 | 核心工具 | 时间复杂度 |
|---|---|---|---|
| 迪杰斯特拉 | 在有非负权重的图中，寻找从一个点到其他点的最小成本路径 | 优先队列 | O(E log V) |
| 并查集 | 判断两个元素是否属于同一集合，或合并集合 | 父节点数组 | 每次操作几乎 O(1) |
| 拓扑排序 | 确定有先后依赖关系的任务顺序，或检测环 | 入度 + 队列 | O(V+E) |

## 最短路径：迪杰斯特拉

### 类型说明

BFS 仅在将每条边视为单位距离（权重为 1）时才能给出最短距离。如果每条边的成本不同，则标准应是“总成本”而非“经过的边数”。迪杰斯特拉算法从起点开始，逐步确定最近的点。

其原理如下：将起点的距离设为 0，其余点设为无穷大。从未确定的点中取出距离最小的点进行确认，并检查通过该点是否能使邻居更近；若能则更新距离。只要边的权重非负，一旦某点被取出，其当前距离即为最小值，无需再次考虑。因此需要“快速取出最小值”，故使用堆（优先队列）。

若存在负权边，则该假设不成立。以维基百科的示例为例：s→a 为 2，s→b 为 5，b→a 为 -10。此时若将 a 的距离确定为 2，但实际路径 s→b→a 的成本为 -5。这种情况下应使用贝尔曼-福特算法（Bellman-Ford）。

### 典型问题

- **프로그래머스 배달 (Programmers Delivery)**：N 个村庄由双向道路连接，统计从 1 号村庄出发 K 小时内可达的村庄数量。只需计算从 1 号村庄到所有村庄的最短距离，并统计小于等于 K 的数量。
- **프로그래머스 합승 택시 요금 (Programmers Shared Taxi Fare)**：如何分割从起点到两个目的地的共享路段以降低成本？可多次运行迪杰斯特拉算法求解。

### 解题思路步骤

1. 检查边是否有成本且是否非负。若所有边权重均为 1，则 BFS 已足够。
2. 判断是单源最短路径还是全对最短路径。若是全对且顶点数较少（数百个），也可考虑弗洛伊德-沃舍尔算法（Floyd-Warshall）。
3. 构建邻接表，将距离数组初始化为无穷大，并将 (0, 起点) 加入堆中。
4. 若从堆中取出的距离大于当前记录的距离，则该项已过期，跳过处理。
5. 更新邻居并加入堆中。

### Python 代码

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

将边 (1,2,2)、(1,3,5)、(2,3,1)、(2,4,7)、(3,4,2)、(4,5,1) 作为双向边添加，并从 1 号点出发运行后，得到结果 `[inf, 0, 2, 3, 5, 6]`（索引 0 不使用）。可以看出路径 1→2→3 的成本低于直接走 5 的直连边。

### 复杂度分析

使用堆时时间复杂度为 O((V+E) log V)，在连通图中可简化为 O(E log V)。上述代码在每次更新时重新 push，并在取出时丢弃过期项；维基百科也介绍了这种替代 decrease-key 操作的方法。空间复杂度为 O(V+E)。

<details>
<summary>Python 输入技巧</summary>

对于边数较多的问题，建议使用 `sys.stdin.readline` 代替 `input()`。Python 的 heapq 是最小堆，且元组比较从第一个元素开始，因此必须按 (距离，顶点) 的顺序插入，才能按距离排序。这部分容易混淆，常导致错误。若需还原路径本身，在更新时应同时保存 `prev[v] = u`，并在到达终点后反向回溯。
</details>

## 并查集

### 类型说明

当频繁出现"A 和 B 是否在同一组”、“合并两个组”这类问题时使用并查集。每个元素指向其父节点，沿父节点向上追溯直至根节点，该根节点即为代表元；若两个元素的根节点相同，则它们属于同一集合。

若直接实现，可能形成极度倾斜的树结构，导致 find 操作退化至 O(n)。因此需结合两种优化技术：路径压缩是在 find 时将沿途访问过的节点直接连接到根节点；基于大小（或秩）的合并是将较小的树挂载到较大的树下。同时使用这两种方法时，m 次操作的复杂度为 Θ(m·α(n))，其中 α 是反阿克曼函数，在实际应用中 n 范围内其值不超过 4，可视为常数。

- 프로그래머스 네트워크：给定计算机连接信息，统计互相连通的计算机组数量。这是并查集（Union-Find）的最基本形式，只需合并后统计根节点的种类数即可。
- 프로그래머스 호텔 방 배정：如果客人想要的房间已满，则分配编号更大的最小空闲房间。每次分配房间时，通过维护“下一个空闲房间”的指针来模拟并查集操作。
- 프로그래머스 섬 연결하기：给定建桥成本，计算使所有岛屿互相可达的最小成本。将边按成本排序，仅选择不形成环的边，此过程结合了克鲁斯卡尔算法（Kruskal）与并查集。

### 解题思路顺序

1. 检查问题只问“是否连通”而不问具体路径。如果是这样，使用并查集比 BFS 更简单。
2. 检查合并操作是否在过程中持续发生（动态连接）。如果是一次性完成，DFS 也可以解决。
3. `find` 操作通常采用路径压缩，`union` 操作则按大小或秩进行合并。
4. 如果是克鲁斯卡尔算法，当 `union` 返回 `False`（表示已在同一组）时，丢弃该边。

### Python 代码

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

对 5 个元素依次合并 (1,2)、(2,3)、(1,3)、(4,5)，得到结果 `True, True, False, True`。第三个为 `False` 是因为 1 和 3 已在同一集合中，在克鲁斯卡尔算法中，这直接表示“该边会形成环”。最后确认 1 和 3 在同一集合，而 1 和 4 在不同集合。

由于递归实现的 `find` 可能触及 Python 的递归深度限制，因此使用迭代方式实现更为安全。

### 复杂度分析

每次操作接近 O(1)（准确说是反阿克曼函数 O(α(n))），空间复杂度为 O(n)。维基百科指出该下界已被证明，无法进一步降低。

## 拓扑排序

### 类型说明

当存在一个有向图，其边表示"A 必须要在 B 之前完成”的先后关系时，将所有边从前指向后排列的过程称为拓扑排序。典型应用场景包括课程先修、构建依赖、任务顺序等。只有无环有向图（DAG）才能进行拓扑排序。结果顺序可能不唯一。

卡恩算法（Kahn's Algorithm）最为常见：将入度为 0 的节点加入队列，取出一个节点并添加到结果中，同时删除该节点指向的边；若因此使某些邻居的入度变为 0，则将其加入队列。如果最终结果长度小于 n，说明存在环，同时也完成了环的检测。

### 代表题目

- LeetCode 210 Course Schedule II：给定课程先修关系，返回一种能修完所有课程的顺序；若不可能，则返回空数组。直接应用卡恩算法。
- LeetCode 207 Course Schedule：在相同输入下，仅需判断是否能修完所有课程（即是否存在环），无需返回具体顺序。
- 若题目要求当先修关系相同时优先输出编号较小的节点，则需将队列替换为堆（见下方解题思路第 6 点）。

### 解题思路顺序

1. 检查是否出现“顺序”、“先行”、“必须先做”等关键词。
2. 确定边的方向（先行 → 后行），注意不要弄反方向。
3. 构建入度数组。
4. 将入度为 0 的节点加入队列，并在处理过程中减少相关节点的入度。
5. 若结果数量不等于 n，则存在环。
6. 若需满足额外顺序条件（如优先小编号），则将队列替换为堆。

### Python 代码

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

运行 (1,2)、(1,3)、(2,4)、(3,4) 得到 `[1, 2, 3, 4]`；若加入 1→2→3→1 的环，则返回 `None`。

### 复杂度分析

时间复杂度 O(V+E)，空间复杂度 O(V+E)。

## 易混淆概念

- 戴克斯特拉算法（Dijkstra）是一种贪心算法，核心是“每次取出距离最小的节点”。它在处理负权边时会出错，原因也在于此。
- 若所有边的权重相同或仅为 0/1，则无需使用戴克斯特拉算法，可用 BFS 或 0-1 BFS 解决。
- 并查集仅支持合并集合，不支持拆分。对于涉及删除边的问题，通常采用时间倒流策略，将删除边转化为反向的合并操作来求解。
- 拓扑排序的结果可能不唯一；若题目要求特定顺序，需额外加入相应规则（如使用堆）。

## 相似类型

- 无权最短路径与搜索：[BFS·DFS 与图](#/post/algo-graph-search)
- 戴克斯特拉算法使用的堆：[树·堆·优先队列](#/post/algo-tree-heap)
- 每步选择最优解的策略：[贪心算法](#/post/algo-greedy)
- 用递推式求解最短路径的方法：[动态规划 (DP)](#/post/algo-dp)
- 时间计算：[时间复杂度与 Python 基础](#/post/algo-complexity)

## 参考资料链接

- 外卖：https://school.programmers.co.kr/learn/courses/30/lessons/12978
- 拼车出租车费用：https://school.programmers.co.kr/learn/courses/30/lessons/72413
- 网络：https://school.programmers.co.kr/learn/courses/30/lessons/43162
- 酒店房间分配：https://school.programmers.co.kr/learn/courses/30/lessons/64063
- 连接岛屿：https://school.programmers.co.kr/learn/courses/30/lessons/42861
- LeetCode 课程表 II：https://leetcode.com/problems/course-schedule-ii/
- LeetCode 课程表：https://leetcode.com/problems/course-schedule/
- Dijkstra 算法 (Wikipedia)：https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm
- 不相交集合数据结构 (Wikipedia)：https://en.wikipedia.org/wiki/Disjoint-set_data_structure
- 拓扑排序 (Wikipedia)：https://en.wikipedia.org/wiki/Topological_sorting

← [概念 map](#/post/algo-map)