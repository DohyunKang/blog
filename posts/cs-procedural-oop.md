절차지향과 객체지향은 같은 문제를 코드로 나누는 기준이 달라서, 절차지향은 함수(할 일)로, 객체지향은 객체(데이터와 그걸 다루는 동작)로 쪼갠다.

## 두 방식이 뭔지

절차지향(procedural)은 프로그램을 절차, 즉 함수나 서브루틴의 연속으로 짠다. 위키백과 설명으로는 프로그램을 변수·자료구조·서브루틴으로 나누고, 절차가 그 자료구조를 따로 다루는 방식이다. Fortran, COBOL, Pascal, C 같은 오래된 언어들이 대표로 나온다.

객체지향(object-oriented)은 데이터와 그걸 다루는 동작을 객체 하나로 묶는다. 객체는 정해 둔 창구(메서드)로만 바깥과 얘기한다. 같은 문서에서 이 둘의 차이를 이 정도로 정리한다.

| | 절차지향 | 객체지향 |
|---|---|---|
| 나누는 단위 | 함수 | 클래스·객체 |
| 데이터와 동작 | 따로 있다 | 한 덩어리 |
| 질문 | 무슨 순서로 처리하지 | 이 데이터는 누가 책임지지 |
| 잘 맞는 곳 | 흐름이 한 줄로 보이는 작업 | 상태가 있고 종류가 늘어나는 것 |

파이썬은 둘 다 된다. 함수만 써도 되고 클래스를 써도 되니까 비교하기 좋다.

## 같은 문제를 두 방식으로

계좌에 입금하고 출금하는 문제로 해 봤다. 먼저 절차지향이다. 계좌는 그냥 딕셔너리고, 동작은 밖에 있는 함수다.

```python
def make_account(owner, balance=0):
    return {"owner": owner, "balance": balance}

def deposit(acc, amount):
    if amount <= 0:
        raise ValueError("amount must be positive")
    acc["balance"] += amount

def withdraw(acc, amount):
    if amount > acc["balance"]:
        raise ValueError("insufficient funds")
    acc["balance"] -= amount

a = make_account("kim", 100)
deposit(a, 50)
withdraw(a, 30)
print(a)              # {'owner': 'kim', 'balance': 120}
a["balance"] = -999   # 막을 방법이 없다
```

읽기 쉽고 짧다. 다만 계좌 데이터가 아무 함수에나 열려 있어서 마지막 줄처럼 검증 없이 값을 바꿀 수 있다. 검증은 함수를 거쳐 가는 사람만 지킨다.

같은 걸 클래스로 쓰면 이렇다.

```python
class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self._balance = balance

    @property
    def balance(self):
        return self._balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("amount must be positive")
        self._balance += amount

    def withdraw(self, amount):
        if amount > self._balance:
            raise ValueError("insufficient funds")
        self._balance -= amount
```

잔액을 `_balance`로 두고 읽기만 `balance`로 열어 뒀다. `acc.balance = 5`를 하면 AttributeError가 났다(직접 돌려 확인). 규칙이 데이터 옆에 붙어 있으니 값이 어떻게 바뀌는지 이 클래스만 보면 된다.

## 클래스·캡슐화

클래스는 객체를 찍어 내는 틀이고, 객체는 그 틀로 만든 실체다. 파이썬 공식 튜토리얼 기준으로 클래스는 데이터와 동작을 묶어 새 타입을 만든다. 메서드의 첫 인자가 그 객체 자신(`self`)이고, 이걸 생략할 수 없게 되어 있다. `__init__`은 객체를 만들 때 실행되는 초기화 함수다.

캡슐화는 안의 데이터를 숨기고 정해 둔 창구로만 만지게 하는 것이다. 헷갈린 점은 파이썬에 진짜 private이 없다는 것이었다. 튜토리얼에 "밖에서 접근 못 하는 private 인스턴스 변수는 파이썬에 없다"고 나온다. 대신 밑줄로 시작하는 이름(`_spam`)은 공개 API가 아니라는 약속으로 쓴다. 밑줄 두 개(`__spam`)는 `_클래스이름__spam`으로 이름이 바뀌는데, 이건 서브클래스와 이름이 겹치는 사고를 피하려는 것이고 막으려는 건 아니다(튜토리얼도 접근은 여전히 가능하다고 적는다). 그래서 파이썬 캡슐화는 강제가 아니라 약속에 가깝다.

## 상속

상속은 기존 클래스를 이어받아 필요한 것만 더하거나 바꾸는 것이다. 이자가 붙는 저축 계좌와 한도 넘게 뽑을 수 있는 당좌 계좌를 만들어 봤다.

