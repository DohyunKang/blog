栈是后进先出（LIFO），队列是先进先出（FIFO）。而双端队列（Deque）是一个两端都可以插入和删除元素的容器。在编程测试中，只要确定了“从哪一端插入、从哪一端删除”，问题基本就解决了。

## 三者有何不同

| | 插入位置 | 删除位置 | 顺序 | Python 实现 |
|---|---|---|---|---|
| 栈 | 后 | 后 | 后进先出 (LIFO) | `list`的`append`, `pop` |
| 队列 | 后 | 前 | 先进先出 (FIFO) | `deque`的`append`, `popleft` |
| 双端队列 | 前·后 | 前·后 | 均可 | `deque`的`append`, `appendleft`, `pop`, `popleft` |

叠盘子是栈，排队是队列。双端队列结合了两者特性，既可以当栈用也可以当队列用。因此在 Python 中，如果需要队列功能，直接使用 `deque` 即可。

## 为什么在 Python 中不建议用列表实现队列

虽然可以用列表实现队列，只需使用 `pop(0)` 从前端删除元素即可。但问题在于效率低下。根据 Python 官方文档，列表在执行 `pop(0)` 和 `insert(0, v)` 时，需要将剩余的所有元素向后移动一位，时间复杂度为 O(n)。相比之下，`deque` 在两端进行插入和删除操作的时间复杂度为 O(1)。教程文档也指出，用列表实现队列效率较差，建议使用 `collections.deque`。

