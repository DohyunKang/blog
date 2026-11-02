# 双指针·滑动窗口·前缀和

数组中询问“连续子区间”的问题很多。例如：有多少个子区间的和为 M，或者长度为 K 的子区间中和最大的那个是什么。最先想到的方法是用双重 for 循环遍历起点和终点，但这会导致 O(N²) 的复杂度。即使 N 达到 10^5，运算次数也会高达 100 亿，从而导致超时。本文介绍的这三种方法都基于“不丢弃已计算的结果并加以复用”这一思路，将复杂度降为 O(N)。

如果看不懂复杂度表示法，可以先看 [详细介绍 → 时间复杂度与 Python 基础](#/post/algo-complexity)。

## 三种类型

| 类型 | 核心思想 | 适用场景 |
|---|---|---|
| 双指针 | 两个索引仅沿一个方向移动 | 在已排序数组中查找和、满足条件的区间 |
| 滑动窗口 | 固定长度（或根据条件伸缩）的窗口每次移动一格 | 长度为 K 的子区间和/最大值、不含重复字符的最长子串 |
| 前缀和 | 预先存储从开头到当前位置的和，通过减法求区间和 | 当需要多次查询区间和时 |

双指针与滑动窗口的界限有时比较模糊。由于两者都是只向右移动区间的两端，因此属于同一类方法；通常将“从两端向中间收缩”称为双指针，而将“整体推动一个区间”称为滑动窗口。

## 1. 双指针：从两端收缩

典型问题是 Programmers「救生艇」。当一艘船最多能载 2 人且有重量限制时，求救出所有人所需的最少船只数。基本框架与“寻找和为 target 的数对”相同。先将数组排序，并在左端点 (l) 和右端点 (r) 设置指针。首先以“寻找和为 target 的数对”为例：

- 若和小于 X，则将 l 向右移动（需要更大的数）。
- 若和大于 X，则将 r 向左移动。
- 若相等，则找到目标。

由于数组已排序，一旦丢弃某个候选就不需要再回头查看，这是关键性质。对于不满足该性质的问题（如未排序或包含负数导致区间和不单调的情况）则不能使用此方法。

```python
def two_sum_sorted(a, target):
    l, r = 0, len(a) - 1
    while l < r:
        s = a[l] + a[r]
        if s == target:
            return (l, r)
        if s < target:
            l += 1
        else:
            r -= 1
    return None

print(two_sum_sorted([1, 2, 3, 4, 5, 6], 9))  # (2, 5)
```

救生艇是在相同框架下仅改变条件：排序后比较最轻的人 (l) 和最重的人 (r)。若两人总重不超过限制，则一起上船（移动 l）；否则最重的人无法与任何人同乘，只能单独上船。无论哪种情况，最重的人 (r) 都会在这艘船上被移除。

```python
def boats(people, limit):
    a = sorted(people)
    l, r, cnt = 0, len(a) - 1, 0
    while l <= r:
        if a[l] + a[r] <= limit:
            l += 1               # 가장 가벼운 사람도 같이 탄다
        r -= 1                   # 가장 무거운 사람은 이번 보트에 탄다
        cnt += 1
    return cnt

print(boats([70, 50, 80, 50], 100))  # 3
print(boats([70, 80, 50], 100))      # 3
```

时间复杂度为排序 O(N log N) + 搜索 O(N)，空间复杂度为 O(1)。若输入已排序，则仅需 O(N) 进行搜索（救生艇问题本身未排序，因此需要排序）。

## 2. 双指针：扩展与收缩区间

典型问题是 Programmers「连续子数组的和」（在非降序排列的序列中，寻找和为 k 的最短连续子数组）。以下代码使用相同框架统计“和为 M 的连续子区间个数”，随后附上该问题的解法。序列元素均为正数这一条件至关重要：因为正数会使区间扩展时和增大、收缩时和减小，所以指针无需回退。

解题思路如下：

1. 用一个变量 s 记录区间 [l, r] 的和。
2. 将 r 向右移动一格，并加上 a[r]。
3. 若和超过 M，则移动 l 并减去 a[l]，直到和不超过 M。
4. 若和等于 M，则计数加一。

```python
def count_sub(a, m):
    l = s = cnt = 0
    for r in range(len(a)):
        s += a[r]
        while s > m and l <= r:
            s -= a[l]
            l += 1
        if s == m:
            cnt += 1
    return cnt

print(count_sub([1, 2, 3, 2, 5, 1, 1, 1, 2], 5))  # 4
```

「连续子数组的和」问题并非统计个数，而是求“和为 k 的最短子数组”的起止索引。同样地，每当遇到和为 k 的区间时，更新最短区间的起止位置。

```python
def shortest_k(seq, k):
    l = s = 0
    best = None
    for r, x in enumerate(seq):
        s += x
        while s > k:
            s -= seq[l]
            l += 1
        if s == k and (best is None or r - l < best[1] - best[0]):
            best = (l, r)
    return list(best)

print(shortest_k([1, 2, 3, 4, 5], 7))           # [2, 3]
print(shortest_k([1, 1, 1, 2, 3, 4, 5], 5))     # [6, 6]
print(shortest_k([2, 2, 2, 2, 2], 6))           # [0, 2]
```

l 和 r 各自最多移动 N 次，因此整体复杂度为 O(N)。虽然 for 循环内包含 while 循环看似是 O(N²)，但 l 永远不会回退，内部 while 循环的总执行次数不会超过 N。空间复杂度为 O(1)。题目页面的限制是序列长度最大 10^6，O(N²) 无法通过，必须采用此方法。

<details>
<summary>为何是 O(N)？更详细的解释</summary>

外层 for 循环执行 N 次。内层 while 循环在 l 每次增加时执行一次。l 的值从 0 开始，最多增加到 N，且不会减少，因此 while 循环体执行的总次数合计不超过 N 次。所以总运算量约为 N + N = 2N，即 O(N)。这种不按单次循环计数而是按整体累计计算的方法称为摊还分析（amortized analysis）。

</details>

## 3. 滑动窗口

长度可变的滑动窗口典型问题包括 Programmers 的「宝石购物」（包含所有种类宝石的最短区间）和 LeetCode 3「不含重复字符的最长子串」。而固定长度 K 的窗口则是“连续 K 天之和的最大值”等问题的基础形式；Programmers 的「连续子数组求和个数」问题则需要遍历从 1 到 N 的所有长度，计算所有连续区间的和，此时滑动窗口的思想依然适用。

### 固定长度窗口

先累加前 K 个元素，每次移动一格时，加上新进入的值并减去离开的值。如果每次都重新累加 K 个元素，复杂度为 O(NK)，但采用上述方法可优化至 O(N)。

```python
def max_window(a, k):
    s = sum(a[:k])
    best = s
    for i in range(k, len(a)):
        s += a[i] - a[i - k]
        best = max(best, s)
    return best

print(max_window([2, 1, 5, 1, 3, 2], 3))  # 9
```

### 长度可变的窗口

不含重复字符的最长子串中，窗口的长度是不固定的。逐步扩展右端点 (r)，当遇到已在窗口内的字符时，将左端点 (l) 移至该字符上次出现位置的下一位。同时记录每个字符的最后出现位置到字典中。

```python
def longest_distinct(s):
    last = {}
    l = best = 0
    for r, ch in enumerate(s):
        if ch in last and last[ch] >= l:
            l = last[ch] + 1
        last[ch] = r
        best = max(best, r - l + 1)
    return best

print(longest_distinct("abcabcbb"))  # 3
print(longest_distinct("abba"))      # 2
```

若遗漏 `last[ch] >= l` 这一条件，在处理 "abba" 时会出错。这是因为左端点 l 会错误地回退到已移出窗口的旧位置。时间复杂度 O(N)，空间复杂度为字符种类数，即 O(min(N, 字符种类))。

## 4. 前缀和

典型问题是 Programmers 的「连续子数组求和个数」。在环形数组（末尾之后接开头）中，统计有多少种不同的连续子数组之和。可将环形数组视为将原数组连接两次形成长度为 2N 的普通数组来处理。若对长度为 L、起始点为 i 的区间每次查询都重新累加，复杂度为 O(L)，整体则为 O(N³)。因此，预先计算从开头到各位置的前缀和。

定义 `prefix[i] = a[0] + ... + a[i-1]`（其中 `prefix[0] = 0`），则区间 [i, j] 的和可表示为 `prefix[j+1] - prefix[i]`，仅需一次减法运算。若在数组开头添加一个 0，即可避免单独处理 i=0 的情况。

```python
def build(a):
    p = [0]
    for x in a:
        p.append(p[-1] + x)
    return p

p = build([10, 20, 30, 40, 50])
print(p)            # [0, 10, 30, 60, 100, 150]
print(p[4] - p[1])  # 20+30+40 = 90
```

预处理时间复杂度 O(N)，单次查询 O(1)，空间复杂度 O(N)。应用于环形数组问题时如下所示：

```python
def count_sums(e):
    n = len(e)
    d = e + e                    # 원형을 두 번 이어 붙임
    p = [0]
    for x in d:
        p.append(p[-1] + x)
    sums = set()
    for length in range(1, n + 1):
        for i in range(n):
            sums.add(p[i + length] - p[i])
    return len(sums)

print(count_sums([7, 9, 1, 1, 4]))  # 18
```

由于区间和可在 O(1) 时间内求得，整体复杂度为 O(N²)。题目页面的限制是元素数量不超过 1,000，因此该方案完全足够。对于需要在区间上频繁增加值的问题（如 Programmers 的「未被破坏的建筑」），则需使用反向应用前缀和思想的差分数组。详细内容请参见 [详情 → 数组·字符串·哈希](#/post/algo-array-hash)。Python 中可使用 `itertools.accumulate`，通过 `list(accumulate(a, initial=0))` 生成相同的前缀和数组。

### 前缀和 + 哈希：求和为 K 的区间个数

若数组中包含负数，则两次指针法不再适用（无法保证扩展区间后和一定增大）。此时应结合前缀和与字典使用。设当前前缀和为 s，则以某点结尾且和为 K 的区间的起始点对应于“此前前缀和为 s-K 的位置”的数量。因此，需将历史出现的前缀和值存入字典进行计数。

```python
from collections import defaultdict

def count_k(a, k):
    seen = defaultdict(int)
    seen[0] = 1          # 아무것도 안 더한 상태
    s = res = 0
    for x in a:
        s += x
        res += seen[s - k]
        seen[s] += 1
    return res

print(count_k([1, 2, 3, -3, 3], 3))  # 5
```

若遗漏 `seen[0] = 1`，则会漏掉从数组开头开始的区间。时间复杂度 O(N)，空间复杂度 O(N)。

<details>
<summary>验证代码正确性的方法</summary>

上述函数已在 Python 中实际运行测试。通过双重循环实现的暴力枚举结果与随机生成的 500 组输入进行了对比，确认两者一致（涵盖两种区间求和个数问题及不含重复字符的最长子串）。典型示例的输出值也与代码注释中的预期结果相符。

</details>

## 该如何选择

| 情况 | 推荐方法 |
|---|---|
| 在已排序数组中求两数之和 | 双指针（两端向中间） |
| 在正数数组中寻找满足条件的连续子数组 | 增减型双指针 |
| 固定长度 K 的区间和或最大值 | 滑动窗口 |
| 多次查询区间和 | 前缀和 |
| 存在负数且需统计和为 K 的区间个数 | 前缀和 + 哈希 |

## 常见错误

- 试图使用双指针，但数组未排序或包含负数，却仍假设单调性。应先检查条件是否满足。
- 前缀和数组长度设为 N，导致索引错位。建议在开头添加一个 0，使长度为 N+1，可减少混淆。
- 在滑动窗口中未处理窗口为空的情况（l > r）。
- 在处理大规模输入问题时使用 `input()` 会导致速度慢，应改用 `sys.stdin.readline`。

类似的类型包括 [排序与二分查找](#/post/algo-sort-search)（基于相同的“数组已排序”前提）、[数组·字符串·哈希](#/post/algo-array-hash)（涵盖前缀和以及哈希字典的应用）、[栈·队列·双端队列](#/post/algo-stack-queue)（利用双端队列在 O(N) 时间内维护窗口内最大值的问题），以及 [贪心算法](#/post/algo-greedy)。若问题不是基于滑动窗口，而是需要枚举情况数，则通常会转向 [动态规划](#/post/algo-dp)。

## 参考资料链接

- 前缀和 (Wikipedia): https://en.wikipedia.org/wiki/Prefix_sum（查看前缀和的定义及线性时间计算方法）
- itertools.accumulate (Python 官方文档): https://docs.python.org/3/library/itertools.html（查看 accumulate 及其 initial 选项）
- 相关题目：救生艇 https://school.programmers.co.kr/learn/courses/30/lessons/42885 · 连续子数组的总和 https://school.programmers.co.kr/learn/courses/30/lessons/178870 · 宝石购物 https://school.programmers.co.kr/learn/courses/30/lessons/67258 · 连续子数组和的数量 https://school.programmers.co.kr/learn/courses/30/lessons/131701 · 未被破坏的建筑 https://school.programmers.co.kr/learn/courses/30/lessons/92344 · LeetCode 3 https://leetcode.com/problems/longest-substring-without-repeating-characters/

← 概念图 (#/post/algo-map)