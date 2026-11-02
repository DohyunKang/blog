木構造の問題は、コードにそのまま巡回順序を書けるかが半分であり、ヒープは「最も小さい（大きい）ものを繰り返し取り出す」問題の道具だと理解した。

## 木とは何か

木はノードが親と子で繋がった構造である。一番上をルート、子を持たないノードをリーフと呼ぶ。サイクルがなく、ルートからどのノードへも経路がただ一つしかない。子が最大 2 つのものを二分木という。コーディングテストでは木はほぼ二分木か、エッジリストで与えられる一般の木である。一般の木は隣接リストで保存して [グラフ探索](#/post/algo-graph-search) のように解く。

用語は数個覚えておけばよい。

| 用語 | 意味 |
|---|---|
| 深さ | ルートからそのノードまでのエッジの数 |
| 高さ | ルートから最も深いリーフまでの深さ（ノード数で数えるかエッジで数えるかは問題ごとに異なるので確認） |
| サブツリー | あるノードをルートとみなしたとき、その下の全体 |

木の問題のほとんどは、「サブツリーも木である」という性質から生まれる。左サブツリーを同じ関数で解き、右も解き、合わせればよい。そのため [再帰](#/post/algo-recursion) と相性が良い。

## 二分木の巡回

巡回はルート何时訪問するかによって分けられる。

| 巡回 | 順序 | 用途 |
|---|---|---|
| 先頭 (Preorder) | ルート → 左 → 右 | 木のコピー、構造の出力 |
| 中間 (Inorder) | 左 → ルート → 右 | 二分探索木におけるソートされた順序 |
| 末尾 (Postorder) | 左 → 右 → ルート | 子の結果を集めて親を計算（高さ、合計） |
| レベル | 上層から一行ずつ | 最短深さ、階層ごとの処理 |

最初の 3 つは深さ優先探索 (DFS) であり再帰で書くが、レベル順巡回は [キュー](#/post/algo-stack-queue) を使う幅優先探索 (BFS) である。以下の木で実際に回してみた。

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

実行結果（実際に回して確認）。

```
전위 [1, 2, 4, 5, 3, 6]
중위 [4, 2, 5, 1, 3, 6]
후위 [4, 5, 2, 6, 3, 1]
레벨 [1, 2, 3, 4, 5, 6]
높이 3
```

時間はノードを一度ずつ見るため O(N)、空間は再帰の深さ分なので O(高さ) である。片寄った木では高さが N になり、Python の再帰制限（デフォルトで約 1000）に引っかかる可能性がある。その場合は `sys.setrecursionlimit` を上げたりスタックに変えたりする。

## ヒープと優先度キュー

優先度キューは「入れた順序ではなく優先度の高いものから取り出すキュー」という概念である。ヒープはその実装のためのデータ構造だ。両者は同じように使われるが、一方は役割であり他方は実装である。

最小ヒープは「すべての親が子よりも小さい（または等しい）」という条件を満たす完全二分木である。最も小さな値は常にルートにある。ソートされているわけではなく、親と子の関係だけが満たされている。

Python の `heapq` はリストをヒープのように使う。公式ドキュメントによると `heap[0]` が最小値であり、インデックス `k` の子は `2k+1`, `2k+2` である。そのため木を別途作る必要はなく配列一つで済む。

| 関数 | 動作 | 時間 |
|---|---|---|
| `heappush(h, x)` | 追加 | O(log N) |
| `heappop(h)` | 最小値を取り出す | O(log N) |
| `h[0]` | 最小値を見る | O(1) |
| `heapify(list)` | リストをヒープにする | O(N) |

`heapify` が O(N) というのはドキュメントに「線形時間」とある通りである。push を N 回行うと O(N log N) となるので、すでにデータが揃っている場合は heapify の方がよい。

```python
import heapq
a = [5, 3, 8, 1, 9, 2]
heapq.heapify(a)
print(a)  # [1, 3, 2, 5, 9, 8]  (직접 실행 확인)
```

結果がソートされていないことがわかる。ただし `a[0]` は 1 である。一つずつ pop すると `[1, 2, 3, 5, 8, 9]` の順で出てくる。

### 最大ヒープは符号を反転させる

`heapq` は最小ヒープのみを提供してきた。ドキュメントを見ると、Python 3.14 で `_max` を含む `heappush_max` などの関数が追加されたという。それ以前のバージョンも使えるため、コーディングテストでは値に `-` を付けて入れ、取り出す際に再度反転させる方式が一般的である。

```python
m = []
for x in [5, 3, 8]:
    heapq.heappush(m, -x)
print(-heapq.heappop(m))  # 8
```

タプルを入れると最初の要素を基準にして比較する。ドキュメントには優先度が同じ場合第二の要素同士で比較する必要があり、そうでないとエラーになるためカウンターを挟むように書かれている。

## 代表的な問題

番号と名前のみ記載する。本文は各サイトで読むのが正しい。

- 프로그래머스 길 찾기 게임: 노드 좌표로 이진 트리를 만들고 전위·후위 순회 결과를 반환합니다. 위 순회 함수를 그대로 사용합니다.
- 프로그래머스 이중우선순위큐: 삽입과 "최댓값 삭제·최솟값 삭제" 명령을 처리하고 남은 최댓값·최솟값을 반환합니다. 최소 힙과 최대 힙 (부호 뒤집기) 을 함께 다루는 연습입니다.
- 프로그래머스 야근 지수: N 시간 동안 일감을 줄여 남은 일감 제곱의 합을 최소화합니다. 가장 큰 값을 계속 꺼내 하나 줄여 다시 넣는 최대 힙 문제입니다.
- 프로그래머스 디스크 컨트롤러: 요청된 작업 중 소요 시간이 짧은 것, 같으면 요청 시각이 빠른 것, 또 같으면 번호가 작은 것부터 처리합니다. 기준이 여럿이라 튜플을 넣는 힙입니다.
- 프로그래머스 더 맵게: 가장 안 매운 둘을 섞어 새 값을 다시 넣는 문제입니다. 항상 가장 작은 둘을 꺼내 합치는 [그리디](#/post/algo-greedy) 에 힙을 붙인 형태입니다.

## 풀이 생각 순서

1. 문제가 "계속 가장 작은 (큰) 것"을 꺼내고 새 값이 중간에 들어오는지 봅니다. 그렇다면 힙입니다. 한 번만 정렬하면 되는 문제는 [정렬](#/post/algo-sort-search) 로 끝납니다.
2. 최대를 원하면 부호를 뒤집습니다. 기준이 둘이면 `(기준1, 기준2)` 튜플로 넣습니다.
3. 꺼낸 값으로 새 값을 만들어 다시 넣는지 확인합니다. 더 맵게가 이 형태입니다.
4. 트리 문제는 "자식 결과로 부모를 계산"하면 후위, "부모 정보를 내려보내면" 전위, 층이 중요하면 레벨 순회를 고릅니다.

### 코드로 보기

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

세 함수 모두 직접 실행해 출력을 확인했습니다.

## 복잡도

| 작업 | 시간 | 공간 |
|---|---|---|
| 트리 순회 (전·중·후·레벨) | O(N) | 재귀 O(높이) / 레벨은 큐 O(폭) |
| 힙 N 개 push·pop | O(N log N) | O(N) |
| K 번째 큰 수 (크기 K 힙) | O(N log K) | O(K) |

K 번째 큰 수에서 전부 정렬하면 O(N log N) 이지만, 크기를 K 로 묶어 두면 힙이 작아져 log K 가 됩니다. K 가 작을 때 차이가 납니다.

## 흔한 오해

- 힙은 정렬된 배열이다: 아닙니다. 위에서 본 대로 `heapify` 결과는 정렬이 아니고 루트만 보장됩니다.
- 힙에서 중간 값을 찾을 수 있다: 최솟값 외의 탐색은 O(N) 입니다. 특정 값을 빼야 하는 문제는 지연 삭제나 다른 구조를 고민해야 합니다.
- 이진 트리와 이진 탐색 트리는 같다: 이진 탐색 트리는 왼쪽 < 루트 < 오른쪽이라는 조건이 더 붙습니다. 힙은 이진 트리지만 그 조건이 없습니다.
- 레벨 순회에 재귀를 쓴다: 가능은 하지만 보통 큐로 씁니다.

## 비슷한 유형

- 정렬 후 하나씩 처리하는 문제는 [정렬·탐색](#/post/algo-sort-search)
- 힙이 핵심 도구가 되는 가중치 그래프 문제는 [최단 경로](#/post/algo-shortest-path)(다익스트라)
- 매번 최솟값을 고르는 [그리디](#/post/algo-greedy)

<details>
<summary>자세한 풀이: 힙에 넣고 뺄 때 일어나는 일</summary>

push 는 배열 끝에 새 값을 붙인 뒤 부모와 비교하며 위로 올립니다. 부모보다 작으면 자리를 바꾸고, 아니면 멈춥니다. 트리 높이가 log N 이라 최대 그만큼만 올라갑니다. pop 은 루트를 꺼내고 맨 끝 값을 루트로 옮긴 뒤 두 자식 중 작은 쪽과 비교하며 아래로 내립니다. 마찬가지로 높이만큼만 갑니다.

이 동작은 구현을 읽고 이해한 설명이고, CPython `heapq` 의 정확한 내부 구현은 이번에 소스를 열어 보지 않았습니다.

</details>

← [개념 map 으로](#/post/algo-map)

관련 글: [그래프 탐색](#/post/algo-graph-search) · [스택·큐](#/post/algo-stack-queue) · [그리디](#/post/algo-greedy)

## 근거 링크

- Python 문서, heapq: https://docs.python.org/3/library/heapq.html
- Wikipedia, Tree traversal: https://en.wikipedia.org/wiki/Tree_traversal
- 길 찾기 게임: https://school.programmers.co.kr/learn/courses/30/lessons/42892
- 이중우선순위큐: https://school.programmers.co.kr/learn/courses/30/lessons/42628
- 야근 지수: https://school.programmers.co.kr/learn/courses/30/lessons/12927
- 디스크 컨트롤러: https://school.programmers.co.kr/learn/courses/30/lessons/42627
- 더 맵게: https://school.programmers.co.kr/learn/courses/30/lessons/42626