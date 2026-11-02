ADsP Course 2 (Data Analysis Planning) covers the entire process from project discovery to master plan, governance, maturity, and project management. Since there are no calculation problems, but rather questions testing precise understanding of terminology and classifications, organizing this into a table makes it easier to eliminate incorrect options. For exam schedules and registration details, please check the official website.

The previous unit covers [Understanding Analysis Planning](#/post/adsp-planning) and [Analysis Methodology](#/post/adsp-methodology). While those sections classified types based on analysis targets and methods, this article focuses on determining the actual execution sequence for projects derived from that classification.

## How to Find Projects

There are two approaches to finding projects:

| | Top-Down | Bottom-Up |
|---|---|---|
| Starting Point | The problem to be solved already exists | You look at data without knowing the specific problem |
| Application Context | When the analysis target is clear | When seeking new insights |
| Process | Problem Exploration → Problem Definition → Solution Exploration → Feasibility Review | Hypothesis Generation → Experimentation → Real-world Environment Testing → Hypothesis Verification |
| Tools | Business Models, External Reference Models | Exploratory Data Analysis, Unsupervised Learning, Prototyping |

Top-down problem exploration is further divided into two: a Business Model approach focusing on internal operations, products, and customers, and an External Reference Model approach referencing similar industries. Exploration results are summarized as analysis use cases (problem description and expected benefits upon resolution). The flow involves converting these use cases into data analysis problems and evaluating their suitability. During the final feasibility review, both economic viability and the applicability of data and technology are assessed together.

Three items should be considered in advance during the analysis planning stage: available data, appropriate use cases, and pre-planning for obstacles (costs, accuracy, organizational capability, change management). Note that "available personnel" is not included in these three categories; if it appears among the options, proceed with caution.

<details>
<summary>Four Solution Approaches: System and Capability Combinations</summary>

The method to solve a project depends on whether an existing system is available and whether analysis capabilities exist.

| Existing System | Analysis Capability | Direction |
|---|---|---|
| Exists | Exists | Leverage existing system and personnel |
| Exists | Does not exist | Train or hire |
| Does not exist | Exists | Upgrade the system |
| Does not exist | Does not exist | Outsource to a specialized vendor |

</details>

## Priority: Urgency and Difficulty

Since all identified projects cannot be executed at once, a sequence must be established. The criteria are based on two axes:

| Axis | Focus |
|---|---|
| Urgency | Strategic importance, target value. Is it needed now or later? |
| Difficulty | Data acquisition/storage/processing costs, analysis implementation costs, level of analysis required |

Multiplying these two axes yields four quadrants:

| Urgency | Difficulty | Note |
|---|---|---|
| Current | Easy | Do first |
| Current | Difficult | Second if urgency is prioritized |
| Future | Easy | Second if difficulty is prioritized |
| Future | Difficult | Do last |

The order of the middle two quadrants changes depending on whether urgency or difficulty is prioritized. One reference material (IT Wiki) noted that for urgency-first prioritization, the quadrant order is III → IV → II → I, while for difficulty-first it is III → II → IV → I. However, since numbering conventions vary by source, remember them based on their attributes rather than fixed numbers. Therefore, when memorizing, focus on "Current & Easy as top priority, Future & Difficult as last." If a quadrant diagram appears in the question, check the axis names first, not the numbers.

The core criterion is urgency. Difficulty can be adjusted according to company circumstances. For projects that are currently needed but difficult, you might reduce the data volume or analysis scope to lower the difficulty before tackling them.

## Master Plan and Roadmap

A master plan outlines when and in what order confirmed projects will be executed. Factors considered when setting priorities include strategic importance, business performance (ROI), and ease of execution.

When determining the scope and approach, three elements are evaluated:

| Element | Distinguishing Question |
|---|---|
| Business Integration | Is it provided via reports/screens, or embedded into business processes and systems for automated use? |
| Analysis Data | Does it use only internal data, or does it expand to include external and unstructured data? |
| Technology | Does it rely on existing systems and technology, or introduce new analysis/big data technologies? |

The implementation roadmap consists of three stages:

1.  **Introduction of Data Analysis Framework:** Discovery of analysis opportunities, project definition, and roadmap formulation.
2.  **Validation of Data Analysis Effectiveness:** Algorithm design, architecture design, and pilot execution.
3.  **Expansion and Advancement of Data Analysis:** Change management, system construction, and enhancement of related systems.

The core sequence is to verify effectiveness via a pilot first, then expand. Items such as data anonymization do not fall under these consideration factors.

## Governance Framework

Analysis governance is the framework through which an organization manages continuous analysis execution and its integration into business operations. The framework consists of five components.

| Element | Content |
|---|---|
| Organization | Position and structure of the analysis planning and management organization |
| Process | Procedures for project discovery, planning, execution, and management |
| System | IT systems and tools used for analysis |
| Data | Standardization, quality, and security management (data governance) |
| Human Resource | Staffing acquisition, role definition, and training system |

Data governance is one component within the broader analytics governance. Any option that equates the two terms is incorrect.

The organizational structure for analytics is divided into three types.

| Type | Characteristics | Weaknesses |
|---|---|---|
| Centralized | A dedicated organization handles enterprise-wide analysis | May overlap with business operations |
| Function-based | Business units conduct analysis directly without a separate organization | Difficult to perform core enterprise-level analysis |
| Decentralized | Analytical personnel are deployed to business units | Sharing best practices becomes easier |

Project management follows the sequence of project discovery (idea generation → candidate proposal → project confirmation) and project execution (team formation → execution → progress management → result sharing & improvement). Outputs and experiences are collected into a pool for reuse in subsequent projects.

## Readiness and Maturity

The current analytics level of an organization is diagnosed using two dimensions.

Readiness evaluates six areas: analytical work, personnel and organization, analytical techniques, analytical data, analytical culture, and IT infrastructure. Maturity assesses which stage—Introduction → Utilization → Expansion → Optimization—the business, organizational/capability, and IT sectors have reached.

Dividing readiness and maturity into high/low categories yields four types.

| Type | Readiness | Maturity | Direction |
|---|---|---|---|
| Preparation | Low | Low | Start with analysis preparation |
| Establishment | Low | High | Already analyzing; systematically establish the framework |
| Introduction | High | Low | Ready to introduce immediately |
| Expansion | High | High | Continuously expand |

Establishment and Introduction types are often confused. Do not rely on the names alone; determine based on which dimension—readiness or maturity—is higher. The Establishment type has high maturity, while the Introduction type has high readiness.

## Top 10 Project Management Areas

Since analytics projects are also projects, they are managed using PMBOK knowledge areas. Based on PMBOK 6th edition, there are ten areas.

| Area | Activities |
|---|---|
| Integration | Coordinate all project elements as one |
| Scope | Define and control work included in the project |
| Schedule | Estimate and control task sequences and durations |
| Cost | Estimate and control the budget |
| Quality | Ensure deliverables meet standards |
| Resources | Acquire and manage teams and resources |
| Communications | Manage information flow to stakeholders |
| Risk | Identify, analyze, respond to, and monitor risks |
| Procurement | Obtain goods and services from external vendors |
| Stakeholders | Identify and engage affected individuals |

PMBOK 7th edition (2021) replaced these knowledge areas with eight performance domains. Check the study material description to confirm which edition version is referenced.

## Frequently Encountered Question Types

- Top-down vs. bottom-up distinction: If "the problem is given first," it's top-down; if "data is examined first," it's bottom-up.
- Selecting priority quadrants: Current/Easy comes first; Future/Hard comes last. The middle quadrant checks whether the criterion is urgency or difficulty.
- Identifying missing elements among three scope/method factors: Business integration, analytical data, and technology. Any other items mixed in indicate an incorrect answer.
- Matching five governance components with characteristics of three organizational structures.
- Determining type names based on readiness/maturity levels (e.g., Establishment vs. Introduction).
- Roadmap sequence: System introduction → Validation (pilot) → Expansion and advancement.

When solving questions, first examine keywords in the options. "Pilot" corresponds to stage 2, "Change management" to stage 3, and "Idea generation" to stage 1—allowing quick narrowing down. It is better to solve past exam questions directly from official sites or study materials.

The next article covers tools used while performing this task: [R Basics and Data Mart](#/post/adsp-r-datamart). Previous chapters include [Analytical Methodology](#/post/adsp-methodology), and the overall flow can be viewed in the [ADsP map](#/post/adsp-map).

← Concept map ([#/post/adsp-map])

## Reference Links

- IT Wiki, Analysis Master Plan: https://itwiki.kr/w/분석 마스터 플랜
- IT Wiki, Data Analytics Governance: https://itwiki.kr/w/데이터 분석 거버넌스
- IT Wiki, Data Analytics Planning: https://itwiki.kr/w/데이터 분석 기획
- Project Engineer, The 10 PMBOK Knowledge Areas: https://projectengineer.net/the-10-pmbok-knowledge-areas