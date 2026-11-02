递归是通过函数调用自身，将问题分解为更小的同类问题的方法；而回溯则是利用这种递归逐一尝试选项，若行不通则回退一步的搜索策略。

## 什么是递归

递归函数会在其内部再次调用自己。要使递归结束，必须满足两个条件：

- **终止条件 (base case)**：无需进一步分解即可直接得出答案的情况。
- **递推规则 (recursive case)**：将大问题转化为一个更小的同类问题的规则。

阶乘是最常见的例子。`5! = 5 × 4!`且 `1! = 1`。如果没有终止条件，或者每次调用时问题没有变小，递归将无法结束。

```python
def fact(n):
    if n <= 1:          # 종료 조건
        return 1
    return n * fact(n - 1)   # 한 단계 작은 같은 문제

print(fact(5))  # 120
```

## 通过调用栈理解

调用 `fact(3)` 会触发 `fact(2)`，进而调用 `fact(1)`。当最内层返回数值后，外层接收该值并进行乘法运算后再返回。调用过程是层层堆叠的（栈），而返回时则逐层解除。

```
fact(3)
 └ fact(2)
    └ fact(1) → 1
    ← 2 * 1 = 2
 ← 3 * 2 = 6
```

因此，递归存在“进入时做的事”和“退出时做的事”。回溯中的回退操作正是“退出时做的事”。

## 用递归思考的顺序

面对问题时，按以下顺序进行思考：

1. 用一句话定义该函数的功能。（例如：`dfs(i)` = 从第 i 个选择开始直到结束的所有尝试）
2. 最小情况的答案是什么？这就是终止条件。
3. 缩小一步后能否用相同的函数解决？这就是递归调用。
4. 相信调用过程。假设内部调用已正确处理，只需编写当前步骤的逻辑。

第 4 点最难。如果试图在脑海中完全追踪内部调用，很容易陷入僵局；因此，先定义函数的功能并信任该定义更为方便。

## 写作前需注意：重复调用与深度限制

