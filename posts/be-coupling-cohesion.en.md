Cohesion measures how closely related the elements within a module are to a single purpose, while coupling measures how much modules know about and depend on each other. A good module has high cohesion and low coupling.

## In Simple Terms

The drawer analogy makes it easy to understand. If a drawer contains only socks, it has high cohesion; if it's mixed with receipts and batteries, the cohesion is low. Coupling refers to the relationship between drawers. If you need to touch the compartment inside the battery drawer to open the sock drawer, the coupling is high.

In code terms:

- **Cohesion**: The degree to which elements within a class, function, or file are grouped together for the same purpose. Higher is better.
- **Coupling**: The extent to which other modules break when one module is changed. Lower is better.

These two concepts are not independent; they move almost together. Stuffing miscellaneous tasks into one module lowers cohesion, and since other modules that need those tasks become dependent on it, coupling also increases. This is why these two axes are used as criteria for dividing modules. The discussion on design principles continues in [SOLID → Details](#/post/cs-solid).

## Why Does It Matter?

It determines how easy the code is to maintain. With low coupling, changing one module has a narrow impact scope, and it's easy to swap in fake objects during testing. With high cohesion, you can understand that "this feature only needs to look at this one file," making it easier to read. Conversely, if both are poor, fixing one place might cause bugs to appear in unrelated areas. Testing is covered in [Details → Testing](#/post/be-testing).

## Types of Cohesion

This is a widely used classification, listed from weakest to strongest. Wikipedia's cohesion entry also lists the same seven stages.

| Stage | Name | Reason for Grouping | Example |
|---|---|---|---|
| 1 (Weak) | Coincidental | No reason | Various functions in a `Utils` class |
| 2 | Logical | Similar types | All input processing functions in one place |
| 3 | Temporal | Executed at the same time | Initialization bundle run at startup |
| 4 | Sequential | Executed in a specific order | Opening a file after permission check |
| 5 | Communicational | Handling the same data | Functions reading and writing the same order records |
| 6 | Sequential (Sequential) | Output of one is input for another | Parsing → Validation → Transformation pipeline |
| 7 (Strong) | Functional | For a single function | A single tax calculation function |

In practice, you often see names like `utils`, `common`, or `helper` at the top. The more generic the name, the more likely it is to have coincidental cohesion.

## Types of Coupling

This list is read from strongest to weakest. Below are the six types found in Wikipedia's coupling entry, matched with commonly used names in Korea (Content, Common, External, Control, Stamp, Data).

| Stage | Name | Description |
|---|---|---|
| 1 (Strong) | Content Coupling | Directly touches internal code or data of another module |
| 2 | Common Coupling | Multiple modules share the same global data |
| 3 | External Coupling | Tied together by external data formats, protocols, or devices |
| 4 | Control Coupling | Controls relative behavior by passing flags |
| 5 | Stamp Coupling | Passes structures or objects whole but uses only a part |
| 6 (Weak) | Data Coupling | Exchanges only necessary values as arguments |

In this classification, data coupling is considered the most desirable. However, "coupling of zero" does not exist. Since modules must be connected for a system to function, the goal is not to eliminate them entirely but to keep them weak and visible. Note that message coupling (exchanged via queues or events) is sometimes listed as a separate stage in other documents, but it is omitted here as it is not covered in my referenced document.

<details>
<summary>Example code for each coupling type (Expand)</summary>

```python
# 공통 결합: 전역 변수를 여러 함수가 같이 씀
config = {"tax": 0.1}
def price_a(x): return x * (1 + config["tax"])
def price_b(x): return x * (1 + config["tax"])   # config가 바뀌면 둘 다 영향

# 제어 결합: mode 값으로 상대 동작을 정함
def process(order, mode):
    if mode == "pay": ...
    elif mode == "cancel": ...

# 스탬프 결합: 객체 전체를 받지만 이름만 씀
def greet(user):            # user에는 필드가 20개
    return "hi " + user.name

# 자료 결합: 필요한 값만 받음
def greet2(name):
    return "hi " + name
```

Control coupling arises because the caller must know about the internal branching of the callee. If `pay` and `cancel` are separated into distinct functions, the flag disappears.

</details>

## Examples and Improvements

We used an order service as an example, starting with high coupling.

```python
class OrderServiceBad:
    def __init__(self):
        self.repo = MySqlRepo()   # 구체 클래스를 안에서 직접 만듦
        self.mailer = Mailer()
    def place(self, order):
        self.repo.save(order)
        self.mailer.send("a@b.c", "ok")
```

To change the database or block emails in tests, you would have to open and modify this class because the service knows about the existence and creation methods of `MySqlRepo` and `Mailer`. The improvement involves moving the work of creating things outside and accepting only what is needed.

```python
class OrderService:
    def __init__(self, repo, notifier):   # 의존을 밖에서 주입
        self.repo, self.notifier = repo, notifier
    def place(self, order):
        self.repo.save(order)
        self.notifier.send("a@b.c", "ok")
```

Now you can inject fake repositories and fake notifications for testing. Running it directly as shown below passes successfully.

```python
class FakeRepo:
    def __init__(self): self.saved = []
    def save(self, o): self.saved.append(o)
class FakeNotifier:
    def __init__(self): self.sent = []
    def send(self, to, body): self.sent.append((to, body))

r, n = FakeRepo(), FakeNotifier()
OrderService(r, n).place({"id": 1})
assert r.saved == [{"id": 1}] and n.sent == [("a@b.c", "ok")]
```

This method of injecting dependencies from the outside is known as Dependency Injection (DI). When dividing controllers, services, and repositories so that each layer sees only promises (interfaces) rather than concrete implementations of lower layers follows the same logic. This continues in [Details → Layered Architecture](#/post/be-layered-architecture). The path requests take through these modules is covered in [Details → Request Flow](#/post/be-request-flow).

Improving cohesion is easier when starting with naming. If a module name cannot be explained in a single sentence, or if the explanation includes "and," it signals that multiple responsibilities are mixed. Splitting `OrderUtils` into `PriceCalculator`, `OrderValidator`, etc., brings each closer to functional cohesion.

## Common Misconceptions

- Lower coupling is always better: Trying to reduce coupling by creating layers of interfaces and hierarchy can make the system harder to follow. Over-abstraction in areas unlikely to change is excessive.
- High cohesion means small classes: Size is unrelated. Even if a class has many lines, if it does one thing, its cohesion is high.
- Smaller modules are always better: If a single feature is scattered across multiple files, changing that feature requires modifying many places. This breaks cohesion.
- The package structure reflects real-world boundaries exactly: A package structure is a tool for organizing thoughts. In practice, it's faster to ask, "How many places need to be changed when I modify this module?"

## Reference Links

- [Coupling (computer programming) - Wikipedia](https://en.wikipedia.org/wiki/Coupling_(computer_programming))
- [Cohesion (computer science) - Wikipedia](https://en.wikipedia.org/wiki/Cohesion_(computer_science))

← [Concept Map](#/post/be-map)

Related articles: [Layered Architecture](#/post/be-layered-architecture) · [SOLID](#/post/cs-solid) · [Testing](#/post/be-testing)