The integrated implementation unit asks how to connect separate systems and exchange data between them in what format. Although there are many terms, most can be solved by summarizing the question as "what does the middleman do?"

## What this unit asks

The unit is divided into three main parts.

| Part | Core Question | Common Terms |
|---|---|---|
| Module Integration | How to connect systems? | Direct integration, Indirect integration, EAI, ESB |
| Interface | What agreement was made on how to exchange data? | Interface specification, Send/receive items, Error handling |
| Data Format | What is the shape of the exchanged documents? | JSON, XML |

Exams often feature definition matching questions like "Which term corresponds to the following description?" Therefore, it's best to memorize each term paired with its one-line definition first. Check the exam schedule and registration fees on the official website.

## Why integration is needed

Companies have separate systems running for ERP, CRM, payroll, etc. The Wikipedia EAI entry describes this state as isolated "islands of automation," and explains EAI as middleware that enables sharing of data and business processes between them.

When there are only two or three systems, they can be directly connected. The problem arises when the number increases. Direct connections multiply rapidly as the number of systems grows, and if one system's format changes, all lines connected to it must be reviewed. A structure with an intermediary was introduced to reduce this burden.

## Three Integration Structures

| Structure | Shape | Characteristics |
|---|---|---|
| Point-to-Point | Systems directly connected one-to-one | Simple, but management becomes difficult as connections increase |
| Hub & Spoke | Each system connects to a central hub | Controlled from the center. If the hub fails, the entire system is affected |
| Bus | Systems attach to a common bus | Systems are connected by plugging into the bus |

The Wikipedia EAI entry mentions two topologies: Hub & Spoke refers to a structure where EAI is in the center and applications connect as spokes; Bus refers to a structure where EAI is either the bus itself or a module within existing message-oriented middleware. Point-to-Point can be noted for comparison as a method of direct connection without EAI.

