DP 是将大问题分解为小问题，并记录答案以避免重复解决相同小问题的方法。核心几乎全在于“如何定义小问题”以及“如何将它们相互连接”，而非代码本身。

## DP 是什么

名字听起来很难，但做的事情很简单。根据维基百科的解释，这是由理查德·贝尔曼（Richard Bellman）在 20 世纪 50 年代初于 RAND 公司创造的术语，指代解决嵌套小决策问题的大决策问题的方法。名称中的"programming"并非指编程，而是更接近“填写表格（计划）”的意思。

要使 DP 奏效，必须满足两个条件：

| 条件 | 含义 | 示例 |
|---|---|---|
| 最优子结构 | 大问题的最优解由小问题的最优解构成 | 最短路径的一部分也是最短路径 |
| 重叠子问题 | 相同的小问题会多次出现 | 计算 fib(5) 时会多次调用 fib(2) |

如果没有第二个条件，那就是分治法；如果没有第一个条件，则无法用 DP 解决。利用重叠子问题只计算一次是 DP 的优势所在。

## 两种实现方式

通过斐波那契数列来看最为简单。如果直接递归实现，会不断重复计算相同值，导致 n 较大时无法运行。可以通过两种方式改进：

- **记忆化搜索 (top-down)**：保留递归结构，但将已计算的值得以存储，下次使用时直接取出。
- **动态规划 (bottom-up)**：从小的情况开始，通过循环填充表格向上推导。

```python
from functools import lru_cache

def fib_memo(n):
    @lru_cache(None)
    def f(k):
        return k if k < 2 else f(k - 1) + f(k - 2)
    return f(n)

def fib_tab(n):
    dp = [0, 1] + [0] * max(0, n - 1)
    for i in range(2, n + 1):
        dp[i] = dp[i - 1] + dp[i - 2]
    return dp[n]

print(fib_memo(50), fib_tab(50))  # 12586269025 12586269025
```

在编程测试中通常使用动态规划（自底向上）方式，因为无需担心递归深度限制（Python 默认约 1000）。不过，当不确定哪些状态实际需要时，记忆化搜索更方便，因为它只计算必要的部分。

## 解题思路步骤

识别出问题是 DP 问题后，按以下顺序进行思考：

1. **状态定义**：用一句话描述 `dp[i]` 的含义。如果在此处卡住，后续将无法进行。
2. **状态转移方程**：描述如何从更小的状态推导出 `dp[i]`。
3. **初始值**：确定状态转移方程所依赖的最小值（如 `dp[0]` 等）。
4. **计算顺序**：确保状态转移方程所需的值先被计算出来。
5. **答案位置**：确认答案是 `dp[n]`，还是整个表格的最大值。

通常判断“这题是不是 DP？”的感觉是：“题目询问最大值/最小值/方案数，且前面的选择会影响后面”。如果全搜索会呈指数级爆炸，但状态数量较少时，就应怀疑是否可用 DP 解决。

## 典型问题 1：背包 (0/1 knapsack)

Programmers 平台的“小偷”（动态规划）问题是典型的“偷还是不偷”结构。每个房子有金额，且不能连续盗窃相邻的房子，目标是求可盗窃的最大金额。虽然约束条件是“邻居禁止”而非“重量总和”，但核心骨架相同：决定对每个物品是拿还是放，以最大化总价值。以下是经典 0/1 背包问题（每个物品有重量和价值，在总重量不超过 K 的前提下最大化总价值）的解法。

- **状态**：`dp[c]` = 重量限制为 c 时能获得的最大价值
- **状态转移方程**：考虑放入物品 (w, v)，则 `dp[c] = max(dp[c], dp[c-w] + v)`
- **注意**：每个物品只能使用一次，因此需从大到小遍历 c。

```python
def knapsack(items, cap):
    dp = [0] * (cap + 1)
    for w, v in items:
        for c in range(cap, w - 1, -1):   # 거꾸로 돌아야 한 물건을 한 번만 쓴다
            dp[c] = max(dp[c], dp[c - w] + v)
    return dp[cap]

print(knapsack([(6, 13), (4, 8), (3, 6), (5, 12)], 7))  # 14
```

时间复杂度 O(N·K)，空间复杂度 O(K)。反之，如果从小到大遍历 c，则变成可无限次使用物品的完全背包问题。仅改变遍历方向就能改变问题类型，这令人惊叹。

## 典型问题 2：最长递增子序列 (LIS)

Programmers 平台的“整数三角形”（动态规划）是练习以“结束位置”作为状态定义的问题。以下是经典 LIS 问题（在保持顺序的前提下，从序列中选出最长的递增子序列的长度）的解法。

- **状态**：`dp[i]` = 以第 i 个元素结尾的最长递增子序列的长度
- **状态转移方程**：`dp[i] = max(dp[j] + 1)`（其中 j < i 且 a[j] < a[i]），若无符合条件的 j 则为 1
- **答案**：整个 `dp` 数组的最大值。经常忽略最后一个位置并非答案这一点。

```python
import bisect

def lis_n2(a):
    dp = [1] * len(a)
    for i in range(len(a)):
        for j in range(i):
            if a[j] < a[i]:
                dp[i] = max(dp[i], dp[j] + 1)
    return max(dp)

def lis_fast(a):
    tails = []
    for x in a:
        p = bisect.bisect_left(tails, x)
        if p == len(tails):
            tails.append(x)
        else:
            tails[p] = x
    return len(tails)

print(lis_n2([10, 20, 10, 30, 20, 50]), lis_fast([10, 20, 10, 30, 20, 50]))  # 4 4
```