我亲自测试了一下：对 5 万个元素从头到尾全部删除，列表耗时约 0.155 秒，而 deque 仅约 0.002 秒。这是我在一台 PC 上测得的数据，实际数值可能略有差异，但数量级确实不同。当输入规模达到 10 万或 100 万时，这种差距会导致超时。关于复杂度为何如此悬殊，详见 [详细说明 → 时间复杂度与 Python 基础](#/post/algo-complexity)。

栈则相反，用列表实现完全足够。因为从末尾插入和删除对列表来说也是 O(1)。

## 典型问题

此处仅列出题目名称，不复制正文。所有题目均来自 Programmers（ 프로그래머스），我已打开对应页面确认了标题和题型。

- **프로그래머스 올바른 괄호**：判断括号字符串是否合法。这是栈的最基本用法。
- **프로그래머스 뒤에 있는 큰 수 찾기 (오큰수)**：寻找每个元素右侧第一个更大的数。属于在栈中“暂存尚未找到答案的元素”的类型。
- **프로그래머스 주식가격**：计算各时间点价格未下跌的持续时间。与 오큰수 使用相同的解题框架。
- **프로그래머스 카드 뭉치**：当只能使用两个牌堆最顶部的牌时，判断能否按给定顺序组成单词。每个牌堆相当于一个从前端取出的队列。
- **프로그래머스 프로세스**：取出队首元素后，若发现更重要的任务排在后面，则将其重新放入队尾。属于在队列中同时存储（优先级，位置）的类型。
- **프로그래머스 두 큐 합 같게 만들기**：在两个队列之间移动元素，使它们的总和相等。操作完全等同于从一队列前端取出并插入到另一队列后端。

- [올바른 괄호](https://school.programmers.co.kr/learn/courses/30/lessons/12909)
- [뒤에 있는 큰 수 찾기](https://school.programmers.co.kr/learn/courses/30/lessons/154539)
- [주식가격](https://school.programmers.co.kr/learn/courses/30/lessons/42584)
- [카드 뭉치](https://school.programmers.co.kr/learn/courses/30/lessons/159994)
- [프로세스](https://school.programmers.co.kr/learn/courses/30/lessons/42587)
- [두 큐 합 같게 만들기](https://school.programmers.co.kr/learn/courses/30/lessons/118667)

## 解题思路步骤

1. 分析处理顺序：若需优先处理最近发生的操作，则用栈；若按进入顺序处理，则用队列。
2. 遇到括号匹配、撤销（undo）、“最近的 ~”等关键词时，优先考虑使用栈。
3. 若涉及从前端取出并重新放入后端的模拟操作，则使用队列。
4. 若两端都需要操作，则使用双端队列。
5. 检查是否能在一次遍历 O(n) 内完成。栈类问题通常每个元素只插入和删除一次，整体复杂度为 O(n)。

## Python 代码

以下代码均已亲自运行并验证了示例输入的结果。

### 올바른 괄호 (Valid Parentheses)

```python
def valid(s):
    st = []
    for c in s:
        if c == '(':
            st.append(c)
        elif not st:      # 닫는데 짝이 없음
            return False
        else:
            st.pop()
    return not st         # 남은 게 없어야 올바름

print(valid("(())()"), valid("(()"), valid("())("))
# True False False
```

### 오큰수 (在栈中存储索引)

```python
def nge(a):
    res = [-1] * len(a)
    st = []                       # 아직 오큰수를 못 찾은 인덱스
    for i, x in enumerate(a):
        while st and a[st[-1]] < x:
            res[st.pop()] = x     # x가 그들의 오큰수
        st.append(i)
    return res

print(nge([3, 5, 2, 7]))  # [5, 7, 7, -1]
print(nge([9, 5, 4, 8]))  # [-1, 8, 8, -1]
```

### 카드 뭉치 (队列)

```python
from collections import deque

def can_make(cards1, cards2, goal):
    q1, q2 = deque(cards1), deque(cards2)
    for w in goal:
        if q1 and q1[0] == w:
            q1.popleft()          # 첫 뭉치의 맨 앞 카드 사용
        elif q2 and q2[0] == w:
            q2.popleft()          # 둘째 뭉치의 맨 앞 카드 사용
        else:
            return "No"
    return "Yes"

print(can_make(["i", "drink", "water"], ["want", "to"],
               ["i", "want", "to", "drink", "water"]))   # Yes
print(can_make(["i", "water", "drink"], ["want", "to"],
               ["i", "want", "to", "drink", "water"]))   # No
```

<details>
<summary>주식가격과 프로세스 코드</summary>

주식가격은 오큰수와 비슷한데, 값이 "떨어지는" 순간 스택에서 꺼내 거리를 기록한다.

```python
def prices(p):
    ans = [0] * len(p)
    st = []
    for i, x in enumerate(p):
        while st and p[st[-1]] > x:
            j = st.pop()
            ans[j] = i - j
        st.append(i)
    for j in st:                  # 끝까지 안 떨어진 것들
        ans[j] = len(p) - 1 - j
    return ans

print(prices([1, 2, 3, 2, 3]))  # [4, 3, 1, 1, 0]
```

进程将（优先级、初始位置）放入队列，若剩余项的优先级高于已取出项，则将其回退。由于每次都要遍历 `any`，最坏情况为 O(n²)。在问题页面确认的限制是优先级数量不超过 100，这已经足够。

```python
from collections import deque

def printer(pr, loc):
    q = deque((p, i) for i, p in enumerate(pr))
    cnt = 0
    while q:
        p, i = q.popleft()
        if any(p < x for x, _ in q):
            q.append((p, i))
        else:
            cnt += 1
            if i == loc:
                return cnt

print(printer([2, 1, 3, 2], 2))        # 1
print(printer([1, 1, 9, 1, 1, 1], 0))  # 5
```

</details>

## 时间与空间复杂度

| 问题 | 时间 | 空间 | 原因 |
|---|---|---|---|
| 有效的括号 | O(n) | O(n) | 每个字符查看一次，最坏情况下全部压入栈 |
| 下一个更大元素·股票价格 | O(n) | O(n) | 每个元素进栈一次且出栈一次 |
| 卡片堆叠 | O(n) | O(n) | 仅检查 deque 前端单词 |
| 进程 | O(n²) | O(n) | 每次取出时需遍历剩余优先级 |

尽管“下一个更大元素”的循环中包含 `while`，但复杂度仍为 O(n)，起初令人困惑。内部 `while` 的总旋转次数不会超过元素总数。因为每个元素仅入栈一次、出栈一次。这种“累加总次数”的计数方式是分析栈问题复杂度的基础。

## 常见错误

- 在队列中使用 `list.pop(0)` 会导致超时。
- 栈为空时调用 `pop()` 会引发 `IndexError`。应在取出前通过 `if st` 进行检查。
- 在“下一个更大元素”中，若需存储索引而非值，却错误地存储了值；反之，若需计算距离或位置，则应存储索引。
- 试图对 `deque` 进行切片。`deque` 不支持类似 `q[1:3]` 的切片操作，且访问中间元素为 O(n)，因此不适合频繁通过索引遍历的场景。关于这一点，文档中提到“中间访问较慢”作为依据，但我尚未亲自验证其确切成本。

## 使用 deque 时

适用于两端均需操作的题目。例如，“使两个队列之和相等”这类在两个 deque 之间移动元素的问题；以及类似“滑动窗口最大值”中“在窗口内前后整理候选项”的问题。使用 `deque(maxlen=k)` 创建后，当填满后再插入新元素时，另一端会自动弹出，便于仅保留最近的 k 个元素。关于滑动窗口的详细内容，请参阅 [深入解析 → 双指针·滑动窗口·前缀和](#/post/algo-two-pointer)。

## 与其他类型的衔接

- 队列是 BFS 的核心结构；栈（或递归）是 DFS 的核心结构。[深入解析 → BFS·DFS 与图](#/post/algo-graph-search)
- 递归调用本身即构成调用栈，若递归过深，会因相同原理导致栈溢出。[深入解析 → 递归与回溯](#/post/algo-recursion)
- 若将“进入顺序”改为“优先级”作为取出依据，则变为优先级队列。[深入解析 → 树·堆·优先级队列](#/post/algo-tree-heap)
- 在遍历字符串或数组统计配对或计数的问题中，通常会结合哈希表使用。[深入解析 → 数组·字符串·哈希](#/post/algo-array-hash)

## 参考链接

- Python 文档，collections.deque：https://docs.python.org/3/library/collections.html（确认两端 O(1)、列表 `pop(0)` 为 O(n) 及 `maxlen` 行为）
- Python 教程，数据结构（将列表用作栈·队列）：https://docs.python.org/3/tutorial/datastructures.html
- 所用题目（Programmers，打开页面查看标题与类型）：
  - 有效的括号 https://school.programmers.co.kr/learn/courses/30/lessons/12909
  - 寻找后面更大的数 https://school.programmers.co.kr/learn/courses/30/lessons/154539
  - 股票价格 https://school.programmers.co.kr/learn/courses/30/lessons/42584
  - 卡片堆叠 https://school.programmers.co.kr/learn/courses/30/lessons/159994
  - 进程 https://school.programmers.co.kr/learn/courses/30/lessons/42587
  - 使两个队列之和相等 https://school.programmers.co.kr/learn/courses/30/lessons/118667

← 概念地图 (#/post/algo-map)

相关文章：[数组·字符串·哈希](#/post/algo-array-hash) · [BFS·DFS 与图](#/post/algo-graph-search) · [树·堆·优先级队列](#/post/algo-tree-heap)