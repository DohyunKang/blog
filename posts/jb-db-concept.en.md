The database section of the Information Processing Technician exam is divided into three parts: keys, relational algebra, and ER models. Since normalization and SQL later on all revolve around these terms, it was right to study this first.

## What is a Data Model?

Creating a database is essentially mapping real-world entities into tabular forms. At this point, the framework that defines "what to express and under what rules" is called a data model. In exams, you are asked about its three components.

| Component | Meaning |
|---|---|
| Structure (structure) | How data is arranged |
| Operation (operation) | How to retrieve and modify that data |
| Constraint (constraint) | What values are not allowed |

In the relational model, structure corresponds to relations (tables), operation to relational algebra, and constraints to keys and integrity rules. These three parts of this article fit directly into these three categories.

Data modeling typically proceeds from conceptual → logical → physical. The conceptual stage has the least detail and defines the scope. The logical stage details the structure independently of any specific DBMS. The physical stage is bound by technology, allowing actual implementation down to tables, indexes, and constraints. The ER model is primarily used in the conceptual stage. The physical stage continues in [Physical Database Design and Distributed Databases](#/post/jb-physical-design).

## Terminology for Relations

The terminology of the relational model mixes Korean and English; memorizing pairs makes it easier.

| Term | Meaning | In a Table |
|---|---|---|
| Relation (relation) | A collection of attribute names (header) and tuples (body) | One table |
| Attribute (attribute) | A cell in the header with a name and type | Column |
| Tuple (tuple) | A row where each attribute has one value | Row |
| Domain (domain) | The set of values an attribute can hold | Types like integer, string, date |
| Degree (degree) | Number of attributes | Number of columns |
| Cardinality (cardinality) | Number of tuples | Number of rows |

Degree and cardinality are easily confused. Remember: degree is horizontal (columns), and cardinality is vertical (rows). In the ER model, "cardinality" can also refer to constraints on the number of relationships like one-to-many, so note that the same word has different meanings in different contexts.

## Keys

Keys are attributes (or sets of attributes) that uniquely distinguish tuples. Understanding them becomes easier when moving from broader ranges to narrower ones.

| Key | Definition |
|---|---|
| Superkey | A set of attributes where every combination of values is unique across all tuples |
| Candidate Key | The minimal subset among superkeys; adding fewer attributes breaks uniqueness |
| Primary Key | The candidate key selected as the representative |
| Alternate Key | Remaining candidate keys that are not chosen as primary keys |
| Foreign Key | A set of attributes that must match values in a candidate key of another relation |

Superkeys require only uniqueness, while candidate keys require both uniqueness and minimality. In a student table, if {Student ID} is a candidate key, then {Student ID, Name} is a superkey but not a candidate key because Student ID alone already distinguishes tuples. If there are other candidate keys like Social Security Number, those not chosen as the primary key become alternate keys.

Exams often ask questions like "How many candidate keys exist?" or "Can this attribute be a primary key?" when given a table. When solving, first eliminate columns with overlapping values, then find attributes that are unique on their own among the remaining columns, and finally examine combinations. If a combination already includes a unique column, it is not minimal and thus excluded from candidate keys.

## Integrity

Keys lead into constraints. Exams cover entity integrity, referential integrity, and domain integrity.

- Entity Integrity: The primary key cannot be NULL, and duplicate values are not allowed.
- Referential Integrity: A foreign key must either reference an existing value in the referenced relation or be NULL.
- Domain Integrity: Attribute values must fall within the predefined domain.

When a foreign key is defined, the DBMS rejects changes that violate these constraints. For example, trying to insert a course record with a student ID that doesn't exist in the student table will fail.

<details>
<summary>Summary of situations where referential integrity is violated</summary>

Let's assume the parent table is Students (with Student ID as primary key) and the child table is Course Enrollment (with Student ID as foreign key and Subject Code).

| Operation | Problematic Case |
|---|---|
| Insert into Child | Inserting a student ID that does not exist in the parent |
| Delete from Parent | Deleting a student ID referenced by the child |
| Modify Parent Key | Changing a student ID referenced by the child |

For deletion from the parent, responses are categorized as restrict (reject if children exist), cascade (delete children too), or set to NULL. Memorize these approaches separately. Actual syntax is covered in [SQL Applications](#/post/jb-sql-basic).

</details>

## Relational Algebra

Relational algebra is a collection of operations that take relations as input and produce relations as output. Since the result is also a relation, operations can be chained together. The basic operations are as follows.

| Operation | Symbol | Action |
|---|---|---|
| Selection | σ | Selects only tuples (rows) that match the condition |
| Projection | π (Π) | Keeps only the specified attributes (columns) |
| Rename | ρ | Changes only attribute names |
| Union | ∪ | Combines tuples from two relations |
| Difference | − | Tuples present only in the first relation |
| Cartesian Product | × | Pairs every tuple from one relation with every tuple from the other |

Derived operations include intersection (∩) and join (⋈). Intersection can be constructed using union and difference, while a join combines tuples that match on specific pairs. A natural join attaches tuples where values for attributes with the same name are equal. Union, difference, and intersection require that the two relations have identical attribute structures. The Cartesian product requires that the attribute names of the two relations do not overlap.

I've split this into two parts for memorization. Selection and projection are operations that cut within a single table: selection cuts horizontally (rows), and projection cuts vertically (columns). This distinction helps avoid confusion. The remaining operations combine multiple tables.

Division (÷) is an operation used in conditions like "students who have taken all subjects." Its definition must be memorized separately from the textbook.

<details>
<summary>Results of translating to SQL and running it directly</summary>

Since the operations weren't visually clear, I created small tables using SQLite to demonstrate the correspondence. The data includes students (1 kim cs, 2 lee ee, 3 park cs) and enrollments (1 db, 1 os, 2 db, 3 db, 3 os).

```sql
-- 셀렉션 σ 학과='cs'
select * from student where dept='cs';
-- → (1,kim,cs) (3,park,cs)

-- 프로젝션 π 학과 (중복 제거)
select distinct dept from student;
-- → cs, ee

-- 자연 조인
select name, cid from student natural join enroll;
-- → kim db, kim os, lee db, park db, park os

-- 카티전 프로덕트: 3행 × 5행
select count(*) from student, enroll;
-- → 15
```

I also ran set operations. When old={1,2} and new={2,3}, union produced {1,2,3}, except produced {1}, and intersect produced {2}.

There is a reason why `distinct` is added to projection. In relational algebra, a relation is a set of tuples and thus contains no duplicates. Since SQL's `SELECT` retains duplicates by default, `DISTINCT` must be used to align the two concepts.

</details>

## ER Model

The ER model is a conceptual model that represents reality using entities and relationships. It consists of three components:

- **Entity**: An identifiable object, usually a noun (e.g., Student, Course).
- **Attribute**: A value describing an entity or relationship (e.g., Student ID, Name). Attributes used to distinguish an entity are underlined.
- **Relationship**: A connection between entities, usually a verb (e.g., Enrolls in).

The Chen notation, which frequently appears in exams, uses specific shapes:

| Element | Shape |
|---|---|
| Entity | Rectangle |
| Relationship | Diamond |
| Attribute | Ellipse |

Relationships have cardinality constraints. If one student can take multiple courses and one course can be taken by multiple students, it is a many-to-many (N:M) relationship. If one professor teaches multiple courses but each course is taught by only one professor, it is a one-to-many (1:N) relationship. These cardinality constraints are also referred to as cardinality. In the crow's foot notation, a circle represents zero, a bar represents one, and a fork represents many; these symbols are paired to indicate minimum and maximum values.

Rules for converting ER diagrams into tables often appear in exam questions. The basic correspondence is that an entity becomes a table, attributes become columns, and underlined identifying attributes become primary keys. Detailed rules, such as converting many-to-many relationships, are best memorized by referring to the textbook's tables.

## Common Confusions

| Confusing Concept | Clarification |
|---|---|
| Superkey vs. Candidate Key | A candidate key has the property of minimality |
| Degree vs. Cardinality | Number of columns vs. number of rows |
| Selection vs. Projection | Filtering rows vs. filtering columns |
| Primary Key vs. Alternate Key | Selected from candidate keys vs. not selected |
| Two meanings of Cardinality | Number of tuples in a relation vs. cardinality constraint on an ER relationship |

This concludes the skeleton of the model; the rules for splitting tables based on these keys are covered in [Normalization and Transactions](#/post/jb-normalization-transaction). Practice exercises involve counting key counts, determining the degree and cardinality of relations from relational algebra results, and matching symbol names. Check the official website for exam schedules and registration information.

← [Concept Map](#/post/jb-map)

Related Articles
- [Normalization and Transactions](#/post/jb-normalization-transaction)
- [SQL Application](#/post/jb-sql-basic)
- [DB Physical Design and Distributed DB](#/post/jb-physical-design)

## Reference Links
- [Relational algebra - Wikipedia](https://en.wikipedia.org/wiki/Relational_algebra)
- [Relational model - Wikipedia](https://en.wikipedia.org/wiki/Relational_model)
- [Entity-relationship model - Wikipedia](https://en.wikipedia.org/wiki/Entity%E2%80%93relationship_model)