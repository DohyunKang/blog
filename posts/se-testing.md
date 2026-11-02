테스트 개요는 [소프트웨어 공학 기초](#/post/cs-sw-engineering)와 [백엔드 테스트](#/post/be-testing)에서 이미 훑었다. 단위·통합·시스템으로 나누는 것, 피라미드 모양은 거기에 있다. 이 글은 한 층 안으로 들어가서 "그 테스트 케이스를 어떻게 고르고, 얼마나 했는지 어떻게 재고, 어떤 순서로 짜느냐"를 다룬다.

## 테스트는 증명이 아니라 표본 추출이다

입력이 가질 수 있는 값은 사실상 무한하다. 테스트로 전부 돌려 볼 수 없으니 몇 개를 골라 돌린다. 통과했다는 건 "고른 입력에서는 틀리지 않았다"는 뜻이지 "틀린 곳이 없다"는 뜻이 아니다. 그러니 테스트 설계는 결국 어떤 표본이 버그를 잘 잡느냐의 문제가 된다.

표본을 고르는 기준은 크게 둘이다. 하나는 명세(요구사항)만 보고 고르는 블랙박스 기법, 다른 하나는 코드 구조를 보고 고르는 화이트박스 기법이다.

| | 보는 것 | 대표 기법 | 잘 찾는 것 |
|---|---|---|---|
| 블랙박스 | 입력·출력 명세 | 동치 분할, 경계값, 결정 테이블 | 요구와 다르게 동작하는 것, 빠뜨린 케이스 |
| 화이트박스 | 코드의 분기·경로 | 문장·분기·조건 커버리지 | 한 번도 안 돌아본 코드 |

## 블랙박스: 동치 분할과 경계값

입력을 "프로그램이 똑같이 취급하는 묶음"으로 나눈 게 동치 분할이다. 같은 묶음 안에서는 어떤 값을 넣어도 같은 결과일 테니 묶음마다 하나만 고른다. 그다음 묶음 사이의 경계에서는 조건식을 `<`로 써야 할 걸 `<=`로 쓰는 식의 실수가 잘 생기므로 경계 값은 따로 넣는다.

예시로 배송비 함수를 잡았다. 5kg 이하 3,000원, 20kg 이하 5,000원, 그 위는 9,000원이고 회원은 반값, 0 이하 무게는 오류다.

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

`pytest`로 돌리니 9개가 통과했다. 케이스를 숫자 몇 개로 줄였는데도 구간 셋, 경계 둘, 오류 입력까지 다 들어간다. `parametrize`는 같은 테스트 본문에 입력·기대값 표를 넘기는 방식이라 케이스를 늘려도 코드가 길어지지 않는다.

<details>
<summary>결정 테이블: 조건이 여러 개 겹칠 때</summary>

조건이 둘 이상 겹치면 동치 분할만으로는 조합이 빠지기 쉽다. 결정 테이블은 조건의 참/거짓 조합을 행으로 쓰고 각 조합의 결과를 적는 표다. 위 함수라면 "5kg 이하 여부 × 회원 여부"처럼 조합을 한 줄씩 적고, 비어 있는 칸이 없는지 보면 된다. 칸이 비어 있으면 명세에 안 적힌 조합이 있다는 뜻이라서, 코드가 아니라 요구사항 쪽 질문이 하나 생긴다.
</details>

## 화이트박스: 커버리지

커버리지는 테스트가 코드의 어느 정도를 실행했는지 재는 지표다. 종류마다 엄격함이 다르다.

| 종류 | 기준 |
|---|---|
| 문장(statement) | 모든 문장이 한 번은 실행됨 |
| 분기(branch) | 모든 `if`가 참인 경우와 거짓인 경우 둘 다 실행됨 |
| 조건(condition) | `and`·`or`로 묶인 조건 하나하나가 참·거짓 둘 다 됨 |

문장 커버리지가 100%여도 분기는 비어 있을 수 있다. 직접 확인해 봤다. 쿠폰이 있으면 1,000원을 깎는 함수를 두고, 어떤 줄이 실행됐는지 `sys.settrace`로 세어 봤다.

```python
def final_price(price, coupon):
    discount = 0
    if coupon:
        discount = 1000
    return price - discount
```

| 넣은 테스트 | 실행된 문장 |
|---|---|
| `coupon=True` 하나 | 4 / 4 |
| `coupon=False` 하나 | 3 / 4 |
| 둘 다 | 4 / 4 |

`coupon=True` 하나만으로 문장은 전부 실행된다. 그런데 `if`가 거짓인 경로, 즉 쿠폰이 없을 때는 한 번도 안 돌았다. 거기에 버그가 있어도 문장 커버리지 100%는 조용히 통과한다. `else`가 없는 `if`가 이런 구멍을 만든다. 그래서 문장보다 분기 커버리지를 최소 기준으로 보는 쪽이 많다.

커버리지에서 조심할 점은 방향이다. 낮으면 "안 돌아본 코드가 있다"는 확실한 신호지만, 높다고 "잘 검증했다"는 뜻은 아니다. 커버리지는 코드가 실행됐는지만 보고 `assert`가 제대로 있는지는 보지 않는다. assert 없는 테스트도 커버리지는 올려 준다.

## TDD: 테스트를 먼저 쓰는 순서

TDD는 테스트 기법이라기보다 짜는 순서다. [Martin Fowler의 설명](https://martinfowler.com/bliki/TestDrivenDevelopment.html)을 기준으로 하면 이렇다. 먼저 필요한 테스트 목록을 적고 하나를 고른다. 그다음 아직 없는 기능에 대한 테스트를 쓰고(Red), 그 테스트만 통과할 만큼의 코드를 쓰고(Green), 코드를 정리한다(Refactor). 이걸 목록이 비도록 반복한다. 글에서는 마지막 리팩터링 단계를 가장 많이 건너뛰는 단계로 꼽고, 건너뛰면 코드 조각이 쌓인 덩어리가 된다고 한다.

윤년 판별로 한 바퀴 돌려 봤다. 처음엔 가장 단순하게 4로 나누어떨어지면 윤년으로 구현했다.

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

돌리면 `test_century`가 `assert not True`로 실패한다(Red). 이 테스트가 통과하게 코드를 고친다.

```python
def is_leap(y):
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
```

다시 돌리니 전부 통과했다(Green). 처음부터 완성된 식을 쓰지 않고 테스트가 실패하는 걸 한 번 본 뒤에 고친 게 요점이다. 실패하는 걸 먼저 봐야 그 테스트가 정말 그 잘못을 잡아내는지 알 수 있다.

TDD가 좋은 점은 테스트가 항상 남는다는 것이고, 대신 설계가 아직 흔들리는 초반에는 테스트도 같이 자주 고쳐야 한다. 어디까지 적용할지는 팀마다 다르다.

## 테스트 더블: 진짜 대신 쓰는 가짜

단위 테스트에서 메일 발송이나 DB 같은 바깥 의존을 진짜로 쓰면 느리고 불안정하다. 그 자리에 가짜를 꽂는 걸 테스트 더블이라 부른다. [Fowler의 정리](https://martinfowler.com/bliki/TestDouble.html)에는 종류가 다음처럼 나뉜다.

| 종류 | 하는 일 |
|---|---|
| Dummy | 매개변수 자리만 채우고 실제로는 안 쓰임 |
| Stub | 미리 정해 둔 답만 돌려줌 |
| Fake | 동작은 하지만 지름길 구현(예: 메모리 DB) |
| Spy | 스텁인데 어떻게 호출됐는지 기록도 함 |
| Mock | 기대한 호출을 미리 적어 두고 검증 때 확인 |

파이썬에서는 `unittest.mock.Mock`으로 만든다. 재고가 5 미만이면 메일을 보내는 함수로 확인했다.

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

예외 없이 끝까지 돌았다. 여기서 검증 대상은 반환값이 아니라 "메일을 보냈나/안 보냈나"라는 행동이다. 반환값으로 확인할 수 없는 결과를 볼 때 목을 쓴다. 다만 호출 방식까지 너무 세세하게 고정하면 내부 구현을 바꿀 때마다 테스트가 깨진다. 가능하면 결과(상태)를 확인하고, 목은 꼭 필요한 곳에만 쓴다.

## 코드 리뷰도 품질 활동이다

테스트가 코드를 실행해서 찾는 방법이라면 코드 리뷰는 사람이 읽어서 찾는 방법이다. 둘이 잡는 게 다르다. 테스트는 동작 오류를 잡고, 리뷰는 읽기 어려운 구조·이름·설계 문제를 잡는다. 구글의 [리뷰어 가이드](https://google.github.io/eng-practices/review/reviewer/standard.html)는 기준을 이렇게 둔다. 완벽하지 않아도 코드 전체 건강을 확실히 개선하는 변경이면 승인하고, 사소한 지적은 "Nit:"으로 표시해 작성자가 무시할 수 있게 한다. 반대로 코드 건강을 분명히 나쁘게 하는 변경은 긴급 상황이 아니면 통과시키지 않는다.

## 흔한 오해

- 테스트가 다 통과했으니 버그가 없다? 통과는 고른 입력에서만의 이야기다. 표본이 나쁘면 통과해도 의미가 작다.
- 커버리지 100%면 충분하다? 위에서 본 것처럼 문장 100%여도 분기가 비어 있을 수 있고, assert가 없어도 커버리지는 오른다.
- 목을 많이 쓸수록 좋은 단위 테스트다? 목이 늘면 구현에 묶여서 리팩터링 때 같이 깨진다.
- TDD는 테스트를 먼저 쓰기만 하면 된다? 마지막 리팩터링 단계까지 가야 TDD다.

[자세히 → 요구사항과 설계](#/post/se-requirements-design)에서 "확인 가능한 요구사항"을 어떻게 쓰는지 이어지고, 이 테스트들을 자동으로 돌리는 건 [형상 관리와 CI/CD](#/post/se-cicd)에서 다룬다.

## 근거 링크

- [Martin Fowler, Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Martin Fowler, Test Double](https://martinfowler.com/bliki/TestDouble.html)
- [Google Engineering Practices, The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html)

← 개념 지도로 ([소프트웨어 공학 기초](#/post/cs-sw-engineering))

관련 글: [백엔드 테스트](#/post/be-testing) · [개발 방법론](#/post/se-methodology) · [형상 관리와 CI/CD](#/post/se-cicd)
