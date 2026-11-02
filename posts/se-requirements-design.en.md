[Overview](#/post/cs-sw-engineering) briefly touched upon requirements, UML, and design one line at a time. Here, we dig deeper into how these three connect. Requirements answer "what," while design answers "in what shape"; if design is not verified against requirements in reverse, the two diverge.

## What Requirement Analysis Does

The requirement stage is less about taking notes and more about organizing information. Stakeholders speak differently, use the same words with different meanings, and leave unstated assumptions. Therefore, the typical flow follows: elicitation (listening) → analysis (identifying conflicts and gaps) → specification (writing down in documents) → validation (stakeholder confirmation).

The distinction between functional and non-functional requirements was covered in the overview. To add one more point: functionality describes "what the system does," whereas non-functionality describes the shape or quality of "how the system does it." As Wikipedia explains, non-functional requirements are also called quality attributes and must be written concretely and measurably. For example, displaying a record count is a functional requirement, while specifying how recent that count must be is a non-functional one.

Non-functional requirements serve as criteria for choosing an architecture. When selecting architectural styles later on, you should first determine the priority of these quality attributes.

### Writing Functional Requirements via Use Cases

A use case describes the interaction process between external actors (people or other systems) and the system to achieve a goal. There is no fixed format, but commonly used patterns look like this:

| Item | Content |
|---|---|
| Name | A single user goal (e.g., "Place an order") |
| Actor | Orderer, Payment System |
| Main Success Scenario | Numbered steps; one step represents one interaction |
| Extension | If branching occurs after step 3 in the main path, label them 3a, 3b |

Steps should describe goals and responses (e.g., "Orderer confirms order") rather than UI actions like "Press the order button," and avoid referencing screen elements. This ensures requirements remain valid even if the interface changes.

I have organized this following [Fowler's explanation of use cases](https://en.wikipedia.org/wiki/Use_case).

### Requirement IDs and Traceability

Assigning an ID to each requirement allows you to track in a table which design element addresses it and which test verifies it. This is traceability. Missing cells represent gaps. Here is a simple demonstration:

```python
reqs = {"R1": "회원은 이메일로 로그인한다", "R2": "로그인 응답은 1초 안에", "R3": "비밀번호는 해시로 저장한다"}
design = {"R1": ["AuthService.login"], "R2": [], "R3": ["UserRepo.save"]}
tests = {"R1": ["test_login_ok"], "R2": ["test_login_latency"], "R3": []}
for r in reqs:
    gaps = [n for n, m in (("설계", design), ("테스트", tests)) if not m[r]]
    print(r, "OK" if not gaps else "빠짐: " + ",".join(gaps))
```

The execution results were `R1 OK`, `R2 missing: design`, and `R3 missing: test`. For R2, there are tests but no design specifying how to maintain the 1-second constraint; for R3, it was implemented but lacks verification tests. Managing this in documents alone achieves the same result with just this single table.

<details>
<summary>Conditions for Good Requirements</summary>

- One requirement per sentence. Split "Log in and send a notification" into two separate requirements.
- Must be verifiable. Use "within 1 second" instead of "fast."
- Must not conflict with each other; this is what gets filtered during analysis.
- State the need, not the solution. "Use Redis" is a design decision, not a requirement.
</details>

## Design Divides into Two Layers

Design is typically divided into architectural design, which defines the overall structure, and detailed design, which defines modules internally. If requirements answer "what," then architectural design determines "how to divide into components and how those components communicate." Non-functional requirements play the largest role here; needs like scalability or maintainability push the structure in specific directions.

## UML Basics

UML is a notation managed by OMG. The introduction page describes it as a graphical language for visualizing, specifying, configuring, and documenting distributed object systems. Understanding diagrams as either showing structure or behavior makes them less confusing. Class, component, and deployment diagrams fall under structure, while use case, sequence, state, and activity diagrams fall under behavior. This classification follows the standard UML taxonomy.

Since the overview listed these in a table, here I will only explain how to read them:

- **Class Diagram**: A box represents a class; lines represent relationships (association, inheritance, aggregation, composition, dependency). You can memorize that inheritance is shown with an unfilled triangle arrowhead.
- **Sequence Diagram**: Time flows from top to bottom; horizontal arrows represent messages. You can directly translate the main success scenario of a single use case into a sequence diagram.
- **State Diagram**: Used for entities with states, such as an order moving from "Received → Paid → Shipped → Completed." It records transitions between states triggered by specific events.

Descending in the order Use Case → Sequence → Class reveals that each step in a scenario becomes a message, and the receiver of the message becomes a class method. Viewing it this way makes the relationships between UML types clearer than memorizing them separately.

[More details → Object-Oriented](#/post/cs-procedural-oop) · [More details → SOLID Principles](#/post/cs-solid)

I verified the definition at [UML Introduction (OMG)](https://www.omg.org/spec/UML/2.5.1/About-UML).

## Architecture Styles

An architecture style is a collection of architectures that share common characteristics. It does not require specific technologies, though there is a good fit between microservices and containers. The essence of a style is constraint: it limits what elements can exist and how they can be connected; adhering to these constraints yields the desired properties.

Taking microservices as an example, the constraints are: one service handles one responsibility, services are independent, and data is owned only by its respective service. Adhering to these makes separate deployment, containing failures, and frequent updates easier.

| Style | How Dependencies Are Handled | Suitable Domain |
|---|---|---|
| N-tier (Layered) | Upper layers call only lower layers | Traditional business systems, areas with infrequent changes |
| Web-Queue-Worker | Separates web and workers via a queue | Simple domains with some heavy processing |
| Microservices | Splits vertically by function and calls via API | Complex domains, frequent changes |
| Event-based | Separates publishers and subscribers via events | IoT, real-time processing |

The table above is taken from [Azure Architecture Center's style guide](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/). It also includes big data and big compute, but those are beyond the scope of a software engineering course, so they were omitted.

The document repeatedly emphasizes that complexity must match the domain. Designing too simply results in an unmanageable "big ball of mud." Conversely, microservices introduce complexities such as service discovery, data consistency, and distributed system management; the document states this approach is better suited for organizations with mature development and operations capabilities. Asynchronous messaging loosens coupling but introduces eventual consistency and duplicate message issues.

[Learn more → Layered Architecture](#/post/be-layered-architecture)

### Direct Calls vs. Events: A Code Comparison

In layered architectures, calls are direct; in event-based architectures, the caller does not know the receiver. The same order functionality was implemented in both ways and executed.

```python
class Inventory:
    def reduce(self, item): print("재고 감소:", item)
class Mail:
    def send(self, item): print("메일 발송:", item)

class OrderLayered:               # 주문이 두 모듈을 직접 안다
    def __init__(self): self.inv, self.mail = Inventory(), Mail()
    def place(self, item):
        self.inv.reduce(item); self.mail.send(item)

class Bus:
    def __init__(self): self.subs = {}
    def subscribe(self, ev, fn): self.subs.setdefault(ev, []).append(fn)
    def publish(self, ev, data):
        for fn in self.subs.get(ev, []): fn(data)

class OrderEvent:                 # 주문은 이벤트만 낸다
    def __init__(self, bus): self.bus = bus
    def place(self, item): self.bus.publish("order_placed", item)

OrderLayered().place("책")
bus = Bus(); bus.subscribe("order_placed", Inventory().reduce); bus.subscribe("order_placed", Mail().send)
OrderEvent(bus).place("책")
bus.subscribe("order_placed", lambda i: print("포인트 적립:", i))  # 주문 코드는 그대로
OrderEvent(bus).place("펜")
```

Upon execution, ordering a "book" reduces inventory and sends an email in both approaches. After adding one more subscription, ordering a "pen" additionally credits points. To achieve the same result with a layered approach, you would need to modify `OrderLayered.place`. In contrast, because the event-based approach does not expose call order in the code, you must trace who receives each event. The trade-offs of asynchronous and event-driven design mentioned earlier are present even in this small example.

## Choosing a Style from Requirements

Choosing a style first and then fitting requirements to it is backwards. The document recommends determining the nature of the problem, identifying core business drivers and resulting non-functional requirements (architectural characteristics), prioritizing them, and then selecting a style. For instance, if release time is tight, prioritize maintainability, testability, and reliability; if budget is constrained, prioritize simplicity. Once a style is chosen, changing it incurs significant cost, so it is worth investing more time in the early stages.

## Common Misconceptions

- Are all requirements defined upfront? This applies to waterfall methodologies; in agile, changes are assumed, and iterations are kept short. Regardless of approach, documenting what can be tracked remains the same.
- Are microservices always better because they are modern? They have constraints and trade-offs. If the domain is simple, N-tier or Web-Queue-Worker may be more appropriate.
- Must UML diagrams cover everything? Only parts that are difficult to explain verbally should be diagrammed.
- Are non-functional requirements handled later? Because structure-determining power is involved, they must be defined before design.

## Reference Links

- [Non-functional requirement (Wikipedia)](https://en.wikipedia.org/wiki/Non-functional_requirement)
- [Use case (Wikipedia)](https://en.wikipedia.org/wiki/Use_case)
- [About the Unified Modeling Language Specification (OMG)](https://www.omg.org/spec/UML/2.5.1/About-UML)
- [Architecture styles (Azure Architecture Center)](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/)

Related posts: [Software Engineering Basics](#/post/cs-sw-engineering) · [Layered Architecture](#/post/be-layered-architecture) · [SOLID Principles](#/post/cs-solid)