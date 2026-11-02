This is the first unit of ADsP Unit 2, Data Analysis Planning. Analysis planning is the stage where you decide in advance how to conduct an analysis task and in what order. Before touching the data, there are no codes or statistical formulas; instead, it focuses on precise classification and terminology. You can check exam schedules and fees on the official website. This article summarizes key concepts per unit, frequently appearing question types, and solution approaches.

## What Analysis Planning Does

Before starting an analysis, there are two main things to decide: what to analyze (analysis target) and how to analyze it (analysis method). The approach depends on whether you already know these two elements. You can consider the entire unit as branching out from this distinction.

In the course structure, Data Analysis Planning consists of about 10 questions and is divided into two parts: Understanding Analysis Planning and the Analysis Master Plan. This article covers the former (Understanding Analysis Planning), while the latter continues in [Details → Analysis Tasks and Master Plan](#/post/adsp-task-masterplan). Methodologies (KDD, CRISP-DM) are covered separately in [Details → Analysis Methodology](#/post/adsp-methodology).

## The Four Quadrants of Analysis Target and Method

This is the most frequently appearing diagram. If you divide targets and methods into "know" and "don't know," you get four quadrants.

| Category | Knows Analysis Method | Doesn't Know Analysis Method |
|---|---|---|
| Knows Analysis Target | Optimization | Solution |
| Doesn't Know Analysis Target | Insight | Discovery |

A mnemonic to remember this is to read "Target first, then Method."

- Know both → Optimization. This involves refining an existing analysis to make it better.
- Know the target but don't know the method → Solution. You have a problem to solve but need to find out how to solve it.
- Don't know the target but know the method → Insight. You look at data using your available analytical techniques to find something worth seeing.
- Don't know either → Discovery. Since you don't even know what to look at, this involves finding new targets.

Exams usually ask questions like "What is the case where you know the analysis target but not the method?" and require you to select the corresponding name. Insight and Solution are easily confused; remember that Solution corresponds to knowing the target, while Insight corresponds to not knowing the method.

## Approach: Top-Down vs. Bottom-Up

Whether you know the target in the four-quadrant model connects to the approach. If a problem is given, it's top-down; if you don't even know what the problem is, it's bottom-up.

| Category | Top-Down | Bottom-Up |
|---|---|---|
| Starting Point | Problem is given; analysis target is clear | Don't know what the problem is |
| Approach | Find and define the problem, then determine the solution | Look at data first to find problems in patterns |
| Representative Techniques | Problem exploration → definition → solution exploration → feasibility review | Exploratory Data Analysis (EDA), unsupervised learning, association rules, clustering analysis, prototyping |

The four-step sequence for top-down is standard, so memorize it.

1. Problem Exploration: Identify problems from business models or external cases and define analysis use cases.
2. Problem Definition: Convert a business problem into a data analysis problem.
3. Solution Exploration: Determine how to secure analytical techniques, systems, and personnel.
4. Feasibility Review: Evaluate economic feasibility and data/technical feasibility to finalize the task.

Bottom-up defines the problem itself through repeated prototyping. It involves setting hypotheses, conducting small experiments, testing in real environments, and extracting insights from results. In practice, it is recommended to alternate between top-down and bottom-up approaches. For detailed procedures of both methods, see [Details → Analysis Methodology](#/post/adsp-methodology).

<details>
<summary>Two branches of top-down problem exploration and solution exploration table</summary>

Problem exploration splits into two based on where the problem is found.

- Business Model Based: Examine internal organizational work, products, customers, regulations and audits, and support infrastructure.
- External Reference Model Based: Benchmark similar industry cases to find opportunities externally. Note that benchmarking belongs to the external reference model, not internal; this distinction often changes in exam questions.

Analysis use cases describe the full problem and the expected effects upon solving it. They are used later when converting to a data analysis problem and evaluating suitability.

Solution exploration splits based on two criteria: whether the analysis can be done with existing systems or if analytical capabilities have been acquired.

| | Analytical Capabilities Acquired | Analytical Capabilities Not Acquired |
|---|---|---|
| Existing System Usable | Improve and utilize existing system | Acquire capabilities through training and hiring |
| New Introduction Required | System enhancement | Utilize specialized vendors (outsourcing) |

</details>

## Approach by Target Timepoint

Even for the same analysis, the approach splits into two depending on how far ahead in time you look.

| Category | Task-Centric (Solving Immediate Tasks) | Master Plan (Embedding Continuous Analysis) |
|---|---|---|
| Primary Goal | Quickly try and validate | Build accurately and deploy to production |
| Task Type | Visible results in a short period | Long-term perspective |
| Approach | Solve given problems | Define the problem itself that needs solving |

You don't choose just one; you combine both. Achieve quick results with immediate tasks while building a long-term system with the Master Plan. Be careful not to confuse the columns: statements like "Task-centric approach defines the problem itself" are often mixed up, but defining the problem itself belongs to the Master Plan. The prioritization criteria for the Master Plan (strategic importance, ROI, ease of execution) are covered in [Detailed Analysis → Tasks and Master Plans](#/post/adsp-task-masterplan).

## Considerations During Analysis Planning

There are three key things to keep in mind when planning:

1. **Available Data**: First check if data exists, and whether it is structured, unstructured, or semi-structured. The solution and analysis methods vary depending on the type.
2. **Appropriate Utilization and Use Cases**: Finding similar cases or existing solutions makes it easier to gain user buy-in and facilitates adoption.
3. **Pre-planning for Obstacles**: Prepare in advance for costs, accuracy and understanding of results, organizational capabilities, and change management to ensure initiatives don't end as one-off projects.

"Available Personnel" is not included in these three categories. Since questions may ask you to identify the incorrect option by inserting "available personnel" into the list, it's best to remember the original three items: available data, use cases, and obstacles.

## Analysis Utilization Scenarios

This is a plan defining how and for what purpose analysis results will be used. It includes analysis goals, analysis methods, and expected outcomes (anticipated effects). It is used when defining tasks or aligning with stakeholders on direction. The core focus is on the analysis purpose and how results will be utilized; data is just one of the elements reviewed to execute the scenario. During a project, if the data situation or business requirements change, the scenario may also need to be adjusted.

## Common Mistakes

- **Confusing Solution with Insight**: Solution refers to knowing the target/object, while insight refers to knowing the method.
- **Misclassifying Benchmarking**: Benchmarking is based on external reference models, not "business model-based problem exploration."
- **Including Available Personnel in Considerations**: The correct considerations are available data, use cases, and obstacles.
- **Swapping Task-Centric and Master Plan Features**: Do not mix up their characteristics.
- **Mixing Up the Top-Down 4-Step Order**: The correct sequence is: Problem Exploration, Problem Definition, Solution Exploration, and Feasibility Review.

Practice questions list only the question types rather than copying the original text exactly. Since problems in this unit involve matching terms without calculations, drawing a four-quadrant table by hand first significantly speeds up solving multiple-choice questions. The next unit is [Analysis Methodology](#/post/adsp-methodology).

---

← Concept Map ([ADsP map](#/post/adsp-map))

Related Articles: [Analysis Methodology](#/post/adsp-methodology) · [Tasks and Master Plans](#/post/adsp-task-masterplan) · [Data Science and Talent](#/post/adsp-ds-bigdata)

## Reference Links

- Data Analysis Planning (IT Wiki): https://itwiki.kr/w/데이터 분석 기획
- Analysis Master Plan (IT Wiki): https://itwiki.kr/w/분석 마스터 플랜
- Data Analysis Junior Expert (IT Wiki): https://itwiki.kr/w/%EB%8D%B0%EC%9D%B4%ED%84%B0%EB%B6%84%EC%84%9D_%EC%A4%80%EC%A0%84%EB%AC%B8%EA%B0%80