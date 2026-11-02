Normalization is the process of splitting tables to prevent anomalies caused by redundancy, while denormalization and partitioning are methods used to optimize performance on models that have already been split. Super/Subtypes are also techniques for restructuring normalized models. In SQLD 1, this unit covers both conceptual questions and scenario-based problems asking "how would you change it," so I've organized the material to cover not just definitions but also when each technique is applied.

You can check the exam schedule and registration fees on the official website. This article focuses only on the core concepts of the unit and frequently encountered question types.

## Why Normalization is Needed

If you store a department name for every employee in a single table, you must update the department name for all employees whenever the department name changes. If even one row is missed, the same department will have two different names. Such problems are called anomalies (anomaly) and are typically categorized into three types:

| Anomaly | Situation |
|---|---|
| Insertion Anomaly | There is no place to insert a new department if there are no employees in it. |
| Update Anomaly | When changing a department name, only some rows are updated, leading to inconsistency. |
| Deletion Anomaly | Deleting the last employee also deletes the department information. |

Normalization prevents these issues by splitting tables according to functional dependencies. A functional dependency is a relationship (A → B) where "once an A value is determined, a B value is uniquely determined." For example, since an employee name is uniquely determined by an employee ID, we have EmployeeID → EmployeeName.

## 1st through 3rd Normal Forms

Based on the definitions in the Wikipedia normalization document, the three stages are interpreted as follows:

| Normal Form | Condition | Action upon Violation |
|---|---|---|
| 1st Normal Form | Every cell contains only a single value; no repeating groups or multi-valued attributes. | Move repeating values to a separate table. |
| 2nd Normal Form | When the primary key is composite, non-key attributes must depend on the entire key (remove partial dependency). | Remove attributes that have partial dependency. |
| 3rd Normal Form | Non-key attributes must not depend on other non-key attributes (remove transitive dependency). | Remove attributes that have transitive dependency. |

It's easier to memorize them by attaching one keyword at a time: 1st Normal Form is atomic values, 2nd Normal Form is partial dependency, and 3rd Normal Form is transitive dependency.

Looking at an enrollment table where the primary key is (StudentID, CourseCode), if CourseName depends only on CourseCode, it's a partial dependency, violating 2nd Normal Form. If a non-key attribute like DepartmentName depends on another non-key attribute like DepartmentCode (e.g., StudentID → DepartmentCode → DepartmentName), it's a transitive dependency, violating 3rd Normal Form.

<details>
<summary>Solution Order (when a problem appears)</summary>

1. First, check the primary key.
2. If a single cell contains multiple values, it's a violation of 1st Normal Form.
3. If the primary key is composite, check whether each non-key attribute is determined by only part of the key. If so, it's a violation of 2nd Normal Form.
4. If there is a relationship where "A determines B" among non-key attributes, it's a violation of 3rd Normal Form.
5. Move the violating attribute along with its determinant (the left-side attribute) to a new table. Keep the determinant in the original table as a foreign key.

If the primary key consists of a single attribute, partial dependency cannot occur, so 2nd Normal Form is automatically satisfied. This point is often used in multiple-choice questions.
</details>

BCNF, 4th Normal Form, and 5th Normal Form exist, but it is known that for this unit, focusing up to the 3rd Normal Form is sufficient. To confirm the exact scope of the exam, please check the subject guide on the official website.

## Verifying Normalization with Code

Splitting employees and departments means the department name exists in only one place. I tested this directly using SQLite.

```sql
CREATE TABLE dept(dept_id INT PRIMARY KEY, dept_name TEXT);
CREATE TABLE emp(emp_id INT PRIMARY KEY, emp_name TEXT,
                 dept_id INT REFERENCES dept);
INSERT INTO dept VALUES (10, '영업');
INSERT INTO emp VALUES (1, '가', 10), (2, '나', 10);

UPDATE dept SET dept_name = '영업1' WHERE dept_id = 10;

SELECT e.emp_name, d.dept_name
FROM emp e JOIN dept d USING (dept_id);
```

The result was `('가', '영업1')`, `('나', '영업1')`. Changing just one row reflected the change for both employees. However, to view employee and department names together, a join became necessary. This is where the discussion of denormalization begins.

## Denormalization

After normalization, tables increase in number, and joins increase during queries. If joins become a performance bottleneck, intentionally allowing redundancy is called denormalization. The Wikipedia normalization document does not have a separate entry for denormalization but links to a separate document. Generally, it is explained as reducing joins at the cost of accepting redundancy.

Exams often ask about methods by categorizing them:

| Category | Method | Example |
|---|---|---|
| Table | Table Merge | Combine 1:1 or 1:N relationship tables into one |
| Table | Table Split | Column-based (vertical split), Row-based (horizontal split) |
| Table | Add Table | Aggregation table, History table, Partial table |
| Column | Duplicate Column Addition | Copy a name column to view without joining |
| Column | Derived Column Addition | Pre-calculate and store sums or counts |
| Relationship | Duplicate Relationship Addition | Add an extra relationship to reduce multi-stage joins |

It's also good to know what else to consider before denormalization. Often, the sequence involves adjusting indexes, using views, or rewriting queries first; if that still doesn't work, then proceed with denormalization.

