Software engineering is a field that deals not just with how to write code well, but "what to build, in what order, how to verify it, and how to fix it." Here is the main outline.

## What is Software Engineering?

If a program is small, you can manage it in your head alone. However, as the number of people increases and the project duration lengthens, the problems change. People may misunderstand what needs to be built, fixes might break other parts, and deadlines get missed. Software engineering is a collection of methods created to reduce such problems.

It is broadly divided into five parts: the overall approach (development methodology), defining what to build (requirements), translating that into diagrams (design/UML), verifying if it works correctly (testing), and managing changing code (version control). The sequence generally follows this order.

| Stage | Activity | Deliverable |
|---|---|---|
| Requirements | Listening and organizing what to build | Requirements Specification |
| Design | Deciding structure, UI, and data | UML, Design Documents |
| Implementation | Writing code | Source Code |
| Testing | Verifying if it meets requirements | Test Results |
| Maintenance | Fixing and adding features | New Version |

## Development Methodologies: Waterfall and Agile

Methodology refers to how you proceed through the stages above.

The Waterfall model proceeds through the stages sequentially from top to bottom, once each. You finish requirements before moving to design, and finish design before implementation. The next stage only begins after the previous one is complete; this ensures clear documentation and planning, but makes it difficult to go back if requirements change midway. Another weakness is that results are only visible at the very end.

Agile is the opposite: build small pieces quickly, show them, and fix them. Reading the 12 principles of the Agile Manifesto clarifies the direction. It welcomes changes in requirements even late in development, delivers working software frequently (in weeks), has business people and developers working together daily, and measures progress with working software. This also includes periodically reviewing and adjusting the approach.

| | Waterfall | Agile |
|---|---|---|
| Progress | Sequentially through stages once each | Repeating short cycles |
| Requirement Changes | Difficult and expensive | Accepted as a premise |
| Result Verification | Almost at the end | At the end of every cycle |
| Documentation | Abundant | Only what is needed |
| Suitable For | Projects with fixed requirements | Projects with frequently changing requirements |

Among the frameworks for actually running Agile, Scrum is the most common. Summarized based on the [Scrum Guide](https://scrumguides.org/scrum-guide.html):

- Sprint: A fixed period of less than a month. All events fit within this.
- Events: Sprint Planning, Daily Scrum (15 minutes), Sprint Review, Retrospective.
- Roles: Product Owner (manages backlog, one person), Scrum Master (removes impediments), Developers.
- Artifacts: Product Backlog, Sprint Backlog, Increment (usable result).

Thinking that Waterfall is bad and Agile is good leads to mistakes in reality. There are times when a plan-centric approach is appropriate for projects with fixed requirements and high costs to revert (e.g., firmware embedded in hardware). Other models exist, such as Spiral (repeating risk analysis) and Prototype; knowing just their names and characteristics is sufficient.

[More details → Module Cohesion and Coupling](#/post/be-coupling-cohesion)

## Requirements

Requirements are what the system must do and the conditions it must satisfy. They are divided into two types:

- Functional Requirements: What the system does, such as "Users must be able to log in via email."
- Non-functional Requirements: Quality or constraint items like "Login response within 1 second" or "Personal data must be encrypted."

Good requirements have a single meaning per sentence and must be verifiable. "Fast" is not verifiable, whereas "within 1 second" is. Mistakes made during the requirements stage become increasingly expensive to fix later on; therefore, ensuring everyone understands the same thing at this stage is most important.

<details>
<summary>How to Elicit and Validate Requirements</summary>

Elicitation is done through interviews, surveys, observing current work, prototype demonstrations, and other methods. Received requirements are analyzed to filter out conflicts, written into a specification document, and reviewed by stakeholders at the end. Numbering each requirement allows for later connection and tracking during design and testing (traceability matrix).
</details>

## UML

UML is a standard notation for drawing designs as diagrams. There are many types, but only a few appear frequently.

| Diagram | What it Shows | When Used |
|---|---|---|
| Use Case | Actions users perform on the system | Organizing requirements |
| Class | Classes and relationships | Structural design |
| Sequence | Order of messages between objects | Flow of a specific feature |
| State | Conditions under which states change | Things with states like orders/payments |
| Activity | Workflow | Business procedures |

It is easier to remember by dividing diagrams into those showing structure (e.g., Class) and those showing behavior (e.g., Sequence, State). You do not need to draw everything; it is better to only draw parts that are difficult to explain in words.

## Testing

Testing is about verifying that what you built works as required and identifying where it breaks. The scope expands in this order: unit (single function or class), integration (bundling modules), system (the whole application), and acceptance (whether users or customers will accept it).

Automated testing is explained using the "Test Pyramid" ratio. Based on [Martin Fowler's article](https://martinfowler.com/articles/practical-test-pyramid.html), unit tests should be fast and therefore most numerous, integration tests involving external systems like databases should be moderate, and UI tests that traverse the entire interface should be very few. Inverting this approach turns it into a slow and expensive-to-maintain "ice cream cone." The advice is to avoid redundant checks across multiple layers and instead push verification as low as possible.

Testing can also be divided into black-box (testing input/output without looking at internal code) and white-box (examining code structure and paths). In black-box testing, boundary value analysis is representative because errors often occur at boundaries such as values of 0, 1, or maximum limits.

Unit tests look like this. Written with Python `unittest` and run directly, all four cases passed.

```python
import unittest

def discount(price, is_member):
    if price < 0:
        raise ValueError("price")
    return int(price * 0.9) if is_member else price

class T(unittest.TestCase):
    def test_member(self):
        self.assertEqual(discount(10000, True), 9000)
    def test_guest(self):
        self.assertEqual(discount(10000, False), 10000)
    def test_zero(self):          # 경계값
        self.assertEqual(discount(0, True), 0)
    def test_negative(self):      # 예외 경우
        with self.assertRaises(ValueError):
            discount(-1, True)

unittest.main()
```

[More details → Backend Testing](#/post/be-testing)

<details>
<summary>A few testing terms</summary>

- Regression testing: Re-checking that previously working functionality hasn't broken after a fix.
- Stub/Mock: Fakes that replace real dependencies (e.g., databases, external APIs) in tests.
- Verification answers "Did we build it right?" (conformance to specifications), while Validation answers "Did we build the right thing?" (alignment with user requirements).
</details>

## Version Control

Code changes constantly; without knowing who changed what and when, problems become unfixable if you can't revert. Version control (SCM) involves recording and controlling changes to deliverables like source code and documents. It includes version management (reverting, history), change control (who approved), and build/deployment management. Git is effectively the standard today.

[More details → Understanding Git Properly](#/post/cs-git)

## Common Misconceptions

- Does Agile mean doing things without documentation or planning? No; it still incorporates good design and technical excellence per principles. It reduces, not eliminates, documentation.
- Is testing done only after development ends? It's better to define "how to verify" during the requirements phase.
- Must all UML diagrams be drawn? Only draw what is necessary.

## Reference Links

- [12 Principles of the Agile Manifesto](https://agilemanifesto.org/principles.html)
- [Scrum Guide](https://scrumguides.org/scrum-guide.html)
- [The Practical Test Pyramid (Martin Fowler)](https://martinfowler.com/articles/practical-test-pyramid.html)

← Concept map ([CS & Design Fundamentals Map](#/post/cs-map))

Related posts: [Understanding Git Properly](#/post/cs-git) · [Backend Testing](#/post/be-testing) · [Module Cohesion and Coupling](#/post/be-coupling-cohesion)