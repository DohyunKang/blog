A knowledge graph is a data structure that represents things in the world (people, places, companies, concepts) as nodes and connects them with lines to show their relationships. The key point is that instead of storing blocks of text, it records "who has what relationship" individually.

## Components

You only need to know three things.

- **Entity**: A node. Examples include Marie Curie, Taj Mahal, or Warsaw.
- **Relation**: A line connecting two nodes. Names like "birthplace" or "discovered" are assigned to these lines.
- **Attribute**: A value attached to a node. These are numbers or text, not other entities (e.g., birth date, population).

A unit consisting of these three elements written in a single sentence is called a triple (triple). It comprises the subject, predicate, and object. The W3C's RDF introduction defines this structure directly. A sentence always follows the format `<subject> <predicate> <object>`, where the subject and object become nodes in the graph, and the predicate becomes an arc (edge). Since the same entity can appear as a subject in one triple and as an object in another, stacking triples naturally forms a graph. Triples and ontologies are covered separately in [Details → Ontology & Triple](#/post/ai-ontology-triple).

## Example

```
(마리 퀴리) --태어난 곳--> (바르샤바)
(마리 퀴리) --발견했다--> (폴로늄)
(마리 퀴리) --분야--> (물리학)
(바르샤바) --속한 나라--> (폴란드)
(바르샤바) --인구--> 숫자 값   ← 속성
```

When written in a table, it looks like this:

| Subject | Predicate | Object |
|---|---|---|
| Marie Curie | birthplace | Warsaw |
| Marie Curie | discovered | Polonium |
| Warsaw | country of | Poland |

With these three lines, you can answer "Which country was Marie Curie born in?" by following the path twice: Curie → Warsaw → Poland. This entire sentence does not need to exist verbatim in any single document. This is the utility of a knowledge graph—you walk along the relationships.

The example above was created by me to illustrate concepts and does not reflect the exact structure of actual data.

## When Google Popularized It

A common reference point for this term is its widespread adoption, often linked to Google. On May 16, 2012, Amit Singhal posted a blog post on Google's site introducing the idea that search should focus on "things, not strings"—moving from simple text matching to understanding actual objects. The scale mentioned in the article included over 500 million entities and over 3.5 billion facts/relations. The materials cited include open-source data such as Freebase, Wikipedia, and the CIA World Factbook.

The tasks performed in search are summarized into three categories:

| Task | Example from Article |
|---|---|
| Disambiguation | Distinguishes whether "Taj Mahal" refers to a building or a musician |
| Key Summary | Searching for Marie Curie displays her birth/death dates, education, and achievements alongside the results |
| Related Exploration | Connected entities like family members, or "People also search for" sections |

This article was Google's self-promotion, so the scale figures reflect Google's announcements at that time. Furthermore, the concept of a knowledge graph itself did not originate then; rather, what was discussed was an implementation applied to Google Search.

## How It Differs from Relational DBs and Vector Search

All three involve "storing and retrieving," but they differ in their retrieval criteria.

| | Relational DB | Vector Search | Knowledge Graph |
|---|---|---|---|
| Storage Unit | Rows and columns in a table | Numerical vectors of text fragments | Entities and relations (triples) |
| Retrieval Criteria | Values matching specific conditions | Items with similar meaning | Reaching items by following connections |
| Strong Suit Questions | "Total orders in March" | "Articles similar to refund policy" | "What is the relationship between A and B?" |
| Weakness | Joins become complex with deep relationships | Does not guarantee accurate factual connections | Effort required to structure data |

Vector search converts text into numbers using [embedding](#/post/ai-embedding) to find semantically similar items. Being "close" means "similar," not "connected." To find the relationship between Marie Curie and Poland, two documents containing both would need to be part of the same fragment in vector search; however, a knowledge graph already has that relationship explicitly written as a line.

Dedicated databases for storing graphs are covered separately in [Graph DB](#/post/ai-graph-db). A relational database can also store a knowledge graph. Whether you use a specific storage system and how you view the data shape are separate considerations.

## Where It Is Used

- **Search**: As seen in the Google example above, for disambiguation, summary cards, and displaying related entities.
- **Recommendation**: Designs that treat users, products, and genres as entities connected by relations are common. I have not verified exactly how specific services implement this in practice.
- **LLM Assistance**: Instead of relying solely on a model to read text and answer, facts and relationships serve as evidence for verification. A variant of the search step in [RAG](#/post/ai-rag) that follows relations instead of retrieving vector fragments is called [GraphRAG](#/post/ai-graphrag). It is frequently mentioned as an effort to reduce [hallucinations](#/post/ai-hallucination), where facts are fabricated incorrectly.

<details>
<summary>Detailed explanation: What changes when attached to an LLM?</summary>

[LLM](#/post/ai-llm) answers based on patterns learned from its training data. Therefore, it struggles with questions requiring multiple reasoning steps, such as "Who is the boss of A's boss," as it tends to fabricate intermediate connections. With a knowledge graph, you can extract entities from the question and follow their relationships by traversing two or three hops to retrieve triples, which can then be included in the prompt. The amount of information added to the prompt consists of just a few relevant triples, thereby consuming less of the [context window](#/post/ai-context-window).

However, this approach requires that the graph be constructed beforehand. Extracting entities and relationships from documents to build the graph is a separate task; if the extraction is incorrect, the resulting graph will also be flawed. Further details on the architecture are covered in the GraphRAG post.

</details>

## Common Misconceptions

- Knowledge graphs are specific products: It is actually a concept and a data model. The term popularized by Google does not imply a single implementation; there are many ways to build them and various storage options available.
- Building a graph makes AI smarter on its own: If the data is incorrect or empty, the responses will reflect that state. Without relationships, the system cannot traverse any paths.
- It replaces vector search: Each method excels at different types of queries, and they are often used together in combined architectures.
- Visualized dots and lines constitute a knowledge graph: The diagram is merely a visualization method; the core entity is the structured data organizing entities and their relationships.

## Reference Links

- Google, Introducing the Knowledge Graph: things, not strings (Amit Singhal, 2012-05-16): https://blog.google/products/search/introducing-knowledge-graph-things-not/
- W3C, RDF 1.1 Primer: https://www.w3.org/TR/rdf11-primer/

← [Concept Map](#/post/ai-map)

Related posts: [Ontology & Triple](#/post/ai-ontology-triple) · [GraphRAG](#/post/ai-graphrag) · [Graph Database](#/post/ai-graph-db)