The cost of denormalization is data consistency. Copied columns must be updated whenever the original changes, which becomes the responsibility of the application or triggers. Therefore, this approach is mainly considered for read-heavy query-oriented tasks.

## Super/Subtypes

When an entity is split into subtypes while sharing common attributes, the common part becomes the supertype and the subtype-specific parts become subtypes. For example, a customer can be divided into individual customers and corporate customers. In the logical model, this is represented as such; when moving to the physical model, one of three approaches must be chosen.

| Transformation Method | Shape | Appropriate Scenario |
|---|---|---|
| One-to-One Relationship | Supertype and subtype are each stored in separate tables with a 1:1 connection | When there are many attributes specific to subtypes and frequent independent queries for each subtype |
| Supertype + Subtype Integration (Single Table) | All attributes and a discriminator column are placed in a single table | When queries often occur without distinguishing subtypes and processing speed is critical |
| Subtype Separation | Separate tables for each subtype with duplicated common attributes | When subtypes are used almost entirely independently |

The integration method offers faster performance due to the absence of joins, but leaves non-applicable columns as NULL and increases table size. Conversely, separation results in lighter tables, but requires joins or UNION operations when combining data from all parts. Exam questions often ask, "Given a query pattern like this, which transformation is correct?" Memorizing the pros and cons in pairs will help solve these problems.

[Read more → Entities and Attributes](#/post/sqld-entity-attr) to understand where supertypes and subtypes originate by reviewing entity classification together.

## Partitioning

This is a method of managing large tables by dividing them into smaller pieces. Oracle documentation describes partitioning as splitting tables or indexes into smaller chunks called partitions, while applications treat partitioned tables like regular tables, stating that SQL changes are not required. Which row belongs to which partition is determined by the partition key.

| Method | Basis | Example |
|---|---|---|
| Range | Value range | Monthly order data |
| List | Specified list of values | Regional data |
| Hash | Even distribution via hash values | Data without natural ranges |
| Composite | Combining the above methods | Hash within a range |

The effects are categorized into three main points in the documentation. In terms of performance, partition pruning is key, where only necessary partitions are read. A documentation example shows that querying one week from an order table divided by week over two years (104 partitions) reads only 1 out of the 104 partitions. For management, backups or loading can be performed at the partition level; for availability, if one partition is blocked, the rest remain usable.

Exam questions often present true/false statements such as "Partition pruning is effective only if the partition key is included in the query condition." Understanding that pruning operates based on key conditions prevents confusion. Simply memorize the pairing of partition method names and their criteria.

<details>
<summary>Is horizontal splitting the same as partitioning?</summary>

Table horizontal splitting divides the table itself into multiple pieces based on rows, whereas partitioning logically keeps a single table while dividing storage. Horizontal splitting requires the application to know which table to view, but partitioning does not require changing SQL. In exams, questions asking about effects are more common than those distinguishing between the two.
</details>

## Performance Modeling from an Index Perspective

When designing indexes, several considerations should be taken into account during the modeling phase:

- Place indexes on columns frequently used in query conditions and joins; foreign key columns are typical examples.
- Columns with very few distinct values yield little benefit; columns with high selectivity are better.
- While indexes speed up queries, they must be updated alongside INSERT, UPDATE, and DELETE operations, incurring write costs.
- For composite indexes, column order is crucial; if the leading column is not used in conditions, utilization becomes difficult.

In the above employee example, creating an index on `emp(dept_id)` resulted in the SQLite execution plan showing `SEARCH emp USING INDEX ix_emp_dept (dept_id=?)`, demonstrating that querying a foreign key column utilizes the index.

```sql
CREATE INDEX ix_emp_dept ON emp(dept_id);
EXPLAIN QUERY PLAN SELECT * FROM emp WHERE dept_id = 10;
```

Details on internal index structure can be found [here → Index](#/post/db-index), and articles discussing normalization as a general database concept are available [here → Normalization](#/post/db-normalization). This article covers only topics relevant to exams.

## Summary of Frequently Encountered Types

| Type | Solution Approach |
|---|---|
| Determining the normal form of a given table | Check primary key, then inspect partial dependencies followed by transitive dependencies in order |
| Table structure after normalization | Separate determinants and dependent attributes into pairs |
| Classification of denormalization techniques | Divide based on whether tables, columns, or relationships are modified |
| Situations where queries are slow | Consider indexes, views, and denormalization in that order |
| Supertype/Subtype transformation selection | Based on query patterns (whether viewed together or separately) |
| Partition effects | Focus on partition key conditions, pruning, and management unit division |

A common pattern that makes a choice incorrect is the absolute statement: "More normalization always improves performance." Just remember that normalization prioritizes consistency, while query performance can actually suffer as joins increase. This alone helps you filter out such choices.

## Reference Links

- [Database normalization — Wikipedia](https://en.wikipedia.org/wiki/Database_normalization)
- [Partitioning Concepts — Oracle Database VLDB and Partitioning Guide 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/vldbg/partition-concepts.html)

← [Concept Map](#/post/sqld-map)

Related posts: [Understanding Data Modeling](#/post/sqld-modeling) · [Relations and Identifiers](#/post/sqld-relation-identifier) · [Normalization (General DB)](#/post/db-normalization)