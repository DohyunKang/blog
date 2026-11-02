The test overview has already been covered in [Software Engineering Basics](#/post/cs-sw-engineering) and [Backend Testing](#/post/be-testing), including the division into unit, integration, and system tests, as well as the pyramid shape. This article delves deeper to address "how to select test cases, how many to write, and in what order to structure them."

## Testing is Sampling, Not Proof

The number of possible input values is effectively infinite, so it's impossible to run every single one through testing; instead, we must select a subset. Passing a test means "the selected inputs did not trigger errors," not that there are no bugs at all. Therefore, test design ultimately boils down to the question: which samples are most effective at catching bugs?

There are two main criteria for selecting samples: black-box techniques based solely on specifications (requirements), and white-box techniques based on code structure.

| | What is Observed | Representative Technique | What it Catches Well |
|---|---|---|---|
| Black-box | Input/Output Specifications | Equivalence Partitioning, Boundary Value Analysis, Decision Tables | Behaviors that deviate from requirements, missed cases |
| White-box | Code Branches/Paths | Statement, Branch, Condition Coverage | Code paths never executed |

## Black-box: Equivalence Partitioning and Boundary Values

Equivalence partitioning involves grouping inputs into sets that the program treats identically. Since any value within a set should yield the same result, we select only one representative from each group. Additionally, errors often occur at boundaries between groups—for instance, using `<=` instead of `<` in a condition—so boundary values must be tested separately.

As an example, consider a shipping fee function: 3,000 won for up to 5kg, 5,000 won for up to 20kg, and 9,000 won above that; members get half price, and weights below zero trigger an error.

```python
# shipping.py
def shipping_fee(weight_kg, is_member):
    if weight_kg <= 0:
        raise ValueError("weight must be positive")
    if weight_kg <= 5:
        fee = 3000
    elif weight_kg <= 20:
        fee = 5000
    else:
        fee = 9000
    if is_member:
        fee = fee // 2
    return fee
```

```python
# test_shipping.py
import pytest
from shipping import shipping_fee

@pytest.mark.parametrize("w, expected", [
    (0.1, 3000), (5, 3000),     # 첫 구간 안쪽, 경계
    (5.1, 5000), (20, 5000),    # 둘째 구간
    (20.1, 9000), (100, 9000),  # 셋째 구간
])
def test_fee_by_weight(w, expected):
    assert shipping_fee(w, False) == expected

def test_member_half():
    assert shipping_fee(10, True) == 2500

@pytest.mark.parametrize("w", [0, -1])
def test_invalid_weight(w):
    with pytest.raises(ValueError):
        shipping_fee(w, False)
```

Running this with `pytest` passes all 9 cases. Despite reducing the test cases to a few numbers, it covers three intervals, two boundaries, and invalid inputs. With `parametrize`, input and expected value tables are passed to the same test function body, so adding more cases does not bloat the code.

<details>
<summary>Decision Tables: When Multiple Conditions Overlap</summary>

When two or more conditions overlap, equivalence partitioning alone can easily miss combinations. A decision table uses rows for all possible true/false combinations of conditions and records the resulting output for each combination. For the above function, you'd list combinations like "Is weight ≤ 5kg × Is member" in separate rows and check for empty cells. An empty cell implies a combination not specified in the requirements, raising a question about the specification itself rather than the code.
</details>

## White-box: Coverage

Coverage is a metric measuring how much of the code has been executed by tests. Different types vary in strictness.

| Type | Criterion |
|---|---|
| Statement | Every statement executes at least once |
| Branch | Both true and false cases of every `if` execute |
| Condition | Each individual condition within `and`/`or` expressions evaluates to both true and false |

Even with 100% statement coverage, branches may remain unexecuted. I verified this directly using `sys.settrace` on a function that discounts 1,000 won if a coupon exists, tracking which lines executed.

```python
def final_price(price, coupon):
    discount = 0
    if coupon:
        discount = 1000
    return price - discount
```

| Test Input | Statements Executed |
|---|---|
| `coupon=True` only | 4 / 4 |
| `coupon=False` only | 3 / 4 |
| Both | 4 / 4 |

With just `coupon=True`, all statements execute. However, the branch where `if` is false (i.e., no coupon) never runs. If a bug exists in that path, 100% statement coverage still passes silently. This gap is created by `if` statements without an `else`. For this reason, branch coverage is often preferred as the minimum standard over statement coverage.

A key caution with coverage is interpretation: low coverage clearly signals untested code, but high coverage does not mean thorough validation. Coverage only tracks whether code executed, not whether assertions are correct. Tests without assertions can still inflate coverage metrics.

## TDD: The Order of Writing Tests

TDD is less a testing technique and more an ordering principle for development. Based on [Martin Fowler's explanation](https://martinfowler.com/bliki/TestDrivenDevelopment.html), the process is as follows: first, write a list of required tests and select one; then, write a test for the missing functionality (Red), implement just enough code to pass that test (Green), and refactor the code (Refactor). Repeat until the list is empty. The article notes that the refactoring step is most frequently skipped in practice, leading to accumulated code fragments if omitted.

I walked through an example of leap year detection. Initially, I implemented it simply by checking divisibility by 4.

```python
def is_leap(y):
    return y % 4 == 0
```

```python
from tdd import is_leap
def test_basic():   assert is_leap(2024) and not is_leap(2023)
def test_century(): assert not is_leap(1900)
def test_400():     assert is_leap(2000)
```

Rotating it causes `test_century` to fail with `assert not True` (Red). Fix the code so this test passes.

```python
def is_leap(y):
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)
```

Running it again, everything passes now (Green). The key point is fixing the code after seeing a failing test rather than using a fully completed expression from the start. You must see the failure first to know if that test truly catches the bug.

The benefit of TDD is that tests always remain; however, during the early stages when design is still unstable, tests also need frequent updates. How far to apply this varies by team.

## Test Doubles: Fakes Used Instead of Real Things

In unit tests, using real external dependencies like email sending or databases makes tests slow and unstable. Placing a fake in their place is called a test double. [Fowler's summary](https://martinfowler.com/bliki/TestDouble.html) categorizes them as follows:

| Type | Function |
|---|---|
| Dummy | Fills parameter slots but isn't actually used |
| Stub | Returns pre-determined answers only |
| Fake | Operates but uses shortcuts (e.g., in-memory DB) |
| Spy | Acts like a stub but also records how it was called |
| Mock | Defines expected calls in advance and verifies them at check time |

In Python, we create these using `unittest.mock.Mock`. We verified that if inventory drops below 5, the email-sending function is invoked.

```python
from unittest.mock import Mock

def notify_if_low(stock, mailer):
    if stock < 5:
        mailer.send("재고 부족")
        return True
    return False

mailer = Mock()
assert notify_if_low(3, mailer) is True
mailer.send.assert_called_once_with("재고 부족")

mailer2 = Mock()
assert notify_if_low(10, mailer2) is False
mailer2.send.assert_not_called()
```

It ran to completion without exceptions. Here, the verification target isn't the return value but the behavior: "Was email sent or not?" We use mocks when we need to verify results that can't be checked via return values. However, if you fixate too closely on the calling method, tests break whenever internal implementation changes. Preferably, check the result (state), and use mocks only where absolutely necessary.

## Code Review is Also a Quality Activity

If tests find issues by executing code, code review finds them by reading it. They catch different things. Tests catch runtime errors; reviews catch structural, naming, or design issues that make code hard to read. Google's [reviewer guide](https://google.github.io/eng-practices/review/reviewer/standard.html) sets the standard as follows: Approve changes that definitely improve overall code health even if not perfect, and mark trivial nitpicks with "Nit:" so authors can ignore them. Conversely, do not approve changes that clearly harm code health unless it's an emergency.

## Common Misconceptions

- Tests all passing means no bugs? Passing only reflects chosen inputs; poor sampling renders passing meaningless.
- Is 100% coverage enough? As shown above, even with 100% statement coverage, branches may be empty, and coverage rises without `assert` statements.
- More mocks mean better unit tests? Excessive mocking ties you to implementation, causing breaks during refactoring.
- Does TDD just mean writing tests first? You must go through the final refactoring step for it to be true TDD.

[Continue to "Verifiable Requirements" in [Requirements and Design](#/post/se-requirements-design)], and automatically running these tests is covered in [Version Control and CI/CD](#/post/se-cicd).

## Reference Links

- [Martin Fowler, Test Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Martin Fowler, Test Double](https://martinfowler.com/bliki/TestDouble.html)
- [Google Engineering Practices, The Standard of Code Review](https://google.github.io/eng-practices/review/reviewer/standard.html)

← Concept map ([Software Engineering Basics](#/post/cs-sw-engineering))

Related posts: [Backend Testing](#/post/be-testing) · [Development Methodology](#/post/se-methodology) · [Version Control and CI/CD](#/post/se-cicd)