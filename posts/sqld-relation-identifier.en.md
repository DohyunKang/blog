In the SQLD Modeling course, relationships and identifiers appear almost every session. If you summarize the terms as "the name divided based on what," you can solve problems regardless of how the questions are phrased.

## What appears in this unit

Once entities and attributes are defined, the next steps are determining how entities connect to each other and what distinguishes rows within each entity. The previous unit covers [Entities and Attributes](#/post/sqld-entity-attr), and the overall modeling flow is explained in [Understanding Data Modeling](#/post/sqld-modeling).

| Category | Basis | Resulting Terms |
|---|---|---|
| Relationship | How many connect? | 1:1, 1:N, M:N (Cardinality) |
| Relationship | Must it exist? | Mandatory, Optional (Participation Constraint) |
| Relationship | Does child PK contain parent PK? | Identifying, Non-identifying relationship |
| Identifier | What role does it play? | Primary, Alternate identifier |
| Identifier | Where does it come from? | Internal, External identifier |
| Identifier | Is it a single column? | Simple, Composite |
| Identifier | Was it original? | Natural, Artificial identifier |

Exams often ask which "basis of classification" each row in this table represents. Remembering the basis alone allows you to solve unfamiliar questions.

## Basics of Relationships

A relationship means there is a business connection between two entities. If read with verbs like "belongs to," as in employee and department, it constitutes a relationship. Since there are two directions to read, we construct sentences from both sides: from the department side, "a department has many employees"; from the employee side, "an employee belongs to one department." Relying on only one sentence makes it easy to misjudge cardinality.

### Relationship Cardinality (How many connect?)

- 1:1 : One row on one side connects to a maximum of one row on the other
- 1:N : One row on one side connects to multiple rows on the other; conversely, a maximum of one on the other
- M:N : Multiple rows on both sides

The crow's foot notation used in ER diagrams indicates: a circle at the end of a line means 0, a vertical bar means 1, and a fork means many. Two symbols are attached to each end, where the inner symbol represents the minimum and the outer symbol represents the maximum ([Wikipedia: Entity–relationship model](https://en.wikipedia.org/wiki/Entity%E2%80%93relationship_model)).

M:N relationships cannot be directly implemented as physical tables, so a junction (link) entity is placed in the middle to resolve it into two 1:N relationships. If students and courses have an M:N relationship, create a "Enrollment" entity and bring in the student PK and course PK. If an exam asks "How is an M:N relationship resolved?", the answer is this junction entity.

### Participation Constraint (Must it exist?)

If cardinality refers to the maximum count, participation constraint refers to the minimum count. A minimum of 0 means optional, while a minimum of 1 means mandatory.

- An employee must belong to one department : Mandatory on the employee side
- A department can be created without any employees : Optional on the department side

This participation constraint later determines whether an FK column allows NULL values. If mandatory, the FK is NOT NULL; if optional, NULL is allowed. This will be revisited below.

## Order for Reading Relationships

When a relationship sentence is given in a problem, read it in this order:

1. Create sentences in both directions.
2. Write down the maximum (one/multiple) for each direction → Cardinality
3. Write down the minimum (can exist without/must exist) for each direction → Participation Constraint
4. Can the child exist without the parent? → Proceed to identifying/non-identifying judgment

<details>
<summary>Example: Order and OrderItem</summary>

- Order → OrderItem : An order has multiple item rows (Maximum N). Assuming an order with no items does not exist, the minimum is 1.
- OrderItem → Order : An item row must belong to one order (Maximum 1, Minimum 1).

Therefore, it is 1:N, and the child side is mandatory. Since an OrderItem row cannot exist without an Order, it becomes a candidate for an identifying relationship later. Remember that if business rules change, the minimum count may also change. For example, "An order can be created without items" would make the minimum on the order side 0.
</details>

## Identifiers

An identifier is an attribute (or set of attributes) within an entity that uniquely points to a single row. In modeling, it's often called an identifier, while in physical tables, it's commonly referred to as a key; exams typically treat these two concepts as part of the same flow.

### Conditions for a Primary Identifier

To qualify as a primary identifier, it usually needs to satisfy the following four conditions:

| Characteristic | Meaning |
|---|---|
| Uniqueness | Values must differ for each row |
| Minimality | Includes only the minimum necessary attributes |
| Immutability | Does not change once established |
| Existence | Cannot be NULL; a value must always exist |

Immutability is particularly often a trap. Phone numbers or email addresses may appear unique but can change, making them unreliable as primary identifier candidates. For minimality, remember: "Even if it's already unique, do not add more attributes."

### Classification by Basis

- Representational (Primary Key vs. Alternate Key): When relating to another entity, if used as the representative identifier, it is a primary key; if not used as the representative, it is an alternate key.
- Self-generated (Internal Key vs. External Key): If created within its own entity, it is internal; if brought from another entity, it is external.
- Number of Attributes (Simple vs. Composite): If there is one attribute, it is simple; if two or more, it is composite.
- Substitutability (Natural vs. Artificial): If used originally in business operations, it is natural; if newly created for convenience, it is artificial.

<details>
<summary>More on Natural and Artificial Keys</summary>

Artificial keys are values generated by the system, like serial numbers. They have the advantage that their values do not carry business meaning and remain unchanged, allowing a foreign key to end in a single column. However, since they lack inherent meaning, duplicate business data may slip through; therefore, unique constraints are often applied separately to the original business keys. These pros and cons are summarized in the same direction in the explanation of surrogate keys ([Wikipedia: Surrogate key](https://en.wikipedia.org/wiki/Surrogate_key)).

As composite identifiers become longer, the primary key continues to grow as you descend into child tables. Therefore, artificial keys are sometimes used in practice; exams express this as "replacing a composite identifier with a single artificial identifier."
</details>

## Identifying and Non-identifying Relationships

This is the core of this unit. The criterion is simple: does the parent's primary key appear in the child's primary key?

| Type | Parent PK in Child | Child Existence | ERD Line |
|---|---|---|---|
| Identifying Relationship | Becomes part of the child PK | Exists only if parent exists | Solid line |
| Non-identifying Relationship | Becomes a regular attribute (FK) of the child | Can exist without parent | Dashed line |

In an identifying relationship, the parent's primary key becomes part of the child's primary key, and each child row must be linked to exactly one parent. Orders and order items are classic examples. Order items combine order number and line number as their PK and cannot exist without an order ([Wikipedia: Weak entity](https://en.wikipedia.org/wiki/Weak_entity)).

```sql
-- 식별 관계: 부모 PK(order_no)가 자식 PK에 포함
CREATE TABLE orders (
  order_no INTEGER PRIMARY KEY,
  memo     TEXT
);
CREATE TABLE order_item (
  order_no INTEGER NOT NULL REFERENCES orders(order_no),
  line_no  INTEGER NOT NULL,
  item     TEXT,
  PRIMARY KEY (order_no, line_no)
);

-- 비식별 관계: 부모 PK(dept_id)는 일반 컬럼으로 FK, NULL 허용 = 선택
CREATE TABLE dept (dept_id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE emp (
  emp_id  INTEGER PRIMARY KEY,
  dept_id INTEGER REFERENCES dept(dept_id),
  name    TEXT
);
```

I ran this DDL directly in SQLite. Inserting into `order_item` with a non-existent order number (9) was blocked due to a foreign key constraint violation, while inserting an employee with `dept_id` as NULL succeeded. This confirms that in identifying relationships, children cannot exist without parents, whereas optional non-identifying relationships allow children to exist without parents. (SQLite requires `PRAGMA foreign_keys=ON` to enforce foreign key checks.)

### Non-identifying Relationships are Divided into Two

Non-identifying relationships are further divided based on whether the FK allows NULL values.

- Mandatory Non-identifying: FK is NOT NULL; the child must have a parent.
- Optional Non-identifying: FK allows NULL; the child can exist without a parent.

The optionality seen earlier here shifts to whether the FK permits NULL. In exams, if a statement says "a child can be created without a parent," you should connect it as an optional non-identifying relationship.

### Which One to Choose?

- If the child has no meaning without the parent (e.g., Order and OrderItem): Identifying Relationship
- If the child is used independently and only references the parent (e.g., Employee and Department): Non-identifying Relationship
- If the child inherits PKs from multiple parents, the PK becomes long; thus, an alternative is to treat it as non-identifying and use an artificial key.

<details>
<summary>Issues Arising from Using Identifying Relationships</summary>

When identifying relationships span multiple levels, the primary key of the lowest-level entity inherits all the way up to the topmost parent's PK. This requires matching many columns during joins and results in larger indexes. Conversely, you can immediately tell which parent a dataset belongs to just by looking at the PK, making this well-suited for business scenarios where child records are cleaned up together with their parents. This is a point of contention regarding pros and cons; exams tend to ask you to distinguish options based on "characteristics of identifying relationships" rather than asking for a single correct answer.
</details>

## Frequently Encountered Types

| Type | Solution Approach |
|---|---|
| Determining Relationship Cardinality | Write the maximum count using bidirectional statements |
| Resolving M:N Relationships | Introduce a junction (associative) entity and split into two 1:N relationships |
| Choosing Identifier Conditions | Compare against uniqueness, minimality, immutability, and existence |
| Classifying Identifiers | First check "what criterion is being used for classification" (representational, generation location, number of attributes, substitutability) |
| Judging Identifying/Non-identifying | If parent PK is included in child → identifying; if it's a regular attribute → non-identifying |
| ERD Notation | Read solid/dashed lines, crow's foot, circles (0)/bars (1) |

The "identify the incorrect sentence" question type generally involves swapping terms. For example, it might reverse definitions like saying "In a non-identifying relationship, the parent PK becomes part of the child PK." Memorizing definitions line by line helps filter these out. When solving problems directly, it's better to explain the criteria from the table above as sentences rather than memorizing past exam questions verbatim. Check exam schedules and fees on the official website.

## Easily Confused Concepts

- Degree and selectivity are different. Degree is maximum; selectivity is minimum.
- Identifiers and FKs are different. An FK is an attribute pointing to another entity. If it becomes part of a PK, it's either an identifying or non-identifying relationship.
- Does adding surrogate keys mean business keys are unnecessary? No. Values that must be unique in practice should be enforced separately with UNIQUE constraints.
- Composite identifiers have multiple attributes, but the "minimum" condition still applies. Removing attributes that maintain uniqueness is unnecessary.

← Concept map (#/post/sqld-map)

Related posts: [Entities and Attributes](#/post/sqld-entity-attr) · [Understanding Data Modeling](#/post/sqld-modeling) · [Normalization and Performance in Data Modeling](#/post/sqld-norm-perf)

## Reference Links

- [Wikipedia: Entity–relationship model](https://en.wikipedia.org/wiki/Entity%E2%80%93relationship_model)
- [Wikipedia: Weak entity](https://en.wikipedia.org/wiki/Weak_entity)
- [Wikipedia: Surrogate key](https://en.wikipedia.org/wiki/Surrogate_key)