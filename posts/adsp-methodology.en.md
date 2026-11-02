Methodology defines the framework for how an analysis project will proceed, including its stages and deliverables. In ADsP, KDD, CRISP-DM, hierarchical processes, and top-down/bottom-up approaches are presented as a unified set.

## Why is Methodology Needed?

Analysis is not simply about receiving data and running a model once. It involves defining goals, collecting data, cleaning it, analyzing it, making the results usable, and evaluating outcomes. By establishing this sequence and its deliverables in advance, teams can work consistently even when personnel change. Methodology documents this process.

For exam purposes, it is helpful to view the content as four main sections.

| Section | Core Question |
|---|---|
| KDD | What are the five steps of the entire process for extracting knowledge from data? |
| CRISP-DM | What are the six stages of a data mining project, and how does it loop back? |
| Hierarchical Process | What are the stage, task, and step in each case? |
| Top-down/Bottom-up | Where do we start when tackling an analysis assignment? |

Details on selecting assignments can be found in [More → Understanding Analysis Planning](#/post/adsp-planning), while prioritizing selected tasks is covered in [More → Analysis Tasks and Master Plan](#/post/adsp-task-masterplan).

## KDD: Five Steps

KDD stands for Knowledge Discovery in Databases. It refers to the entire process of discovering useful knowledge from large volumes of data, whereas data mining is just one step within that process. This distinction is often confused. Remember that data mining is not the entirety of KDD but rather the fourth step. The stage composition follows the explanation cited from Fayyad et al. (1996).

| Order | Step | Activity |
|---|---|---|
| 1 | Selection | Select data appropriate to the analysis objective and create the target dataset |
| 2 | Preprocessing | Clean missing values and noise |
| 3 | Transformation | Convert into a form suitable for analysis and reduce the number of variables |
| 4 | Data Mining | Apply algorithms to find hidden patterns |
| 5 | Interpretation/Evaluation | Review whether found patterns are meaningful and summarize as knowledge |

If criteria are not met at any of the five steps, the process loops back to preprocessing and mining stages. To remember the flow in one line: "Selection, Preprocessing, Transformation, Mining, Interpretation." Techniques used in the data mining step (classification, clustering, association analysis) are separately organized in [More → Structured Data Mining](#/post/adsp-datamining).

## CRISP-DM: Six Steps

CRISP-DM stands for Cross-Industry Standard Process for Data Mining. It was conceptualized in 1996 and evolved through EU ESPRIT-supported projects. The first version was presented at a workshop in Brussels in March 1999, followed by a step-by-step guide later that same year. It is also the methodology most frequently cited by data mining practitioners in various surveys.

| Order | Step | Key Tasks |
|---|---|---|
| 1 | Business Understanding | Understand business objectives, assess context, define data mining goals, develop project plan |
| 2 | Data Understanding | Initial data collection, technical analysis of data, data exploration, verify data quality |
| 3 | Data Preparation | Select dataset for analysis, clean, prepare, integrate, format |
| 4 | Modeling | Select modeling techniques, design testing plan, build models, evaluate models |
| 5 | Evaluation | Evaluate analysis results, assess modeling process, evaluate model applicability |
| 6 | Deployment | Develop deployment plan, monitoring and maintenance planning, write closure report, conduct project review |

When placed side by side with KDD, corresponding elements become apparent. In CRISP-DM, KDD's selection, preprocessing, and transformation steps are grouped into the single Data Preparation stage. Additionally, CRISP-DM includes Business Understanding at the beginning and Deployment at the end. However, since the stages of the two methodologies do not map exactly one-to-one, it is safer to learn each step name and sequence separately rather than forcing them into a rigid table.

### The Sequence Is Not Fixed

This is the most important point in CRISP-DM: steps do not flow strictly in numerical order in one direction. Moving between steps is common; for example, if data insufficiency is discovered during modeling, the process returns to Data Understanding or Preparation. If evaluation results are inadequate, it loops back to Business Understanding. Even after Deployment concludes, lessons learned can generate new questions that lead to subsequent projects. In diagrams, an outer circle surrounding the steps represents this cyclical nature.

<details>
<summary>Detailed explanation: Four layers of CRISP-DM</summary>

CRISP-DM describes itself as a hierarchy. At the top are Phases, followed by Generic Tasks, then Specialized Tasks, and finally Process Instances at the bottom. A Generic Task is a name applicable to any project, whereas a Specialized Task is concretized according to the actual situation. The "Major Tasks" in the table above correspond to the Generic Task level.

For exam preparation, it is sufficient to know the 6 phases and one or two representative tasks for each phase. For Specialized Tasks and below, knowing just the names is enough.

</details>

## Hierarchical Process: Phases, Tasks, Steps

The big data analytics methodology mentioned in domestic textbooks consists of three hierarchical levels: Phase (Phase), Task (Task), and Step (Step). The definitions appear similar, leading to confusion in distinguishing them.

| Level | Definition |
|---|---|
| Phase | Top-level level. Managed via version control based on completed deliverables as baselines. |
| Task | A unit activity constituting a phase. Subject to quality review. |
| Step | A unit process corresponding to a work package in WBS. Composed of Input, Process & Tools, and Output. |

It is common for Steps to have Inputs, Processes/Tools, and Outputs. Options defining Tasks this way are incorrect.

The 5 phases and representative deliverables of this methodology are as follows. The order is important; Analysis Planning comes first, followed by System Implementation, which precedes Evaluation & Deployment.

| Order | Phase | Major Tasks | Representative Deliverables |
|---|---|---|---|
| 1 | Analysis Planning | Business understanding and scope setting, Project definition and planning, Project risk planning | Project Scope Definition (SOW), Project Plan |
| 2 | Data Preparation | Required data definition, Data store design, Data collection and consistency check | Data Dictionary, Data Store |
| 3 | Data Analysis | Analytical data preparation, Text analysis, Exploratory analysis, Modeling, Model evaluation and validation | Analytical dataset, Model Evaluation Report |
| 4 | System Implementation | Design and implementation, System testing and operation | System Design Document, Operation Manual |
| 5 | Evaluation & Deployment | Model evolution plan formulation, Project evaluation and reporting | Model Evolution Plan, Final Report |

Although the names differ from CRISP-DM's Business Understanding, Data Understanding & Preparation, Modeling, Evaluation, and Deployment, the flow is essentially the same when reviewed. If your concept of "Data Understanding" is weak, it is better to start with [Detailed → Understanding Data](#/post/adsp-data-understanding).

## Top-down and Bottom-up

This distinction is based on where the analysis task originates.

| Distinction | Starting Point | Suitable Situation |
|---|---|---|
| Top-down | Breaking down problems from corporate goals or current issues to derive tasks | When the business problem to be solved is relatively clear |
| Bottom-up | Starting with available data to find new patterns and relationships, deriving new tasks | When it is not yet known what the problem is |

It is explained that in practice, both approaches are often mixed.

### Top-down 4 Phases

The order is Problem Exploration, Problem Definition, Solution Exploration, and Feasibility Review.

| Phase | Activity |
|---|---|
| Problem Exploration | Review management goals, business processes, customer requirements, and market environment to identify problems to solve or analysis opportunities. An enterprise-wide perspective is important. |
| Problem Definition | Translate a business problem into a data problem. For example, changing "Increase in Customer Churn" to "Prediction of High-Churn Customers." |
| Solution Exploration | Review analytical techniques, systems, and personnel acquisition plans. Plans diverge based on combinations of whether to leverage existing systems and whether analytical capabilities are possessed. |
| Feasibility Review | Evaluate economic feasibility (e.g., cost-benefit) and data/technical feasibility to finalize the task. |

Methods used in Problem Exploration include a business model-based approach reviewing internal operations and an external reference model-based approach referencing cases from other companies. Benchmarking falls under the external reference model category. Options that incorrectly swap this into the internal side frequently appear as wrong answers.

### Bottom-up

It involves exploring data characteristics through exploratory data analysis, finding hidden patterns using unsupervised learning such as clustering or association rules, and defining the problem itself by iterating through trial and error via prototyping. Prototyping refers to a method of repeating hypothesis generation, experimentation, testing in actual environments, and result verification.

## Common Question Types and Solution Approaches

We do not reproduce exact past exam questions but summarize how they are phrased.

- **Ordering the Steps**: Match the correct sequence for KDD (5 steps), CRISP-DM (6 steps), and a generic 5-step methodology. You only need to know the first and last steps of each methodology to eliminate incorrect options: KDD starts with Selection and ends with Interpretation/Evaluation, while CRISP-DM starts with Business Understanding and ends with Deployment.
- **Connecting Activities by Step**: Questions like "Is 'Data Quality Check' part of Data Understanding or Data Preparation?" test your knowledge; checking quality belongs to Understanding, whereas fixing and merging data belong to Preparation.
- **Distinguishing Hierarchical Definitions**: Identify options where the definitions of Stage, Task, and Step are swapped. Remember that a Step consists of Input/Process/Output, while a Task is a unit activity that makes up a Stage.
- **Distinguishing Approaches**: If the problem is defined, it's Top-Down; if you start from the data, it's Bottom-Up. If Unsupervised Learning appears, it falls under the Bottom-Up approach.
- **Identifying Incorrect Statements**: Statements claiming the sequence is fixed or that Data Mining is the entire KDD process are incorrect answers.

## Common Misconceptions

- **CRISP-DM is a linear procedure completed in one pass**: Moving between steps is fundamental, and even after Deployment, it continues with the next question.
- **Data Mining and KDD are the same thing**: Mining is just one step within KDD.
- **Tasks and Steps in a hierarchical process are the same term**: A Step is a smaller unit that includes Input/Process/Output.
- **Bottom-Up is better or worse than Top-Down**: The choice depends on whether the problem is visible, and they can also be combined.

<details>
<summary>Detailed Explanation: Viewing the Same Task Through Three Methodologies</summary>

Consider a project aimed at reducing churn for an online shopping mall. Reading the same task through three different frameworks yields the following:

**KDD Approach**: Select necessary columns from purchase history (Selection), clean missing values and anomalies (Preprocessing), combine or reduce variables (Transformation), run algorithms to predict churn (Mining), and interpret whether the resulting patterns are meaningful (Interpretation/Evaluation).

**CRISP-DM Approach**: First, write down the business goal of reducing churn and the data mining goal separately (Business Understanding); browse existing data to assess quality (Data Understanding); create an analysis dataset (Data Preparation); build and evaluate models (Modeling); check if results align with business goals (Evaluation). If they do, deploy to operations and plan monitoring (Deployment). If not, return to Business Understanding.

**5-Step Methodology Approach**: Write a scope definition and plan document (Analysis Planning); define and collect necessary data (Data Preparation); create an analysis dataset and model evaluation report (Data Analysis); implement and operate the system (System Implementation); conclude with a final report and model evolution plan (Evaluation & Deployment).

All three frameworks differ only in name but share the core logic of preparing data, building models, evaluating them, and then applying results.

</details>

## Reference Links

- Wikipedia, Cross-industry standard process for data mining: https://en.wikipedia.org/wiki/Cross-industry_standard_process_for_data_mining
- Wikipedia, Data mining (KDD steps and CRISP-DM): https://en.wikipedia.org/wiki/Data_mining
- Data Science PM, CRISP-DM phases and tasks: https://www.datascience-pm.com/crisp-dm-2/
- IT Wiki, KDD: https://itwiki.kr/w/KDD
- IT Wiki, CRISP-DM: https://itwiki.kr/w/CRISP-DM
- IT Wiki, Big Data Analysis Methodologies: https://itwiki.kr/w/빅데이터_분석_방법론
- IT Wiki, Data Analysis Planning (Bottom-Up/Top-Down): https://itwiki.kr/w/데이터_분석_기획

Check the official site for exam schedules and registration methods.

← Concept Map ([ADsP map](#/post/adsp-map))

Related Articles: [Understanding Analysis Planning](#/post/adsp-planning) · [Analysis Tasks and Master Plan](#/post/adsp-task-masterplan) · [Structured Data Mining](#/post/adsp-datamining)