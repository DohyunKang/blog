[Overview](#/post/cs-sw-engineering) briefly touched on the Waterfall and Agile models. This time, we delve deeper into what methodologies precisely define, and how Waterfall, Spiral, Scrum, XP, and Kanban differ from one another.

## What Methodologies Define

Methodologies ultimately define three things: the unit in which work is broken down, how frequently verification and correction occur, and who is responsible for what. Stage names (Requirements, Design, Implementation, Testing) are almost identical. The difference lies in whether a stage is executed once, iterated multiple times briefly, or viewed as a flow without a stage framework at all.

| | Number of Iterations | Verification Cycle | Core Focus |
|---|---|---|---|
| Waterfall | Once | At the end of each stage | Planning & Documentation |
| Spiral | Multiple times | Each loop | Risk |
| Scrum | Per Sprint | Per Sprint | Fixed cycles and roles |
| XP | Very briefly | Continuously at code level | Coding practices |
| Kanban | No fixed cycle | When items are completed | Flow and work-in-progress count |

## Waterfall: The Original Paper Was Different

The name "Waterfall" and the image of falling from top to bottom originated in a 1970 paper by Winston Royce. However, Wikipedia's summary indicates that Royce did not advocate for this sequential approach as-is. He reported that a structure with testing only at the very end was risky and led to failure, adding several stages to mitigate risk. His final model included feedback loops returning from code testing to design, and from design to requirements. It also includes leaving sufficient documentation, planning tests, and involving customers.

Thus, the image of "Waterfall = a model you cannot go back from" is closer to the result of one popularized diagram than the original paper. It remains useful for work where requirements are fixed and unlikely to change.

[Learn more → Requirements and Design](#/post/se-requirements-design)

## Spiral: Risk Determines the Sequence

The Spiral model proposed by Barry Boehm in a 1986 paper is risk-driven. Each loop involves four steps:

1. Identify stakeholders' goals
2. Find and evaluate alternatives to achieve those goals
3. Identify and resolve risks of the chosen approach
4. Obtain stakeholder approval and agreement on the next loop

If risk is high, prototypes are created; if low, one can proceed with a Waterfall-style approach. Wikipedia's explanation suggests viewing Waterfall as a special case of the Spiral model. If requirements are stable and risk is low, a Spiral model ending in one loop is essentially Waterfall. Conversely, repeating Waterfall multiple times when requirements are unstable may look like a Spiral but is considered risky, according to Boehm's warning. The core of the Spiral model is not "iterating," but rather "assessing risks and choosing the next action."

## Scrum: Fixed Cycles and Three Commitments

The [Scrum Guide](https://scrumguides.org/scrum-guide.html) stands on empiricism. Its three pillars are Transparency (work and process are visible), Inspection (frequent verification), and Adaptation (immediate correction if deviated). A Sprint is a fixed period of less than a month, followed immediately by the next Sprint.

A notable part in the guide is that each deliverable has an associated commitment:

| Deliverable | Attached Commitment |
|---|---|
| Product Backlog | Product Goal |
| Sprint Backlog | Sprint Goal |
| Increment | Definition of Done |

Items not satisfying the Definition of Done are not counted as part of the Increment. This mechanism prevents counting "almost done" as progress. The Sprint Goal fixes only one goal, leaving room to change detailed tasks needed to achieve it. Among roles, the Product Owner is a single individual, not a committee, and they alone can cancel a Sprint. However, this is only permitted when the Sprint Goal becomes obsolete.

<details>
<summary>Values and Role Responsibilities in the Scrum Guide</summary>

The values are Commitment, Focus, Openness, Respect, and Courage (five items). The entire Scrum team is responsible for valuable and useful Increments each Sprint. Developers create the Sprint Backlog, adhere to the Definition of Done, and adjust plans daily. The Scrum Master coaches the Scrum to function properly, removes impediments, and ensures events conclude within their timeboxes.
</details>

## XP: Digging into Code

While Scrum defines schedules and roles, XP (Extreme Programming) defines coding styles. Based on Wikipedia's summary, values are Communication, Simplicity, Feedback, Courage, and Respect (added in the 2nd edition), and there are twelve practices.

- **Fast Feedback**: Pair programming, Planning games, Test-driven development, Whole team
- **Uninterrupted Flow**: Continuous integration, Refactoring, Small releases
- **Shared Understanding**: Coding standards, Collective code ownership, Simple design, System metaphors
- **People**: Sustainable pace

Scrum and XP are not competitors; they operate at different levels. Scrum addresses "how to run work within a framework," while XP focuses on "how to write code," so they are often used together. Test-driven development and continuous integration are covered separately in [Testing and Quality](#/post/se-testing) and [Version Control and CI/CD](#/post/se-cicd).

## Kanban: No Fixed Cycle, Counting Items

The [Kanban Guide](https://kanbanguides.org/english/) defines Kanban as "a strategy to optimize the flow of value through a process." There are three practices: define and make work visible, actively manage work in progress (WIP), and improve flow.

Unlike sprints with fixed cycles, Kanban sets up these elements instead:

- Start points, end points, and states in between
- How to control the number of items in progress (WIP)
- Service Level Expectations (SLE): values like "85% of items will be completed within N days," predicted based on past cycle times

Controlling WIP naturally leads to a pull system. New work is only started when there is space, i.e., when the number of in-progress items drops below the defined limit. The Kanban Guide insists on using four metrics: WIP (number of started but not finished items), throughput (number of completed items per unit time), age of work items (time elapsed since an item was started), and cycle time (time from start to finish).

### What Changes When We Reduce WIP?

I wanted to see directly with numbers why the guide recommends controlling WIP, so I ran a very simple model in Python. The team capacity is 3 person-days per day, and there are 20 items, each requiring 3 person-days. Capacity is shared equally among in-progress items, and only as many items are started simultaneously as allowed by the WIP limit.

```python
def run(wip, n=20, size=3, cap=3):
    remaining = {}
    start, done = {}, {}
    nxt, day = 0, 0
    while len(done) < n:
        while len(remaining) < wip and nxt < n:   # 자리가 나야 시작
            remaining[nxt] = size; start[nxt] = day; nxt += 1
        day += 1
        share = cap / len(remaining)              # 진행 중인 항목에 용량을 똑같이 나눔
        for i in list(remaining):
            remaining[i] -= share
            if remaining[i] <= 1e-9:
                del remaining[i]; done[i] = day
    ct = [done[i] - start[i] for i in range(n)]
    return day, sum(ct) / n, n / day

for w in (1, 3, 6, 20):
    d, ct, th = run(w)
    print(w, d, round(ct, 2), round(th, 2))
```

The execution results were as follows:

| WIP Limit | Total Duration | Average Cycle Time | Throughput |
|---|---|---|---|
| 1 | 20 days | 1.00 day | 1.00 item/day |
| 3 | 20 days | 2.90 days | 1.00 item/day |
| 6 | 20 days | 5.60 days | 1.00 item/day |
| 20 | 20 days | 20.00 days | 1.00 item/day |

Throughput and total duration remain constant, but cycle time increases almost proportionally with WIP. The time to finish everything is the same, but if WIP is set to 20, all 20 items finish only on the last day. If done one by one, the first item comes out in a day. When WIP is 3, the average cycle time is 2.9 days because there is a period where the remaining items decrease and WIP drops below 3. This model does not account for capacity waste or context switching costs. In reality, increasing concurrency would incur switching costs, reducing throughput, but that lies outside the scope shown by this code.

## Common Misconceptions

- Is Scrum Agile? Scrum is one framework for practicing Agile principles. Kanban and XP belong to the same side.
- Is Kanban just about using a Kanban board? The guide describes a board as the result of making work flow definition visible. Simply attaching a board without defining flow and controlling WIP makes it hard to call it Kanban.
- Is the Spiral Model just Waterfall repeated multiple times? Boehm himself said not to view it that way.
- Does Waterfall lack feedback? Royce's final model includes a feedback loop.

## Reference Links

- [Waterfall model (Wikipedia)](https://en.wikipedia.org/wiki/Waterfall_model)
- [Spiral model (Wikipedia)](https://en.wikipedia.org/wiki/Spiral_model)
- [Scrum Guide](https://scrumguides.org/scrum-guide.html)
- [Extreme programming (Wikipedia)](https://en.wikipedia.org/wiki/Extreme_programming)
- [Kanban Guide](https://kanbanguides.org/english/)

← Concept Map ([CS & Design Fundamentals Map](#/post/cs-map))

Related posts: [Software Engineering Basics](#/post/cs-sw-engineering) · [Testing and Quality](#/post/se-testing) · [Version Control and CI/CD](#/post/se-cicd)