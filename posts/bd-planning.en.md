In the Big Data Analysis Engineer written exam syllabus, the "Data Analysis Planning" section consists of two main parts: Analysis Strategy Formulation (Analysis Roadmap Setup, Analysis Problem Definition, and Data Analysis Approach) and Analysis Task Planning (Data Acquisition Plan and Analysis Procedure & Task Plan). Since this stage determines what problem to solve before starting the analysis, in what order to proceed, and how to handle data and risks, questions focus more on terminology and sequence than on calculations. You can check the exam schedule and registration fee on the official website. This article summarizes key concepts by section, common pitfalls in multiple-choice questions, and solution approaches.

If you have already read ADsP, there will be significant overlap. Task identification and prioritization are covered in detail in [Analysis Tasks and Masterplan](#/post/adsp-task-masterplan), while the overall methodology is organized separately in [Analysis Methodology](#/post/adsp-methodology). This article reorganizes the content according to the Big Data Analysis Engineer syllabus structure.

## Overview at a Glance

| Section | What is Asked | Keywords |
|---|---|---|
| Analysis Problem Definition | What task should be solved? | Top-down, Bottom-up, Use Case |
| Analysis Roadmap | In what order should it be done? | Urgency, Difficulty, Three-Stage Implementation |
| Analysis Procedure | What stages are involved? | 5-Step Methodology, Tasks, Deliverables |
| Data Acquisition Plan | How to obtain necessary data? | Required Data Definition, Collection, Consistency |
| Risk Plan | What if problems arise? | Identification, Avoidance/Transfer/Mitigation/Acceptance |

## Analysis Problem Definition

There are two main ways to identify tasks.

| | Top-down | Bottom-up |
|---|---|---|
| Starting Point | The problem to be solved already exists | Start with data without knowing the problem |
| Application Context | When the analysis target is clear | When seeking new insights |
| Process | Problem Exploration → Problem Definition → Solution Exploration → Feasibility Review | Hypothesis Generation → Experimentation → Real-world Environment Testing → Hypothesis Verification |

Top-down approaches are further divided into business model-based and external reference model-based problem exploration.

Three factors should be considered in advance during the analysis planning stage: available data, appropriate use cases, and obstacles. Obstacles include cost, accuracy, organizational capability, and change management.

<details>
<summary>Four Solution Approaches: Combination of Existing Systems and Analytical Capabilities</summary>

The method to solve a task depends on whether an existing system is available and whether analytical capabilities exist.

| Existing System | Analytical Capability | Direction |
|---|---|---|
| Exists | Exists | Leverage existing system and personnel |
| Exists | Does not exist | Train or hire |
| Does not exist | Exists | Upgrade the system |
| Does not exist | Does not exist | Outsource to specialized vendors |

</details>

## Analysis Roadmap: Determining Sequence

Tasks found cannot all be executed at once, so prioritization is necessary. Considerations include strategic importance, business performance (ROI), and ease of execution. Plotting these on two axes yields Urgency and Difficulty.

| Axis | What to Consider | ROI Perspective |
|---|---|---|
| Urgency | Connection to strategic goals, value of KPI targets. Is it needed now or later? | Business Impact |
| Difficulty | Data acquisition/storage/processing costs, analysis application costs, analysis level | Investment Cost |

Multiplying these two axes results in four quadrants.

| Urgency | Difficulty | Sequence |
|---|---|---|
| Current | Easy | Do first |
| Current | Difficult | Second if urgency is prioritized |
| Future | Easy | Second if difficulty is prioritized |
| Future | Difficult | Do last |

The order of the middle two quadrants changes depending on whether urgency or difficulty is prioritized. Since quadrant numbers (I~IV) vary across materials, it is safer to remember them by their attributes (Urgency and Difficulty) rather than memorizing specific numbers. Tasks that are currently needed but difficult can be applied first after reducing data volume or analysis scope to lower the difficulty level.

Translating this sequence rule into pandas yields the following structure. This follows an urgency-first criterion and has been verified through direct execution.

```python
import pandas as pd

tasks = pd.DataFrame({
    "과제": ["이탈 예측", "재고 수요 예측", "고객 군집", "챗봇 로그 분석"],
    "시급성": ["미래", "현재", "미래", "현재"],
    "난이도": ["어려움", "어려움", "쉬움", "쉬움"],
})

# 시급성 우선: 현재가 먼저, 같으면 쉬운 것이 먼저
tasks["u"] = tasks["시급성"].map({"현재": 0, "미래": 1})
tasks["d"] = tasks["난이도"].map({"쉬움": 0, "어려움": 1})
tasks = tasks.sort_values(["u", "d"]).drop(columns=["u", "d"]).reset_index(drop=True)
tasks.index += 1
print(tasks)
```

The execution results are as follows:

```
         과제 시급성  난이도
1  챗봇 로그 분석  현재   쉬움
2  재고 수요 예측  현재  어려움
3     고객 군집  미래   쉬움
4     이탈 예측  미래  어려움
```

To change the criterion to prioritize difficulty, simply swap the positions of 'u' and 'd' in the sort keys. Although code does not appear on the exam, understanding that the order of axes in the sort key determines the sequence makes it easy to understand why the middle two quadrants change.

The roadmap is organized into three stages of implementation:

| Stage | Content |
|---|---|
| 1. Introduction of Data Analysis Framework | Discovery of analysis opportunities, task definition, roadmap formulation |
| 2. Validation of Data Analysis Effectiveness | Design of analysis algorithms, architecture design, pilot execution |
| 3. Expansion and Advancement of Data Analysis | Change management, system construction, advancement of related systems |

Scope and approach are determined by considering the level of business internalization, the scope of data application (whether using only internal data or expanding to external/unstructured data), and the level of technology adoption (leveraging existing technologies versus introducing new ones). Detailed implementation plans often follow a hybrid approach: data collection and preparation are done sequentially, while only the modeling stage is iterative, as analysis involves repeated refinement.

There are also two distinct approaches. The **project-centric** approach focuses on Speed & Test, Quick-Win, and Problem Solving, whereas the **master plan** approach emphasizes Accuracy & Deploy, Long Term View, and Problem Definition. Since keywords often appear swapped between options, remember that the left three items relate to speed, while the right three relate to long-term perspective.

## Analysis Procedure: 5-Step Methodology

In the analysis work plan, the analysis procedure is treated as a five-step methodology. The hierarchy follows Phase → Task → Step. A phase produces deliverables; a task consists of unit activities within a phase; and a step comprises a unit process made up of input, processing, and output.

| Order | Phase | Key Tasks | Key Deliverables |
|---|---|---|---|
| 1 | Analysis Planning | Business understanding & scope definition, Project definition & planning, Project risk planning | Project Scope Statement (SOW), Project Plan |
| 2 | Data Preparation | Required data definition, Data store design, Data collection & integrity check | Data Definition Document, Data Store |
| 3 | Data Analysis | Preparation of analysis data, Text analysis, Exploratory analysis, Modeling, Model evaluation & validation | Analysis dataset, Model evaluation report |
| 4 | System Implementation | Design & implementation, System testing & operation | System design document, Operations manual |
| 5 | Evaluation & Deployment | Model evolution plan formulation, Project evaluation & reporting | Model evolution plan, Final report |

Analysis planning comes first, preceding data preparation. System implementation occurs before evaluation and deployment. Each phase is treated as a baseline and controlled via version management. When examining the tasks and steps within the analysis planning phase specifically, they are as follows:

| Task | Step |
|---|---|
| Business understanding & scope definition | Business understanding → Project scope definition (SOW creation) |
| Project definition & planning | Data analysis project definition → Execution plan formulation |
| Project risk planning | Data analysis risk identification → Risk response plan formulation |

You can compare this with other methodologies like CRISP-DM or KDD by referring to [Details → Analysis Methodology](#/post/adsp-methodology).

## Data Acquisition Plan

In the table of contents, the data acquisition plan appears under the analysis work plan and defines how necessary data will be acquired. When mapped to the five-step methodology, it connects with the tasks in Phase 2 (Data Preparation): required data definition, data store design, and data collection & integrity check. Therefore, options suggesting that required data definition and data store design belong to the Analysis Planning phase are incorrect. The data acquisition plan is established during analysis planning, but the actual tasks of defining required data and designing the store belong to the Data Preparation phase.

Collection methods (scraping, ETL, API, log collection) and storage solutions are covered separately in the next chapter: [Details → Data Collection and Storage](#/post/bd-collection-storage).

## Risk Planning

The project risk planning task consists of two steps: first, identify data analysis risks; second, formulate a response plan. There are four response strategies:

| Response | Meaning |
|---|---|
| Avoid | Eliminate or avoid the risk factor itself |
| Transfer | Shift responsibility or impact of the risk to a third party |
| Mitigate | Reduce the likelihood or impact of the risk |
| Accept | Accept the risk and bear its consequences as is |

Management (Management) is not a type of response strategy. If an option includes "Risk Management" as a response method, it is incorrect.

<details>
<summary>Response Strategy Matching Practice: Example Scenarios</summary>

Creating an example scenario helps distinguish the four strategies quickly. This is for illustration only and unrelated to actual exam questions.

| Risk | Response | Reason |
|---|---|---|
| Data mixed with personal information | Avoid | Do not use that data at all |
| Data loading may be delayed | Mitigate | Build buffer time into the schedule and load part of the data early |
| Model accuracy may fall short of target | Accept | Proceed as planned and report the results |
| Shortage of analysis personnel | Transfer | Outsource to an external vendor |

</details>

## Where is WBS Used?

WBS (Work Breakdown Structure) is created during the project execution planning step of the project definition and planning establishment tasks. It is established along with schedule, personnel, and budget plans. The methodology's steps correspond to WBS work packages. Defining analysis topics or formulating modeling approaches is not part of the WBS creation phase.

## Common Mistakes

- Treating necessary data definition or data store design as a task in the analysis planning phase; this belongs to the data preparation phase.
- Including risk response management methods; there are four: avoidance, transfer, mitigation, and acceptance.
- Swapping keywords between project-centric and master plan perspectives.
- Memorizing quadrant numbers solely based on urgency and difficulty order, which varies by material.
- Mixing up the order of the top-down four-step process: problem exploration, problem definition, solution exploration, and feasibility review.
- Altering the sequence of the five methodology steps: analysis planning, data preparation, data analysis, system implementation, and evaluation and deployment.

Practice questions list only the points where options diverge from the original text without copying it verbatim. The solving approach involves first writing down a five-step table and then checking which step each task in the options belongs to. Risk response is simply memorizing four terms.

Next is [Details → Data Collection and Storage](#/post/bd-collection-storage).

---

← Concept map ([Big Data Analysis Engineer Map](#/post/bd-map))

Related posts: [Big Data Overview and Utilization](#/post/bd-overview) · [Analysis Methodology](#/post/adsp-methodology) · [Analysis Tasks and Master Plan](#/post/adsp-task-masterplan)

## Reference Links

- Big Data Analysis Engineer Textbook (IT Wiki): https://itwiki.kr/w/빅데이터분석기사_교본
- Big Data Analysis Methodology (IT Wiki): https://itwiki.kr/w/빅데이터 분석 방법론
- Analysis Master Plan (IT Wiki): https://itwiki.kr/w/분석 마스터 플랜