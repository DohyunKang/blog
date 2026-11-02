Backend tests are code that verifies whether "what used to work still works" after fixing code, acting as a substitute for human verification. The standard approach is to categorize them by size into unit, integration, and end-to-end (E2E), with the latter being used less frequently.

## What is testing?

Testing is another form of code that executes your codebase and compares the results against expectations. For instance, you provide input to a function and use `assert` to check if the output matches. The tasks are similar to manually clicking through a UI, but instead of pressing buttons one by one, you can run hundreds of cases in just a few seconds with a single command.

Backend testing is particularly necessary because issues aren't immediately visible. While frontend failures result in broken screens, errors in server-side calculations or database updates silently accumulate incorrect data. Furthermore, as features grow, the likelihood that fixing one area breaks another increases. With tests, you can detect these issues immediately after fixes, and running them automatically via [CI/CD](#/post/cloud-cicd) prevents broken code from being deployed.

## Categorizing by size

Tests are categorized based on "how much of the system is bundled and executed at once."

| Type | Scope Checked | Speed | Ease of Finding Failures |
|---|---|---|---|
| Unit | Single function or class | Very fast | Easy |
| Integration | Connection points like DBs or external services | Moderate | Average |
| E2E (end-to-end) | Entire deployed system following user flows | Slow | Difficult |

Unit tests replace surrounding dependencies (like databases or email sending) with fakes and examine only a single piece of code. Integration tests swap those fakes for real ones to verify if "our code and the database actually mesh correctly." For example, you cannot determine if SQL runs without syntax errors or modifies the desired rows using a fake database. E2E tests invoke APIs to observe the entire process—from order creation to inventory reduction—while the server, database, and external integrations are all active.

## The Testing Pyramid

Martin Fowler's concept of the testing pyramid is a rule of thumb regarding how much of each type to use: write the most unit tests, fewer integration tests, and very few E2E tests. The article explains that while E2E tests provide high confidence by using the entire system, they are slow, expensive to maintain, and prone to becoming unstable (flaky). It recommends limiting them to a few core user flows. Conversely, a pattern where E2E tests make up the majority of your suite is jokingly called an "ice cream cone" and cited as a pattern to avoid.

```
        /\            E2E   : 핵심 흐름 몇 개
       /  \ 
      /----\          통합  : DB·외부 연동 지점마다 조금
     /      \ 
    /--------\        단위  : 가장 많이, 빠르게
```

Another rule provided by the same article suggests that since testing incurs maintenance costs, you should verify as much as possible at the lower layers. If a test in an upper layer fails while the lower-layer tests pass, add another test to the lower layer. If an upper-layer test merely overlaps with a lower-layer one, it can be removed.

Note that this article also includes contract tests between integration and E2E levels. These verify that both parties share the same understanding of request/response shapes exchanged between services. If your app has only one service, you don't need to worry about them immediately.

## Example: Trying pytest

Python developers frequently use `pytest`. By naming files `test_*.py` and functions starting with `test_`, it automatically discovers and runs them. Below is an example covering all three layers for a single order service involving checking inventory, reducing stock, and sending emails. Separating layers (discussed in [Layered Architecture](#/post/be-layered-architecture)) allows you to inject repositories and mailers from the outside, making testing easier.

<details>
<summary>Target Code: shop.py</summary>

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
<summary>Test Code: test_shop.py (Unit, Mock, Integration)</summary>

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

Running `python -m pytest -q` on these two files resulted in `7 passed` (pytest 9.2.0, verified locally).

</details>

Four parts of the code are worth noting:

- `parametrize`: Providing a table of inputs and expected values allows the same test to run separately for each value. It is good practice to include boundary values (e.g., 0%, 100%).
- `pytest.raises`: Used to verify that an exception occurs when it should. How errors are designed connects to [Error Handling and Logging](#/post/be-error-logging).
- `Mock`: Replaces the mailer with a fake to check only if `send` was called once with specific arguments; no actual emails are sent. You can also verify that no email was sent when inventory is low (`assert_not_called`).
- `fixture` and `yield`: Create an in-memory SQLite database, pass it to tests, and close it upon completion. According to pytest documentation, code after `yield` handles teardown. The default scope is per-test function, meaning a new database is created for each test, preventing interference between tests.

`test_place_with_real_db` corresponds to an integration test. It uses the same `OrderService`, but executes real SQL instead of fakes. This test fails if the SQL statement is incorrect, whereas unit tests above cannot catch such issues.

## How to Test API Endpoints

APIs built with web frameworks typically simulate requests against a running server using the framework's provided test client, rather than spinning up the full server. These tests cover routing, validation, and serialization, making them closer to integration tests than unit tests. We verify status codes and response body shapes to ensure they align with the conventions outlined in [APIs and REST](#/post/be-api-rest). In this case, I did not run framework examples directly, so no code is included here.

## How Much Code Should Be Written?

- Do not attempt to test every line of code. Focus on critical calculations involving money, permissions, and inventory first.
- When fixing a bug, write a test that reproduces the bug before applying the fix to prevent recurrence.
- Use coverage metrics (the percentage of code executed) to identify untested areas, not as a guarantee of safety. High coverage does not mean safe, as tests that merely execute code without assertions can inflate these numbers.
- For apps with AI features, outputs vary each time, making `assert equals` ineffective. This is addressed separately in [LLM App Evaluation](#/post/app-eval).

## Common Misconceptions

- Writing many tests eliminates bugs: Tests only verify scenarios you have considered; they prove the absence of bugs but cannot guarantee their existence or find all issues.
- Using mocks solves everything: Fakes behave differently from real components, allowing tests to pass while actual systems fail. Therefore, connection points like databases should be verified again through integration tests.
- E2E (End-to-End) testing is definitive and sufficient on its own: While reliable, it is slow and unstable, making root cause analysis difficult upon failure. This is why the test pyramid emphasizes a thicker foundation at the bottom.
- Testing slows down development: Initially time-consuming, manual verification becomes more costly as code grows. However, the extent of speed improvement varies by team and project, so specific numbers are not provided.

## Reference Links

- Martin Fowler, The Practical Test Pyramid: https://martinfowler.com/articles/practical-test-pyramid.html
- pytest documentation, How to use fixtures: https://docs.pytest.org/en/stable/how-to/fixtures.html

← [Concept Map](#/post/be-map)

Related articles: [Error Handling and Logging](#/post/be-error-logging) · [Layered Architecture](#/post/be-layered-architecture) · [CI/CD and Deployment Strategies](#/post/cloud-cicd)