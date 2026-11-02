排序在 Python 中几乎完全由内建函数完成，如果数据已排序，则可以通过二分查找不断舍弃一半来寻找目标。对于询问“能达到多少”这类问题，也可以用二分查找解决（参数化搜索）。

## 从排序开始

在编码测试中，很少需要手写排序算法。直接使用 `sorted()` 或 `list.sort()` 即可，Python 文档指出这种排序是 Timsort，并且是稳定排序（stable）。稳定排序意味着相同键的元素会保持原有的相对顺序。

不过了解其原理也值得。时间复杂度遵循 [时间复杂度总结](#/post/algo-complexity) 中讨论的 Big-O 标准。

| 方式 | 平均 | 最坏 | 内存 |
|---|---|---|---|
| 冒泡·选择·插入 | O(N²) | O(N²) | 简单，但 N 较大时不可用。插入排序在几乎已排序的数据上很快 |
| 归并排序 | O(N log N) | O(N log N) | 分半后分别排序再合并。稳定，需要额外内存 |
| 快速排序 | O(N log N) | O(N²) | 以基准值划分。若选错基准则陷入最坏情况 |
| 计数排序 | O(N + K) | O(N + K) | 仅当值范围 K 较小时适用。不涉及比较操作 |

内建排序可视为 O(N log N)。即使 N 达到 100 万，在 Python 中也能轻松运行。

提供键的方法是实战中最常用的。若要按“长度顺序，若相同则按字典序”对字符串进行排序，可将元组作为键传入。

```python
words = ["but", "i", "wont", "hesitate", "no", "more", "it"]
print(sorted(words, key=lambda w: (len(w), w)))
# ['i', 'it', 'no', 'but', 'more', 'wont', 'hesitate']
```

降序使用 `reverse=True`；若只想对数字键进行降序排序，则在键中使用 `-x`。由于是稳定排序，文档中还提到了“先按辅助键排序，再按主键重新排序”的方法。

<details>
<summary>详细解析：手写归并排序时</summary>

用于验证原理。将列表二分，然后从前往后比较两个已排序的列表进行合并。若相等时优先取左侧元素，即可实现稳定排序。

```python
def merge_sort(a):
    if len(a) <= 1:
        return a
    m = len(a) // 2
    l, r = merge_sort(a[:m]), merge_sort(a[m:])
    res, i, j = [], 0, 0
    while i < len(l) and j < len(r):
        if l[i] <= r[j]:
            res.append(l[i]); i += 1
        else:
            res.append(r[j]); j += 1
    return res + l[i:] + r[j:]
```

使用 300 个随机列表对比 `sorted()` 的结果，确认两者一致。分割深度为 log N，每层合并成本为 N，因此总复杂度为 O(N log N)。空间复杂度为 O(N)。

</details>

## 二分查找

在已排序的数组中查找值时，观察中间元素：若目标值更大，则只保留右半部分；若更小，则只保留左半部分。每次将范围减半，时间复杂度为 O(log N)。即使有 1000 万个元素，通常也在 20~30 次内完成。

前提条件只有一个：数据必须已排序（或具备“从某点起条件恒为真”的单调性）。这一条件在参数化搜索中尤为重要。

手写实现时容易在边界出错。因此，以“第一个大于等于 x 的位置”作为基准来编写更为方便。这就是 lower bound，等同于 Python 的 `bisect_left`。

```python
def lower_bound(a, x):   # a[i] >= x 인 첫 i (없으면 len(a))
    lo, hi = 0, len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] < x:
            lo = mid + 1
        else:
            hi = mid
    return lo

def upper_bound(a, x):   # a[i] > x 인 첫 i
    lo, hi = 0, len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] <= x:
            lo = mid + 1
        else:
            hi = mid
    return lo
```

这与 `bisect` 文档中的说明一致：`bisect_left` 返回相同值左侧的插入位置，`bisect_right` 返回右侧的插入位置。例如在 `[1, 2, 2, 2, 3]` 中插入 2，分别得到 1 和 4。因此，值 x 的出现次数可通过 `bisect_right(a, x) - bisect_left(a, x)` 计算得出。上述两个函数已在随机排序列表中与 `bisect` 的结果进行了对比验证。

有一点需要注意：`bisect` 是提供“插入位置”的函数，而非直接查找值的函数。若要确认该位置是否存在对应值，仍需直接比较该位置的元素。

## 参数化搜索

这是一种将答案本身作为二分查找目标的思路，适用于“求满足条件的最大值（或最小值）”这类问题。模板几乎相同。

1. 确定答案的候选范围（例如：从 0 到最长树木高度）。
2. 构造一个函数，给定一个候选值，以 O(N) 的时间检查该值是否满足条件。
3. 尽可能将范围向更大（或更小）的一侧收缩。

可行的前提是单调性。若在高度 H 处切割可行，则更低的高度也必须可行；若不满足此条件，则无法使用二分查找。

若单次检查耗时 O(N)，候选范围为 R，则总复杂度为 O(N log R)。即使范围高达 20 亿（log ≈ 31），当 N 为 100 万时依然值得尝试。

## 典型题目

仅列出编号与名称。正文内容需在各网站查看。全部来自 Progarmmers（프로그래머스）。

- [K 个数的 K 倍值](https://school.programmers.co.kr/learn/courses/30/lessons/42748): 截取数组区间并排序后取出第 k 个值。这是直接使用内置排序的最基础题目。
- [生成最大数](https://school.programmers.co.kr/learn/courses/30/lessons/42746): 将数字拼接以组成最大的数。直接给出以 `a+b` 和 `b+a` 拼接并比较的排序规则。
- [搜索排名](https://school.programmers.co.kr/learn/courses/30/lessons/72412): 按条件对分数列表进行排序，然后对每个查询使用二分查找计数。这是练习使用 `bisect` 求"x 及以上数量”的题目。
- [石头游戏](https://school.programmers.co.kr/learn/courses/30/lessons/43236): 移除 n 块石头后，最大化剩余石头间距离的最小值。属于参数化搜索（求最大值），对距离基准值进行二分查找。
- [入国审查](https://school.programmers.co.kr/learn/courses/30/lessons/43238): 参数化搜索（求最小值）。对时间 T 进行二分查找。

## 解题思路顺序

1. 排序后是否更容易解决？如果容易，则排序后只需查看相邻元素；否则属于其他类型。
2. 是否只需在已排序数据中查找？可使用二分查找或 `bisect`。
3. 询问“最大值/最小值”，且给定一个值即可在 O(N) 时间内判断可行性吗？这是参数化搜索。
4. 确定范围 (lo, hi)，先决定答案是在区间内还是外，再调整 mid 计算与更新。寻找最大值时需使用 `mid = (lo + hi + 1) // 2` 向上取整以避免无限循环。

## 代码

“确定截断高度 H"的类型：以高度 H 截断时获得的木材量为所有“高于 H 的树木的高度减去 H"之和。目标是找到满足需求量 M 的最大 H。

```python
def tree_cut(trees, need):
    lo, hi = 0, max(trees)
    while lo < hi:
        mid = (lo + hi + 1) // 2          # 최댓값 찾기: 올림
        if sum(t - mid for t in trees if t > mid) >= need:
            lo = mid                       # 가능 -> 더 높여 본다
        else:
            hi = mid - 1                   # 불가능 -> 낮춘다
    return lo

print(tree_cut([20, 15, 10, 17], 7))        # 15
print(tree_cut([4, 42, 40, 26, 46], 20))    # 36
```

“长度为 L 截断并制作 K 个以上”的类型属于相同框架，只需将检查逻辑改为 `sum(l // mid)`，且 `lo` 从 1 开始。

```python
def lan(lines, need):
    lo, hi = 1, max(lines)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if sum(l // mid for l in lines) >= need:
            lo = mid
        else:
            hi = mid - 1
    return lo

print(lan([802, 743, 457, 539], 11))        # 200
```

入国审查是求“最小值”，因此不使用向上取整的 mid，而是使用向下取整。在时间 T 内可处理的人数为 `sum(T // t)`。

```python
def immigration(n, times):
    lo, hi = 1, min(times) * n
    while lo < hi:
        mid = (lo + hi) // 2               # 최솟값 찾기: 내림
        if sum(mid // t for t in times) >= n:
            hi = mid                        # 가능 -> 더 줄여 본다
        else:
            lo = mid + 1
    return lo

print(immigration(6, [7, 10]))              # 28
```

石头游戏是寻找最大值，因此使用向上取整的 mid，检查逻辑是从前往后计数“移走基准值附近的石头需要移除多少个”。若移除数量小于 n 则可行。

```python
def bridge(distance, rocks, n):
    pts = [0] + sorted(rocks) + [distance]
    lo, hi = 1, distance
    while lo < hi:
        mid = (lo + hi + 1) // 2           # 최댓값 찾기: 올림
        removed, prev = 0, 0
        for p in pts[1:]:
            if p - prev < mid:
                removed += 1               # 너무 가까운 바위는 치운다
            else:
                prev = p
        if removed <= n:
            lo = mid                        # n개 이하로 치워도 됨 -> 기준을 키운다
        else:
            hi = mid - 1
    return lo

print(bridge(25, [2, 14, 11, 21, 17], 2))   # 4
```

生成最大数的排序规则通过 `cmp_to_key` 提供。

```python
from functools import cmp_to_key

def biggest(nums):
    s = sorted(map(str, nums),
               key=cmp_to_key(lambda a, b: (a + b < b + a) - (a + b > b + a)))
    return str(int("".join(s)))             # 앞의 0이 몰려 "000"이 되는 경우 처리

print(biggest([6, 10, 2]))                  # 6210
print(biggest([3, 30, 34, 5, 9]))           # 9534330
```

上述代码均已直接运行并验证示例输出正确。入国审查（输入 6, [7, 10] → 28）和石头游戏（输入 25, [2, 14, 11, 21, 17], 2 → 4）的值与 Programmers 问题页面的输入输出示例一致。这些代码并未提交到问题网站进行评分。

## 时间·空间复杂度

| 操作 | 时间 | 空间 |
|---|---|---|
| `sorted()` / `list.sort()` | O(N log N) | `sort()` 原地排序，`sorted()` 返回副本 O(N) |
| 二分查找（已排序状态） | O(log N) | O(1) |
| 排序 + N 次二分查找 | O(N log N) | O(1)~O(N) |
| 参数化搜索 | O(N log R) | O(1) |

`bisect.insort` 的查找操作为 O(log N)，但插入列表的操作为 O(N)，因此整体复杂度为 O(N)（文档中也如此说明）。若需反复插入，应考虑其他数据结构。

## 常见错误

- 在未排序的数组上使用二分查找。虽然不会报错，但会得到错误答案且难以排查。
- 在更新 `mid` 时使用 `lo = mid` 并配合向下取整的 mid，导致陷入无限循环。
- 参数化搜索的范围上限 (hi) 设置过小。
- 无需使用二分查找却强行使用。在许多情况下，`set` 或 `dict` 更为简单。

## 相似类型

- 排序后从两端向中间收缩的方式参见 [双指针](#/post/algo-two-pointer)。
- “通过条件缩小可行值范围”的思路常与 [贪心](#/post/algo-greedy) 一同出现。参数化搜索的检查函数多为贪心策略。
- 当数值范围较小时，使用 [数组·哈希](#/post/algo-array-hash) 的计数比二分查找更简单。
- 若优化问题不具备单调性，则转向 [动态规划](#/post/algo-dp)。

← 概念图参见 [算法类型图](#/post/algo-map)

## 参考链接

- Python 文档，排序技巧：https://docs.python.org/3/howto/sorting.html
- Python 文档，bisect：https://docs.python.org/3/library/bisect.html
- 使用的问题（Programmers）：K 个数 https://school.programmers.co.kr/learn/courses/30/lessons/42748 · 最大的数 https://school.programmers.co.kr/learn/courses/30/lessons/42746 · 排名搜索 https://school.programmers.co.kr/learn/courses/30/lessons/72412 · 跳石 https://school.programmers.co.kr/learn/courses/30/lessons/43236 · 入境审查 https://school.programmers.co.kr/learn/courses/30/lessons/43238