UML is a standard notation for drawing software diagrams, and in the Information Processing Engineer exam, key topics include distinguishing diagram types, class relationship symbols, and reading use cases and sequences. This article serves as a study guide for the exam. The requirements elicitation phase was covered first in [detailed → Requirements Verification and Analysis](#/post/jb-requirements).

## What is UML?

UML (Unified Modeling Language) is a standard language for modeling systems. It was adopted as a standard by OMG in 1997 and managed by them, with ISO/IEC adopting it as ISO/IEC 19501 in 2005. The official version since then is 2.5.1 (adopted in December 2017).

UML 2 defines 14 types of diagrams. For memorization, it's easier to divide them into two groups.

| Category | What does it depict? | 7 Diagrams |
|---|---|---|
| Structure | What components make up the system (static) | Class, Component, Composite Structure, Deployment, Object, Package, Profile |
| Behavior | How the system evolves over time (dynamic) | Use Case, Activity, State Machine, Sequence, Communication, Interaction Overview, Timing |

The four diagrams under Behavior—Sequence, Communication, Interaction Overview, and Timing—are sometimes grouped together as interaction diagrams.

In exams, questions often ask "What type of diagram is this?" or "Which side does it belong to: static model or dynamic model?", so you only need to correctly identify whether a diagram belongs to the left (Structure) or right (Behavior) column in the table above. Common points of confusion are that Deployment diagrams belong to Structure and Use Case diagrams belong to Behavior.

## Use Case Diagrams

Use case diagrams depict who uses the system and what the system does on a single page.

- **Actor**: A user or external system, typically drawn as a stick figure.
- **Use Case**: A single function provided by the system, drawn as an oval or ellipse.
- **System Boundary**: A rectangle enclosing use cases to show the system's scope.

Relationships between use cases are indicated by dashed arrows with labels.

| Relationship | Meaning | Arrow Direction |
|---|---|---|
| include | The base use case incorporates common functionality in its normal flow | Base → Included |
| extend | Adds optional behavior to the base function when conditions are met | Extending → Base |
| Generalization | Child extends or overrides parent | Child → Parent (triangle head) |

Remember that `include` is for parts always traversed, like login verification, while `extend` is for occasional insertions, such as "password error". This helps avoid confusion with arrow directions. Note that in `extend`, the arrow points toward the base use case.

## Class Diagrams

Class diagrams are the most commonly used among structure diagrams. A class is drawn as a three-compartment box (name, attributes, operations), and access modifiers are prefixed to members.

| Symbol | Access Level |
|---|---|
| + | public |
| - | private |
| # | protected |
| ~ | package |

Multiplicity is written at the end of relationship lines: `1` means exactly one, `0..1` means zero or one, `0..*` or `*` means zero or more, and `1..*` means one or more. The six types of relationships are central to this topic.

| Relationship | In words | Shape |
|---|---|---|
| Association | Structurally connected between classes | Solid line |
| Aggregation | has-a; parts can exist independently | Empty diamond at the whole end |
| Composition | Stronger has-a; parts disappear if the whole is destroyed | Filled diamond at the whole end |
| Generalization | is-a; inheritance | Solid line + empty triangle pointing to parent |
| Realization | Implements an interface | Dashed line + empty triangle pointing to interface |
| Dependency | Weak relationship where one affects the other when changed | Dashed line + open arrow (using side → used side) |

Common points of confusion are aggregation vs. composition, and generalization vs. realization. Whether the diamond is filled or empty depends on whether they share a lifecycle. Both use an empty triangle; solid lines indicate inheritance, while dashed lines indicate implementation. Remembering to check line style first, then arrowhead shape reduces errors.

However, regardless of how these relationships appear in exam questions (in English or Korean), memorizing one defining sentence for each is sufficient. The skill of translating this into code continues in [detailed → Object-Oriented Programming and Language Code Reading](#/post/jb-oop-lang).

## Sequence Diagrams

Sequence diagrams depict the order in which objects exchange messages, drawn from top to bottom following the flow of time.

- Lifeline: A vertical line representing an object or process. If there is an X below it, the object has been destroyed.
- Message: Attach a message name to a horizontal arrow. A filled arrowhead indicates a synchronous call (the caller waits until the callee finishes), while an open arrowhead indicates an asynchronous call (proceeds without waiting). A dashed line represents a response (return).
- Activation bar: A thin rectangle above the lifeline indicating the period during which that object is processing a message. If it calls itself, the bars overlap and stack.
- Combined fragment: A box used to group and represent flows such as parallel execution, conditional branching, or alternative actions.

Problems typically ask you to identify "which message is of what type" or "which object receives the call" based on a diagram, so practicing distinguishing arrowhead shapes and dashed response lines is most direct.

<details>
<summary>Detailed explanation: Translating one scene into three diagrams</summary>

Using an online order as an example, the same content appears differently in each diagram.

- Use case: Includes actors "Customer" and "Payment Processor," with use cases "Place Order" and "Process Payment." "Place Order" includes "Login Verification," and "Apply Coupon" extends "Process Payment." Place use cases inside the system boundary and keep actors outside.
- Class: Order and OrderItem are composed because an item has no meaning without an order; Order and Customer are associated. The multiplicity is 1 Customer to 0..* Orders. If a CardPayment class implements the payment interface, it is shown with a dashed line and an empty triangle.
- Sequence: Customer → Order Service sends "Order Request" (synchronous), Order Service → Payment sends "Payment Request," and a dashed line returns the "Payment Result" response. If you send without waiting for a notification, draw it as an asynchronous message with an open arrowhead.

Even in the same system, use cases handle "who does what," class diagrams handle "what owns what," and sequence diagrams handle "who tells whom when." When reading a problem, first determine which of these three categories the question belongs to; this speeds up solving.

</details>

## Intuition for Object-Oriented Analysis

Object-oriented analysis involves extracting object candidates (nouns) and their behaviors (verbs) from requirements and organizing them into classes. It is natural to define functional scope using use case diagrams, establish static structure with class diagrams, and verify scenarios with sequence diagrams. The structure defined at this stage becomes the foundation for [Software Architecture](#/post/jb-architecture-pattern) and [Design Patterns](#/post/jb-design-pattern) discussed later in detail.

## Common Confusions

- Composition and aggregation both use diamonds: An empty diamond means the part can exist independently, while a filled diamond means the part disappears with the whole.
- Generalization and realization triangles look identical: A solid line indicates inheritance, while a dashed line indicates implementation.
- The arrow directions for include and extend are opposite: Include points from the base to the included element; extend points from the extending element to the base.
- Deployment and component diagrams are behavioral: They are actually structural.
- Exam schedules and problem type ratios are not covered in this article; check official sites for schedules and registration.

← Concept map (#/post/jb-map)

Related articles: [Requirements Verification and Analysis](#/post/jb-requirements) · [Object-Oriented Concepts and Reading Language Code](#/post/jb-oop-lang) · [Design Patterns](#/post/jb-design-pattern)

## Reference Links

- Wikipedia, Unified Modeling Language: https://en.wikipedia.org/wiki/Unified_Modeling_Language
- Wikipedia, Class diagram: https://en.wikipedia.org/wiki/Class_diagram
- Wikipedia, Use case diagram: https://en.wikipedia.org/wiki/Use_case_diagram
- Wikipedia, Sequence diagram: https://en.wikipedia.org/wiki/Sequence_diagram
- Visual Paradigm, What is Use Case Diagram: https://www.visual-paradigm.com/guide/uml-unified-modeling-language/what-is-use-case-diagram/