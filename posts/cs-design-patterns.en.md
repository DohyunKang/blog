Design patterns are a collection of names and solutions for common problems encountered in object-oriented design. While they may seem confusing at first glance based solely on their names and categories, understanding the context makes them much easier to grasp.

## What is a Pattern?

The starting point is the 1994 book "Design Patterns: Elements of Reusable Object-Oriented Software" by Gamma, Helm, Johnson, and Vlissides. These four authors are commonly referred to as GoF (Gang of Four). The book contains 23 patterns. You can think of it as a book that groups together structures that developers used repeatedly without specific names.

A pattern is not a library; it is a shape of design. It is closer to a trick like "dividing objects this way works well in such situations" rather than code you simply copy and paste. Having a name allows you to say, "Let's use an Observer here," and the discussion about structure ends quickly, shortening conversations.

It is closely related to the [SOLID principles](#/post/cs-solid) I previously organized. Most patterns are implementations of principles such as "open for extension, closed for modification" and "depend on interfaces, not implementations." To understand patterns, you must first have a sense of [procedural vs. object-oriented programming](#/post/cs-procedural-oop).

## Three Categories

GoF divides patterns into three categories based on their purpose.

| Category | Problem Solved | Representative Patterns |
|---|---|---|
| Creational | How to create objects? | Singleton, Factory Method, Abstract Factory, Builder, Prototype |
| Structural | How to weave classes and objects together? | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
| Behavioral | How to distribute roles and communication among objects? | Observer, Strategy, Command, State, Iterator, Template Method, etc. |

According to the original book, the counts are 5 for Creational, 7 for Structural, and 11 for Behavioral, totaling 23. Some sites (e.g., Refactoring.guru) introduce 22 patterns by excluding Interpreter; this discrepancy in count seems to be due to that reason. It is safer to consider the number as 23 based on the book.

The list of behavioral patterns (Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor) is long and often causes confusion. Here they are listed one by one:

- Chain of Responsibility: Pass requests along a chain until an object capable of handling the request is found.
- Command: Encapsulate a request as an object, allowing for parameterization of clients with queues, operations to be logged, and support for undo/redo.
- Iterator: Traverse elements of a collection without exposing its underlying structure.
- Mediator: Define how objects interact by introducing a mediator object so they do not communicate directly.
- Memento: Capture and externalize an object's internal state so that it can be restored later (undo/redo).
- State: Represent different states of an object as separate state objects to change behavior based on the current state.
- Template Method: Define the skeleton of an algorithm in a base class, allowing subclasses to override specific steps.
- Visitor: Separate algorithms from objects by defining operations that can be applied to elements of an object structure without changing their classes.

## Representative Patterns with Code

The code below is all written in Python and has been executed directly to verify the output.

### Singleton: Only One Instance

Used when only one instance should exist throughout the program, such as a configuration object.

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

While convenient, it resembles a global variable, making testing difficult and introducing hidden dependencies. In multi-threaded environments, this code alone is insufficient; lock handling is required (I did not test this part).

### Factory Method: Hide Who Creates

Allows the caller to remain unaware of which specific class is being created.

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

Strictly speaking, GoF's Factory Method involves a parent class defining a creation method that subclasses override. The code above is closer to a simple factory implemented with functions for the same purpose. In one line, it means "delegate object creation to subclasses."

### Adapter: Connect Mismatched Interfaces

Used when an old code's method name differs from what is currently in use; it bridges the gap by wrapping them together.

```python
class OldPrinter:
    def print_text(self, s): return f"[old] {s}"
class NewPrinter:
    def __init__(self, old): self.old = old
    def write(self, s): return self.old.print_text(s)

print(NewPrinter(OldPrinter()).write("hello"))   # [old] hello
```

### Decorator: Layer Functions Without Inheritance

Adds functionality without inheritance, similar to adding milk or a shot to coffee.

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

Both the wrapper and the wrapped share the same interface (here, `cost`), allowing multiple layers to be stacked. As combinations grow, you do not need to create classes like "MilkShotCoffee" one by one.

### Observer: Notify When Changed

Automatically notifies subscribed objects when the state of one object changes. This is typical for event handling and notifications.

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

### Strategy: Swap Algorithms Easily

Used when there are multiple "ways" to perform a task, such as discount calculations, and you need to switch based on the situation.

```python
def won(p): return p
def vip(p): return int(p * 0.9)

class Cart:
    def __init__(self, strategy): self.strategy = strategy
    def total(self, p): return self.strategy(p)

print(Cart(won).total(10000), Cart(vip).total(10000))   # 10000 9000
```

Using if-else to branch logic can be refactored by extracting the branching into objects (functions in this case), allowing new approaches to be added without touching existing code. This is a great example of the Open-Closed Principle from SOLID, making it memorable.

## Easily Confused Pairs

- **Decorator** and **Proxy**: Both wrap an interface in a similar way, but their intentions differ. A Decorator adds functionality, while a Proxy controls access (e.g., lazy loading, permission checks).
- **Adapter** and **Facade**: An Adapter changes one interface into another form, whereas a Facade provides a simple entry point to a complex set of classes.
- **Strategy** and **State**: Their structures are similar. Strategy involves selecting an algorithm from the outside, while State changes behavior based on the object's own state.
- **Factory Method** and **Abstract Factory**: The former creates one product, while the latter creates a family of related products at once.

It is often said that patterns with similar shapes should be distinguished by their intent rather than code structure alone.

## Common Misconceptions

- **More usage always means better design**: If there's no problem, adding a pattern only increases the number of classes and makes the code harder to read. It's better to apply patterns when needed.
- **Patterns are only used in object-oriented languages**: Books may be based on object-oriented principles, but as shown in the Strategy example above, functions can be passed as values, allowing for much shorter implementations without classes in such languages.
- **Memorizing makes you a good designer**: Knowing names is different from understanding situations. Design emerges from recognizing situations.
- **Singleton is always good**: While it's the easiest to use, it's also the most criticized pattern because it easily leads to global state.

<details>
<summary>Detailed explanation: Finding patterns by keywords</summary>

When identifying a pattern, you often ask, "Which pattern fits this description?" Keeping keywords and patterns together helps you recognize them faster.

| Description Keyword | Pattern |
|---|---|
| Single instance, global access | Singleton |
| Delegates creation to subclasses | Factory Method |
| Creation of related object family | Abstract Factory |
| Step-by-step assembly of complex objects | Builder |
| Creation via cloning existing objects | Prototype |
| Interface transformation | Adapter |
| Separation of abstraction and implementation | Bridge |
| Part-whole tree structure | Composite |
| Dynamic addition of functionality | Decorator |
| Single entry point to complex subsystems | Facade |
| Memory savings via shared objects | Flyweight |
| Access control via surrogate object | Proxy |
| Notification of changes to subscribers | Observer |
| Algorithm replacement | Strategy |
| Encapsulation of requests as objects | Command |

</details>

## Reference Links

- Wikipedia, Design Patterns (book): https://en.wikipedia.org/wiki/Design_Patterns
- Refactoring.guru, Classification of patterns: https://refactoring.guru/design-patterns/classification

← Concept map (#/post/cs-map)

Related articles: [SOLID Principles](#/post/cs-solid) · [Procedural vs Object-Oriented](#/post/cs-procedural-oop) · [Coupling and Cohesion](#/post/be-coupling-cohesion)