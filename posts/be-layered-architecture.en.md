Layered architecture divides code into layers based on responsibility, where upper layers only call lower layers. The most common controller–service–repository structure in backends follows this pattern.

## What is it doing?

A single request involves mixed tasks: reading the request, validating values, applying rules, reading and writing to the database, and generating a response. Putting all of this into one function might be fast initially but quickly becomes tangled. Therefore, we divide by task type into layers.

| Layer | Responsibility | Common Name |
|---|---|---|
| Presentation (Presentation) | Receive HTTP requests, validate input format, build responses | Controller, Router, Handler |
| Domain (Business) | Apply rules, validation, calculations; group multiple operations as a single unit | Service |
| Data Access | Read and write to databases or external storage | Repository, DAO |

Martin Fowler's writings divide this into three parts: presentation, domain, and data access. Layers are logical divisions; they can exist within a single server or be physically separated. This is distinct from the concept of tiers when dividing servers.

## Dependency direction is key

Dividing into layers does not make it layered architecture unless there is a rule that upper layers only call lower layers.

```
컨트롤러 → 서비스 → 리포지토리 → DB
```

Controllers know about services, and services know about repositories. The reverse is not allowed. If a repository calls a controller, or if a service directly touches an HTTP request object, the meaning of layering disappears. Mixing HTTP concepts into a service prevents using the same logic in CLI or batch contexts.

Fowler's writings also mention variations. One approach places a mapper between domain and data access so that the domain does not know the storage directly; this is commonly called hexagonal architecture. This article focuses on the basic form.

## Why divide?

The biggest reason Fowler cites is "the scope of concern shrinks." When viewing one layer, the others can largely be ignored. Other benefits include:

- Testing: If rules are concentrated in the service layer, you can test only the rules without HTTP or a database. Replacing the repository with a fake object speeds things up. [More details → Testing](#/post/be-testing)
- Substitution: The same service can be used by web, mobile API, and CLI together. However, Fowler notes that swapping databases in practice is rare.
- Role separation: It becomes easy to identify whether an error lies in input validation, rule logic, or query issues within a specific layer.

## Example code

Here is a small example in Python for placing an order. The rule rejects the order if the total exceeds the limit.

```python
import sqlite3
from dataclasses import dataclass

@dataclass
class Order:
    id: int | None
    user_id: int
    amount: int

class OrderRepository:                      # 데이터 접근
    def __init__(self, conn):
        self.conn = conn
    def save(self, o: Order) -> Order:
        cur = self.conn.execute(
            "INSERT INTO orders(user_id, amount) VALUES (?, ?)", (o.user_id, o.amount))
        return Order(cur.lastrowid, o.user_id, o.amount)
    def total_of(self, user_id: int) -> int:
        row = self.conn.execute(
            "SELECT COALESCE(SUM(amount),0) FROM orders WHERE user_id=?", (user_id,)).fetchone()
        return row[0]

class OrderError(Exception):
    pass

class OrderService:                         # 규칙 + 트랜잭션 경계
    LIMIT = 100_000
    def __init__(self, repo, conn):
        self.repo, self.conn = repo, conn
    def place(self, user_id: int, amount: int) -> Order:
        if amount <= 0:
            raise OrderError("amount must be positive")
        with self.conn:                     # 한 트랜잭션
            if self.repo.total_of(user_id) + amount > self.LIMIT:
                raise OrderError("limit exceeded")
            return self.repo.save(Order(None, user_id, amount))

def post_order(service, body: dict):        # 표현: HTTP와 에러 코드만 안다
    try:
        o = service.place(body["user_id"], body["amount"])
        return 201, {"id": o.id}
    except OrderError as e:
        return 400, {"error": str(e)}
```

Running it directly shows that a 60,000 won order returns `201`, while a subsequent 50,000 won order exceeds the limit and returns `400`. Even negative amounts return `400`. Replacing the repository with a fake object (a memory list) allows the service to run unchanged. This is the benefit of layering. Note that this has not yet been tested with an actual web framework.

Summarizing what each layer knows and doesn't know:

| Layer | Knows | Doesn't Know |
|---|---|---|
| Controller | HTTP status codes, request format | SQL, storage methods |
| Service | Rules, how to group operations as a unit | HTTP, specific database details |
| Repository | Queries, tables | Why this data is being read |

## Where do transactions belong?

When multiple storage operations need to be treated as a single unit, the boundary is usually placed in the service. A repository method performs only one query, and the service, which knows the rules, determines what constitutes a single unit. The `with self.conn:` in the example above marks that location.

Spring documentation examples also place `@Transactional` on the service class. The documentation does not explicitly say "put it in the service layer"; rather, the examples show this pattern. What the documentation clearly states is to use concrete classes instead of interfaces. In AspectJ mode, annotations on interfaces are not recognized, so rollback tests may appear fine initially but silently fail later.

## When is it excessive?

Layered architecture is not always good.

- Sometimes a service merely passes data from the controller to the repository without any rules. If there are no rules, having layers only increases code size and results in unnecessary file hopping during reads. This is common in small CRUD apps.
- Creating separate objects (DTOs, entities) for each layer and transferring data between them repeatedly increases boilerplate code.
- When all rules are concentrated in the service and domain objects hold only fields, this structure is commonly called an "anemic domain model." Fowler's writings are known to use this term.

Fowler does not directly warn against excessive layering but notes that using layers as the top-level division in growing systems causes problems. He recommends dividing by domain and then applying layers within each domain. Additionally, he states that splitting development teams by layer (frontend team, backend team, DB team) is an anti-pattern.

If we set a standard, I believe that if there are any rules, the service should be kept separate; however, for read-only APIs with no rules at all, reducing layers is acceptable. This is my personal judgment and not backed by a specific source.

## Common Misconceptions

- More layers are better: Layers only make sense when tasks are distinguished. Empty layers are just costs.
- Layers mean server instances: Layers refer to logical divisions in code, which is different from the number of servers (tiers).
- Putting rules in the controller works fine: It does work, but you must rewrite the same rules at other entry points (e.g., batch jobs, queue consumers).
- One repository per table: This is common practice, but it's not a rule. Repositories are sometimes grouped by unit (e.g., order and order items).

<details>
<summary>Detailed explanation: The sequence of layers a single request passes through</summary>

1. The controller reads the JSON body and checks for required fields and correct types. If invalid, it returns 400.
2. It calls the service. The service checks rules such as whether an amount is positive or within limits. Rule violations are raised as exceptions.
3. The service opens a transaction, reads totals from the repository, and saves them.
4. If an exception occurs, the transaction is rolled back, and the controller converts it to an appropriate HTTP status code before responding.

Handling exceptions by converting them to HTTP codes is left to the presentation layer. If a service directly says `400`, the service becomes aware of HTTP. Error handling should be handled separately. [Read more → Error Handling and Logging](#/post/be-error-logging)

</details>

## Related Reading

- [Read more → How requests are processed on the server](#/post/be-request-flow)
- [Read more → Coupling and Cohesion](#/post/be-coupling-cohesion)
- [Read more → SOLID](#/post/cs-solid)
- [Read more → Design Patterns](#/post/cs-design-patterns)

← [Concept Map](#/post/be-map)

## Reference Links

- Martin Fowler, PresentationDomainDataLayering: https://martinfowler.com/bliki/PresentationDomainDataLayering.html
- Spring Framework Documentation, Using @Transactional: https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html
- Martin Fowler, AnemicDomainModel: https://martinfowler.com/bliki/AnemicDomainModel.html