Understanding Data, the first unit of ADsP 1, consists mostly of questions about terminology and distinctions without calculations. There are four key concepts to memorize: the distinction between data, information, knowledge, and wisdom; data types; characteristics of databases; and characteristics of data warehouses. The concept of the 3Vs of big data is also added here. The complete order is summarized in the [ADsP map](#/post/adsp-map).

## Data, Information, Knowledge, Wisdom

DIKW stands for the first letters of Data, Information, Knowledge, and Wisdom. When drawn as a pyramid, data is at the bottom and wisdom is at the top. Each lower stage is processed to become the next higher stage.

| Stage | Meaning | Example (Convenience Store) |
|---|---|---|
| Data | Raw values observed or measured; difficult to interpret on their own | Umbrella at Store A: 3,000 won, Umbrella at Store B: 5,000 won |
| Information | Data processed and organized for a specific purpose to gain meaning | Umbrellas at Store A are cheaper than those at Store B |
| Knowledge | Information structured so it can be understood and used | On rainy days, it's better to buy an umbrella from Store A |
| Wisdom | Judgment on what actions to take | Stop going to Store B for expensive umbrellas; prioritize other items available at Store A |

Questions typically appear in the format: "Which of the following examples represents information?" The key strategy is simple: if only values are listed, it's data; if two values are compared or organized to produce a single-line conclusion, it's information; if that information leads to predictions or rules about future actions, it's knowledge; and if there is further advancement leading to judgment or creative ideas, it's wisdom.

<details>
<summary>Where did the DIKW model originate?</summary>

There isn't a single definitive source for this model. It was widely popularized in the late 1980s by various people, and the pyramid representation also emerged around that time. This topic does not appear on exams, so you can skim it. Exams focus only on the order of the four stages and distinguishing examples for each stage.
</details>

## Types of Data

Based on structure (shape), there are three types.

| Type | Characteristics | Example |
|---|---|---|
| Structured data | Has a fixed schema and is handled directly in tables | Relational DB tables, Excel, CSV |
| Semi-structured data | Has a format, but the structure can vary per value | JSON, XML, HTML |
| Unstructured data | No predefined structure | Text documents, images, audio, video |

The confusing part is semi-structured data. Although it uses tags or keys to indicate structure, remember that it does not fit neatly into rows and columns like a table. How relational DBs handle structured data continues in [Relational DB and SQL Basics](#/post/db-rdb-sql), while methods for handling non-structured data are covered in [NoSQL Types and Selection](#/post/db-nosql).

## Four Characteristics of Databases

A database is a collection of data gathered for use by multiple people. Exams ask you to match the following four terms with their meanings.

| Characteristic | Core Meaning |
|---|---|
| Integrated data | Collected so that the same content does not duplicate |
| Stored data | Kept on storage media accessible by computers |
| Shared data | Used jointly by multiple users and application systems |
| Dynamic data | Continuously changes via insert, delete, and update operations but must always reflect the current state accurately |

A common trap is statements like "Integrated data allows duplication of the same data," which is incorrect. Integration eliminates duplication. Similarly, dynamic data might be presented in reverse, such as "Once stored, it cannot be changed."

## Data Warehouse

If a database handles daily operations, a data warehouse is a repository where data is collected for analysis. It involves extracting data from multiple business systems, transforming the format, and loading it into the warehouse. This process flow is called ETL.

There are four characteristics of a data warehouse:

| Characteristic | Meaning |
|---|---|
| Subject-oriented | Organized around core subjects like sales or customers rather than individual transaction processing |
| Integrated | Harmonizes differences in names, units, and code systems across multiple systems to ensure consistency |
| Time-variant | Accumulates historical data over long periods and analyzes trends over time |
| Non-volatile | Once loaded, data is read-only; it should not be arbitrarily modified or deleted |

A data mart is a smaller version of a data warehouse tailored to a specific subject or department. You can distinguish them by scale: enterprise-level units are warehouses, while department-level units are marts. Since marts connect with R lab exercises, they will also appear in [R Basics and Data Marts](#/post/adsp-r-datamart).

<details>
<summary>Comparing DBs and Warehouses in One Line</summary>

| Category | Database | Data Warehouse |
|---|---|---|
| Purpose | Daily transaction processing | Analysis and decision support |
| Data | Focused on current state, continuously updated | Focused on historical records, nearly read-only |
| Structure | Organized by business units | Organized by subject areas |

There is a question option that mixes the DB characteristic "changing data" with the statement "A warehouse is both time-series and non-volatile." A database keeps changing, while a warehouse stores data without modification.

## Big Data

The term "Big Data" has been in use since the 1990s and was initially explained using three Vs.

| V | Meaning |
|---|---|
| Volume (Scale) | Quantities of terabytes or petabytes and above |
| Variety (Diversity) | A mix of structured, semi-structured, and unstructured data |
| Velocity (Speed) | Rapid generation and processing, close to real-time |

Later, Veracity (accuracy) was added as the fourth V, and Value was included to form a 5V explanation. Depending on the textbook, the inclusion of certain aspects in the Vs may vary slightly; therefore, it is safest to memorize based on the list of textbooks you are studying. In problem-solving questions, there are many types where you must identify which V a statement refers to. "Processing speed" refers to Velocity, "multiple data formats" refers to Variety, and "large quantity" refers to Volume.

The reasons why Big Data emerged and its applications continue in the next section: [Value of Data and Future](#/post/adsp-data-value), and what data scientists do is covered in [Data Science and Talent](#/post/adsp-ds-bigdata).

## Order for Reviewing Explanations

1. If a question option presents a DIKW case, identify the steps in order: value listing, comparison/organization, rules/prediction, and judgment.
2. For terminology definition questions, match characteristics using keywords such as 'duplication', 'read-only', or 'multiple users'.
3. For "select the incorrect statement" questions, suspect reversed expressions first, such as allowing duplication, inability to modify, or tabulating unstructured data.

Information regarding exam schedules and registration can be checked on the official website.

← [Concept Map](#/post/adsp-map)

Related articles: [Value of Data and Future](#/post/adsp-data-value) · [Data Science and Talent](#/post/adsp-ds-bigdata) · [Understanding Analytical Planning](#/post/adsp-planning)

## Reference Links

- [DIKW pyramid - Wikipedia](https://en.wikipedia.org/wiki/DIKW_pyramid)
- [Data warehouse - Wikipedia](https://en.wikipedia.org/wiki/Data_warehouse)
- [Big data - Wikipedia](https://en.wikipedia.org/wiki/Big_data)
- [Database - IT Wiki](https://itwiki.kr/w/데이터베이스)