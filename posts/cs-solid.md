SOLID는 객체지향 설계에서 "코드가 바뀔 때 덜 깨지게" 만드는 다섯 가지 기준의 머리글자다. 규칙집이라기보다 코드가 이상할 때 이유를 찾는 체크리스트로 읽는 게 편했다.

## 어디서 나온 말인지

Wikipedia 기준으로 Robert C. Martin이 2000년 논문 "Design Principles and Design Patterns"에서 기본 원칙들을 소개했고, SOLID라는 머리글자는 Michael Feathers가 2004년쯤 붙였다.

| 글자 | 이름 | 한 줄 |
|---|---|---|
| S | 단일 책임 | 클래스를 바꿀 이유는 하나여야 한다 |
| O | 개방-폐쇄 | 확장에는 열려 있고 수정에는 닫혀 있어야 한다 |
| L | 리스코프 치환 | 부모 자리에 자식을 넣어도 멀쩡해야 한다 |
| I | 인터페이스 분리 | 안 쓰는 메서드에 의존하게 만들지 않는다 |
| D | 의존성 역전 | 구체 클래스 말고 추상에 기대라 |

[자세히 → 절차지향 vs 객체지향](#/post/cs-procedural-oop)을 먼저 읽고 오면 클래스·상속·인터페이스 얘기가 더 편하다.

아래 예시는 주문 처리라는 한 가지 상황을 계속 끌고 간다. 코드는 Python으로 직접 돌려서 결과를 확인했다.

## S: 바꿀 이유가 하나

처음 정의는 "클래스를 바꿀 이유가 둘 이상이면 안 된다"였다. Martin이 나중에 쓴 글에서는 이걸 사람 기준으로 풀었다. 모듈은 하나의 이해관계자(액터)에게만 책임져야 한다는 얘기다.

그 글의 예가 `Employee` 클래스다. `calculatePay`는 재무 담당, `reportHours`는 운영 담당, `save`는 기술 담당이 각각 요구하는 기능인데 한 클래스에 같이 있다. 한쪽이 요청해서 바꾼 코드가 다른 쪽 기능을 깨뜨릴 수 있으니 나누라는 것이다.

주문에 옮기면 이렇다. 위반하는 쪽은 `Order` 하나가 합계 계산, 할인, DB 저장, 메일 발송을 다 한다. 나는 이런 클래스를 보면 import 목록부터 길어지더라. 개선은 단순하다.

```python
@dataclass
class Order:
    items: list  # (이름, 가격)
    def total(self): return sum(p for _, p in self.items)

class OrderRepository:          # 저장만 안다
    def __init__(self): self.rows = []
    def save(self, order): self.rows.append(order)
```

주문은 금액만 알고, 저장은 저장소가 안다. "할인율이 바뀌었다"와 "DB를 바꿨다"가 서로 다른 파일에서 일어난다.

## O: 새 기능이 기존 코드를 안 건드리게

할인 종류가 늘 때마다 `if`를 추가하는 코드가 전형적인 위반이다.

```python
def checkout_bad(order, kind):
    t = order.total()
    if kind == "vip": return int(t*0.9)
    elif kind == "coupon": return max(t-3000,0)
    return t
```

쿠폰 할인이 하나 더 생기면 이미 잘 돌던 이 함수를 열어서 고쳐야 한다. 고치다 VIP 쪽을 망칠 수도 있다. 그래서 할인을 클래스로 빼고, 새 정책은 새 클래스로 더한다.

```python
class Discount(ABC):
    @abstractmethod
    def apply(self, price: int) -> int: ...

class NoDiscount(Discount):
    def apply(self, price): return price
class VipDiscount(Discount):
    def apply(self, price): return int(price * 0.9)
class CouponDiscount(Discount):
    def apply(self, price): return max(price - 3000, 0)

def checkout(order, discount: Discount):
    return discount.apply(order.total())
```

합계 14,000원짜리 주문에 `checkout_bad(o, "vip")`는 12,600, `checkout(o, VipDiscount())`도 12,600, `CouponDiscount()`는 11,000이 나왔다. 결과는 같고 새 할인을 넣을 때 `checkout`은 안 열어도 된다. 이 구조는 전략 패턴과 같은 모양이다. [자세히 → 디자인 패턴](#/post/cs-design-patterns)

## L: 부모 자리에 자식을 넣어도 되는가

Wikipedia가 인용하는 문장은 "기반 클래스를 쓰는 함수가 파생 클래스를 몰라도 그대로 동작해야 한다"는 취지다. 상속하면 is-a 관계라는 직관이 먼저 오는데, 이 원칙은 "동작이 약속을 지키느냐"를 본다.

고전 예가 정사각형이다. 수학에서 정사각형은 직사각형이지만 코드에서는 문제가 생긴다.

```python
class Rectangle:
    def __init__(self, w, h): self.w, self.h = w, h
    def set_width(self, w): self.w = w
    def set_height(self, h): self.h = h
    def area(self): return self.w * self.h

class Square(Rectangle):
    def set_width(self, w): self.w = self.h = w
    def set_height(self, h): self.w = self.h = h

def stretch(r):
    r.set_width(5); r.set_height(2)
    return r.area()
```

`stretch(Rectangle(1,1))`은 10, `stretch(Square(1,1))`은 4가 나왔다. `stretch`는 "너비와 높이는 따로 바뀐다"고 믿고 짜였는데 `Square`가 그 믿음을 깼다. 타입은 맞아도 행동이 안 맞는 경우다. 해결은 보통 상속을 포기하는 것이다. 둘을 `Shape`의 형제로 두고 부모에는 `area()`만 약속한다.

흔히 보는 위반 신호는 자식에서 `NotImplementedError`를 던지는 것, 부모 메서드가 하던 검증을 자식이 건너뛰는 것이다.

## I: 필요한 것만 요구한다

"클라이언트가 쓰지 않는 메서드에 의존하도록 강요하지 말라"가 원문 취지다. 프린터·스캐너·팩스가 한 인터페이스에 있으면 프린터만 되는 기기도 `scan()`을 구현해야 하고, 보통 빈 메서드나 예외로 때운다.

```python
class Printer(Protocol):
    def print_doc(self, d): ...
class Scanner(Protocol):
    def scan(self): ...

def run_print(p: Printer, d):      # 인쇄만 필요하면 Printer만 요구
    return p.print_doc(d)
```

인쇄만 되는 `OfficePrinter`와 둘 다 되는 `Combo`를 모두 `run_print`에 넣어서 돌려 봤고 둘 다 통과했다. 인터페이스가 작으면 구현하는 쪽도, 테스트 때 가짜를 만드는 쪽도 편하다.

## D: 안쪽이 바깥 구현을 모르게

핵심 로직(주문 처리)이 메일 발송 같은 세부 구현에 직접 기대면, 메일 서비스를 바꾸거나 테스트할 때 로직까지 같이 흔들린다. 그래서 로직은 `Notifier`라는 추상에 기대고 실제 구현은 밖에서 꽂아 준다.

```python
class Notifier(ABC):
    @abstractmethod
    def send(self, to, msg): ...

class OrderService:
    def __init__(self, repo, notifier: Notifier):
        self.repo, self.notifier = repo, notifier
    def place(self, order, user, discount: Discount):
        self.repo.save(order)
        paid = checkout(order, discount)
        self.notifier.send(user, f"결제 {paid}원")
        return paid
```

테스트에서는 `FakeNotifier`를 넣었더니 `place`가 12,600을 돌려주고 가짜에 `('a@x.com', '결제 12600원')`이 쌓였고 저장소에는 한 건이 들어갔다. 메일 서버 없이 로직 전체를 확인한 셈이다. 이게 의존성 주입(생성자로 넘기기)이고, 의존성 역전은 "화살표 방향을 안쪽 추상 쪽으로 돌린다"는 설계 원칙이다. 둘은 같은 말이 아니다. 주입은 방법이고 역전은 목적에 가깝다. 계층 구조에서 이게 어떻게 쓰이는지는 [자세히 → 계층형 아키텍처](#/post/be-layered-architecture)에 이어서 정리했다. 테스트 관점은 [자세히 → 백엔드 테스트](#/post/be-testing).

## 흔한 오해

- 클래스는 무조건 작게 쪼갤수록 좋다: S는 "메서드 하나당 클래스 하나"가 아니다. 같은 이유로 바뀌는 것끼리 모으는 게 목표라서, 너무 쪼개면 읽는 사람이 파일을 따라다니느라 지친다. 응집과 결합 쪽 얘기는 [자세히 → 결합도·응집도](#/post/be-coupling-cohesion).
- 처음부터 인터페이스와 추상 클래스를 깔아 둬야 한다: 변하지 않는 곳에 추상을 넣으면 코드만 늘어난다. 할인이 한 종류뿐이면 `if`도 괜찮다. 두 번째 변형이 실제로 나올 때 나누는 쪽이 덜 틀렸다.
- SOLID를 지키면 좋은 설계다: 원칙은 도구다. 서로 부딪히기도 하고(O를 위해 추상을 늘리면 코드가 복잡해진다) 언어에 따라 적용 모양이 다르다. 함수를 값으로 넘기는 언어에서는 `Discount` 클래스 대신 함수 하나를 넘겨도 O가 된다.
- L은 상속 얘기라서 상속을 안 쓰면 상관없다: 인터페이스를 구현하는 모든 경우에 해당한다. "같은 약속을 지키는가"의 문제다.

<details>
<summary>자세한 풀이: 위반 냄새 빠른 표</summary>

| 이런 냄새가 나면 | 의심할 원칙 |
|---|---|
| 한 파일을 여러 사람·여러 이유로 자주 고친다 | S |
| 기능 추가마다 같은 `if/elif`를 열어 고친다 | O |
| 자식 클래스가 부모 메서드를 비우거나 예외로 막는다 | L |
| 구현할 때 빈 메서드가 많다 | I |
| 테스트에서 외부 서비스를 못 떼어낸다 | D |

외울 필요 없이, 고치다가 불편한 지점이 이 표에 걸리면 해당 원칙을 떠올리면 된다. 이 표의 "냄새" 열은 위 예시에서 일어난 일을 줄인 것이고 공식 목록은 아니다.

</details>

## 근거 링크

- Wikipedia, SOLID: https://en.wikipedia.org/wiki/SOLID
- Robert C. Martin, The Single Responsibility Principle (2014): https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html

← [개념 map으로](#/post/cs-map)

관련 글: [절차지향 vs 객체지향](#/post/cs-procedural-oop) · [디자인 패턴](#/post/cs-design-patterns) · [결합도·응집도](#/post/be-coupling-cohesion)
