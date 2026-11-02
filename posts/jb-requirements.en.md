Requirements describe "what the system should do and what quality it should have." Exam questions frequently ask you to distinguish between the sequence of handling these requirements and the names and characteristics of development models.

## What are Requirements?

Requirements are a verbal summary of what users and stakeholders want from the software. Since this stage determines "what to build" before writing code, mistakes made here incur high costs later when fixing them.

In exams, requirements are broadly divided into two categories:

| Category | Phrasing Pattern | Example |
|---|---|---|
| Functional Requirements | The system shall do ~ | Logs in, displays order history |
| Non-functional Requirements | The system shall be ~ | Response time is under 2 seconds, passwords are encrypted and stored |

The Wikipedia article on non-functional requirements also notes a tendency to phrase functional requirements as "system shall do ~" and non-functional ones as "system shall be ~". Representative items for non-functional requirements include performance, reliability/availability, scalability, security, usability, and maintainability. Remember that functional requirements describe *what* the system does, while non-functional requirements describe *how well* it does it; this distinction helps avoid confusion in problems.

Some textbooks also treat constraints (budget, schedule, technologies to be used) as a separate category. If "constraints" appear among options, choose the one that is neither functional nor non-functional.

## Requirements Engineering Process

According to Wikipedia, requirements engineering activities include elicitation, analysis/negotiation, modeling, specification, validation, and management. Textbooks like 정처기 (Jeong Cheo-gi) often group these into four stages:

```
도출 → 분석 → 명세 → 확인(검증)
```

| Stage | Activity | Exam Focus Point |
|---|---|---|
| Elicitation | Gather requirements from stakeholders | Distinguishing technique names |
| Analysis | Resolve ambiguities and conflicts; set priorities | Conflict resolution (negotiation), modeling |
| Specification | Finalize in documents (SRS) | Clarity, verifiability |
| Validation | Check if the specification matches actual needs | Reviews, prototypes |

Wikipedia notes that these activities do not proceed strictly in sequence but involve "considerable interleaving" in practice. While exam questions may ask about order, understanding that real-world processes are iterative is sufficient. Also, a document becomes an official specification only after undergoing validation.

### Elicitation Techniques

Elicitation involves discovering requirements, and many exam questions pair technique names with their characteristics:

