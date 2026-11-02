백엔드 테스트는 코드를 고쳤을 때 "예전에 되던 게 아직 되나"를 사람 대신 확인해 주는 코드이고, 크기별로 단위·통합·E2E로 나누어 아래쪽을 많이 쓰는 게 기본 모양이다.

## 테스트가 뭔지

테스트는 코드를 실행해서 결과가 기대와 같은지 비교하는 또 다른 코드다. 함수에 입력을 넣고, 나온 값이 맞는지 `assert`로 확인하는 식이다. 사람이 화면을 눌러 보는 것과 하는 일은 같은데, 버튼 하나로 몇 초 만에 수백 개를 돌릴 수 있다는 점이 다르다.

백엔드에서 이게 특히 필요한 이유는 눈에 안 보이기 때문이다. 프런트는 깨지면 화면이 이상해지지만, 서버 쪽 계산이나 DB 갱신이 틀리면 조용히 잘못된 값이 쌓인다. 그리고 기능이 늘수록 한 군데를 고쳤을 때 다른 곳이 깨질 가능성도 커진다. 테스트가 있으면 고친 직후에 그걸 알 수 있고, [CI/CD](#/post/cloud-cicd)에서 자동으로 돌리면 깨진 코드가 배포로 넘어가는 걸 막을 수 있다.

## 크기별로 나누면

테스트는 "얼마나 많은 부분을 한 번에 묶어서 실행하느냐"로 나눈다.

| 종류 | 확인하는 범위 | 속도 | 깨지는 이유 찾기 |
|---|---|---|---|
| 단위(unit) | 함수·클래스 하나 | 아주 빠름 | 쉬움 |
| 통합(integration) | DB·외부 서비스 같은 연결 지점 하나 | 중간 | 보통 |
| E2E(end-to-end) | 배포된 시스템 전체를 사용자 흐름대로 | 느림 | 어려움 |

단위 테스트는 주변 의존물(DB, 메일 발송 등)을 가짜로 바꿔 놓고 코드 한 덩어리만 본다. 통합 테스트는 그 가짜를 진짜로 바꿔서 "우리 코드와 DB가 실제로 맞물리나"를 본다. 예를 들어 SQL이 문법 오류 없이 돌고 원하는 행을 바꾸는지는 가짜 DB로는 알 수 없다. E2E는 API를 호출해서 주문이 만들어지고 재고가 줄어드는 전 과정을 서버·DB·외부 연동이 다 붙은 상태에서 본다.

## 테스트 피라미드

Martin Fowler의 글에 나오는 테스트 피라미드는 이 세 종류를 얼마나 쓸지에 대한 어림 규칙이다. 단위 테스트를 가장 많이, 통합은 그보다 적게, E2E는 아주 조금 쓴다. 글은 E2E를 "전체 시스템을 다 쓰니 확신은 크지만 느리고, 유지 비용이 크고, 불안정(flaky)해지기 쉽다"고 설명하고, 핵심 사용자 흐름 몇 개로만 제한하라고 한다. 거꾸로 E2E가 제일 많은 모양은 아이스크림 콘이라고 부르며 피해야 할 패턴으로 든다.

```
        /\            E2E   : 핵심 흐름 몇 개
       /  \ 
      /----\          통합  : DB·외부 연동 지점마다 조금
     /      \ 
    /--------\        단위  : 가장 많이, 빠르게
```

같은 글이 알려 주는 규칙도 하나 있다. 테스트마다 유지 비용이 드니까 가능한 한 아래 층에서 확인하고, 위 층 테스트가 깨졌는데 아래 층은 멀쩡하면 아래 층에 테스트를 하나 더 추가하라는 것이다. 위 층 테스트가 아래 층과 겹치기만 한다면 지우는 것도 방법이라고 한다.

참고로 이 글은 통합과 E2E 사이에 계약(contract) 테스트도 둔다. 서비스끼리 주고받는 요청·응답 모양을 양쪽이 같게 이해하는지 확인하는 테스트다. 서비스가 하나뿐인 앱이면 당장은 신경 안 써도 된다.

## 예시: pytest로 써 보기

파이썬에서는 pytest를 많이 쓴다. 파일 이름을 `test_*.py`로 하고 함수 이름을 `test_`로 시작하면 알아서 찾아서 돌린다. 아래는 주문 서비스 하나에 대해 세 층위를 다 써 본 예다. 재고를 확인하고, 줄이고, 메일을 보내는 코드다. 레이어를 나눠 두면(이건 [레이어드 아키텍처](#/post/be-layered-architecture)에서 다룬다) 리포지토리와 메일러를 바깥에서 넣어 줄 수 있어서 테스트하기 쉬워진다.

<details>
<summary>테스트 대상 코드: shop.py</summary>

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
<summary>테스트 코드: test_shop.py (단위·목·통합)</summary>

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

위 두 파일로 `python -m pytest -q`를 돌렸더니 `7 passed`가 나왔다(pytest 9.2.0, 로컬 실행 확인).

</details>

코드에서 눈여겨볼 부분은 네 군데다.

- `parametrize`: 입력과 기대값을 표로 주면 같은 테스트가 값마다 따로 돈다. 경계값(0%, 100%)을 넣기 좋다.
- `pytest.raises`: 예외가 나야 정상인 경우를 확인한다. 에러를 어떻게 설계하는지는 [에러 처리와 로깅](#/post/be-error-logging)과 이어진다.
- `Mock`: 메일러를 가짜로 바꿔서 "send가 이 인자로 한 번 불렸나"만 본다. 실제 메일은 안 나간다. 재고 부족일 때 메일이 안 나갔다는 것(`assert_not_called`)도 확인할 수 있다.
- `fixture`와 `yield`: 메모리 SQLite를 만들고, 테스트에 넘기고, 끝나면 닫는다. pytest 문서 기준으로 `yield` 뒤의 코드가 정리(teardown)이고, 기본 범위는 테스트 함수 하나라서 테스트마다 새 DB가 생긴다. 그래서 테스트끼리 서로 영향을 주지 않는다.

`test_place_with_real_db`가 통합 테스트에 해당한다. 같은 `OrderService`지만 가짜 대신 진짜 SQL이 돈다. 이 테스트는 SQL 문장이 틀리면 깨지고, 위의 단위 테스트는 못 잡는다.

## API 엔드포인트는 어떻게 테스트하나

웹 프레임워크로 만든 API는 보통 프레임워크가 주는 테스트 클라이언트로 서버를 띄우지 않고 요청을 흉내 낸다. 이런 테스트는 라우팅·검증·직렬화까지 함께 거치니까 단위보다는 통합에 가깝다. 상태 코드와 응답 본문 모양을 확인하게 되는데, 이게 [API와 REST](#/post/be-api-rest)에서 정리한 규약과 맞는지 보는 일이다. 이번엔 프레임워크 예시는 직접 실행해 보지 않아서 코드를 싣지 않았다.

## 어디까지 짜야 하나

- 모든 줄을 테스트하려고 하지 않는다. 틀리면 곤란한 계산(금액·권한·재고)부터 쓴다.
- 버그를 하나 고칠 때 그 버그를 재현하는 테스트를 먼저 쓰고 고친다. 같은 버그가 다시 나오는 걸 막는다.
- 커버리지 숫자(코드의 몇 %를 실행했나)는 "테스트가 안 닿는 곳이 어디인가"를 찾는 데 쓰고, 높다고 안전하다고 믿지는 않는다. 실행만 하고 아무것도 확인하지 않는 테스트도 숫자는 올려 주기 때문이다.
- AI 기능이 들어간 앱은 출력이 매번 달라서 `assert 같다`가 안 통한다. 그건 따로 [LLM 앱 평가](#/post/app-eval)에서 다룬다.

## 흔한 오해

- 테스트를 많이 짜면 버그가 없다: 테스트는 "내가 떠올린 경우"만 확인한다. 없다는 걸 증명하지는 못하고, 있다는 걸 찾아낼 뿐이다.
- Mock을 쓰면 다 해결된다: 가짜가 진짜와 다르게 동작하면 테스트는 통과하는데 실제로는 깨진다. 그래서 DB 같은 연결 지점은 통합 테스트로 한 번 더 본다.
- E2E가 제일 확실하니 그것만 쓰면 된다: 확실하긴 한데 느리고 불안정해서, 실패했을 때 어디가 원인인지 찾기도 어렵다. 피라미드가 아래를 두껍게 하라는 이유가 이거다.
- 테스트는 개발 속도를 늦춘다: 처음엔 시간이 들지만, 코드가 커질수록 수동으로 확인하는 시간이 더 크다. 다만 얼마나 빨라지는지는 팀과 프로젝트마다 달라서 숫자로는 말하지 않는다.

## 근거 링크

- Martin Fowler, The Practical Test Pyramid: https://martinfowler.com/articles/practical-test-pyramid.html
- pytest 문서, How to use fixtures: https://docs.pytest.org/en/stable/how-to/fixtures.html

← [개념 지도로](#/post/be-map)

관련 글: [에러 처리와 로깅](#/post/be-error-logging) · [레이어드 아키텍처](#/post/be-layered-architecture) · [CI/CD와 배포 전략](#/post/cloud-cicd)
