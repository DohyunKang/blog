The software testing unit is full of terms that are hard to memorize, but if you divide them into three axes, you can find their place in most cases: whether you look inside the code (White-box vs. Black-box), at which stage you test (Test Level), and how much of the code you have scanned (Coverage). Check the exam schedule and fees on the official site; here, we only organize concepts and problem-solving methods.

## First, the Big Picture

| Axis | Question | Representative Terms |
|---|---|---|
| Approach | Do you look inside the code? | White-box, Black-box |
| Stage | What scope do you bundle to examine? | Unit, Integration, System, Acceptance |
| Metric | How much of the code was executed? | Statement, Decision, Condition, MC/DC Coverage |

[If you want to see requirements first → Requirements Analysis](#/post/jb-requirements)

## Black-box and White-box

Black-box testing creates cases based on "if this input, then that output" without knowing the implementation. It is specification-based, so most of it is functional testing, and it is usually not used at the unit level. White-box testing is the opposite: you examine the internal structure and code, selecting inputs to traverse code paths. It is also called structure-based or glass-box testing. If a feature exists in the specification but is missing in the implementation, it is difficult to catch with white-box testing alone.

### Black-box Techniques

In exams, techniques are often asked by pairing their names with one-line descriptions to memorize.

| Technique | One-liner |
|---|---|
| Equivalence Partitioning | Divide inputs into segments treated together and use only one representative value per segment |
| Boundary Value Analysis | Use values at the boundaries of a segment and immediately before/after them |
| Cause-Effect Graphing | Create a graph or decision table showing the relationship between input (cause) and output (effect) |
| Error Guessing | Point out places where errors are likely to occur based on experience |
| State Transition | Create cases using state and event flow |
| Comparison Testing | Compare results by feeding the same inputs into multiple implementations |

If you view the rule as "pass if score is 60 or above," equivalence partitioning divides it into two segments: "59 or below" and "60 or above." Boundary values use 59, 60, and 61. In code terms, it looks like this:

```python
def grade(score, bonus):
    if score >= 60 and bonus:
        return "A"
    if score >= 60:
        return "B"
    return "C"

for s in (59, 60, 61):
    print(s, grade(s, False))
# 59 C
# 60 B
# 61 B
```

The point where the result changes at the boundary is 60, which is immediately apparent from the two values 59 and 60. This is why boundary value analysis is good at catching bugs where `>=` is mistakenly written as `>`.

### White-box Techniques

White-box testing sounds almost synonymous with "coverage criteria." The technique name becomes the criterion for how you scan the code. We continue this in the Coverage section below. Among the techniques, basic path testing also appears. Independent paths are extracted from a control flow graph to test, and the baseline for the number of such paths is cyclomatic complexity.

<details>
<summary>Cyclomatic Complexity Calculation</summary>

Cyclomatic complexity V is calculated as V = E - N + 2 (number of edges minus number of nodes plus 2) in a control flow graph. For simple structures with decision (branch) nodes, it equals the number of decision statements plus 1. The above `grade` function has two if statements, so V = 3, and there are also three independent paths (paths ending at A, B, and C). Problems usually appear in the form of drawing a graph and asking for V.

</details>

## Test Levels

It is easy to organize by pairing them with development stages.

| Level | Scope | Keywords |
|---|---|---|
| Unit | One module or function | Driver, Stub |
| Integration | Interfaces between modules | Bottom-up, Top-down, Big Bang |
| System | Entire system | Functional, Performance, Security |
| Acceptance | Based on user/customer criteria | Alpha, Beta |

Unit testing checks whether isolated code operates as expected; if surrounding modules are not yet available, fakes are needed to substitute them. A driver mimics the caller, while a stub mimics the callee. In integration testing, top-down requires stubs and bottom-up requires drivers—a pairing that frequently appears in exams. This direction is not confusing if you recall the hierarchical structure seen in [Architecture Patterns](#/post/jb-architecture-pattern).

Acceptance testing is the stage where users verify whether requirements are met. It is divided into Alpha, tested by users in a developer environment, and Beta, tested by actual users in a real environment.

There are also other terms that appear only by name:

- Regression Testing: Re-checking to ensure existing functionality is not broken after modifications
- Smoke Testing: Quickly checking if the build runs by default
- Performance, Load, Stress Testing: Checking throughput and limits

Regression and smoke tests are often run automatically in environments where builds occur frequently. The flow continues when viewed alongside [Version Control and Build/Deployment](#/post/jb-build-release).

## Coverage

Coverage is a metric of how much code the test has executed. As criteria become stricter, more cases are required.

| Criterion | Satisfaction Condition |
|---|---|
| Statement (Sentence) | Every statement is executed at least once |
| Decision (Branch) | Every decision's result is true or false at least once respectively |
| Condition | Each individual condition within a judgment is true or false at least once respectively |
| Condition/Decision | Satisfies both decision coverage and condition coverage |
| Modified Condition/Decision (MC/DC) | Demonstrates that each condition independently changes the result |
| Multiple Conditions | All combinations of conditions |

MC/DC is known to be often required in safety-critical fields such as aviation. Path coverage is a criterion that traverses all possible paths.

### Comparison with the Same Function

The most confusing point in exams is usually the difference between condition coverage and decision coverage, so I ran a direct test using the `grade` function.

```python
# 결정 커버리지: 두 if가 각각 참/거짓이 되게
dec = [(70, True), (70, False), (50, False)]
print([grade(*c) for c in dec])   # ['A', 'B', 'C']

# 조건만 맞춘 두 케이스: score>=60 이 T/F, bonus 가 T/F
cond = [(70, False), (50, True)]
print([grade(*c) for c in cond])  # ['B', 'C']
```

In the second case group, since both `score >= 60` and `bonus` experienced true and false respectively, condition coverage is satisfied. However, the entire condition expression of the first if (`score >= 60 and bonus`) was never true even once. This means no one traversed the path that results in "A". Satisfying condition coverage does not mean decision coverage is achieved; therefore, there is a separate criterion combining both called condition/decision coverage.

<details>
<summary>Tips for Solving</summary>

Coverage problems usually present code or flowcharts and ask questions like "Which criterion does this test set satisfy?" or "What is the minimum number of cases needed for statement coverage?". The order of steps is as follows:

1. Create a table listing inputs that make each judgment true or false.
2. Substitute each given case one by one to mark whether statements, branches, and conditions were traversed.
3. If any cell is missing, that criterion is not satisfied.
4. To count the minimum number of cases, group them so that true/false paths do not overlap.

In the above `grade` example, statement coverage with just the `(70, True)` case passes through A in the first if but cannot reach statements B and C; thus, 3 cases are needed to traverse all A, B, and C. Direct substitution is faster than memorizing these rules.

</details>

## Common Misconceptions

- Achieving 100% coverage does not mean there are no bugs. Coverage indicates whether code was executed, not whether expected results were verified.
- Black-box testing is not a weak test due to ignorance of the code; it is simply an approach based on specifications. Missing features are actually caught by black-box testing.
- Drivers and Stubs can be easily confused. Remember: if called from above, it's a driver; if called from below, it's a stub.

## Conclusion

Instead of memorizing all concepts, keep three tables in mind while solving problems. When code is presented, directly substitute cases to analyze them.

← [Concept Map](#/post/jb-map)

Related posts: [Software Design and Requirements](#/post/jb-requirements) · [Version Control and Build/Release](#/post/jb-build-release) · [Design Patterns](#/post/jb-design-pattern)

## Reference Links

- [Code coverage — Wikipedia](https://en.wikipedia.org/wiki/Code_coverage)
- [Software testing — Wikipedia](https://en.wikipedia.org/wiki/Software_testing)