Design patterns are names given to recurring problems and their solutions in object-oriented design. When studying for the Information Processing Engineer exam, it is essential to memorize the pattern name, its category, and a one-line description together. Exam schedules and fees change, so please check the official website.

For a deeper understanding of the patterns themselves, I have prepared a separate article on [Design Pattern Concepts](#/post/cs-design-patterns). This article focuses only on the core points needed for exam preparation.

## The Skeleton

In 1994, Erich Gamma, Richard Helm, Ralph Johnson, and John Vlissides published the book "Design Patterns: Elements of Reusable Object-Oriented Software," which contains 23 patterns. Since there are four authors, they are referred to as GoF (Gang of Four). Therefore, the design patterns mentioned in exams are mostly these 23.

These 23 patterns are divided into three categories based on their purpose:

| Category | Count | Problem Solved | Patterns |
|---|---|---|---|
| Creational | 5 | How to create objects? | Abstract Factory, Builder, Factory Method, Prototype, Singleton |
| Structural | 7 | How to connect classes and objects? | Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy |
| Behavioral | 11 | How to distribute roles and communication among objects? | Chain of Responsibility, Command, Interpreter, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor |

Refactoring.guru shows 10 behavioral patterns by excluding the Interpreter pattern. Since exam textbooks are usually based on the book, you should memorize all 23 patterns.

The category names are important for memorization order, so first commit "5 Creational, 7 Structural, 11 Behavioral" to memory. Knowing the counts helps you immediately spot any patterns you might have missed while memorizing.

## One-Liner Descriptions for Creational Patterns

- Singleton: Create exactly one instance and use it from anywhere. Configuration objects are a typical example.
- Factory Method: Delegate the responsibility of creating objects to subclasses.
- Abstract Factory: Create families of related objects (product groups) without specifying concrete class names.
- Builder: Assemble complex objects step by step. The same assembly process can produce different results.
- Prototype: Create new instances by cloning an existing prototype instead of building from scratch.

The confusing pair is Factory Method and Abstract Factory. If a single product's creation method is delegated to a subclass, it is Factory Method; if multiple related products are created at once, it is Abstract Factory.

## One-Liner Descriptions for Structural Patterns

- Adapter: Fit together two incompatible interfaces by inserting something in between. It works like a power outlet adapter.
- Bridge: Separate the abstraction part from the implementation part so each can be extended independently.
- Composite: Treat parts and wholes in the same way. A tree structure with folders containing subfolders and files is an example.
- Decorator: Wrap an existing object to add functionality. Instead of inheritance, use wrapping to extend features.
- Facade: Place a simple entry point in front of a complex subsystem.
- Flyweight: Save memory by sharing common objects instead of creating multiple copies.
- Proxy: Place a surrogate object in front to handle access. Used for access control and lazy initialization.

Adapter and Facade may seem similar. Adapter changes an existing interface into another form, whereas Facade groups many things to create a new simple entry point. Decorator and Proxy both wrap objects; if you add functionality, it is Decorator, but if you intercept and control access, it is Proxy.

## One-Liner Descriptions for Behavioral Patterns

- Chain of Responsibility: Pass requests along a chain until an object capable of handling them appears.
- Command: Turn requests into objects that can be stored, undone, and queued.
- Interpreter: Express the grammar of a simple language as classes and interpret it.
| Iterator | Traverse elements one by one without exposing the internal structure. |
| Mediator | Objects communicate through a mediator instead of talking directly to each other. |
| Memento | Save an object's state so it can be restored later. Used for undo functionality. |
| Observer | Notify subscribed objects when one object changes. |
| State | Separate behavior that varies by state into distinct state objects. |
| Strategy | Extract algorithms into objects that can be swapped in and out. |
| Template Method | Define the algorithm's skeleton in a parent class and let subclasses fill in specific steps. |
| Visitor | Keep the structure unchanged but add operations performed on top of it separately. |

State and Strategy have similar structures. State changes itself based on state transitions, while Strategy is chosen and plugged in by the user.

## Keyword Pairing

It's easier to study if you think of this as matching a description with a pattern name. Here are the key terms from the descriptions paired with their corresponding patterns:

| Description | Pattern |
|---|---|
| Single instance, global access | Singleton |
| Cloning | Prototype |
| Step-by-step assembly | Builder |
| Product family | Abstract Factory |
| Subclass decides creation | Factory Method |
| Interface conversion | Adapter |
| Separation of abstraction and implementation | Bridge |
| Tree, part-whole | Composite |
| Adding functionality | Decorator |
| Single entry point | Facade |
| Memory saving via sharing | Flyweight |
| Stand-in | Proxy |
| Passing along a chain | Chain of Responsibility |
| Request as object | Command |
| Traversal | Iterator |
| Mediator | Mediator |
| State preservation and restoration | Memento |
| Change notification | Observer |
| Behavior per state | State |
| Algorithm replacement | Strategy |
| Skeleton and detailed steps | Template Method |
| Operation outside structure | Visitor |
| Syntax interpretation | Interpreter |

## Preparing to Read Code

Sometimes the pattern name isn't given, and only code is shown. In such cases, examine how the classes are interconnected. The code below was run directly to verify the output.

### Decorator wraps around

```python
class Coffee:
    def cost(self): return 3000
class Milk:
    def __init__(self, c): self.c = c
    def cost(self): return self.c.cost() + 500

print(Milk(Milk(Coffee())).cost())   # 4000
```

An object with the same method contains another object inside and adds values while passing calls. Since milk was wrapped twice, it's 3000 + 500 + 500.

### Observer iterates through subscribers

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

Notifications are sent in the order of registration. If a question asks about output order, follow the registration sequence.

### Template Method has a parent defining the structure

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

The call is made by the parent's `make`, and children fill in the empty spots.

<details>
<summary>Strategy and Adapter code</summary>

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

Strategy swaps algorithms, such as discount methods, by passing them as functions or objects. Adapter connects an old method name `old_send` to a new name `send`.

</details>

## Study Order

1. Memorize the three categories and counts (5·7·11).
2. Attach one keyword per pattern.
3. Compare confusing pairs separately: Factory Method vs Abstract Factory, Adapter vs Facade, Decorator vs Proxy, State vs Strategy.
4. Solve practice problems from official sites or legitimate problem books, then revisit only the incorrect patterns using a table.

Patterns are easier to memorize when viewed alongside [SOLID principles](#/post/cs-solid), as many rely on interfaces and favor open extension. The sense of reading relationships between classes is covered in [UML and Object-Oriented Analysis](#/post/jb-uml), while discussions on larger structures with overlapping pattern names continue in [Software Architecture](#/post/jb-architecture-pattern). Reading code output is summarized in [Object-Oriented Programming and Language Code Reading](#/post/jb-oop-lang).

## Reference Links

- Wikipedia, Design Patterns (book): https://en.wikipedia.org/wiki/Design_Patterns
- Refactoring.guru, Classification of patterns: https://refactoring.guru/design-patterns/classification

← Concept map (#/post/jb-map)

Related posts: [UML and Object-Oriented Analysis](#/post/jb-uml) · [Software Architecture](#/post/jb-architecture-pattern) · [Object-Oriented Programming and Language Code Reading](#/post/jb-oop-lang)