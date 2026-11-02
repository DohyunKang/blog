BFS와 DFS는 그래프의 점을 하나씩 빠짐없이 도는 두 가지 방법이고, 둘의 차이는 다음에 볼 점을 큐에 쌓느냐 스택에 쌓느냐 하나뿐이다.

## 그래프가 뭔지

그래프는 점(정점)과 점끼리 잇는 선(간선)의 모음이다. 지하철 노선도, 친구 관계, 웹페이지 링크가 다 그래프다. 선에 방향이 있으면 방향 그래프, 없으면 무방향 그래프라고 한다.

코드로 들고 있는 방법은 보통 인접 리스트다. 점마다 "나와 이어진 점 목록"을 하나씩 들고 있는 방식이다. 파이썬에서는 리스트의 리스트나 딕셔너리로 쓴다.

```python
graph = {1: [2, 3, 4], 2: [5], 3: [4], 4: [], 5: []}
```

격자(2차원 배열) 문제는 칸 하나가 점이고, 상하좌우로 이웃한 칸이 간선이다. 따로 그래프를 만들 필요 없이 좌표 계산(dy, dx)으로 이웃을 바로 구한다. 이 글의 문제 절반은 격자다.

[배열·해시 쪽 기본기는 → 배열과 해시](#/post/algo-array-hash)

## 탐색이 뭔지

시작점에서 갈 수 있는 점을 전부 한 번씩 방문하는 것이 탐색이다. 두 가지를 정해야 한다. 어디서 시작할지, 그리고 지금 점에서 이웃이 여럿일 때 어느 쪽을 먼저 볼지. 이 두 번째가 BFS와 DFS를 가른다.

- BFS(너비 우선): 가까운 점부터 훑는다. 시작점과 거리 1인 점을 전부, 그다음 거리 2인 점을 전부, 이런 식이다. 먼저 발견한 점을 먼저 처리해야 하니 큐(FIFO)를 쓴다.
- DFS(깊이 우선): 한 갈래로 갈 수 있는 데까지 끝까지 들어갔다가 막히면 돌아와서 다음 갈래를 본다. 나중에 발견한 점을 먼저 처리하니 스택(LIFO)이고, 재귀 호출이 곧 스택이다.

| | BFS | DFS |
|---|---|---|
| 자료구조 | 큐 | 스택(또는 재귀) |
| 도는 순서 | 가까운 점부터 | 한 길로 깊이 |
| 잘 맞는 문제 | 최단 거리(간선 가중치 없을 때) | 연결 요소, 경로 존재 여부, 영역 크기 |
| 메모리 | 한 층의 폭만큼 큐가 커짐 | 깊이만큼 스택이 커짐 |

위 `graph`로 1번에서 시작하면 BFS는 1, 2, 3, 4, 5 순서로 돌고 DFS는 1, 2, 5, 3, 4 순서로 돈다. 직접 돌려서 확인했다.

## 방문 체크가 전부다

두 알고리즘에서 가장 많이 빠뜨리는 게 방문 체크다. 점을 방문했다고 표시하지 않으면 사이클이 있는 그래프에서 같은 점을 계속 돌아 무한 루프가 된다. 표시하는 시점도 중요한데, BFS에서는 큐에 넣을 때 표시하는 게 맞다. 꺼낼 때 표시하면 같은 점이 큐에 여러 번 들어간다.

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

큐는 `deque`를 쓴다. Python 문서에 따르면 deque는 양쪽 끝 추가·제거가 O(1)이고, 리스트의 `pop(0)`은 나머지를 전부 밀어야 해서 O(n)이다. 리스트로 큐를 만들어도 답은 나오지만 점이 많아지면 시간이 터진다.

## DFS 코드

재귀로 쓰면 짧다.

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

파이썬은 재귀 깊이 한계가 있다. 이 PC에서 `sys.getrecursionlimit()`을 찍어 보니 1000이었다. 점이 10만 개짜리 일직선 그래프라면 재귀 DFS는 바로 `RecursionError`가 난다. `sys.setrecursionlimit`으로 올릴 수는 있지만 문서가 너무 높이면 인터프리터가 죽을 수 있다고 경고한다. 깊이가 클 수 있으면 스택을 직접 쓰는 쪽이 안전하다.

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

스택 버전은 꺼낼 때 방문 표시를 한다. 이웃을 `reversed`로 넣는 건 재귀 버전과 같은 순서로 돌게 하려는 것이다. 순서가 상관없는 문제면 빼도 된다. 두 버전 모두 같은 그래프에서 1, 2, 5, 3, 4가 나왔다.

[스택·큐 자체가 궁금하면 → 스택과 큐](#/post/algo-stack-queue) / [재귀가 헷갈리면 → 재귀](#/post/algo-recursion)

## 대표 문제 1: 연결 요소 개수

백준 11724번 "연결 요소의 개수"는 무방향 그래프에서 서로 오갈 수 있는 덩어리가 몇 개인지 세는 문제다.

생각 순서는 이렇다.

1. 아직 방문 안 한 점이 있으면 거기서 탐색을 한 번 시작한다. 그 탐색으로 같은 덩어리가 통째로 방문 처리된다.
2. 탐색을 시작한 횟수가 덩어리 개수다.
3. 방문 안 한 점이 남아 있는 동안 반복한다.

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

6개 점에 간선 (1,2), (2,5), (5,1), (3,4), (4,6)이면 2개, 마지막 간선을 빼면 6번이 혼자 남아 3개가 나왔다.

## 대표 문제 2: 미로 최단 거리

백준 2178번 "미로 탐색"은 0과 1로 된 격자에서 1인 칸만 밟아 (1,1)에서 (N,M)까지 가는 최소 칸 수를 구하는 문제다.

가중치 없는 격자에서 최단 거리는 BFS가 푼다. 층별로 도니까 어떤 칸에 처음 도착한 순간이 최소 거리이기 때문이다. 방문 배열 대신 거리 배열을 쓰면 방문 체크와 거리 기록이 한 번에 된다.

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
            if 0 <= ny < n and 0 <= nx < m and grid[ny][nx] == '1' and dist[ny][nx] == -1:
                dist[ny][nx] = dist[y][x] + 1
                q.append((ny, nx))
    return dist[n - 1][m - 1]
```

예제 격자(`101111`, `101010`, `101011`, `111011`)로 돌리니 15가 나왔다. 이 문제는 DFS로 풀면 안 되는 대표 사례다. DFS는 먼저 닿은 길이 짧다는 보장이 없다.

## 대표 문제 3: 영역 크기 세기

백준 2667번 "단지번호붙이기"는 격자에서 1로 이어진 덩어리가 몇 개고 각각 크기가 얼마인지 구하는 문제다. 최단 거리가 아니라 덩어리를 세는 거라 BFS든 DFS든 상관없다. 연결 요소와 같은 구조에 칸 수 세기만 붙은 셈이다.

```python
def islands(grid):
    n, m = len(grid), len(grid[0])
    seen = [[False] * m for _ in range(n)]
    sizes = []
    for i in range(n):
        for j in range(m):
            if grid[i][j] == '1' and not seen[i][j]:
                seen[i][j] = True
                st = [(i, j)]
                size = 0
                while st:
                    y, x = st.pop()
                    size += 1
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < n and 0 <= nx < m and grid[ny][nx] == '1' and not seen[ny][nx]:
                            seen[ny][nx] = True
                            st.append((ny, nx))
                sizes.append(size)
    return sorted(sizes)
```

`1101`, `1001`, `0011`, `1000`을 넣으니 크기 [1, 3, 4]가 나왔다. 여기서는 스택에 넣을 때 방문 표시를 했는데, 이렇게 하면 같은 칸이 중복으로 안 들어가서 순서를 신경 쓰지 않는 문제에는 이쪽이 단순하다.

## 문제 보고 고르는 순서

1. 최단 거리·최소 이동 횟수를 묻는가 → BFS.
2. 덩어리 개수·영역 크기·갈 수 있는지 여부인가 → BFS든 DFS든 되니 더 쉬운 쪽.
3. 깊이가 커질 수 있는가(일직선 모양) → 파이썬이면 재귀 DFS 피하고 스택이나 BFS.
4. 모든 경우를 해 보는 문제(백트래킹)인가 → DFS. 이건 이 글의 범위 밖이다.

## 시간·공간 복잡도

점이 V개, 간선이 E개일 때 인접 리스트 기준으로 BFS와 DFS는 둘 다 O(V + E)다. 점마다 한 번 꺼내고, 간선은 양 끝에서 한 번씩 훑기 때문이다. 공간도 방문 배열과 큐(스택)로 O(V)다. 격자라면 V가 N×M이고 E는 칸당 최대 4개라서 O(N×M)이다.

인접 행렬로 들고 있으면 이웃을 찾는 데 점마다 V번을 보니 O(V²)이 된다. 점이 많고 간선이 적은 문제에서는 인접 리스트가 맞다.

<details>
<summary>흔한 실수 모음</summary>

- 방문 표시 시점: BFS에서 꺼낼 때 표시하면 큐에 중복이 쌓여 느려지거나 메모리가 터진다. 넣을 때 표시한다.
- 무방향 그래프 간선을 한쪽에만 넣는다.
- 격자에서 범위 검사를 값 검사보다 뒤에 둬서 인덱스 에러가 난다. 범위 검사가 앞이다.
- 점 번호가 1부터인데 배열을 N 크기로 만든다. N+1로 만든다.
- 여러 시작점이 필요한 문제(익은 토마토처럼)를 시작점마다 따로 BFS 돌린다. 시작점을 처음에 큐에 한꺼번에 넣고 한 번만 돌리는 게 맞다. 이 부분은 원리만 알고 있고 이 글에서 코드를 돌려 보지는 않았다.
- 입력이 많은 문제에서 `input()`이 느려서 시간 초과가 난다. `sys.stdin.readline`을 쓴다.
</details>

## 비슷한 유형

가중치가 있는 그래프의 최단 거리는 BFS로 안 되고 다익스트라 같은 걸 써야 한다. [자세히 → 최단 경로](#/post/algo-shortest-path)

트리는 사이클 없는 그래프라서 같은 탐색이 그대로 쓰인다. [자세히 → 트리와 힙](#/post/algo-tree-heap)

탐색 중 이미 계산한 값을 재활용하면 DP로 넘어간다. [자세히 → DP](#/post/algo-dp)

## 근거 링크

- Python 문서, collections.deque: https://docs.python.org/3/library/collections.html#collections.deque
- Python 문서, sys.setrecursionlimit: https://docs.python.org/3/library/sys.html#sys.setrecursionlimit
- 문제 번호(본문 복제 없이 번호·이름만): 백준 11724, 2178, 2667

## 확인 못 함

- 백준 문제 본문과 예제는 열어 보지 않았다. 위 문제 설명은 번호·이름에서 알려진 유형 기준이고, 코드는 내가 만든 작은 예제로만 돌렸다(실제 제출 채점은 안 함).
- 여러 시작점 BFS는 코드 실행 확인 못 함.
- 파이썬 기본 재귀 한계 1000은 이 PC에서 확인한 값이다. 환경에 따라 다를 수 있다.

← [개념 지도로](#/post/algo-map)