```python
class SavingsAccount(Account):
    def __init__(self, owner, balance=0, rate=0.02):
        super().__init__(owner, balance)
        self.rate = rate

    def add_interest(self):
        self.deposit(self._balance * self.rate)

class CheckingAccount(Account):
    def withdraw(self, amount):          # 덮어쓰기(오버라이딩)
        if amount > self._balance + 50:
            raise ValueError("overdraft limit")
        self._balance -= amount
```

`deposit`은 `Account` 것을 그대로 쓰고, `CheckingAccount`는 `withdraw`만 갈아 끼운다. `super()`는 부모 쪽 메서드를 부를 때 쓴다. 튜토리얼에는 파이썬의 모든 메서드가 사실상 virtual이라고 나온다. 그래서 부모 메서드가 다른 메서드를 부르면 자식 것이 불릴 수 있다.

## 다형성

다형성은 같은 호출이 객체 종류에 따라 다르게 동작하는 것이다.

```python
for acc in [SavingsAccount("lee", 1000), CheckingAccount("park", 10)]:
    acc.withdraw(40)
    print(type(acc).__name__, acc.balance)
# SavingsAccount 960
# CheckingAccount -30
```

호출하는 쪽은 `withdraw(40)`만 안다. 잔액이 10인 당좌 계좌는 한도 50 안이라 -30이 됐고, 저축 계좌는 960이 됐다. 절차지향이었으면 함수 안에 `if 계좌종류 == ...`가 계속 늘어났을 자리다.

<details>
<summary>파이썬의 다형성은 상속 없이도 된다(덕 타이핑)</summary>

튜토리얼은 "다형성"이나 "덕 타이핑"이라는 말은 안 쓰지만, 같은 얘기를 한다. 어떤 추상 타입을 기대하는 코드에 그 타입의 메서드를 흉내 내는 다른 클래스를 넘겨도 된다는 것이다. 예로 `__iter__()`와 `__next__()`를 가진 클래스면 어떤 부모를 상속했는지와 관계없이 `for` 문에 들어간다.

그래서 파이썬에서는 `withdraw` 메서드만 있으면 `Account`를 상속하지 않은 클래스도 위 반복문에 넣을 수 있다. 자바처럼 인터페이스 상속이 필수인 언어와 다른 점이다. 상속은 "코드를 물려받는 수단", 다형성은 "같은 메서드 이름으로 부르는 성질"이라 따로 생각하는 게 맞는 것 같다.

</details>

## 언제 뭘 쓰나

외운 기준은 이렇다. 흐름이 한 줄이고 데이터가 단순하면(파일 읽고 변환해서 저장하는 스크립트) 절차지향이 짧고 낫다. 상태를 가진 개념이 여럿이고 종류가 계속 늘어나면(계좌 종류, 결제 수단) 객체지향이 정리가 된다. 큰 코드를 설계할 때는 객체지향 위에 원칙이 더 붙는데, 그건 [자세히 → SOLID 원칙](#/post/cs-solid)과 [자세히 → 디자인 패턴](#/post/cs-design-patterns)에서 이어진다. 클래스를 어떻게 자를지의 감각은 [자세히 → 결합도와 응집도](#/post/be-coupling-cohesion)와 이어지고, 서비스 코드에서 역할별로 층을 나누는 얘기는 [자세히 → 계층형 아키텍처](#/post/be-layered-architecture)에 있다.

## 흔한 오해

- 객체지향이 더 좋은 방식이다: 둘은 도구가 다르고, 짧은 스크립트에 클래스를 억지로 넣으면 코드만 길어진다. 현대 코드도 함수와 객체를 섞어 쓴다.
- 클래스를 쓰면 객체지향이다: 데이터만 담고 동작은 밖 함수에 있는 클래스는 딕셔너리를 이름 붙인 것에 가깝다.
- 상속을 많이 쓸수록 재사용이 잘 된다: 상속이 깊어지면 부모를 고칠 때 자식이 줄줄이 깨진다. 이 부분의 대안은 위의 SOLID·디자인 패턴 글에서 다룬다.
- 파이썬에도 private이 있다: 위에서 본 대로 약속과 이름 바꾸기뿐이다.

## 근거 링크

- Python 공식 튜토리얼, Classes: https://docs.python.org/3/tutorial/classes.html
- Wikipedia, Procedural programming: https://en.wikipedia.org/wiki/Procedural_programming

← 개념 지도로 (#/post/cs-map)

관련 글: [SOLID 원칙](#/post/cs-solid) · [디자인 패턴](#/post/cs-design-patterns) · [결합도와 응집도](#/post/be-coupling-cohesion)
