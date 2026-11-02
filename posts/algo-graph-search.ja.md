BFS 와 DFS 는 그래프의 정점을 하나씩 빠짐없이 방문하는 두 가지 방법이며, 두 알고리즘의 차이는 다음에 방문할 정점을 큐 (Queue) 에 쌓느냐 스택 (Stack) 에 쌓느냐 하나뿐입니다.

## 그래프란 무엇인가

그래프는 정점 (점) 과 정점끼리 잇는 간선 (선) 의 모음입니다. 지하철 노선도, 친구 관계, 웹페이지 링크가 모두 그래프입니다. 간선에 방향이 있으면 방향 그래프, 없으면 무방향 그래프라고 합니다.

코드로 표현하는 방법은 보통 인접 리스트입니다. 각 정점에 대해 "나와 연결된 정점 목록"을 하나씩 가지고 있는 방식입니다. 파이썬에서는 리스트의 리스트나 딕셔너리를 사용합니다.

```python
graph = {1: [2, 3, 4], 2: [5], 3: [4], 4: [], 5: []}
```

격자 (2 차원 배열) 문제에서는 칸 하나가 정점이 되며, 상하좌우로 이웃한 칸이 간선입니다. 별도의 그래프를 만들 필요 없이 좌표 계산 (`dy`, `dx`) 으로 이웃을 바로 구할 수 있습니다. 이 글의 문제 절반은 격자 문제입니다.

