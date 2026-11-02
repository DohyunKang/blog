In SQLD Subject 1, the topic of entities and attributes contains many questions about terminology and classification. What you need to memorize includes five characteristics of an entity, two criteria for classification, two types of attribute classification, and domain definition. It is helpful to grasp the overall flow first in [Understanding Data Modeling](#/post/sqld-modeling).

## Terminology First

An Entity (Entity) is an identifiable object that needs to be managed in business operations. It is created to store information. When moved to a DB, an entity corresponds to a table, an instance to a row, and an attribute to a column.

| Term | Meaning | Viewed as a Table |
|---|---|---|
| Entity | A set of objects to be managed | Table |
| Instance | An individual object belonging to an entity | Row (Row) |
| Attribute | The smallest meaningful unit possessed by an entity | Column |
| Attribute Value | The value actually entered into an attribute | Cell |

The containment relationship is remembered as `Attribute Value ⊂ Attribute ⊂ Instance ⊂ Entity`. One entity can have two or more instances, one instance can have two or more attributes, and one attribute has one attribute value. There are question types where these numbers appear mixed in the options.

```
엔터티: 회원
  인스턴스 1: (m01, 김철수, 010-1111-2222)
  인스턴스 2: (m02, 이영희, 010-3333-4444)
  속성: 회원ID, 이름, 전화번호
  속성값: 'm01', '김철수', ...
```

## Five Characteristics of an Entity

Questions often ask you to choose between "things that can be entities" and "things that cannot." If any one of the following five conditions is broken, it is difficult to consider it an entity.

1. It must be information used in business operations. Data that is not needed should not be made into an entity.
2. It must have an identifier to distinguish instances. An identifier can be a single attribute or a combination of multiple attributes.
3. There must be two or more instances. There is no reason to create an entity for an object that exists only once in its lifetime.
4. It must have attributes. An entity cannot exist with just a name and no attributes.
5. It must have at least one relationship with other entities. Entities existing alone without relationships are usually inefficient.

For example, an option stating "Company name and address exist as only one item, but this is made into an entity" violates condition 2 regarding instances. When solving, first determine which of the five conditions the option triggers.

## Entity Classification: Two Criteria

Classification has two criteria, and exams mix questions about which criterion and type. Memorize the pairs of criterion names and type names.

### Classification Based on Tangibility

| Type | Description | Example |
|---|---|---|
| Strong Entity | Has a physical form, is stable, and is used continuously | Product, Member, Employee |
| Conceptual Entity | Exists as a concept without physical form | Department, Major |
| Event Entity | Occurs during business operations, happens frequently, and is used for statistics | Order, Event Entry |

A common method is to take the first letters and remember it as "유개사" (Yu-Gae-Sa).

### Classification Based on Occurrence Timing

| Type | Description | Example |
|---|---|---|
| Basic Entity | Exists originally in business operations and arises independently. Can have child entities. | Product, Member, Employee, Department |
| Central Entity | Created from a basic entity and plays a central role in business operations. Contains much data and creates behavior entities. | Order, Sales Revenue, Contract |
| Behavior Entity | Created from two or more entities. Data changes frequently or continues to grow. | Order Details, Event Entry |

Remember it as "기중행" (Gi-Jung-Ha). Thinking that things are derived from basic to central, and then from central to behavior helps avoid confusion in order.

<details>
<summary>Frequently Confused Points</summary>

- The definitions of Central Entity and Behavior Entity vary slightly depending on the material. Some materials describe a Central Entity as being derived from a Basic Entity, while others describe it as playing a connecting role between Basic and Behavior Entities. It is safest to use the definition provided in the textbook you are studying.
- Event Entity (based on tangibility) and Behavior Entity (based on occurrence timing) may look similar but have different criteria. If the question mentions "occurrence timing," choose from Basic, Central, and Behavior; if it mentions "type/tangibility," choose from Strong, Conceptual, and Event.
- The same object can receive a different name depending on the criterion. For example, 'Order' appears as an Event under the tangibility criterion but as a Central Entity under the occurrence timing criterion.

</details>

## Naming Entities

Naming rules also appear in question options. In summary, they are as follows:

- Use terms actually used in business operations.
- Do not use abbreviations for Korean, and use uppercase letters for English.
- Use singular nouns, and do not allow spaces.
- The name should not overlap in meaning with other entities.
- The name must clearly reveal the data possessed by that entity.

Options such as "Use plural forms" or "Actively use abbreviations" are incorrect sentences.

## Attributes

An attribute is the smallest meaningful unit possessed by an entity. You can consider it to be a level where meaning is lost if split further. There are two classification criteria for attributes.

### Classification Based on Characteristics

| Type | Description | Example |
|---|---|---|
| Basic Attribute | An attribute that originally exists in the entity; not created from other attributes. | Name, Price, Quantity |
| Designed Attribute | An attribute not present initially but created during design as needed. | Artificial identifiers like Serial Number |
| Derived Attribute | An attribute calculated from other attributes. | Total Amount, Age |

Derived attributes are values that can be computed through calculations; storing them leads to redundancy and inconsistencies when the original data changes. However, some systems intentionally retain them for query performance, a topic revisited in [Normalization and Performance Data Modeling](#/post/sqld-norm-perf) under denormalization.

### Classification by Composition Method

| Type | Description |
|---|---|
| PK Attribute | An attribute that forms part of the primary key identifying an instance. |
| FK Attribute | A foreign key attribute derived from relationships with other entities. |
| General Attribute | An attribute that is neither a PK nor an FK. |

PK and FK attributes are further explored alongside identifier types in [Relations and Identifiers](#/post/sqld-relation-identifier). Here, it suffices to understand that attributes fall into three categories.

Additionally, multi-valued attributes containing multiple values are handled by separating them into distinct entities. Structures allowing multiple values in a single field also relate to normalization issues. Reviewing [Normalization Concepts](#/post/db-normalization) together will aid understanding.

## Domain

A domain defines the range of permissible values for an attribute. Each attribute has an assigned domain, considered alongside data type, length, and allowed values. For example, if the domain of the 'Gender' attribute is limited to 'Male, Female', no other values are permitted. In exam questions, you may be asked whether the definition "a set of values an attribute can hold" is correct.

## Solution Approach

Problems in this unit are filtered using the following steps after reading the options:

1. Determine whether the question concerns an entity or an attribute.
2. For classification problems, first check the criterion (tangible/intangible / point of occurrence / characteristics / composition method).
3. Match examples mentioned in the options (e.g., Order, Department, Total Amount) to their respective category under the given criterion.
4. For characteristic-based questions, identify which option violates one of the five conditions.
5. For naming rule problems, first suspect sentences with errors in singular/plural usage, abbreviations, or spacing.

<details>
<summary>Questions for Self-Check</summary>

- Why is an object with only one instance not considered an entity?
- Which category does 'Total Amount' fall into among Basic, Designed, and Derived attributes?
- Can you list three types under both the tangible/intangible criterion and the point-of-occurrence criterion?
- Can you explain why entity names are not pluralized using a sentence from the options?

</details>

Check exam schedules and registration details on the official website.

← [Concept Map](#/post/sqld-map)

Related posts: [Understanding Data Modeling](#/post/sqld-modeling) · [Relations and Identifiers](#/post/sqld-relation-identifier) · [Normalization and Performance Data Modeling](#/post/sqld-norm-perf)

## Reference Links

- [SQLD Subject 1 Summary (Velog)](https://velog.io/@86400/SQLD-1과목-정리)
- [SQLD Entity (Inblog)](https://inblog.ai/soultree/sqld-%EC%97%94%ED%84%B0%ED%8B%B0entity-28766)
- [Understanding Data Modeling (Velog)](https://velog.io/@ani2689/SQLD-데이터-모델링의-이해)