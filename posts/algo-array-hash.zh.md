数组和字符串问题大多通过“不要重复计数，而是统计一次并记录下来”的思路解决，而记录的位置通常是前缀和数组或哈希表（dict、set）。

## 这是什么类型的问题

在编程测试中，最常遇到的输入是数组和字符串。起初人们会认为只需使用双重 for 循环进行全量比较，但当输入规模变大时就会导致超时。这类问题的核心在于将双重循环优化为单次循环。优化的工具主要有两种：

- **前缀和 (prefix sum)**：预先从前往后累加求和，区间和可以通过一次减法运算得出。
- **哈希表**：将值作为键存储，从而直接确认“该值是否存在”。同时也用于计数。

[复杂度为何重要 → 时间与空间复杂度](#/post/algo-complexity) 中已单独整理。此处仅说明“将 O(n²) 优化为 O(n)"的程度。

## 为什么哈希表很快

Python 的 `dict` 和 `set` 都是哈希表。通过将键输入哈希函数，可以直接根据返回值找到存储位置。因此，通过键查找或检查键是否存在，其平均时间复杂度为 O(1)。Python 官方文档的时间复杂度表如下所示：

| 数据类型 | 操作 | 平均 | 最坏 |
|---|---|---|---|
| list | `x in l` | O(n) | O(n) |
| list | `l[k]` | O(1) | O(1) |
| dict | `key in d`, `d[key]` | O(1) | O(n) |
| set | `x in s` | O(1) | O(n) |

文档明确指出这是平均情况。该数值基于哈希函数足够健壮、冲突罕见且键分布均匀的假设。如果所有键的哈希值相同，则退化为 O(n)。在编程测试的一般输入中，可以按平均值进行处理。

在 `list` 中使用 `in` 操作符会导致 O(n) 复杂度，这是一个容易出错的点。如果在循环内部使用 `if x in 列表`，虽然表面上只有一行代码，但内部实际上执行了双重循环。此时将列表转换为 set 是第一个优化步骤。

## 三个典型问题

仅列出编号和名称，正文内容建议直接在 Programmers 问题页面查看。

| 问题 | 一句话总结 | 使用的工具 |
|---|---|---|
| 프로그래머스 파괴되지 않은 건물 (Programmers: Destroyed Building) | 涉及大量在网格的多个矩形区间上进行加法和减法操作 | 前缀和（仅在区间末尾记录要加的数值，最后一次性累加） |
| 프로그래머스 완주하지 못한 선수 (Programmers: Runner Who Did Not Finish) | 从参赛者名单中找出未完成的选手（存在同名者） | 哈希表 (Counter) |
| 프로그래머스 의상 (Programmers: Outfit) | 给定服装名称和种类，求每种只穿一件时可能的组合数量 | 按种类计数 (Counter) |

上述三个问题均已打开 Programmers 问题页面确认了标题和摘要。下方的解释基于“操作量非常大”、“名单可能很长”等一般性原因。

- [파괴되지 않은 건물](https://school.programmers.co.kr/learn/courses/30/lessons/92344)
- [완주하지 못한 선수](https://school.programmers.co.kr/learn/courses/30/lessons/42576)
- [의상](https://school.programmers.co.kr/learn/courses/30/lessons/42578)

## 解题思路顺序

### 1. 前缀和：不再对每个区间重复求和

这是基础形式。当需要多次查询区间和时，如果每次提问都用 for 循环累加区间，区间长度为 n，提问次数为 m，则复杂度为 O(n·m)。提问次数多时速度会很慢。

换个思路则是：在提问之前，先从前往后只累加一次并存储下来。若定义 `p[i]` 为“前 i 个元素的和”，则从第 i 个到第 j 个的区间和即为 `p[j] - p[i-1]`。构建过程耗时 O(n)，每次查询仅需 O(1)。

“未摧毁的建筑”问题则是将这一思路反过来应用。每当有攻击或恢复操作时，若修改整个区间会很慢，因此只需在区间的起始位置记录 +v，在结束位置的下一个位置记录 -v（即差分数组）。完成所有操作记录后，一次性计算前缀和即可得到每个格子的最终值。由于问题是二维网格，需在四个角上记录，但一维情况下的处理方式相同。以下代码为一维基础形式。

### 2. 未完成的选手：视为从名单中逐个删除

对于每位参赛者，首先想到的方法是遍历完赛者名单，若存在则将其移除。在 `list` 中查找需要 O(n)，对每位参赛者重复此操作会导致 O(n²)。

由于存在同名者，仅用 set 是不够的。应使用按名字计数的 dict（Counter）。对参赛者名字 +1，对完赛者名字 -1，最后剩余计数不为零的名字即为答案。

### 3. 服装：名字无关紧要，只看种类数量

服装名称不影响组合数量，只关心每种类型（如头饰、眼镜等）的个数。使用 Counter 统计各类别的数量。对于每一种类，可选方案为“选择该类型的某一件”或“不穿任何该类”，因此共有 (数量 + 1) 种选择。将所有类别的 (数量 + 1) 相乘，并减去必须穿一套衣服的情况（即全都不穿的 1 种情况）。

三个问题遵循相同的解题框架：先遍历一次记录信息，然后基于这些信息直接得出答案。

## Python 代码

以下代码均已本地运行验证，确保示例输入能输出正确结果，但尚未在 Programmers 平台实际提交。

```python
from collections import Counter

# 1) 구간 합 (누적합 기본형)
def range_sums(a, queries):
    p = [0]                      # p[i] = 앞에서 i개의 합
    for x in a:
        p.append(p[-1] + x)
    return [p[j] - p[i - 1] for i, j in queries]   # 1-indexed 구간

print(range_sums([5, 4, 3, 2, 1], [(1, 3), (2, 4), (5, 5)]))
# [12, 9, 1]

# 1-2) 구간에 값 더하기 (차이 배열 + 누적합, 파괴되지 않은 건물의 1차원 버전)
def apply_updates(n, updates):
    d = [0] * (n + 1)
    for l, r, v in updates:      # 0-indexed, l..r에 v를 더한다
        d[l] += v
        d[r + 1] -= v
    res, s = [], 0
    for i in range(n):
        s += d[i]                # 누적하면 칸마다 최종 값
        res.append(s)
    return res

print(apply_updates(5, [(0, 2, 3), (1, 3, -1), (4, 4, 5)]))
# [3, 2, 2, -1, 5]

# 2) 완주하지 못한 선수 (프로그래머스 방식)
def not_finished(participant, completion):
    c = Counter(participant)
    c.subtract(completion)       # 완주자는 -1
    return next(name for name, cnt in c.items() if cnt > 0)

print(not_finished(["leo", "kiki", "eden"], ["eden", "kiki"]))
# leo
print(not_finished(["mislav", "stanko", "mislav", "ana"],
                   ["stanko", "ana", "mislav"]))
# mislav   (동명이인)

# 3) 의상 (종류별 개수 세기)
def outfits(clothes):
    c = Counter(kind for _, kind in clothes)
    ans = 1
    for cnt in c.values():
        ans *= cnt + 1          # 종류마다 '안 입기' 포함
    return ans - 1              # 아무것도 안 입는 경우 제외

print(outfits([["yellow_hat", "headgear"], ["blue_sunglasses", "eyewear"],
               ["green_turban", "headgear"]]))   # 5
print(outfits([["crow_mask", "face"], ["blue_sunglasses", "face"],
               ["smoky_makeup", "face"]]))       # 3
```

Counter 是 dict 的子类，根据文档，其计数值可以为 0 或负数。`완주하지 못한 선수`（未完成比赛者）解法中使用 `subtract()` 保留负数结果是正确的；相反，`c - d` 运算符只会保留非负数，因此不适用于该解法。此外，查询不存在的键时返回 0 而非抛出 KeyError，也更为方便。

<details>
<summary>使用哈希表查找两数之和（Two Sum 类型）</summary>

此类问题目标是找到“和为 target 的两个数的位置”。双重 for 循环的时间复杂度为 O(n²)。使用哈希表则只需遍历一次，每次检查 `target - x` 是否已存在于已访问的键中。

```python
def two_sum(nums, target):
    seen = {}                    # 값 -> 위치
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i

print(two_sum([2, 7, 11, 15], 9))   # [0, 1]
```

插入与检查的顺序至关重要：若先检查再插入，可能导致同一元素被重复使用。本地运行验证了上述结果。
</details>

## 时间与空间复杂度

| 解法 | 时间 | 空间 | 备注 |
|---|---|---|---|
| 区间求和，每次累加 | O(n·m) | O(1) | n=区间长度，m=查询次数 |
| 区间求和，前缀和 | O(n + m) | O(n) | 构建前缀和需 n，查询 m 次 |
| 区间值更新，逐个修正 | O(n·m) | O(1) | m=操作次数 |
| 区间值更新，差分数组 | O(n + m) | O(n) | 每次操作仅修改两个位置，最后累加还原 |
| 未完成比赛者，删除列表元素 | O(n²) | O(1) | 每次查找需 O(n) |
| 未完成比赛者，Counter | O(n) | O(n) | 假设哈希表平均 O(1) |
| 服装搭配，Counter | O(n) | O(种类数) | 遍历一次服装并按类别计数 |

使用哈希表的解法通常以牺牲空间换取时间，可视为用空间换时间。上述哈希表的时间复杂度均基于平均值。

## 常见错误

- **前缀和索引偏移**：题目要求从 1 开始计数，却从 0 开始导致错位。可在 `p` 列表前端补一个 0，使 `i-1` 为 0 时也能安全处理。
- **在列表中检查元素是否存在 (`in`)**：如上所述时间复杂度为 O(n)。若出现在循环内，应改用 set 或 dict。
- **对同名人使用 set**：set 会去除重复项；若需保留数量信息，应使用 Counter。
- **字符串 `+=` 重复拼接**：持续向大字符串追加会导致性能下降。通常做法是先将元素存入列表，最后用 `"".join()` 拼接。
- **在遍历 dict 时修改其大小**：遍历过程中删除或添加键会引发错误。应遍历副本或在遍历结束后统一处理。

## 相似题型

- 排序后从两端向中间收缩的解法，可参考 [详细 → 双指针](#/post/algo-two-pointer)，用于解决“两数之和”类问题。
- 排序后查找特定值的解法，参见 [详细 → 排序与搜索](#/post/algo-sort-search)。
- 先进先出或后进先出的结构，对应 [详细 → 栈与队列](#/post/algo-stack-queue)。
- 涉及累加思想的重复问题，通常导向 [详细 → 动态规划](#/post/algo-dp)。

## 参考链接

- [Python 文档：内置类型的时间复杂度](https://docs.python.org/3/builtins/time-complexity.html)
- [Python 文档：collections — Counter](https://docs.python.org/3/library/collections.html)
- 使用的问题：[破坏未完成的建筑](https://school.programmers.co.kr/learn/courses/30/lessons/92344) · [未完成比赛的选手](https://school.programmers.co.kr/learn/courses/30/lessons/42576) · [服装搭配](https://school.programmers.co.kr/learn/courses/30/lessons/42578)（打开问题页面可查看标题与类型）

← 概念地图 ([算法地图](#/post/algo-map))

相关文章：[时间复杂度与空间复杂度](#/post/algo-complexity) · [双指针](#/post/algo-two-pointer) · [栈与队列](#/post/algo-stack-queue)