The first unit of SQLD 1 covers data modeling. The process of translating real-world business operations into data structures is divided into three stages: conceptual, logical, and physical, with the results depicted as an ERD. This article organizes key points based on how this unit is typically tested. You can check the exam schedule and fee on the official website.

## What is Modeling?

Modeling is the act of simplifying the real world for representation. It's similar to a map, which doesn't draw every detail of the land but only what is necessary. The core principle is to retain only what is needed for business operations and discard the rest. Therefore, exams often ask about the characteristics of modeling: abstraction, simplification, and clarification.

- **Abstraction**: Extracts only common characteristics from reality.
- **Simplification**: Represents complex things simply using agreed-upon symbols.
- **Clarification**: Removes ambiguity so that the meaning is clear to anyone who reads it.

There are also three perspectives on modeling: the data perspective focuses on what data a business operation involves; the process perspective focuses on what the actual work entails; and the data-process correlation perspective examines how operations transform data. SQLD primarily deals with the data perspective.

## Conceptual, Logical, Physical

Modeling stages proceed from abstract to concrete.

| Stage | Activity | Representative Output | Exam Point |
|---|---|---|---|
| Conceptual Modeling | Identify core entities and define relationships in business operations | Conceptual ERD | Highest level of abstraction; independent of specific DBMS |
| Logical Modeling | Specify structure using tables, columns, and keys | Logical ERD | Normalization occurs here; high reusability |
| Physical Modeling | Consider performance and storage tailored to the actual DBMS | Physical ERD, Schema | Depends on DBMS type; involves denormalization and index design |

Wikipedia's data model documentation also distinguishes these similarly from an ANSI perspective. The conceptual model explains domain meanings using entity classifications and relationships; the logical model describes meanings expressed with specific technologies (e.g., tables, columns); and the physical model addresses how data is actually stored (e.g., partitioning, tablespaces). Since these three perspectives are relatively independent, changing storage technology affects the upper models less.