[배열·해시 기본기는 → 배열과 해시](#/post/algo-array-hash)

## 탐색이란 무엇인가

시작점에서 갈 수 있는 정점을 모두 한 번씩 방문하는 것을 탐색이라고 합니다. 두 가지를 결정해야 합니다. 어디서 시작할지, 그리고 현재 정점의 이웃이 여러 개일 때 어느 쪽을 먼저 볼지입니다. 이 두 번째 요소가 BFS 와 DFS 를 구분합니다.

- **BFS (너비 우선)**: 가까운 정점부터 훑습니다. 시작점과 거리 1 인 정점을 모두 방문한 다음, 거리 2 인 정점을 모두 방문하는 식입니다. 먼저 발견한 정점을 먼저 처리해야 하므로 큐 (FIFO) 를 사용합니다.
- **DFS (깊이 우선)**: 한 갈래로 갈 수 있는 곳까지 끝까지 들어갔다가 막히면 돌아와서 다음 갈래를 봅니다. 나중에 발견한 정점을 먼저 처리하므로 스택 (LIFO) 이며, 재귀 호출이 곧 스택입니다.

| | BFS | DFS |
|---|---|---|
| 자료구조 | 큐 | 스택 (또는 재귀) |
| 방문 순서 | 가까운 정점부터 | 한 길로 깊이 |
| 적합한 문제 | 최단 거리 (간선 가중치가 없을 때) | 연결 요소, 경로 존재 여부, 영역 크기 |
| 메모리 | 한 층의 폭만큼 큐가 커짐 | 깊이만큼 스택이 커짐 |

위 `graph`를 1 번에서 시작하면 BFS 는 1, 2, 3, 4, 5 순서로 방문하고 DFS 는 1, 2, 5, 3, 4 순서로 방문합니다. 직접 실행하여 확인했습니다.

## 방문 체크가 전부다

두 알고리즘에서 가장 많이 빠뜨리는 것이 방문 체크입니다. 정점을 방문했다고 표시하지 않으면 사이클이 있는 그래프에서 같은 정점을 계속 돌아 무한 루프에 걸립니다. 표시하는 시점도 중요한데, BFS 에서는 큐에 넣을 때 표시하는 것이 맞습니다. 꺼낼 때 표시하면 같은 정점이 큐에 여러 번 들어갑니다.

## BFS 코드

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

큐는 `deque`를 사용합니다. 파이썬 문서에 따르면 deque 는 양쪽 끝에 추가·제거가 O(1) 이고, 리스트의 `pop(0)` 은 나머지를 모두 밀어야 해서 O(n) 입니다. 리스트로 큐를 만들어도 답은 나오지만 정점이 많아지면 시간이 터집니다.

## DFS 코드

재귀로 쓰면 짧습니다.

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

파이썬은 재귀 깊이 한계가 있습니다. 이 PC 에서 `sys.getrecursionlimit()`을 찍어 보니 1000 이었습니다. 정점이 10 만 개짜리 일직선 그래프라면 재귀 DFS 는 바로 `RecursionError` 가 납니다. `sys.setrecursionlimit` 으로 올릴 수는 있지만 값을 너무 높이면 인터프리터가 죽을 수 있다고 경고합니다. 깊이가 클 수 있으면 스택을 직접 쓰는 쪽이 안전합니다.

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

스택 버전은 꺼낼 때 방문 표시를 합니다. 이웃을 `reversed` 로 넣는 것은 재귀 버전과 같은 순서로 돌게 하려는 것입니다. 순서가 상관없는 문제라면 빼도 됩니다. 두 버전 모두 같은 그래프에서 1, 2, 5, 3, 4 가 나왔습니다.

[스택·큐 자체가 궁금하면 → 스택과 큐](#/post/algo-stack-queue) / [재귀가 헷갈리면 → 재귀](#/post/algo-recursion)

## 대표 문제 1: 연결 요소 개수

프로그래머스 "네트워크"는 컴퓨터 n 대의 연결 정보가 주어질 때, 직접이거나 다른 컴퓨터를 거쳐서든 서로 통하는 컴퓨터 묶음 (네트워크) 이 몇 개인지 세는 문제입니다. 무방향 그래프에서 서로 오갈 수 있는 덩어리가 몇 개인지 세는 연결 요소 문제 그대로입니다.

생각 순서는 다음과 같습니다.

1. 아직 방문하지 않은 정점이 있으면 거기서 탐색을 한 번 시작합니다. 그 탐색으로 같은 덩어리가 통째로 방문 처리됩니다.
2. 탐색을 시작한 횟수가 덩어리 개수입니다.
3. 방문하지 않은 정점이 남아 있는 동안 반복합니다.

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

6 개 정점에 간선 (1,2), (2,5), (5,1), (3,4), (4,6) 이라면 2 개이며, 마지막 간선을 빼면 6 번이 혼자 남아 3 개가 나옵니다.

이 문제는 연결 정보가 인접 행렬 (`computers[i][j] == 1`이면 i 번과 j 번이 연결) 로 주어집니다. 위 `components`에 넣으려면 간선 목록으로 바꿔 주기만 하면 됩니다.

```python
def solution(n, computers):
    edges = [(i + 1, j + 1) for i in range(n) for j in range(i + 1, n) if computers[i][j] == 1]
    return components(n, edges)
```

문제 페이지의 예제 두 개 (`[[1,1,0],[1,1,0],[0,0,1]]`은 2, `[[1,1,0],[1,1,1],[0,1,1]]`은 1) 를 돌려 맞는 것을 확인했습니다.

## 대표 문제 2: 미로 최단 거리

프로그래머스 "게임 맵 최단거리"는 1이 길, 0이 벽인 격자에서 왼쪽 위에서 오른쪽 아래까지 상하좌우로만 움직여 지나가는 최소 칸 수를 구하는 문제다. 도착할 수 없으면 -1 을 반환한다.

가중치 없는 격자에서 최단 거리는 BFS 가 해결한다. 층별로 탐색하기 때문에 어떤 칸에 처음 도달한 순간이 최소 거리이기 때문이다. 방문 배열 대신 거리 배열을 사용하면 방문 체크와 거리 기록이 한 번에 가능하다.

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

거리 배열을 -1 로 채워 두니, 도착 칸이 끝까지 -1 이라면 그대로 "갈 수 없음"의 답이 된다. 문제 페이지의 예제 두 개를 실행하니 11 과 -1 이 나왔다. 이 문제는 DFS 로 풀면 안 되는 대표 사례다. DFS 는 먼저 닿은 경로가 짧다는 보장이 없다.

## 대표 문제 3: 영역 크기 세기

프로그래머스 "무인도 여행"은 바다 (`X`) 와 숫자 (1~9, 식량 양) 가 적힌 격자에서 상하좌우로 이어진 땅 덩어리마다 식량 합을 구해 오름차순으로 반환하고, 땅이 없으면 `[-1]` 을 반환하는 문제다. 최단 거리가 아니라 덩어리를 세는 것이므로 BFS 나 DFS 는 상관없다. 연결 요소와 같은 구조에 덩어리 안의 값 더하기만 붙은 셈이다.

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
2. 덩어리 개수·영역 크기·갈 수 있는지 여부인가 → BFS든 DFS든 되니 더 쉬운 쪽을 선택한다.
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
- 여러 시작점이 필요한 문제 (불이 여러 곳에서 번지는 격자 같은 것)를 시작점마다 따로 BFS 돌린다. 시작점을 처음에 큐에 한꺼번에 넣고 한 번만 돌리는 게 맞다. 이 부분은 원리만 알고 있고 이 글에서 코드를 돌려 보지는 않았다.
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