测试概述在 [软件工程基础](#/post/cs-sw-engineering) 和 [后端测试](#/post/be-testing) 中已经涉及。单元测试、集成测试与系统测试的分类，以及金字塔模型，均在那两篇文章中有介绍。本文则深入一层，探讨“如何选择测试用例、如何统计执行数量、以及如何安排执行顺序”。

## 测试不是证明，而是抽样

输入可能取值的范围实际上几乎是无限的，无法对所有情况进行测试，因此只能选取部分样本进行测试。通过测试仅意味着“所选的输入没有出错”，并不代表“完全没有错误”。因此，测试设计的核心问题在于：如何选取能够有效发现缺陷的样本。

选择样本的标准主要有两种：一种是仅依据规范（需求）进行选择的黑盒技术；另一种是依据代码结构进行选择的白盒技术。

| | 观察对象 | 典型方法 | 擅长发现的问题 |
|---|---|---|---|
| 黑盒 | 输入/输出规范 | 等价划分、边界值分析、判定表 | 行为与需求不符的情况、遗漏的测试用例 |
| 白盒 | 代码分支/路径 | 语句覆盖、分支覆盖、条件覆盖 | 从未执行过的代码 |

## 黑盒：等价划分与边界值

将输入划分为“程序会同等对待的一组”称为等价划分。同一组内的任意输入应产生相同结果，因此每组只需选取一个代表值。此外，在组与组之间的边界处，常因将 `<` 误写为 `<=` 等条件判断错误而引发问题，因此需单独测试边界值。

以运费计算函数为例：5kg 及以下收费 3,000 元，20kg 及以下收费 5,000 元，超过 20kg 收费 9,000 元；会员享受半价优惠；重量小于等于 0 则报错。

```python
# shipping.py
def shipping_fee(weight_kg, is_member):
    if weight_kg <= 0:
        raise ValueError("weight must be positive")
    if weight_kg <= 5:
        fee = 3000
    elif weight_kg <= 20:
        fee = 5000
    else:
        fee = 9000
    if is_member:
        fee = fee // 2
    return fee
```

```python
# test_shipping.py
import pytest
from shipping import shipping_fee

@pytest.mark.parametrize("w, expected", [
    (0.1, 3000), (5, 3000),     # 첫 구간 안쪽, 경계
    (5.1, 5000), (20, 5000),    # 둘째 구간
    (20.1, 9000), (100, 9000),  # 셋째 구간
])
def test_fee_by_weight(w, expected):
    assert shipping_fee(w, False) == expected

def test_member_half():
    assert shipping_fee(10, True) == 2500

@pytest.mark.parametrize("w", [0, -1])
def test_invalid_weight(w):
    with pytest.raises(ValueError):
        shipping_fee(w, False)
```

使用 `pytest` 运行后，9 个测试用例全部通过。尽管仅用几个数字代表，却涵盖了三个区间、两个边界以及错误输入。`parametrize` 允许在相同的测试函数体中传入输入与期望值的表格，因此即使增加测试用例，代码也不会变长。

<details>
<summary>判定表：当条件多重叠加时</summary>

当存在两个或以上条件时，仅靠等价划分容易遗漏组合。判定表以条件的真/假组合为行，列出各组合对应的结果。以上述函数为例，可逐行列出“是否 5kg 以下 × 是否为会员”的组合，检查是否有空白单元格。若存在空白格，则意味着规范中未定义该组合，从而产生一个关于需求本身的问题，而非代码问题。
</details>

## 白盒：覆盖率

覆盖率是衡量测试执行了代码多少比例的指标。不同种类严格程度各异。

| 类型 | 标准 |
|---|---|
| 语句覆盖 (statement) | 所有语句至少执行一次 |
| 分支覆盖 (branch) | 所有 `if` 的真假两种情况均被执行 |
| 条件覆盖 (condition) | 由 `and`/`or` 组合的每个子条件均需经历真与假两种状态 |

即使语句覆盖率达到 100%，分支仍可能未被完全覆盖。我亲自验证过：存在一个若持有优惠券则减免 1,000 元的函数，并使用 `sys.settrace` 追踪了哪些行被执行。

```python
def final_price(price, coupon):
    discount = 0
    if coupon:
        discount = 1000
    return price - discount
```

| 测试输入 | 执行语句数 |
|---|---|
| `coupon=True`（仅一项） | 4 / 4 |
| `coupon=False`（仅一项） | 3 / 4 |
| 两者皆有 | 4 / 4 |

仅用 `coupon=True` 一项即可实现语句全覆盖。然而，当 `if` 条件为假（即无优惠券）的路径却从未被执行。即使该路径中存在缺陷，只要语句覆盖率为 100%，测试仍会静默通过。缺少 `else` 的 `if` 语句正是造成此类漏洞的原因。因此，实践中更多将分支覆盖率作为最低标准。

在关注覆盖率时需注意其方向性：低覆盖率明确表明“存在未执行代码”，但高覆盖率并不意味着“验证充分”。覆盖率仅反映代码是否被执行，并不检查 `assert` 断言是否正确设置。即使没有断言的测试也能提升覆盖率。

## TDD：先写测试的开发顺序

TDD 更应被视为一种开发顺序而非单纯的测试技术。以 [Martin Fowler 的解释](https://martinfowler.com/bliki/TestDrivenDevelopment.html) 为基准，流程如下：首先列出所需测试清单并选取一项；接着编写针对尚未实现功能的测试（Red）；然后编写仅能使该测试通过的代码（Green）；最后重构代码（Refactor）。重复此过程直至清单清空。本文指出，在所列步骤中最后的重构阶段最常被跳过，若跳过则会导致代码碎片堆积成臃肿模块。

以闰年判断为例进行一轮实践：最初以最简单的方式实现——若能被 4 整除则判定为闰年。

```python
def is_leap(y):
    return y % 4 == 0
```

```python
from tdd import is_leap
def test_basic():   assert is_leap(2024) and not is_leap(2023)
def test_century(): assert not is_leap(1900)
def test_400():     assert is_leap(2000)
```

旋转会导致 `test_century` 测试以 `assert not True` 失败（红色）。修改代码使该测试通过。

```python
def is_leap(y):
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
```

再次运行则全部通过（绿色）。要点在于：不要一开始就使用完整的表达式，而是先让测试失败，然后进行修复。只有先看到失败，才能知道该测试是否真正检测到了那个错误。

TDD 的优点是测试始终保留下来；但缺点是在设计尚未稳固的初期阶段，测试也需要频繁修改。具体应用程度因团队而异。

## 测试双：用于替代真对象的假对象

在单元测试中，如果直接使用邮件发送或数据库等外部依赖，会导致运行缓慢且不稳定。因此，我们使用“假对象”来替代它们，这种做法称为**测试双（Test Double）**。[Fowler 的分类](https://martinfowler.com/bliki/TestDouble.html)将测试双分为以下几类：

| 类型 | 作用 |
|---|---|
| Dummy | 仅填充参数位置，实际并未使用 |
| Stub | 返回预设的固定答案 |
| Fake | 功能正常但采用捷径实现（例如内存数据库） |
| Spy | 类似 Stub，同时记录调用情况 |
| Mock | 预先定义预期的调用行为，并在验证时进行检查 |

在 Python 中，使用 `unittest.mock.Mock` 来创建 Mock 对象。我们检查了库存少于 5 时是否触发了发送邮件的函数。

```python
from unittest.mock import Mock

def notify_if_low(stock, mailer):
    if stock < 5:
        mailer.send("재고 부족")
        return True
    return False

mailer = Mock()
assert notify_if_low(3, mailer) is True
mailer.send.assert_called_once_with("재고 부족")

mailer2 = Mock()
assert notify_if_low(10, mailer2) is False
mailer2.send.assert_not_called()
```

测试顺利运行至结束且未抛出异常。此处的验证目标并非返回值，而是“是否发送了邮件”这一行为。当无法通过返回值确认结果时，才使用 Mock。不过，如果过度细化对调用方式的约束，每次内部实现变更都可能导致测试失败。因此，应尽可能验证结果（状态），仅在必要时使用 Mock。

## 代码审查也是一种质量活动

如果说测试是通过执行代码来发现问题，那么代码审查则是通过阅读代码来发现问题。两者发现的问题类型不同：测试主要捕捉运行时错误，而审查则发现难以阅读的结构、命名或设计问题。谷歌的 [审查指南](https://google.github.io/eng-practices/review/reviewer/standard.html) 提出如下标准：即使代码尚未完美，只要变更能切实改善整体代码健康度，即可批准；对于琐碎的意见，标记为 "Nit:"，允许作者忽略。相反，若某项变更明显损害代码健康度，除非处于紧急状态，否则不予通过。

## 常见误解

- 测试全部通过就意味着没有 Bug？这只是针对所选输入样本而言的。如果样本选择不当，即使通过也意义有限。
- 覆盖率 100% 就足够了？如前所述，即使语句覆盖率达到 100%，分支可能为空；此外，即使没有断言，覆盖率也会上升。
- Mock 用得越多越好吗？Mock 过多会导致测试与实现耦合，重构时容易一同失效。
- TDD 只需先写测试即可？必须完成最后的重构阶段才算真正的 TDD。

[详见 → 需求与设计](#/post/se-requirements-design) 中关于“可验证需求”的使用方法，以及自动运行这些测试的内容将在 [版本控制与 CI/CD](#/post/se-cicd) 中讨论。

## 参考链接

- [Martin Fowler, Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Martin Fowler, Test Double](https://martinfowler.com/bliki/TestDouble.html)
- [Google Engineering Practices, The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html)

← 概念地图 ([软件工程基础](#/post/cs-sw-engineering))

相关文章：[后端测试](#/post/be-testing) · [开发方法论](#/post/se-methodology) · [版本控制与 CI/CD](#/post/se-cicd)