Exams frequently feature matching questions pairing stages with descriptions. A simple way to remember: conceptual is "what to manage," logical is "how to structure it in tables," and physical is "how to run it quickly in a DBMS." Link normalization to the logical stage, and denormalization/index design to the physical stage to solve problems easily. Normalization itself is covered separately in [Details → Normalization and Performance Data Modeling](#/post/sqld-norm-perf).

<details>
<summary>Example for distinguishing modeling stages</summary>

Using a library as an example:

- **Conceptual**: Only define "members borrow books." Entities are Member, Book, and Loan; no columns yet.
- **Logical**: Define columns and keys such as Member (member\_id, name), Book (book\_id, title), Loan (member\_id, book\_id, loan\_date), and normalize to eliminate redundancy.
- **Physical**: Partition the Loan table based on loan date anticipating growth, add indexes to frequently queried columns, and adjust column types to match the DBMS.

It's simply redrawing the same object with increasing specificity; just remember the order from top to bottom after completing each stage.
</details>

## ERD

ERD (Entity Relationship Diagram) visually represents entities and their relationships. Rectangles represent entities, and lines represent relationships. This model was proposed by Peter Chen in an ACM paper in 1976 and is commonly used as the abstract data model for relational databases. Think of entities as nouns and relationships as verbs for easier understanding.

Exams often ask about the drawing order and components of an ERD. The writing order used in Korean SQLD textbooks is as follows:

1. Draw entities.
2. Position entities.
3. Define relationships between entities.
4. Describe relationship names.
5. Indicate participation (cardinality) of relationships.
6. Indicate whether relationships are mandatory or optional.

When positioning entities, it's common to remember placing important entities at the top-left. A "crow's foot" symbol at the end of a line means "many," while a circle represents 0 and a short line represents 1; this notation is most common and also appears in Wikipedia's ER model documentation. Relationship cardinality (1:1, 1:N, M:N) and optionality are covered in [Details → Relationships and Identifiers](#/post/sqld-relation-identifier), while entity and attribute classification is discussed in [Details → Entities and Attributes](#/post/sqld-entity-attr).

## Conditions for a Good Data Model

"Elements a good model must possess" is also a common sentence-type question.

| Condition | Meaning |
|---|---|
| Completeness | Includes all data necessary for the task. |
| Duplication Elimination | Does not store the same fact in multiple places. |
| Business Rules | Expresses business rules in the model and ensures they are shared by all. |
| Data Reusability | Designs data independently so it is not tied to a single program. |
| Communication | Those who understand the modeling notation interpret it with the same meaning. |
| Integrity | Defines data only once and references it from other places. |

If "speed" or "storage space saving" appears in the options, be suspicious. The core of this list is whether data is stored accurately without duplication and can be read together consistently.

## 3-Level Schema and Data Independence

A schema describes the structure and constraints of a database. The 3-level schema (ANSI-SPARC architecture) divides this into three layers. The terms concept, logic, and physics in modeling are similar to external, conceptual, and internal, making them easy to confuse; however, these are not steps but rather three layers for viewing a single database.

| Schema | Who Views It? | Description |
|---|---|---|
| External Schema | Users, Applications | A view showing only the parts needed by each user. There can be multiple views. |
| Conceptual Schema | Entire Organization, DBA | An integrated structure of all data, relationships, and constraints. One per database. |
| Internal Schema | System, Storage Perspective | Physical storage methods, records, indexes. One per database. |

Wikipedia's ANSI-SPARC documentation also covers the same content. The external layer consists of user-specific views (multiple possible), while the conceptual and internal layers each have one instance; the internal layer deals with the representation actually stored on hardware.

The reason for dividing into these layers is data independence. Changing one layer should not affect the others.

- Logical Independence: Changing the conceptual schema does not affect external schemas (user views, applications).
- Physical Independence: Changing the internal schema (storage structure) does not affect the conceptual schema.

With independence, controlling access per user becomes easier, programs do not need modification when storage devices change, and the same data can be displayed in multiple ways. Questions often ask which schema changes affect which side. You can summarize this as: logical independence is between external and conceptual schemas, while physical independence is between conceptual and internal schemas.

<details>
<summary>How to Distinguish Between Modeling 3-Levels and 3-Level Schema</summary>

These two concepts should be kept separate to avoid confusion.

- Modeling 3-levels (conceptual, logical, physical) refer to the sequence of design. This is a time axis, progressing from top to bottom by one person.
- 3-level schema (external, conceptual, internal) refers to viewing a completed database from different layers. This is a structural axis and exists simultaneously.

Therefore, although the word "conceptual" appears in both contexts, they are not the same. If a question mentions "design sequence" or "DBMS independent," it refers to modeling levels; if it mentions "user view" or "storage structure," it refers to the 3-level schema.
</details>

## Common Mistakes

- Selecting options that mention normalization or indexing in conceptual modeling is incorrect. Normalization belongs to the logical level, and indexing to the physical level.
- Options claiming there is only one external schema are also incorrect. There are multiple external schemas, while conceptual and internal schemas each have one.
- Questions often mix up explanations of logical and physical independence. Pair conceptual schema changes with external schemas, and internal schema changes with conceptual schemas.
- Modeling is not about replicating reality exactly but retaining only what is necessary; therefore, options claiming it contains all information from reality are incorrect.

Practice questions do not quote the original text verbatim but list question types. Option sentences often rephrase expressions from the table above. Instead of memorizing the table word-for-word, try memorizing one sentence explaining the reason for each point to retain knowledge longer. The next unit is [Entities and Attributes](#/post/sqld-entity-attr).

---

← Concept map ([SQLD map](#/post/sqld-map))

Related articles: [Entities and Attributes](#/post/sqld-entity-attr) · [Normalization and Modeling](#/post/db-normalization) · [Indexes](#/post/db-index)

## Reference Links

- ANSI-SPARC Architecture (Wikipedia): https://en.wikipedia.org/wiki/ANSI-SPARC_Architecture
- Data model (Wikipedia): https://en.wikipedia.org/wiki/Data_model
- Entity-relationship model (Wikipedia): https://en.wikipedia.org/wiki/Entity%E2%80%93relationship_model