- **Interview**: Directly meet and ask people. Good for depth but time-consuming.
- **Survey**: Distribute the same questions to many people. Good for breadth but shallow in depth.
- **Brainstorming**: Generate ideas collectively without criticism.
- **Prototyping**: Show a simple prototype and gather feedback. Used when requirements are hard to express verbally.
- **Observation**: Watch users working in their actual environment. Uncovers needs users themselves cannot articulate.
- **Use Case / Scenario**: Document requirements as scenes of users using the system. UML-related content is covered in detail in [UML and Object-Oriented Analysis](#/post/jb-uml).

### Analysis

Elicited requirements often contain conflicts—for example, the sales team wants speed while the development team emphasizes stability. During analysis, these are resolved through negotiation, priorities are set, and modeling is used to represent requirements visually using tools like data flow diagrams, use case diagrams, and class diagrams. Wikipedia also notes that use cases and user stories are employed in analysis, with UML serving as a graphical tool.

### Specification and Validation

Specification involves documenting the requirements. The representative document is the SRS (Software Requirements Specification). A good specification should be unambiguous, free of contradictions, and verifiable. For instance, "responds quickly" is vague, whereas "95% of requests respond within 2 seconds" is verifiable.

Validation checks whether the documented requirements are consistent and satisfy stakeholder needs. Methods include document reviews, prototype demonstrations, and test case creation. Testing-related topics continue in [Software Testing](#/post/jb-testing).

<details>
<summary>Detailed Explanation: Commonly Confused Pairs</summary>

- **Validation** asks "Are we building the right product?", while **verification** asks "Are we building the product right (according to the specification)". Many memorize this distinction, though textbooks sometimes mix these terms, so context in the question is key.
- **Requirements management** refers to activities that continue after specification completion, tracking changes from initiation through system usage. Wikipedia describes management as spanning from project start to changes during system operation.
- Elicitation technique questions often follow a pattern like "Show a prototype and receive feedback → Prototyping". Focus on the core verb in the description to identify the correct term.

</details>

## Development Models

The development model varies depending on when and how much the requirements are finalized. Exam questions typically ask you to match a model name with its characteristics.

| Model | One-line Characteristic | Requirement Perspective |
|---|---|---|
| Waterfall | Proceed sequentially through stages without going back | Requirements are fully defined upfront |
| Prototype | Build a prototype first to validate requirements | Used when requirements are unclear |
| Spiral | Iterate while analyzing risks | Suitable for large projects with high risk |
| Agile | Respond to change through short iterations | Assumes requirements will change |

### Waterfall

According to Wikipedia, the phases of the waterfall model include preliminary analysis, system analysis and requirement definition, design, development, integration and testing, acceptance/installation/deployment, and maintenance. Textbooks usually simplify this to planning → requirements analysis → design → implementation → testing → maintenance for memorization.

Interestingly, Royce's 1970 paper is notable. Although his diagram gave rise to the name "waterfall," Royce himself considered a simple form where testing occurs only at the end to be risky; he advocated adding feedback loops from testing back to design and from design back to requirements. Exams often cite the weakness of the simple waterfall model: because customers may not know exact requirements until seeing working software, late changes lead to rework and increased costs.

### Prototype

When requirements are ambiguous, a simple prototype is built first and shown to users to refine them based on feedback. This model addresses the waterfall's weakness of "discovering requirements late" by tackling it early.

### Spiral

Proposed in Barry Boehm's 1986 paper, Wikipedia describes four tasks to be performed in every cycle: examine goals and constraints of key stakeholders, find and evaluate alternatives to achieve those goals, analyze risks associated with the chosen approach and respond to them, and obtain stakeholder approval to proceed to the next cycle. The emphasis on risk analysis is a common exam point. If a model includes a "risk analysis" phase due to risk concerns, it can be directly linked to the spiral model.

### Agile

The 2001 Agile Manifesto lists four values:

- Individuals and interactions over processes and tools
- Working software over comprehensive documentation
- Customer collaboration over contract negotiation
- Responding to change over following a plan

The manifesto document separately links to twelve principles. Exams may ask about the structure where "both sides have value but the right side is prioritized," so remember these four pairs as matched sets.

Representative Agile methodologies are Scrum and XP.

Scrum, based on the Scrum Guide, has three roles: Developer, Product Owner, and Scrum Master. Events include Sprint, Sprint Planning, Daily Scrum, Sprint Review, and Sprint Retrospective. Artifacts are the Product Backlog, Sprint Backlog, and Increment. A Sprint is a fixed duration of one month or less.

XP (Extreme Programming) was developed by Kent Beck during Chrysler's payroll system project. Its values are Communication, Simplicity, Feedback, Courage, and Respect. Representative practices include Pair Programming, Planning Game, Test-Driven Development (TDD), Continuous Integration, Refactoring, Small Releases, Coding Standards, Collective Code Ownership, Simple Design, and Sustainable Pace. Exams often present questions like: "If 'pair programming,' 'TDD,' or 'refactoring' appears, it's XP."

<details>
<summary>Detailed explanation: Order for solving model selection problems</summary>

1. If the problem mentions "risk analysis," it's Spiral.
2. If "prototype" or "sample" is mentioned, it's Prototype.
3. If "Sprint," "backlog," or "Scrum Master" appears, it's Scrum.
4. If "pair programming," "refactoring," or "TDD" is present, it's XP.
5. If the description says "sequential step-by-step, no going back to previous stages," it's Waterfall.

When options are similar, distinguish them by whether requirements are stable (Waterfall), unclear (Prototype), high-risk (Spiral), or continuously changing (Agile).

</details>

## Common Misconceptions

- Requirements can be fully defined upfront: The waterfall model assumes this, while Agile assumes requirements will change. Each model has different underlying assumptions.
- Non-functional requirements are less important: If performance or security is neglected, the system becomes unusable even if all functional features are implemented.
- Agile does not use documentation: The manifesto emphasizes working software over comprehensive documentation, but it does not mean documentation is unnecessary.
- Spiral is Agile because it involves iteration: While both involve iteration, Spiral centers on risk analysis, whereas Agile focuses on responding to change and collaboration.

When solving past exam questions, the same concept often reappears with only slight changes in the option text; reviewing the table above and practicing renaming explanations by name will be helpful. Check the exam schedule and registration conditions on the official website.

Related concepts continue in [Details → Software Engineering Basics](#/post/cs-sw-engineering), [Details → Software Architecture](#/post/jb-architecture-pattern), and [Details → Project Management](#/post/jb-project-mgmt).

## Reference Links

- Wikipedia, Requirements engineering: https://en.wikipedia.org/wiki/Requirements_engineering
- Wikipedia, Non-functional requirement: https://en.wikipedia.org/wiki/Non-functional_requirement
- Wikipedia, Waterfall model: https://en.wikipedia.org/wiki/Waterfall_model
- Wikipedia, Spiral model: https://en.wikipedia.org/wiki/Spiral_model
- Agile Manifesto: https://agilemanifesto.org/
- Scrum Guide: https://scrumguides.org/scrum-guide.html
- Wikipedia, Extreme programming: https://en.wikipedia.org/wiki/Extreme_programming

← Concept map ([Information Processing Engineer Exam Map](#/post/jb-map))

Related articles: [UML and Object-Oriented Analysis](#/post/jb-uml) · [Software Testing](#/post/jb-testing) · [Project Management](#/post/jb-project-mgmt)