O(N²) 解法的时间复杂度为 O(N²)，空间复杂度为 O(N)。若 N 达到百万级别，则需要使用上述的 `lis_fast` 方法，其时间复杂度为 O(N log N)。维基百科的 LIS 文档也介绍了利用二分查找实现的 O(n log n) 算法。`tails[k]` 表示“长度为 k+1 的递增子序列中末尾元素的最小值”，该数组始终保持有序，因此可进行二分查找。需要注意的是，`tails` 本身并不是实际的 LIS，它仅匹配长度。

<details>
<summary>为什么 lis_fast 是正确的（折叠）</summary>

当遇到新元素 x 时，在 `tails` 中找到第一个大于等于 x 的位置。

- 如果没有这样的空位，x 可以接在最长的序列后面，因此长度增加 1。
- 如果有，则将末尾的值改为 x。末尾值越小，后续能接上的数就越多，因此没有损失。

使用 `bisect_left` 的原因是在遇到相同值时，为了保持“递增”（必须严格变大）。如果是非递减序列（允许相等或变大），则应使用 `bisect_right`。我们随机测试了 300 个数组，验证了 `lis_n2` 和 `lis_fast` 是否得到相同的长度。
</details>

## 代表问题 3：硬币（最少数量）

Programmers“找零钱”是相同的硬币结构，但统计的是方案数而非最小数量。下面的问题是给定硬币种类，求总和为 k 的最小硬币数量（若不可能则为 -1）。

- 状态：`dp[i]` = 组成金额 i 所需的最少硬币数
- 递推式：`dp[i] = min(dp[i - c] + 1)`（遍历所有硬币 c）
- 初始值：`dp[0] = 0`，其余设为极大值

```python
def coin(coins, k):
    INF = 10**9
    dp = [0] + [INF] * k
    for i in range(1, k + 1):
        for c in coins:
            if i >= c and dp[i - c] + 1 < dp[i]:
                dp[i] = dp[i - c] + 1
    return dp[k] if dp[k] < INF else -1

print(coin([1, 5, 12], 15), coin([2], 3))  # 3 -1
```

时间复杂度 O(k × 硬币种类数)，空间复杂度 O(k)。例如用硬币 [1, 5, 12] 组成 15 时，贪心策略从大硬币开始取会得到 12+1+1+1（共 4 枚），但正确答案是 5+5+5（共 3 枚）。这是一个典型的贪心失效、必须使用 DP 的例子，建议结合 [贪心](#/post/algo-greedy) 一起阅读以区分两者。

<details>
<summary>加餐：LCS（两个字符串的最长公共子序列）</summary>

这类问题与 Programmers“等校门路”（动态规划）类似，需要填充二维表格。LCS 同样使用二维表格。`dp[i][j]` 表示字符串 a 的前 i 个字符与字符串 b 的前 j 个字符的 LCS 长度：若两个字符相同，则为 `dp[i-1][j-1] + 1`；若不同，则取 `max(dp[i-1][j], dp[i][j-1])`。

```python
def lcs(a, b):
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    return dp[-1][-1]

print(lcs("ACAYKP", "CAPCAK"))  # 4
```

时间复杂度与空间复杂度均为 O(N·M)。可以通过只保留一行将空间优化至 O(M)。
</details>

## 如何分析复杂度

DP 的时间复杂度通常为：(状态数) × (计算单个状态所需的转移次数)。例如背包问题是 K 个状态 × N 件物品，硬币问题是 k 个状态 × 硬币种类数。据此可初步判断“该解法是否在时限内通过”。空间方面，若递推式仅依赖前几个状态，可用少量变量替代整个数组；维基百科关于斐波那契数列的示例也指出，只需保留必要值即可将空间降为常数。

## 常见错误

- 状态定义模糊：仅写“dp[i] 是到 i 的答案”无法导出递推式，必须明确条件，如“以第 i 个结尾的”或“恰好组成 i 元的”。
- 遗漏初始值：求最小值问题需设 INF，求方案数则需 `dp[0] = 1` 等符合题意的初始设定。
- 背包遍历方向错误：如上所述，0/1 背包需倒序遍历。
- 盲目使用 DP：许多问题可用贪心或 [BFS/DFS](#/post/algo-graph-search) 解决，应先判断是否存在重叠子问题。
- 递归记忆化时受深度限制影响：在 Python 中若递归过深，需调用 `sys.setrecursionlimit` 或改用自底向上（bottom-up）方式。

## 相似题型

- [递归](#/post/algo-recursion)：记忆化 DP 的根源。熟悉递归有助于轻松处理 top-down 递推式。
- [贪心](#/post/algo-greedy)：如同硬币问题，常同时出现贪心与 DP 的判别标准。
- [最短路径](#/post/algo-shortest-path)：部分最短路径问题同样具备最优子结构性质。
- [复杂度](#/post/algo-complexity)：用于估算时间复杂度（状态数 × 转移次数）。

← 通过 [算法地图](#/post/algo-map) 查看概念图

## 参考资料

- [动态规划 — 维基百科](https://en.wikipedia.org/wiki/Dynamic_programming)：贝尔曼命名，最优子结构与子问题重叠，记忆化与自底向上，空间优化示例
- [最长递增子序列 — 维基百科](https://en.wikipedia.org/wiki/Longest_increasing_subsequence)：O(n log n) 算法与 tails 数组的含义
- 프로그래머스 [偷窃](https://school.programmers.co.kr/learn/courses/30/lessons/42897) / [整数三角形](https://school.programmers.co.kr/learn/courses/30/lessons/43105) / [零钱兑换](https://school.programmers.co.kr/learn/courses/30/lessons/12907) / [最短路径](https://school.programmers.co.kr/learn/courses/30/lessons/42898)：在问题页面查看标题与类型（动态规划）