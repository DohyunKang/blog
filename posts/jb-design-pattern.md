디자인 패턴은 객체지향 설계에서 반복해서 나오는 문제와 그 풀이 모양에 이름을 붙인 것이다. 정보처리기사 공부에서는 이름, 분류, 한 줄 역할을 짝지어 두는 게 기본이다. 시험 일정과 응시료는 바뀌니 공식 사이트에서 확인한다.

패턴 자체를 천천히 이해하는 쪽은 [디자인 패턴 개념 글](#/post/cs-design-patterns)에 따로 정리해 두었고, 이 글은 시험 공부용으로 단원 핵심만 추렸다.

## 뼈대부터

1994년에 Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides 네 명이 낸 책 "Design Patterns: Elements of Reusable Object-Oriented Software"에 패턴 23개가 실려 있다. 저자 넷이라 GoF(Gang of Four)라고 부른다. 그래서 시험에서 말하는 디자인 패턴은 대부분 이 23개다.

23개는 목적에 따라 세 갈래로 나뉜다.

| 분류 | 개수 | 풀려는 문제 | 패턴 |
|---|---|---|---|
| 생성 | 5 | 객체를 어떻게 만들까 | Abstract Factory, Builder, Factory Method, Prototype, Singleton |
| 구조 | 7 | 클래스·객체를 어떻게 엮을까 | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
| 행위 | 11 | 객체끼리 역할과 소통을 어떻게 나눌까 | Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor |

Refactoring.guru는 Interpreter를 빼고 행위 패턴을 10개로 보여 준다. 시험 교재는 보통 책 기준이니 23개로 외우면 된다.

분류 이름은 암기 순서가 중요해서 "생성 5, 구조 7, 행위 11"을 먼저 입에 붙인다. 개수를 알면 외우다 빠뜨린 패턴을 바로 알아챈다.

## 생성 패턴 한 줄씩

- Singleton: 인스턴스를 딱 하나만 만들고 어디서든 같은 걸 쓴다. 설정 객체가 전형적인 예다.
- Factory Method: 객체를 만드는 일을 서브클래스가 정하게 넘긴다.
- Abstract Factory: 서로 관련된 객체 묶음(제품군)을 구체 클래스 이름 없이 만든다.
- Builder: 복잡한 객체를 단계별로 조립한다. 같은 조립 과정으로 다른 결과물을 만들 수 있다.
- Prototype: 새로 만들지 않고 원본을 복제해서 만든다.

헷갈리는 쌍은 Factory Method와 Abstract Factory다. 하나의 제품을 만드는 메서드를 서브클래스에 맡기면 Factory Method, 관련된 여러 제품을 한꺼번에 만들어 주는 팩토리면 Abstract Factory로 구분한다.

## 구조 패턴 한 줄씩

- Adapter: 인터페이스가 안 맞는 두 쪽 사이에 끼어 맞춰 준다. 콘센트 변환 어댑터와 같은 역할이다.
- Bridge: 추상 부분과 구현 부분을 따로 나눠 각자 확장하게 한다.
- Composite: 부분과 전체를 같은 방식으로 다룬다. 폴더 안에 폴더와 파일이 같이 있는 트리 구조가 예다.
- Decorator: 기존 객체를 감싸서 기능을 덧붙인다. 상속 대신 감싸기로 기능을 늘린다.
- Facade: 복잡한 하위 시스템 앞에 단순한 창구 하나를 둔다.
- Flyweight: 같은 걸 여러 개 만들지 않고 공유해서 메모리를 아낀다.
- Proxy: 대리 객체를 앞에 두고 접근을 대신 받는다. 접근 제어, 지연 생성 같은 데 쓴다.

Adapter와 Facade가 특히 비슷해 보인다. Adapter는 이미 있는 인터페이스를 다른 모양으로 바꾸는 쪽이고, Facade는 여럿을 묶어 단순한 입구를 새로 만드는 쪽이다. Decorator와 Proxy도 둘 다 객체를 감싸는데, 기능을 더하면 Decorator, 접근을 가로채 통제하면 Proxy로 외운다.

## 행위 패턴 한 줄씩

- Chain of Responsibility: 요청을 처리할 객체가 나올 때까지 사슬처럼 넘긴다.
- Command: 요청 자체를 객체로 만들어 저장하고, 취소하고, 줄 세운다.
- Interpreter: 간단한 언어의 문법을 클래스로 표현해 해석한다.
- Iterator: 내부 구조를 드러내지 않고 하나씩 순회한다.
- Mediator: 객체끼리 직접 말하지 않고 중재자를 거친다.
- Memento: 객체 상태를 저장해 두었다가 복원한다. 되돌리기(undo)에 쓴다.
- Observer: 한 객체가 바뀌면 구독 중인 객체들에게 알린다.
- State: 상태에 따라 행동이 달라지는 걸 상태 객체로 분리한다.
- Strategy: 알고리즘을 객체로 빼서 갈아 끼운다.
- Template Method: 알고리즘 뼈대는 부모가 정하고 세부 단계는 자식이 채운다.
- Visitor: 구조는 그대로 두고 그 위에서 하는 연산을 따로 추가한다.

State와 Strategy는 구조가 비슷하다. 상태 변화에 따라 스스로 바뀌면 State, 사용하는 쪽이 알고리즘을 골라 끼우면 Strategy다.

## 키워드로 짝짓기

문제는 설명을 주고 패턴 이름을 고르는 식이라고 생각하고 공부하면 편하다. 설명 속 핵심 단어와 패턴을 이렇게 짝지어 둔다.

| 설명에 나오는 말 | 패턴 |
|---|---|
| 하나만, 전역 접근 | Singleton |
| 복제 | Prototype |
| 단계별 조립 | Builder |
| 제품군 | Abstract Factory |
| 서브클래스가 생성 결정 | Factory Method |
| 인터페이스 변환 | Adapter |
| 추상과 구현 분리 | Bridge |
| 트리, 부분-전체 | Composite |
| 기능 덧붙이기 | Decorator |
| 단일 창구 | Facade |
| 공유로 메모리 절약 | Flyweight |
| 대리 | Proxy |
| 사슬로 넘김 | Chain of Responsibility |
| 요청을 객체로 | Command |
| 순회 | Iterator |
| 중재자 | Mediator |
| 상태 저장·복원 | Memento |
| 변경 통지 | Observer |
| 상태별 행동 | State |
| 알고리즘 교체 | Strategy |
| 뼈대와 세부 단계 | Template Method |
| 연산을 구조 밖으로 | Visitor |
| 문법 해석 | Interpreter |

## 코드 읽는 문제 대비

패턴 이름을 안 알려 주고 코드를 보여 주는 형태도 있을 수 있다. 그럴 때는 클래스가 서로 어떻게 엮였는지를 본다. 아래 코드는 직접 돌려서 출력을 확인했다.

### Decorator는 감싸는 모양

```python
class Coffee:
    def cost(self): return 3000
class Milk:
    def __init__(self, c): self.c = c
    def cost(self): return self.c.cost() + 500

print(Milk(Milk(Coffee())).cost())   # 4000
```

같은 메서드를 가진 객체가 다른 객체를 안에 품고, 호출을 넘기면서 값을 더한다. 우유를 두 번 감쌌으니 3000 + 500 + 500이다.

### Observer는 구독 목록을 도는 모양

```python
class Subject:
    def __init__(self): self.obs = []
    def attach(self, o): self.obs.append(o)
    def notify(self, v):
        for o in self.obs: o(v)

s = Subject()
s.attach(lambda v: print("A", v))
s.attach(lambda v: print("B", v))
s.notify(7)
# A 7
# B 7
```

등록한 순서대로 통지가 간다. 출력 순서를 묻는 문제가 나오면 등록 순서를 따라가면 된다.

### Template Method는 부모가 틀을 쥔 모양

```python
from abc import ABC, abstractmethod

class Report(ABC):
    def make(self): return self.head() + "|" + self.body()
    def head(self): return "H"
    @abstractmethod
    def body(self): ...

class Sales(Report):
    def body(self): return "sales"

print(Sales().make())   # H|sales
```

호출은 부모의 `make`가 하고, 비어 있던 자리만 자식이 채운다.

<details>
<summary>Strategy와 Adapter 코드</summary>

```python
def run(price, discount): return discount(price)
print(run(10000, lambda p: p * 0.9), run(10000, lambda p: p - 1000))
# 9000.0 9000

class Old:
    def old_send(self, m): return "old:" + m
class Adapter:
    def __init__(self, o): self.o = o
    def send(self, m): return self.o.old_send(m)

print(Adapter(Old()).send("x"))   # old:x
```

Strategy는 할인 방식 같은 알고리즘을 함수나 객체로 넘겨 바꿔 끼운다. Adapter는 옛 메서드 이름 `old_send`를 새 이름 `send`로 이어 준다.

</details>

## 공부 순서

1. 분류 세 개와 개수(5·7·11)를 외운다.
2. 패턴마다 키워드 한 단어씩 붙인다.
3. 헷갈리는 쌍(Factory Method와 Abstract Factory, Adapter와 Facade, Decorator와 Proxy, State와 Strategy)을 따로 비교한다.
4. 기출은 공식 사이트나 정식 문제집에서 직접 풀어 보고, 틀린 패턴만 표로 돌아와 다시 본다.

패턴은 [SOLID 원칙](#/post/cs-solid)과 같이 보면 외우기 쉽다. 많은 패턴이 인터페이스에 기대고 확장은 열어 두는 방향이라서다. 클래스 사이의 관계를 그림으로 읽는 감각은 [UML과 객체지향 분석](#/post/jb-uml)에서, 패턴과 이름이 겹치는 큰 구조 얘기는 [소프트웨어 아키텍처](#/post/jb-architecture-pattern)에서 이어진다. 코드 출력 읽기는 [객체지향과 언어 코드 읽기](#/post/jb-oop-lang)에 정리한다.

## 근거 링크

- Wikipedia, Design Patterns (book): https://en.wikipedia.org/wiki/Design_Patterns
- Refactoring.guru, Classification of patterns: https://refactoring.guru/design-patterns/classification

← 개념 map으로 (#/post/jb-map)

관련 글: [UML과 객체지향 분석](#/post/jb-uml) · [소프트웨어 아키텍처](#/post/jb-architecture-pattern) · [객체지향과 언어 코드 읽기](#/post/jb-oop-lang)
