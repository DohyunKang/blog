디자인 패턴은 객체지향 설계에서 자주 만나는 문제와 그 풀이 방식에 이름을 붙여 모아 둔 것이다. 이름과 분류만 보면 헷갈리지만, 상황과 같이 보면 훨씬 쉬웠다.

## 패턴이 뭔지

1994년에 Gamma, Helm, Johnson, Vlissides 네 명이 쓴 책 "Design Patterns: Elements of Reusable Object-Oriented Software"가 출발점이다. 저자 넷이라 흔히 GoF(Gang of Four)라고 부른다. 이 책에 패턴이 23개 실려 있다. 개발자들이 따로 이름 없이 반복해서 쓰던 구조를 이름으로 묶어 준 책이라고 보면 된다.

패턴은 라이브러리가 아니라 설계의 모양이다. 복사해서 붙이는 코드가 아니라 "이런 상황엔 객체를 이렇게 나누면 편하더라" 하는 요령에 가깝다. 이름이 있으면 "여기 옵저버로 하자" 한마디로 구조 얘기가 끝나서 대화가 짧아진다.

이전에 정리한 [SOLID 원칙](#/post/cs-solid)과 관계가 깊다. 패턴 대부분이 "확장엔 열리고 수정엔 닫히게", "구현이 아니라 인터페이스에 기대기" 같은 원칙을 구현한 모양이다. [절차지향과 객체지향](#/post/cs-procedural-oop) 감각이 먼저 있어야 패턴도 읽힌다.

## 세 가지 분류

GoF는 패턴을 목적에 따라 셋으로 나눈다.

| 분류 | 무슨 문제를 푸나 | 대표 패턴 |
|---|---|---|
| 생성(Creational) | 객체를 어떻게 만들까 | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
| 구조(Structural) | 클래스·객체를 어떻게 엮을까 | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
| 행위(Behavioral) | 객체끼리 역할·통신을 어떻게 나눌까 | Observer, Strategy, Command, State, Iterator, Template Method 등 |

원서 기준 개수는 생성 5, 구조 7, 행위 11로 합쳐 23개다. 일부 사이트(Refactoring.guru)는 Interpreter를 빼고 22개로 소개하는데, 원서와 개수가 다른 건 이 때문인 것 같다. 개수는 책 기준 23개로 보는 쪽이 안전하다.

행위 패턴 목록(Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor)이 길어서 제일 많이 헷갈린다. 한 줄씩 붙여 두면 이렇다.

- Chain of Responsibility: 요청을 처리할 수 있는 객체가 나올 때까지 줄줄이 넘김
- Command: 요청 자체를 객체로 만들어 저장·취소·큐잉
- Iterator: 내부 구조를 안 보이고 하나씩 순회
- Mediator: 객체끼리 직접 말하지 않고 중재자를 거침
- Memento: 상태를 저장해 두었다가 복원(되돌리기)
- State: 상태에 따라 동작이 바뀌는 걸 상태 객체로 분리
- Template Method: 알고리즘 뼈대는 부모가, 세부 단계는 자식이
- Visitor: 구조는 그대로 두고 그 위에서 하는 일만 따로 추가

## 대표 패턴 코드로 보기

아래 코드는 모두 Python으로 직접 돌려서 출력까지 확인했다.

### Singleton: 인스턴스를 하나만

설정 객체처럼 프로그램 전체에서 하나만 있어야 할 때 쓴다.

```python
class Config:
    _inst = None
    def __new__(cls):
        if cls._inst is None:
            cls._inst = super().__new__(cls)
            cls._inst.values = {}
        return cls._inst

a, b = Config(), Config()
a.values["mode"] = "dev"
print(a is b, b.values)   # True {'mode': 'dev'}
```

편하지만 전역 변수와 비슷해서 테스트가 어려워지고 숨은 의존이 생긴다. 멀티스레드에서는 위 코드만으로는 부족하고 락 처리가 필요하다(이 부분은 실행해 보지 않았다).

### Factory Method: 만드는 쪽을 숨기기

어떤 클래스를 만들지 호출하는 쪽이 몰라도 되게 한다.

```python
from abc import ABC, abstractmethod

class Notifier(ABC):
    @abstractmethod
    def send(self, msg): ...
class Email(Notifier):
    def send(self, msg): return f"email: {msg}"
class Sms(Notifier):
    def send(self, msg): return f"sms: {msg}"

def make_notifier(kind):
    return {"email": Email, "sms": Sms}[kind]()

print(make_notifier("sms").send("hi"))   # sms: hi
```

엄밀히 GoF의 Factory Method는 부모 클래스가 생성 메서드를 정의하고 자식이 오버라이드하는 형태다. 위 코드는 같은 의도를 함수로 줄인 간단 팩토리에 가깝다. 한 줄로 줄이면 "객체 생성을 서브클래스에 위임"이다.

### Adapter: 맞지 않는 인터페이스 연결

옛 코드의 메서드 이름이 지금 쓰는 쪽과 다를 때 중간에 껴서 맞춰 준다.

```python
class OldPrinter:
    def print_text(self, s): return f"[old] {s}"
class NewPrinter:
    def __init__(self, old): self.old = old
    def write(self, s): return self.old.print_text(s)

print(NewPrinter(OldPrinter()).write("hello"))   # [old] hello
```

### Decorator: 기능을 겹쳐 입히기

상속 없이 기능을 덧붙인다. 커피에 우유, 샷을 추가하는 식이다.

```python
class Coffee:
    def cost(self): return 3000
class Milk:
    def __init__(self, base): self.base = base
    def cost(self): return self.base.cost() + 500
class Shot:
    def __init__(self, base): self.base = base
    def cost(self): return self.base.cost() + 700

print(Shot(Milk(Coffee())).cost())   # 4200
```

감싸는 쪽과 감싸지는 쪽이 같은 인터페이스(여기선 cost)를 가져서 몇 겹이든 쌓을 수 있다. 조합이 늘 때 "우유샷커피" 같은 클래스를 일일이 만들지 않아도 된다.

### Observer: 변하면 알려 주기

한 객체의 상태가 바뀌면 구독한 쪽들에 자동으로 알린다. 이벤트 처리, 알림이 이 모양이다.

```python
class Subject:
    def __init__(self): self.obs = []
    def subscribe(self, f): self.obs.append(f)
    def notify(self, v):
        for f in self.obs: f(v)

s = Subject()
s.subscribe(lambda v: print("A got", v))
s.subscribe(lambda v: print("B got", v))
s.notify(42)   # A got 42 / B got 42
```

### Strategy: 알고리즘을 갈아 끼우기

할인 계산처럼 "방식"이 여러 개이고 상황에 따라 바꿔야 할 때 쓴다.

```python
def won(p): return p
def vip(p): return int(p * 0.9)

class Cart:
    def __init__(self, strategy): self.strategy = strategy
    def total(self, p): return self.strategy(p)

print(Cart(won).total(10000), Cart(vip).total(10000))   # 10000 9000
```

if-else로 방식을 분기하던 걸 객체(여기선 함수)로 빼면 새 방식을 추가할 때 기존 코드를 안 건드려도 된다. SOLID의 개방-폐쇄 원칙을 그대로 보여 주는 예라서 기억에 남았다.

## 헷갈리기 쉬운 쌍

- Decorator와 Proxy: 둘 다 같은 인터페이스로 감싸는 모양이다. 의도가 다르다. Decorator는 기능을 덧붙이고, Proxy는 접근을 제어한다(지연 로딩, 권한 확인 등).
- Adapter와 Facade: Adapter는 인터페이스 하나를 다른 모양으로 바꾸고, Facade는 복잡한 여러 클래스 앞에 단순한 창구를 하나 둔다.
- Strategy와 State: 구조는 비슷하다. Strategy는 바깥에서 알고리즘을 골라 끼우고, State는 객체 자신의 상태에 따라 동작이 바뀐다.
- Factory Method와 Abstract Factory: 전자는 제품 하나를, 후자는 서로 관련된 제품군을 한 번에 만든다.

이렇게 모양이 비슷한 패턴은 코드 구조보다 의도로 구분하라는 말이 자주 나온다.

## 흔한 오해

- 많이 쓸수록 좋은 설계다: 문제가 없는데 패턴을 끼우면 클래스만 늘고 읽기 어려워진다. 필요해질 때 적용하는 쪽이 낫다.
- 패턴은 객체지향 언어에서만 쓴다: 책이 객체지향 기준일 뿐이다. 위 Strategy 예시처럼 함수를 값으로 넘길 수 있는 언어에서는 클래스 없이 훨씬 짧게 쓴다.
- 외우면 설계가 된다: 이름을 아는 것과 상황을 알아보는 것은 다르다. 설계는 상황을 알아보는 데서 나온다.
- Singleton은 무조건 좋다: 가장 쉽게 쓰이지만 가장 자주 비판받는 패턴이다. 전역 상태가 되기 쉽다.

<details>
<summary>자세한 풀이: 키워드로 패턴 찾기</summary>

패턴을 알아볼 때는 "이런 설명은 어떤 패턴이냐"를 따져 보게 된다. 키워드와 패턴을 묶어 두면 빨랐다.

| 설명 키워드 | 패턴 |
|---|---|
| 인스턴스 하나, 전역 접근 | Singleton |
| 생성을 서브클래스에 위임 | Factory Method |
| 관련 객체군 생성 | Abstract Factory |
| 복잡한 객체를 단계별 조립 | Builder |
| 기존 객체 복제로 생성 | Prototype |
| 인터페이스 변환 | Adapter |
| 추상과 구현을 분리 | Bridge |
| 부분-전체 트리 구조 | Composite |
| 기능 동적 추가 | Decorator |
| 복잡한 하위 시스템에 단일 창구 | Facade |
| 같은 객체 공유로 메모리 절약 | Flyweight |
| 대리 객체로 접근 제어 | Proxy |
| 변경을 구독자에게 통지 | Observer |
| 알고리즘 교체 | Strategy |
| 요청을 객체로 캡슐화 | Command |

</details>

## 근거 링크

- Wikipedia, Design Patterns (book): https://en.wikipedia.org/wiki/Design_Patterns
- Refactoring.guru, Classification of patterns: https://refactoring.guru/design-patterns/classification

← 개념 map으로 (#/post/cs-map)

관련 글: [SOLID 원칙](#/post/cs-solid) · [절차지향과 객체지향](#/post/cs-procedural-oop) · [결합도와 응집도](#/post/be-coupling-cohesion)