若直接使用 `fib(n) = fib(n-1) + fib(n-2)` 计算斐波那契数列，会导致同一值被多次重复计算。由于调用大致呈二叉树状不断分支，随着 n 增大，计算量将难以承受。若存储已计算过的值（记忆化），则每个值只需计算一次。相关内容可参考 [详细介绍 → 动态规划](#/post/algo-dp)。

```python
def fib(n, memo={}):
    if n < 2:
        return n
    if n not in memo:
        memo[n] = fib(n - 1) + fib(n - 2)
    return memo[n]

print(fib(50))  # 12586269025
```

此外还需注意深度限制。Python 对递归深度设有上限（在我的环境中 `sys.getrecursionlimit()` 为 1000），超过该限制会抛出 `RecursionError`。Python 文档指出，此限制是为了防止无限递归导致 C 栈溢出并使解释器崩溃；虽然可以通过 `setrecursionlimit` 提高限制，但设置过高可能导致崩溃。在编程测试中，若深度达到数万级别，改用循环或显式栈更为安全。

## 什么是回溯

回溯是一种选择某个选项，通过递归将其后续路径探索到底，然后撤销该选择并尝试下一个选项的方法。其框架几乎相同。

```
def dfs(상태):
    if 끝났다:          # 답 하나 완성
        기록; return
    for 선택지 in 후보들:
        if 못 고르는 선택지: continue   # 가지치기
        선택하기
        dfs(다음 상태)
        선택 되돌리기      # 이게 백트래킹
```

核心在于：既要遍历所有情况，又要尽早剪枝（pruning）掉不可能成功的分支。与暴力搜索的区别就在于这种剪枝策略。由于“选择 → 递归 → 回退”这三步循环往复的模式容易上手，一旦熟悉，只需更换具体问题即可应用。

## 典型问题

仅列出编号与名称，未复制正文内容。这些问题均来自 Programmers 平台。

- [피로도](https://school.programmers.co.kr/learn/courses/30/lessons/87946)：计算所有访问地牢的顺序，找出能探索最远路径的情况。属于排列回溯。
- [모음사전](https://school.programmers.co.kr/learn/courses/30/lessons/84512)：由元音 A、E、I、O、U 组成的长度不超过 5 的单词按字典序排列时，找出给定单词是第几个。属于按字典序逐个生成的递归。
- [메뉴 리뉴얼](https://school.programmers.co.kr/learn/courses/30/lessons/72411)：从订单列表中抽取菜单组合，找出被共同订购次数最多的组合。在列举组合时附加哈希值。
- [N-Queen](https://school.programmers.co.kr/learn/courses/30/lessons/12952)：在 N×N 棋盘上放置 N 个皇后，使它们互不攻击的方案数。
- [타겟 넘버](https://school.programmers.co.kr/learn/courses/30/lessons/43165)：为每个数字添加 + 或 - 符号，求和等于目标值的方案数。由于每个数字分为两种分支的递归，与下方“放入或不放入”的框架相同。

## 代码

### 排列：顺序有意义且无重复

```python
def permutations_of(n, m):
    res, path, used = [], [], [False] * (n + 1)
    def dfs():
        if len(path) == m:
            res.append(tuple(path)); return
        for i in range(1, n + 1):
            if used[i]: continue
            used[i] = True; path.append(i)
            dfs()
            path.pop(); used[i] = False   # 되돌리기
    dfs()
    return res
```

### 组合：只向前推进以避免重复

```python
def combinations_of(n, m):
    res, path = [], []
    def dfs(start):
        if len(path) == m:
            res.append(tuple(path)); return
        for i in range(start, n + 1):
            path.append(i)
            dfs(i + 1)       # 다음은 i 뒤에서만 고른다
            path.pop()
    dfs(1)
    return res
```

执行后验证了结果顺序和数值与 `itertools.permutations(range(1,5), 2)` 及 `itertools.combinations(range(1,6), 3)` 一致（分别为 12 个和 10 个）。

### 放或不放（子序列求和、目标数字）

```python
def count_subsets(a, target):
    cnt = 0
    def dfs(i, s):
        nonlocal cnt
        if i == len(a):
            if s == target: cnt += 1
            return
        dfs(i + 1, s + a[i])   # a[i]를 넣는다
        dfs(i + 1, s)          # 안 넣는다
    dfs(0, 0)
    return cnt
```

“目标数字”问题是将“不放”的位置替换为“减去 (`s - a[i]`)"的相同框架。验证了程序mers输入输出示例 `[1, 1, 1, 1, 1], 3 → 5` 和 `[4, 1, 2, 1], 4 → 2` 能得出相同的值。

```python
def target_number(a, target):
    cnt = 0
    def dfs(i, s):
        nonlocal cnt
        if i == len(a):
            if s == target: cnt += 1
            return
        dfs(i + 1, s + a[i])   # 더한다
        dfs(i + 1, s - a[i])   # 뺀다
    dfs(0, 0)
    return cnt
```

疲劳度问题是在排列框架的基础上，仅添加了“当前是否允许进入该疲劳度”的剪枝逻辑。验证了输入输出示例 `k=80, [[80,20],[50,40],[30,10]] → 3` 的结果。

```python
def max_dungeons(k, dungeons):
    best, used = 0, [False] * len(dungeons)
    def dfs(k, cnt):
        nonlocal best
        best = max(best, cnt)
        for i, (need, cost) in enumerate(dungeons):
            if used[i] or k < need: continue   # 못 들어가면 가지치기
            used[i] = True
            dfs(k - cost, cnt + 1)
            used[i] = False                    # 되돌리기
    dfs(k, 0)
    return best
```

### N-Queens：每行一个，检查列与对角线

```python
def n_queens(n):
    cols, d1, d2 = set(), set(), set()
    cnt = 0
    def dfs(r):
        nonlocal cnt
        if r == n:
            cnt += 1; return
        for c in range(n):
            if c in cols or (r - c) in d1 or (r + c) in d2:
                continue            # 가지치기
            cols.add(c); d1.add(r - c); d2.add(r + c)
            dfs(r + 1)
            cols.remove(c); d1.remove(r - c); d2.remove(r + c)
    dfs(0)
    return cnt
```

对 n=1~9 进行测试，结果分别为 1, 0, 0, 2, 10, 4, 40, 92, 352。其中 n=8 的结果为 92，与维基百科关于 8 皇后文档中记载的数值（互不相同的解有 92 个）一致。

<details>
<summary>详细解析：为何 N-Queens 的检查要这样做</summary>

皇后会攻击同一行、列或对角线上的棋子。逐行放置且每行只放一个，因此从开始就不会发生行冲突。剩下的需要检查的是列和两个方向的对角线。

- 列：若 `c` 相同则发生冲突。
- `↘` 对角线：同一对角线上的格子满足 `r - c` 相等。
- `↙` 对角线：同一对角线上的格子满足 `r + c` 相等。

将这三个值存入集合，即可一次性完成冲突检查。这种方法比遍历整个数组进行比较要快得多。回溯时，必须移除之前添加的值；若漏掉任何一个移除操作，后续的分支搜索就会静默出错。

</details>

## 时间与空间复杂度

| 问题 | 时间 | 空间（调用深度 + 辅助） |
|---|---|---|
| 阶乘 | O(n) | O(n) |
| 斐波那契（无记忆化） | 指数级 | O(n) |
| 斐波那契（有记忆化） | O(n) | O(n) |
| 排列 nPm 枚举 | O(nPm × m) 左右 | O(n) |
| 组合 nCm 枚举 | O(nCm × m) 左右 | O(m) |
| 子序列求和 | O(2ⁿ) | O(n) |
| N-Queens | 最坏情况接近 O(n!)，但通过剪枝大幅减少搜索量 | O(n) |

对于需要列出所有结果的问题，处理结果数量本身是必须付出的代价。可以将回溯法视为适用于输入规模较小（N 在 10~20 左右）的解法。若 N 较大，则需要采用其他方法。剪枝能减少多少取决于具体问题，因此上述关于 N-Queens 的“大幅减少”仅描述了方向，并非通用公式。

## 常见错误

- 遗漏回溯操作。缺少 `path.pop()` 或 `used[i] = False` 这样的语句会导致后续分支被污染。
- 将 `path` 本身直接加入结果列表。由于后续会修改 `path`，应使用 `tuple(path)` 或 `path[:]` 进行复制后再添加。
- 终止条件过晚。即使已经不可能继续，若仍遍历到底部会导致超时。应尽早剪枝。
- 作为默认参数传入的空字典（如 `memo={}`）会在调用之间共享。虽然在上述斐波那契示例中是故意这样写的，但在其他场景下容易导致意外的 bug。

## 相似类型

- 遍历图上的所有情况：[详情 → 图搜索 (BFS·DFS)](#/post/algo-graph-search)
- 存在重叠子问题时：[详情 → 动态规划](#/post/algo-dp)
- 估算时间复杂度的方法：[详情 → 时间与空间复杂度](#/post/algo-complexity)
- 若对调用栈结构感兴趣：[详情 → 栈·队列](#/post/algo-stack-queue)

← [概念映射图](#/post/algo-map)

相关文章：[图搜索](#/post/algo-graph-search) · [动态规划](#/post/algo-dp) · [贪心算法](#/post/algo-greedy)

## 参考资料

- Python 文档，sys.setrecursionlimit：https://docs.python.org/3/library/sys.html#sys.setrecursionlimit
- Wikipedia，八皇后问题：https://en.wikipedia.org/wiki/Eight_queens_puzzle
- 使用的问题（Programmers）：疲劳度 https://school.programmers.co.kr/learn/courses/30/lessons/87946 · 元音字典 https://school.programmers.co.kr/learn/courses/30/lessons/84512 · 菜单更新 https://school.programmers.co.kr/learn/courses/30/lessons/72411 · N-皇后 https://school.programmers.co.kr/learn/courses/30/lessons/12952 · 目标数字 https://school.programmers.co.kr/learn/courses/30/lessons/43165