[Learn more → Software Architecture](#/post/jb-architecture-pattern)

## EAI

EAI (Enterprise Application Integration) is a method that connects multiple applications within an enterprise to share data and business processes. The components mentioned in the document are as follows:

- Hub or Bus: The part that handles message exchange from the center
- Adapter: Attaches each application to the hub and converts data into a common format
- Integration Module: Handles notifications by subscribing to specific events

Patterns are divided into two types. Mediation is a method where, when an event occurs in one application, EAI acts as a broker to deliver changes to related applications. Federation is a method where EAI serves as the gateway for external requests and communicates on behalf of internal applications.

Consistency across operations spanning multiple systems is achieved using two-phase commit or compensating transactions.

[Learn more → Normalization and Transactions](#/post/jb-normalization-transaction)

## ESB

ESB (Enterprise Service Bus) is a communication system that connects applications in a Service-Oriented Architecture (SOA), with the primary purpose of integrating different systems. Wikipedia introduces ESB as a common way to implement the bus model of EAI. Ideally, all communications pass through the bus instead of applications contacting each other directly.

The core functions of ESB are summarized as follows:

| Function | What it does |
|---|---|
| Routing | Sends messages to appropriate services and monitors/control flow. Can be branched based on content or rules |
| Transformation | Converts messages into a format readable by the receiving side |
| Protocol Translation | Enables communication between services using different communication protocols |
| Message Queuing | Organizes messages and events in sequence for delivery |

<details>
<summary>Distinguishing EAI and ESB in one line</summary>

EAI is closer to the purpose of "integrating applications within an enterprise," while ESB is closer to a method implemented as a service bus shape. In exams, if the question focuses on a hub-centric approach, it's likely EAI Hub & Spoke; if it mentions service-oriented structure and bus, it's likely ESB. However, depending on the problem statement, both may be grouped under the same category, so if both terms appear in the options, it's safer to read the entire explanation sentence.

</details>

## Interface Specification

To integrate systems with each other, an agreement is needed, and the document recording that agreement is the interface specification. Typically, it includes the following content:

- Which system sends and which system receives data
- Names, data types, lengths, and whether fields are mandatory for exchanged items
- Invocation methods and frequency (real-time or batch)
- Error handling procedures when issues occur

Since a single mismatched item can break the entire integration, this document must be concise yet comprehensive. In exams, questions may ask which items appear in the specification or how to verify that data was successfully exchanged after integration.

[Learn more → Software Testing](#/post/jb-testing)

## Data Formats: JSON and XML

JSON and XML are the primary formats for exchanging data. Here is how the same order information can be represented in both ways:

```json
{"orderId": 101, "items": [{"sku": "A1", "qty": 2}], "paid": true}
```

```xml
<order id="101"><item sku="A1" qty="2"/><paid>true</paid></order>
```

When I read these two lines directly using Python, JSON was parsed as a dictionary using `json.loads`, where `items[0].qty` returned 2, while XML was read using `ElementTree`, and the `qty` attribute of `item` also returned 2. Invalid XML with mismatched closing tags (`<a><b></a>`) caused an error during parsing.

### JSON

json.org describes JSON as a lightweight text-based data interchange format that is easy for humans to read and write, and easy for machines to parse and generate, independent of any programming language. Its structure consists of two types:

- **Object**: A collection of name-value pairs enclosed in curly braces, with colons after names and commas separating pairs. It represents an unordered set.
- **Array**: An ordered collection of values enclosed in square brackets and separated by commas.

Values can be strings (in double quotes), numbers, `true`/`false`, `null`, or objects and arrays (which can be nested).

### XML

According to the W3C XML 1.0 specification, XML is a restricted subset of SGML, with the goal of facilitating the exchange and processing of structured data on the web. Two key concepts are tested in exams:

| Concept | Meaning |
|---|---|
| Well-formed | A document that follows syntax rules, such as having exactly one root element and properly nested elements |
| Valid | A well-formed document that also satisfies the structure defined by an associated DTD |

Opening and closing tags must match. Attributes are name-value pairs within the opening tag. Order of attributes does not matter, and duplicate attribute names within the same tag are not allowed. A DTD defines the permitted elements and their structural relationships.

<details>
<summary>Comparison Table: JSON vs XML</summary>

| Item | JSON | XML |
|---|---|---|
| Structure | Objects and arrays | Element tree wrapped in tags |
| Attributes | None; expressed as name-value pairs | Attributes on opening tags |
| Structure validation | Based on syntax rules within the document itself | Can be validated using a DTD |
| Size | Generally more concise | Often longer due to repeated tags |

While the size difference is immediately visible in examples like the one above, neither format is universally better. Exams often test your ability to distinguish between the definitions and structural differences of these two formats.

</details>

## Common Question Types

- **Terminology matching**: Given a description, choose among EAI, ESB, Hub-and-Spoke, or Bus
- **Function identification**: Find the function that matches the description among routing, transformation, protocol conversion, or message queuing
- **Format reading**: Given JSON or XML examples, extract values or identify correct syntax
- **Well-formed vs. Valid**: Problems resolved based on the presence or absence of a DTD

The solution approach is straightforward: if the sentence contains "central" or "hub," it's Hub-and-Spoke; if it mentions "service" and "bus" with transformation or routing, it's ESB. For format identification, check for curly braces first (JSON) or tags (XML), then proceed to details. It's best to practice with actual past exam questions from official sources like the Korea Computer Union (KCET).

← [Concept Map](#/post/jb-map)

Related Articles
- [Software Architecture](#/post/jb-architecture-pattern)
- [Software Testing](#/post/jb-testing)
- [Network Fundamentals](#/post/jb-network)

## Reference Links

- [Enterprise application integration - Wikipedia](https://en.wikipedia.org/wiki/Enterprise_application_integration)
- [Enterprise service bus - Wikipedia](https://en.wikipedia.org/wiki/Enterprise_service_bus)
- [Introducing JSON - json.org](https://www.json.org/json-en.html)
- [Extensible Markup Language (XML) 1.0 - W3C](https://www.w3.org/TR/xml/)