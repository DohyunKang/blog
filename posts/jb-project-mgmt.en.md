The project management section may seem broad, but the exam focuses on a few calculation types: schedules involve CPM and PERT, costs use COCOMO, people relate to Brooks's Law, and operations cover ITIL terminology. Check the official site for the exam schedule and fees; here we only summarize the concepts and solution steps.

## First, the Big Picture

| Question | Tool | Solution Method |
|---|---|---|
| How long will the schedule take? | CPM | Find the longest path following predecessor relationships |
| Don't know activity durations | PERT | Calculate expected value using optimistic, most likely, and pessimistic values |
| How much do costs (personnel) amount to? | COCOMO | Input code size (KLOC) into the formula |
| Does adding people speed things up? | Brooks's Law | The number of communication paths increases |
| How is a service operated? | ITIL | Management activities like incident, problem, and change management |

If input values for sizing requirements shake, these calculations also shake. The previous step continues from [Requirements Verification and Analysis](#/post/jb-requirements).

## Schedule: CPM

CPM (Critical Path Method) plots predecessor relationships between activities on a graph and identifies the longest path as the critical path. Activities on the critical path have zero float (slack); even a one-day delay pushes the entire schedule. Activities outside the critical path have slack.

Calculations involve two passes:

1. Forward pass: Determine the earliest start (ES) and finish (EF = ES + duration) for each activity. If there are multiple predecessors, align with the latest finishing predecessor.
2. Backward pass: Starting from the project end date, calculate the latest finish (LF) and start (LS = LF - duration). If there are multiple successors, align with the earliest starting successor.
3. Slack = LS - ES. If slack is 0, it's a critical activity.

For example, I manually solved for 6 activities. Parentheses indicate duration (days), and arrows point to predecessor activities.

| Activity | Duration | Predecessors |
|---|---|---|
| A | 3 | - |
| B | 4 | A |
| C | 2 | A |
| D | 5 | B, C |
| E | 3 | C |
| F | 2 | D, E |

```python
tasks = {"A": (3, []), "B": (4, ["A"]), "C": (2, ["A"]),
         "D": (5, ["B", "C"]), "E": (3, ["C"]), "F": (2, ["D", "E"])}
es, ef = {}, {}
for t in tasks:                       # 전진
    d, pre = tasks[t]
    es[t] = max([ef[x] for x in pre], default=0)
    ef[t] = es[t] + d
end = max(ef.values())
ls, lf = {}, {}
for t in reversed(list(tasks)):       # 후진
    succ = [s for s in tasks if t in tasks[s][1]]
    lf[t] = min([ls[s] for s in succ], default=end)
    ls[t] = lf[t] - tasks[t][0]
for t in tasks:
    print(t, es[t], ef[t], ls[t], lf[t], "여유", ls[t] - es[t])
print("전체", end)
# A 0 3 0 3 여유 0
# B 3 7 3 7 여유 0
# C 3 5 5 7 여유 2
# D 7 12 7 12 여유 0
# E 5 8 9 12 여유 4
# F 12 14 12 14 여유 0
# 전체 14
```

The critical path is A-B-D-F with a total duration of 14 days. Activity C can be delayed up to 2 days, and E up to 4 days without affecting the overall schedule. Questions usually ask for "the length of the critical path" or "slack for a specific activity."

<details>
<summary>Common mistakes when solving</summary>

- In the forward pass, if there are two or more predecessors, use the largest EF, not the sum. For D above, the start is 7 because it aligns with the larger of B (7) and C (5).
- In the backward pass, if there are two or more successors, use the smallest LS. For C above, the LF is 7 because it aligns with the smaller of D (LS 7) and E (LS 9).
- There may be multiple critical paths. Do not stop after finding one line; verify all activities with zero slack.

</details>

## Schedule: PERT

PERT accepts three values when activity durations are uncertain: optimistic value (o), most likely value (m), and pessimistic value (p). Expected time is te = (o + 4m + p) / 6, and standard deviation is (p - o) / 6. The expected time for the entire path is the sum of activity expected times, and the path's standard deviation is the square root of the sum of squared activity standard deviations.

```python
o, m, p = 2, 4, 12
print((o + 4*m + p) / 6)   # 5.0
print((p - o) / 6)         # 1.666...
```

With optimistic 2, most likely 4, and pessimistic 12, the expected duration is 5 days. The value being larger than the most likely one occurs because the pessimistic tail is long. Remember: CPM treats duration as a fixed value, while PERT treats it probabilistically.

## Cost: COCOMO

COCOMO is a model for estimating effort (person-months) based on code size. The Basic Model formulas are:

- Effort E = a × (KLOC)^b (person-months)
- Development duration D = 2.5 × E^c (months)
- Average personnel P = E / D

Coefficients vary by project type.

| Type | a | b | c |
|---|---|---|---|
| Organic | 2.4 | 1.05 | 0.38 |
| Semi-detached | 3.0 | 1.12 | 0.35 |
| Embedded | 3.6 | 1.20 | 0.32 |

I tested how results change for the same 10 KLOC when the type changes.

```python
for name, a, b, c in (("조직형", 2.4, 1.05, 0.38),
                      ("반분리형", 3.0, 1.12, 0.35),
                      ("내장형", 3.6, 1.20, 0.32)):
    e = a * 10**b
    d = 2.5 * e**c
    print(name, round(e, 1), round(d, 1), round(e / d, 1))
# 조직형 26.9 8.7 3.1
# 반분리형 39.5 9.1 4.4
# 내장형 57.1 9.1 6.3
```

Effort ranges from 26.9 person-months for Organic to 57.1 person-months for Embedded—more than double—but duration stays around 9 months due to the small exponent c in the duration formula, which means effort increases slowly over time. Exams usually ask forms like "effort for 10 KLOC Organic," so memorizing coefficients is priority. If you cannot use a calculator, do not approximate the b exponent; use the value given in the problem directly.

<details>
<summary>Distinguishing Basic, Intermediate, and Detailed Models</summary>

The basic model is the simplest form, considering only size and type. The intermediate (Intermediate) model multiplies this by an Effort Adjustment Factor (EAF) that reflects cost factors such as products, personnel, environment, and others. The usage of a·b·c remains the same. Although the detailed model is known to be subdivided step-by-step, the exam focuses on the formulas and coefficients of the basic model.

</details>

A similar concept involves measuring the number of functions instead of lines of code (Function Points). Only the metric for "size" changes; the flow from "size → effort" remains the same.

## People: Brooks's Law

Brooks's Law states that adding manpower to a late software project makes it later. This is explained by three reasons: tasks cannot be completely divided into independent pieces, new members must first learn while consuming existing team members' time, and increasing the number of people rapidly increases communication paths. The number of communication paths among n people is n(n-1)/2.

```python
print(10*9//2, 50*49//2)  # 45 1225
```

For 10 people, there are 45 paths; for 50 people, there are 1,225 paths. A common exam question asks for the "number of communication paths given n people."

## Service Operations: ITIL

ITIL is a collection of best practices for IT service management. The 3rd edition grouped processes and functions into five volumes centered on the service lifecycle. The 4th edition (2019) expanded beyond IT-only service management to align with Agile, DevOps, and Lean. Exams often feature questions distinguishing the meanings of individual management activities.

| Term | One-liner Definition |
|---|---|
| Incident Management | Restoring normal service quickly from outages or failures |
| Problem Management | Identifying root causes of incidents to prevent recurrence |
| Change Management | Controlling changes to manage their impact on services. The 4th edition name is "change enablement" |

Remember: Incidents are about "restoration first," while Problems are about "finding the cause." Change management is similar in name to configuration change control in [Configuration Management and Build/Release](#/post/jb-build-release), but ITIL focuses on the service operations perspective.

## Common Misconceptions

- In CPM, the critical path is the longest path, not the shortest. The longest path determines the total duration.
- Effort and duration in COCOMO are not proportional. Doubling effort only increases duration by a factor of c (exponent).
- Calculations suggesting that adding people shortens schedules are valid only when work can be divided into independent pieces. Software development generally does not allow this.
- Incidents and Problems are distinct. Incidents require restoration; Problems require root cause elimination.

## Conclusion

Practicing the three types of calculation problems (CPM forward/backward pass, PERT expected value, COCOMO formula) by hand once ensures you remember the formulas during the exam. Memorize the rest using tables. The preceding and following units connect with [Software Testing](#/post/jb-testing) and [New Technologies and IT Terms](#/post/jb-it-trend).

← [Concept Map](#/post/jb-map)

Related articles: [Requirements Verification and Analysis](#/post/jb-requirements) · [Configuration Management and Build/Release](#/post/jb-build-release) · [Software Testing](#/post/jb-testing)

## Reference Links

- [COCOMO — Wikipedia](https://en.wikipedia.org/wiki/COCOMO)
- [Critical path method — Wikipedia](https://en.wikipedia.org/wiki/Critical_path_method)
- [Program evaluation and review technique — Wikipedia](https://en.wikipedia.org/wiki/Program_evaluation_and_review_technique)
- [The Mythical Man-Month — Wikipedia](https://en.wikipedia.org/wiki/The_Mythical_Man-Month)
- [ITIL — Wikipedia](https://en.wikipedia.org/wiki/ITIL)