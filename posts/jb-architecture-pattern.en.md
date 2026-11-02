In the Information Processing Technician exam, the software architecture section is divided into two main parts: defining the overall shape of the system (architecture patterns) and evaluating how well the components are separated (modularity, coupling, cohesion). The first part involves matching names with characteristics, while the second focuses on memorizing sequences. Past exam questions are not reproduced; instead, only the formats in which they appear and the criteria for solving them are summarized.

## What is Architecture?

Architecture defines the high-level framework that specifies how a system is divided into elements and how those elements connect to each other. It is determined before writing a single line of code and is expensive to change later. Therefore, non-functional requirements such as performance, security, and maintainability are established at this stage. How requirements are extracted is covered separately in [Requirements Verification and Analysis →](#/post/jb-requirements).

Microsoft's Azure Architecture Guide describes an architecture style as "a family of architectures that share specific characteristics." Styles impose constraints on design. They define what elements can exist and what relationships between them are allowed. Adhering to these constraints brings the expected benefits of that style. When memorizing pattern names, it helps to consider "what constraint this pattern imposes" to avoid confusion.

## Summary of Architecture Patterns

| Pattern | Core Structure | One-Liner Characteristic |
|---|---|---|
| Layered (Layered, N-tier) | Presentation → Business → Data Access | Each layer calls only the layer below it |
| MVC | Model / View / Controller | Separates data, display, and input processing |
| Pipe-and-Filter | Filters connected by pipes | Output of one stage becomes input to the next |
| Client-Server | Requesting side ↔ Responding side | Server holds resources; client makes requests |
| Event-Based | Producer → Event Channel/Broker → Consumer | Producer and consumer are unaware of each other |
| Microservices | Multiple small independent services | Each service owns its own data and is deployed separately |

The table descriptions are based on content verified from the Wikipedia entries for each pattern and Microsoft's Azure Architecture Guide. Below, we examine each one in more detail.

### Layered

According to the Azure guide, N-tier divides an application into logical layers and physical tiers, where each layer calls only the layer beneath it—a traditional enterprise structure. Typically, this includes presentation, business logic, and data access layers. Advantages include minimal changes when migrating apps already built with a layered architecture; disadvantages noted in the same document include that horizontal divisions can lead to changes affecting multiple parts. For details on how to divide layers in actual code, see [Layered Architecture →](#/post/be-layered-architecture).

### MVC

According to Wikipedia, MVC is a pattern for user interfaces that divides program logic into three parts:

- **Model**: The application's data and rules governing it; independent of the interface.
- **View**: The part that displays information; multiple views can display the same data.
- **Controller**: Receives user input and translates it into commands to update the Model or View.

MVC was created in the late 1970s by Trygve Reenskaug at Xerox PARC during work on Smalltalk. In exams, correctly matching "input → Controller, data → Model, screen → View" is sufficient to solve most questions. MVP and MVVM are known as variants derived from MVC. To be prepared for cases where names appear together in options, it's essential to clearly understand the three roles of MVC.

### Pipe-and-Filter

This structure consists of processing stages connected sequentially, where the output of one stage becomes the input of the next. Stages are called filters and connections are called pipes; pipes typically include some buffering. While simple and low-cost, Wikipedia notes that flexibility, fault tolerance, and scalability are limited. It's easy to remember by thinking of Linux commands chained with `|`.

### Client-Server

This structure involves a server providing functions or resources while a client sends requests. The most common example is a web browser and web server. Since the server interacts with multiple clients, understanding that server-side load and failures can affect the entire system will help when answering descriptive-choice questions.

### Event-Based

The Azure guide describes this as using a publish-subscribe model. An event producer creates events without knowing who the consumers are, while consumers react to events they are interested in. They are connected via an event channel or broker. While direct dependencies between producer and consumer disappear, challenges include delivery guarantees, event ordering, and eventual consistency.

### Microservices

Split applications into small, independent services. Each service handles a single business function and owns its own data store. Services communicate via APIs, enabling separate development, deployment, and scaling per service. However, as the Azure guide points out, challenges arise in service discovery, data consistency, and managing distributed systems. This approach is not universally suitable for every small application.

## Criteria for Choosing a Pattern

| Situation | Suitable Approach |
|---|---|
| Migrating an existing layered business system | Layered |
| Wanting to separate UI from data logic | MVC |
| Transforming data in stages | Pipe-and-Filter |
| Real-time processing, loose coupling | Event-driven |
| Frequent changes in complex domains | Microservices |

The Azure guide table also categorizes N-tier as "traditional business domains, low update frequency," microservices as "complex domains, frequent updates," and event-driven as suitable for IoT and real-time systems. The same document notes that it is better to slightly relax constraints and adapt to reality rather than strictly following pure structures.

## Modularity, Coupling, and Cohesion

Modularity involves dividing a system into functional units. The criteria for this division are coupling and cohesion. Coupling refers to how intertwined modules are, while cohesion measures how closely related the elements within a module are focused on a single purpose. Good design aims for low coupling and high cohesion. Wikipedia explains that high cohesion tends to go hand-in-hand with loose coupling.

Conceptual explanations can be found in detail at [Coupling and Cohesion →](#/post/be-coupling-cohesion), but here we fix the order for testing purposes only.

### Coupling (High → Low)

| Order | Type | Meaning |
|---|---|---|
| 1 | Content | Directly uses internal code or branches of another module |
| 2 | Common | Multiple modules share the same global data |
| 3 | External | Share predefined data formats, communication protocols, or device interfaces from outside |
| 4 | Control | Pass values (e.g., flags) that control the flow of another module |
| 5 | Stamp | Share composite data structures but use only a part of them |
| 6 | Data | Exchange only basic data as parameters |

This order and definition follow Wikipedia's Coupling entry, which lists "from highest to lowest coupling." The most desirable is data coupling.

### Cohesion (High → Low)

| Order | Type | Reason for Grouping |
|---|---|---|
| 1 | Functional | All elements contribute to a single well-defined task |
| 2 | Sequential | Output of one element becomes input of the next |
| 3 | Communicational (Information) | Handle the same data |
| 4 | Temporal | Follow a predefined execution sequence |
| 5 | Logical | Belong to the same category but perform different tasks |
| 6 | Coincidental | Gathered together without special reason |

Wikipedia's Cohesion entry places functional cohesion as the best and coincidental cohesion as the lowest. Some sources also note that this ranking does not necessarily imply a consistent improvement path within the same item.

<details>
<summary>How to Remember the Order</summary>

It's easier to remember by linking the first letters: Coupling follows 내·공·외·제·스·자 (Content, Common, External, Control, Stamp, Data), and Cohesion follows 기·순·통·절·시·논·우 (Functional, Sequential, Communicational, Logical, Temporal, Logical, Coincidental). Since the two tables have opposite directions—coupling lists from bad to good, while cohesion lists from good to bad—writing them separately once will help avoid confusion.

</details>

## Common Question Types and Solutions

- **Pattern Name Selection**: Options may list characteristics like "data/UI/input separation," "output of one feeds input of the next," or "lower layers only call upper ones." Match these with a single line from the table above to solve.
- **Coupling/Cohesion Order**: Questions ask for the lowest coupling type or highest cohesion type. Knowing just the extremes solves it: data coupling is best for low coupling, and functional cohesion is best for high cohesion.
- **Scenario Matching**: Descriptions like "two modules share a global variable" correspond to common coupling, while "one module passes a flag to change another module's behavior" corresponds to control coupling. Memorize the meaning column in the coupling table to identify names quickly.
- **Design Principle Pairing**: Questions ask why low coupling and high cohesion are beneficial. Reading that fewer parts need modification when changing a module generally leads to the correct answer.

Memorizing only pattern names can be confusing; grouping them with single-line characteristics as shown above speeds up understanding.

## Common Misconceptions

- Coupling must always be zero: If modules do not exchange anything with each other, the system does not exist. The goal is to reduce coupling through weak connections.
- Microservices are not always better than layered architectures: Azure guides also state that they are suitable for complex domains with frequent changes and require operational maturity.
- MVC is used only in web applications: MVC is described as a pattern for user interfaces and is commonly used in web frameworks.
- High cohesion means small modules: This is unrelated to size. A module can have many responsibilities while still having high cohesion if it performs one thing well.

<details>
<summary>Difference between design patterns and architectural patterns</summary>

Architectural patterns define the overall structure of a system, whereas GoF design patterns are design techniques at the class and object level. Since both often appear mixed in exams, I have organized them into separate sections. Design patterns can be found [in detail → Design Patterns](#/post/jb-design-pattern), and UML for drawing classes and objects along with object-oriented analysis is available [in detail → UML and Object-Oriented Analysis](#/post/jb-uml).

</details>

## Reference Links

- [Architecture styles - Azure Architecture Center (Microsoft Learn)](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/)
- [Architectural pattern - Wikipedia](https://en.wikipedia.org/wiki/Architectural_pattern)
- [Model–view–controller - Wikipedia](https://en.wikipedia.org/wiki/Model%E2%80%93view%E2%80%93controller)
- [Pipeline (software) - Wikipedia](https://en.wikipedia.org/wiki/Pipeline_(software))
- [Coupling (computer programming) - Wikipedia](https://en.wikipedia.org/wiki/Coupling_(computer_programming))
- [Cohesion (computer science) - Wikipedia](https://en.wikipedia.org/wiki/Cohesion_(computer_science))

← [Concept Map](#/post/jb-map)

Related articles: [Design Patterns](#/post/jb-design-pattern) · [UML and Object-Oriented Analysis](#/post/jb-uml) · [SOLID](#/post/cs-solid)