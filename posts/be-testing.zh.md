后端测试是在修改代码时，代替人工去验证“以前能用的功能现在是否还能用”的代码。其基本形态是按规模分为单元、集成和端到端（E2E）三类，且主要使用下方的单元测试。

## 什么是测试

测试是另一种代码：它运行代码并比较结果是否符合预期。例如，向函数输入数据，然后使用 `assert` 检查输出值是否正确。这与人工点击屏幕查看类似，但区别在于只需一个按钮即可在几秒钟内运行数百个测试用例。

后端尤其需要这种测试的原因在于其不可见性。前端如果出错，界面会显得异常；而服务器端的计算错误或数据库更新失败，则会悄无声息地积累错误数据。此外，随着功能增多，修改一处时导致其他部分出错的概率也会增加。有了测试，就能在修复后立即发现问题；若结合 [CI/CD](#/post/cloud-cicd) 自动运行，则可防止有缺陷的代码被部署。

## 按规模划分

测试可根据“一次性执行多少部分”来划分：

| 类型 | 检查范围 | 速度 | 定位故障原因 |
|---|---|---|---|
| 单元 (unit) | 单个函数或类 | 极快 | 容易 |
| 集成 (integration) | 如数据库、外部服务等连接点 | 中等 | 一般 |
| E2E (end-to-end) | 按用户流程运行的整个部署系统 | 慢 | 困难 |

单元测试会将周边依赖（如数据库、邮件发送等）替换为模拟对象，仅关注代码片段本身。集成测试则将模拟对象替换为真实对象，以验证“我们的代码与数据库是否真正协同工作”。例如，仅凭模拟数据库无法判断 SQL 语句是否存在语法错误或是否修改了预期的行。端到端测试则是在服务器、数据库及外部联动均连接的状态下，通过调用 API 来观察从创建订单到库存减少的完整流程。

## 测试金字塔

Martin Fowler 文章中提到的测试金字塔是关于这三类测试使用比例的粗略规则：应大量使用单元测试，适量使用集成测试，极少使用端到端测试。文章指出，端到端测试“虽能覆盖整个系统从而提供较高信心，但速度慢、维护成本高且容易不稳定（flaky）”，建议仅限制在少数核心用户流程上使用。相反，若端到端测试占比最大，则被称为“冰淇淋筒”模式，属于应避免的架构模式。

```
        /\            E2E   : 핵심 흐름 몇 개
       /  \ 
      /----\          통합  : DB·외부 연동 지점마다 조금
     /      \ 
    /--------\        단위  : 가장 많이, 빠르게
```

同一篇文章还给出了另一条规则：由于每个测试都有维护成本，应尽可能在下层进行测试；如果上层测试失败而下层测试正常，则应在下层增加一个测试。若上层测试仅与下层重叠，也可以直接删除上层测试。

此外，该文章还在集成和端到端之间提出了“合同（contract）测试”。这是一种用于确认双方对彼此间请求/响应格式理解一致的测试。对于只有单个服务的独立应用而言，当前阶段无需特别关注此项。

## 示例：使用 pytest 编写测试

在 Python 中，pytest 被广泛使用。将文件名设为 `test_*.py`、函数名以 `test_` 开头时，pytest 会自动发现并运行这些测试。以下是一个订单服务的三层测试示例，涵盖检查库存、减少库存以及发送邮件的代码。通过分层（相关内容见 [分层架构](#/post/be-layered-architecture)），可以从外部注入存储库和邮件发送器，从而简化测试工作。

<details>
<summary>被测代码：shop.py</summary>

```python
class OutOfStock(Exception):
    pass

def apply_discount(price: int, percent: int) -> int:
    if not 0 <= percent <= 100:
        raise ValueError("percent must be 0..100")
    return price * (100 - percent) // 100

class OrderService:
    def __init__(self, repo, mailer):
        self.repo = repo
        self.mailer = mailer

    def place(self, user_email, item_id, qty):
        stock = self.repo.get_stock(item_id)
        if stock < qty:
            raise OutOfStock(item_id)
        self.repo.set_stock(item_id, stock - qty)
        self.mailer.send(user_email, f"주문 완료: {item_id} x{qty}")
        return stock - qty
```

</details>

<details>
<summary>测试代码：test_shop.py（单元/模块/集成）</summary>

```python
import sqlite3
from unittest.mock import Mock
import pytest
from shop import apply_discount, OrderService, OutOfStock

# 단위 테스트: 순수 함수
@pytest.mark.parametrize("price,pct,expected", [(10000, 10, 9000), (999, 0, 999), (500, 100, 0)])
def test_discount(price, pct, expected):
    assert apply_discount(price, pct) == expected

def test_discount_rejects_bad_percent():
    with pytest.raises(ValueError):
        apply_discount(1000, 120)

# 목을 쓴 테스트: 메일러를 가짜로 바꾼다
class FakeRepo:
    def __init__(self, stock):
        self.stock = {"A": stock}
    def get_stock(self, i): return self.stock[i]
    def set_stock(self, i, n): self.stock[i] = n

def test_place_sends_mail():
    mailer = Mock()
    svc = OrderService(FakeRepo(5), mailer)
    assert svc.place("a@b.c", "A", 2) == 3
    mailer.send.assert_called_once_with("a@b.c", "주문 완료: A x2")

def test_place_out_of_stock_no_mail():
    mailer = Mock()
    svc = OrderService(FakeRepo(1), mailer)
    with pytest.raises(OutOfStock):
        svc.place("a@b.c", "A", 2)
    mailer.send.assert_not_called()

# 통합 테스트: 진짜 SQL(메모리 SQLite)에 붙인다
class SqlRepo:
    def __init__(self, con): self.con = con
    def get_stock(self, i):
        return self.con.execute("SELECT qty FROM stock WHERE id=?", (i,)).fetchone()[0]
    def set_stock(self, i, n):
        self.con.execute("UPDATE stock SET qty=? WHERE id=?", (n, i))

@pytest.fixture
def con():
    c = sqlite3.connect(":memory:")
    c.execute("CREATE TABLE stock (id TEXT PRIMARY KEY, qty INTEGER)")
    c.execute("INSERT INTO stock VALUES ('A', 5)")
    yield c
    c.close()

def test_place_with_real_db(con):
    svc = OrderService(SqlRepo(con), Mock())
    svc.place("a@b.c", "A", 4)
    assert SqlRepo(con).get_stock("A") == 1
```

运行 `python -m pytest -q` 后输出 `7 passed`（pytest 9.2.0，本地执行验证）。

</details>

代码中值得注意的有四处：

- `parametrize`：通过表格提供输入和预期值，相同的测试会为每个值单独运行。建议加入边界值（如 0%、100%）。
- `pytest.raises`：用于验证在应抛出异常的情况下确实发生了异常。如何设计错误处理可参考 [错误处理与日志](#/post/be-error-logging)。
- `Mock`：通过模拟邮件发送器，仅检查“send 方法是否被调用了一次且传入该参数”，而不会实际发送邮件。还可验证在库存不足时邮件未被发送的情况（使用 `assert_not_called`）。
- `fixture` 与 `yield`：创建内存 SQLite 数据库，将其传递给测试，并在测试结束后关闭。根据 pytest 文档规范，`yield` 之后的代码属于清理（teardown）部分；默认作用域为每个测试函数，因此每次测试都会生成新的数据库，从而避免测试之间相互影响。

`test_place_with_real_db` 对应于集成测试。它使用的是同一个 `OrderService`，但不再使用假数据，而是运行真实的 SQL。如果 SQL 语句有误，该测试会失败，而上述单元测试则无法捕获此类问题。

## 如何测试 API 端点

由 Web 框架构建的 API 通常不会启动服务器来模拟请求，而是利用框架提供的测试客户端直接发起请求。这类测试涵盖了路由、验证和序列化等环节，因此更接近于集成测试而非单元测试。我们会检查状态码和响应正文的格式，以确认其是否符合 [API 与 REST](#/post/be-api-rest) 中整理的规范。本次示例未直接运行框架代码，因此没有提供具体代码。

## 需要编写多少测试

- 不必尝试测试每一行代码。应优先覆盖关键计算（如金额、权限、库存）等出错后果严重的部分。
- 修复一个 bug 时，应先编写能够复现该 bug 的测试，然后再进行修复，以防止同类问题再次出现。
- 覆盖率数值（即执行了代码的百分比）应用于发现“哪些地方未被测试覆盖”，而非认为高覆盖率就等于安全。因为仅执行而不验证内容的测试也会推高覆盖率。
- 对于包含 AI 功能的 App，由于输出每次可能不同，`assert 相等` 无法适用。相关内容将在专门的 [LLM 应用评估](#/post/app-eval) 中讨论。

## 常见误解

- 编写大量测试就没有 bug：测试仅能验证“我设想到的情况”，无法证明不存在问题，只能发现已存在的问题。
- 使用 Mock 就能解决所有问题：如果 Mock 的行为与真实对象不同，测试可能通过，但实际运行时仍会失败。因此，对于数据库等连接点，仍需通过集成测试再次验证。
- E2E（端到端）测试最可靠，所以只需使用它：虽然确实可靠，但其速度慢且不稳定，失败时也难以定位原因。这正是测试金字塔强调底层（单元测试）要更厚的原因。
- 测试会降低开发速度：初期耗时较长，但随着代码规模扩大，手动检查的时间会显著增加。不过具体能提升多少效率，因团队和项目而异，此处不给出具体数值。

## 参考链接

- Martin Fowler, The Practical Test Pyramid: https://martinfowler.com/articles/practical-test-pyramid.html
- pytest 文档，如何使用 fixtures: https://docs.pytest.org/en/stable/how-to/fixtures.html

← [概念图](#/post/be-map)

相关文章：[错误处理与日志记录](#/post/be-error-logging) · [分层架构](#/post/be-layered-architecture) · [CI/CD 与部署策略](#/post/cloud-cicd)