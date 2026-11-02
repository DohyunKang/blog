树问题中，能否直接写出遍历顺序占了成功的一半；而堆则是解决“反复取出最小（或最大）元素”这类问题的工具。

## 什么是树

树是由节点通过父子关系连接而成的结构。最顶端的节点称为根，没有子节点的节点称为叶。树中没有环，且从根到任意节点的路径唯一。如果每个节点最多有两个子节点，则称为二叉树。在编程测试中，遇到的树几乎都是二叉树，或是以边列表形式给出的普通树。普通树通常用邻接表存储，并像 [图搜索](#/post/algo-graph-search) 那样进行求解。

只需了解几个术语即可：

| 术语 | 含义 |
|---|---|
| 深度 | 从根到该节点的边数 |
| 高度 | 从根到最深叶子的深度（是按节点数计算还是按边数计算，视具体问题而定，请注意确认） |
| 子树 | 将某个节点视为根时，其下方的所有部分 |

树的几乎所有问题都源于“子树也是树”这一性质。只需递归地解决左子树和右子树，然后合并结果即可。因此，[递归](#/post/algo-recursion) 与树非常契合。

## 二叉树遍历

遍历方式根据访问根节点的时机不同而分类：

| 遍历类型 | 顺序 | 用途 |
|---|---|---|
| 前序 | 根 → 左 → 右 | 复制树、输出结构 |
| 中序 | 左 → 根 → 右 | 在二叉搜索树中获得排序后的序列 |
| 后序 | 左 → 右 → 根 | 收集子节点结果以计算父节点（如高度、求和） |
| 层序 | 从上至下逐层处理 | 获取最短深度、按层处理 |

前三种属于深度优先搜索（DFS），通常使用递归实现；而层序遍历则是广度优先搜索（BFS），需使用 [队列](#/post/algo-stack-queue)。下方代码直接演示了这些操作。

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

运行结果（已亲自验证）。

```
전위 [1, 2, 4, 5, 3, 6]
중위 [4, 2, 5, 1, 3, 6]
후위 [4, 5, 2, 6, 3, 1]
레벨 [1, 2, 3, 4, 5, 6]
높이 3
```

时间复杂度为 O(N)，因为每个节点只访问一次；空间复杂度为递归深度，即 O(高度)。对于形状极度倾斜的树，高度可能达到 N，从而触发 Python 的递归限制（默认约 1000）。此时应使用 `sys.setrecursionlimit` 提高限制，或将递归改为显式栈实现。

## 堆与优先队列

优先队列的概念是“并非按插入顺序出队，而是按优先级高的元素先出队”。堆是实现该功能的底层数据结构。两者常被混用，但前者指角色（接口），后者指实现。

最小堆是一个满足“所有父节点小于或等于其子节点”条件的完全二叉树。最小值始终位于根节点。它并非全局有序，仅保证父子关系满足大小约束。

Python 的 `heapq` 模块利用列表模拟堆。根据官方文档，`heap[0]` 为最小值；索引 `k` 处的节点的子节点索引为 `2k+1` 和 `2k+2`。因此无需构建独立的树结构，仅用一个数组即可完成。

| 函数 | 功能 | 时间复杂度 |
|---|---|---|
| `heappush(h, x)` | 插入元素 | O(log N) |
| `heappop(h)` | 弹出最小值 | O(log N) |
| `h[0]` | 查看最小值 | O(1) |
| `heapify(list)` | 将列表转为堆 | O(N) |

文档指出 `heapify` 的时间为“线性时间”。若需插入 N 次元素，总耗时为 O(N log N)，因此当数据已齐全时，使用 `heapify` 更高效。

```python
import heapq
a = [5, 3, 8, 1, 9, 2]
heapq.heapify(a)
print(a)  # [1, 3, 2, 5, 9, 8]  (직접 실행 확인)
```

输出结果并非排序状态。但 `a[0]` 确实为 1。逐个弹出元素将按 `[1, 2, 3, 5, 8, 9]` 的顺序输出。

### 最大堆通过取反实现

`heapq` 长期以来仅提供最小堆支持。查阅文档可知，Python 3.14 中新增了如 `heappush_max` 等 `_max` 系列函数。为兼容旧版本，在编程测试中常见做法是插入时将值取负，弹出后再还原符号。

```python
m = []
for x in [5, 3, 8]:
    heapq.heappush(m, -x)
print(-heapq.heappop(m))  # 8
```

若传入元组，则依据第一个元素进行比较。文档指出：当优先级相同时需比较第二个元素；否则将引发错误，因此建议插入计数器作为辅助字段。

## 典型问题

仅列出编号与名称。详细内容请查阅各网站原文。

- 프로그래머스 길 찾기 게임：根据节点坐标构建二叉树，并返回前序和后序遍历结果。直接使用前序遍历函数。
- 프로그래머스 이중우선순위큐：处理“插入”、“删除最大值”和“删除最小值”指令，并返回剩余的最大值和最小值。这是同时操作最小堆和最大堆（通过取反符号）的练习。
- 프로그래머스 야근 지수：在 N 小时内减少工作量，使剩余工作量的平方和最小化。这是一个不断取出最大值、将其减一后重新放入的最大堆问题。
- 프로그래머스 디스크 컨트롤러：在处理请求时，优先处理耗时短的任务；若耗时相同，则优先处理请求时间早的任务；若仍相同，则优先处理编号小的任务。由于有多个排序标准，因此使用包含元组的堆。
- 프로그래머스 더 맵게：将最不辣的两个混合并重新插入新值的问题。这是结合了贪心策略（始终取出最小的两个合并）与堆的结构。

## 解题思路顺序

1. 观察问题是否涉及“不断取出最小（或最大）的值”，以及新生成的值是否会插入中间。如果是，则使用堆。只需排序一次即可解决的问题可以用 [排序](#/post/algo-sort-search) 解决。
2. 如果需要最大值，可以取反符号。如果有多个排序标准，则使用 `(标准 1, 标准 2)` 形式的元组放入堆中。
3. 检查是否根据取出的值生成新值并再次插入。`더 맵게`（更辣）就是这种形式。
4. 对于树问题：如果“根据子节点结果计算父节点”，则是后序遍历；如果“向下传递父节点信息”，则是前序遍历；如果层级很重要，则选择层序遍历。

### 代码示例

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

上述三个函数均已直接运行并确认了输出结果。

## 复杂度分析

| 操作 | 时间复杂度 | 空间复杂度 |
|---|---|---|
| 树遍历（前/中/后/层序） | O(N) | 递归 O(高度) / 层序使用队列 O(宽度) |
| 堆 N 次 push/pop | O(N log N) | O(N) |
| 第 K 大的数（大小为 K 的堆） | O(N log K) | O(K) |

对于第 K 大的数，如果全部排序需要 O(N log N)，但如果限制大小为 K 并使用堆，复杂度变为 O(N log K)。当 K 较小时，这种差异尤为明显。

## 常见误区

- 堆是已排序的数组：不对。如上所述，`heapify` 的结果并非完全排序，仅保证根节点满足条件。
- 可以在堆中查找中间值：除了最小值外，其他值的搜索复杂度为 O(N)。需要删除特定值的问题需要考虑延迟删除或其他数据结构。
- 二叉树与二叉搜索树相同：不对。二叉搜索树额外满足“左子节点 < 根节点 < 右子节点”的条件。堆虽然是二叉树，但不具备该条件。
- 层序遍历使用递归：虽然可行，但通常使用队列实现。

## 类似题型

- 排序后逐个处理的问题属于 [排序与搜索](#/post/algo-sort-search) 范畴。
- 以堆为核心工具的加权图问题属于 [最短路径](#/post/algo-shortest-path)（如 Dijkstra 算法）。
- 每次选择最小值的 [贪心](#/post/algo-greedy) 策略。

<details>
<summary>详细解析：向堆中插入和删除时的操作</summary>

push 操作是将新值附加到数组末尾，然后与父节点比较并向上移动。如果小于父节点则交换位置，否则停止。由于树的高度为 log N，因此最多向上移动 log N 次。pop 操作是取出根节点，将末尾元素移至根节点位置，然后与两个子节点中较小的那个比较并向下移动。同样地，最多向下移动 log N 次。

以上描述是基于对实现代码的理解，CPython `heapq` 的精确内部实现在此次未查看源码的情况下无法确认。

</details>

← [概念映射](#/post/algo-map)

相关文章：[图搜索](#/post/algo-graph-search) · [栈与队列](#/post/algo-stack-queue) · [贪心](#/post/algo-greedy)

## 参考链接

- Python 文档，heapq: https://docs.python.org/3/library/heapq.html
- Wikipedia, Tree traversal: https://en.wikipedia.org/wiki/Tree_traversal
- 길 찾기 게임：https://school.programmers.co.kr/learn/courses/30/lessons/42892
- 이중우선순위큐：https://school.programmers.co.kr/learn/courses/30/lessons/42628
- 야근 지수：https://school.programmers.co.kr/learn/courses/30/lessons/12927
- 디스크 컨트롤러：https://school.programmers.co.kr/learn/courses/30/lessons/42627
- 더 맵게：https://school.programmers.co.kr/learn/courses/30/lessons/42626