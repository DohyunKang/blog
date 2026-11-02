SOLID stands for the five principles that make code more resilient to change in object-oriented design. Rather than a rigid rulebook, it reads better as a checklist to diagnose why code might be behaving strangely.

## Where did the term come from?

According to Wikipedia, Robert C. Martin introduced the basic principles in his 2000 paper "Design Principles and Design Patterns," while the acronym SOLID was coined around 2004 by Michael Feathers.

| Letter | Principle | One-liner |
|---|---|---|
| S | Single Responsibility | A class should have only one reason to change |
| O | Open-Closed | Should be open for extension, closed for modification |
| L | Liskov Substitution | Subtypes must be substitutable for their base types without breaking functionality |
| I | Interface Segregation | Clients should not depend on interfaces they do not use |
| D | Dependency Inversion | Depend on abstractions, not concretions |

Reading [Procedural vs. Object-Oriented Programming](#/post/cs-procedural-oop) first will make discussions about classes, inheritance, and interfaces easier to follow.

The examples below continue with a single scenario: order processing. The code was written in Python and executed directly to verify the results.

## S: One Reason to Change

The original definition stated that "a class should not have more than one reason to change." In later writings, Martin reframed this from a human perspective: a module should be responsible to only one stakeholder (actor).

A classic example is the `Employee` class. Here, `calculatePay`, `reportHours`, and `save` represent functionalities requested by Finance, Operations, and Engineering respectively, yet they all reside in one class. If one party requests a change, it could break functionality for others. Hence, separation is recommended.

Translating this to orders, the violation occurs when a single `Order` class handles total calculation, discount application, database storage, and email sending. When I see such classes, the import list tends to grow unnecessarily long. The improvement is straightforward.

```python
@dataclass
class Order:
    items: list  # (이름, 가격)
    def total(self): return sum(p for _, p in self.items)

class OrderRepository:          # 저장만 안다
    def __init__(self): self.rows = []
    def save(self, order): self.rows.append(order)
```

The order knows only about the amount, while storage is handled by the repository. Changes like "discount rate updated" and "database changed" happen in separate files.

## O: New Features Don't Touch Existing Code

Adding more `if` statements for each new discount type is a typical violation.

```python
def checkout_bad(order, kind):
    t = order.total()
    if kind == "vip": return int(t*0.9)
    elif kind == "coupon": return max(t-3000,0)
    return t
```

If a coupon discount is added, you must open and modify the existing function that was previously working correctly. This can easily break VIP-related logic. Therefore, discounts should be extracted into classes, and new policies added as new classes.

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

For an order totaling 14,000 won, `checkout_bad(o, "vip")` returns 12,600, `checkout(o, VipDiscount())` also returns 12,600, and `CouponDiscount()` returns 11,000. The results are consistent, and adding a new discount does not require modifying the `checkout` function. This structure resembles the Strategy Pattern. [Read more → Design Patterns](#/post/cs-design-patterns)

## L: Can You Substitute a Child for Its Parent?

The Wikipedia quote states that "functions using a base class should work correctly even if they don't know about derived classes." While inheritance implies an "is-a" relationship, this principle focuses on whether behavior honors its promises.

A classic example is the square. Mathematically, a square is a rectangle, but in code, this causes problems.

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

`stretch(Rectangle(1,1))` returns 10, while `stretch(Square(1,1))` returns 4. The `stretch` function was written under the assumption that width and height can change independently, but `Square` violates this expectation. Even if types match, behavior may not align. The usual solution is to abandon inheritance and place both as siblings of a `Shape` parent, with only an `area()` method promised by the parent.

Common violation signals include child classes throwing `NotImplementedError` or skipping validations performed by parent methods.

## I: Only Require What Is Needed

The original intent is: "Do not force clients to depend on methods they do not use." If a printer, scanner, and fax share one interface, a device that only prints must still implement `scan()`, often resulting in empty methods or exceptions.

```python
class Printer(Protocol):
    def print_doc(self, d): ...
class Scanner(Protocol):
    def scan(self): ...

def run_print(p: Printer, d):      # 인쇄만 필요하면 Printer만 요구
    return p.print_doc(d)
```

Both the `OfficePrinter` (print-only) and the `Combo` (both print and scan) were tested with `run_print`, and both passed. Smaller interfaces make it easier for implementers and for creating mocks during testing.

## D: Inner Logic Doesn't Know Outer Implementation

If core logic (order processing) directly depends on specific implementations like email sending, changing the mail service or running tests can shake the entire logic. Therefore, the logic should depend on an abstraction like `Notifier`, with concrete implementations plugged in from outside.

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

In the test, adding `FakeNotifier` returned 12,600 for `place`, accumulated a fake entry of `('a@x.com', '결제 12600원')`, and one record was stored in the repository. This effectively verified the entire logic without a mail server. This is dependency injection (passed via constructor), while dependency inversion is the design principle of "turning the arrow direction inward toward abstraction." They are not the same thing; injection is a method, whereas inversion is closer to a goal. How this is used in layered structures is elaborated in [details → Layered Architecture](#/post/be-layered-architecture). The testing perspective is covered in [details → Backend Testing](#/post/be-testing).

## Common Misconceptions

- Classes should always be split as small as possible: S does not mean "one class per method." The goal is to group things that change together; splitting too much causes readers to get tired of following the file. Discussions on cohesion and coupling are covered in [details → Coupling & Cohesion](#/post/be-coupling-cohesion).
- Interfaces and abstract classes should be set up from the start: Adding abstraction to unchanging parts only increases code size. If there is only one type of discount, an `if` statement is fine. Dividing when a second variant actually appears is less error-prone.
- Following SOLID means good design: Principles are tools. They can conflict (increasing abstraction for O complicates code), and application varies by language. In languages that pass functions as values, passing a single function instead of a `Discount` class also satisfies O.
- L is about inheritance, so it doesn't matter if you don't use inheritance: This applies to all cases involving implementing interfaces. It's a question of "keeping the same promise."

<details>
<summary>Detailed explanation: Quick cheat sheet for violations</summary>

| If this smell appears | Principle to suspect |
|---|---|
| A file is frequently changed by multiple people for multiple reasons | S |
| Every feature addition opens the same `if/elif` block to fix it | O |
| Child classes empty or override parent methods with exceptions | L |
| Many empty methods during implementation | I |
| Cannot detach external services in tests | D |

You don't need to memorize this; if you encounter an uncomfortable point while fixing code that matches an entry in this table, recall the corresponding principle. The "smell" column in this table summarizes events from the examples above and is not an official list.

</details>

## Reference Links

- Wikipedia, SOLID: https://en.wikipedia.org/wiki/SOLID
- Robert C. Martin, The Single Responsibility Principle (2014): https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html

← [Concept Map](#/post/cs-map)

Related articles: [Procedural vs Object-Oriented](#/post/cs-procedural-oop) · [Design Patterns](#/post/cs-design-patterns) · [Coupling & Cohesion](#/post/be-coupling-cohesion)