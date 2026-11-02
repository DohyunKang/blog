A triple is a single sentence written in three slots—subject, predicate, and object—expressing a relationship like "A has this relation to B." When you gather many such sentences, they form a graph; an ontology defines the meanings and rules for the terms used in that graph. To understand knowledge graphs, you first need these two components ([learn more → Knowledge Graph](#/post/ai-knowledge-graph)).

## Triples

The W3C RDF 1.1 Primer describes RDF sentences in the form `<subject> <predicate> <object>`. A single sentence represents a relationship between two resources and consists of three parts, hence the name "triple." The predicate is also referred to as a property.

| Subject | Predicate | Object |
|---|---|---|
| Seoul | capital of | Republic of Korea |
| Republic of Korea | name | "Republic of Korea" |
| Seoul | type | city |

Triples connect when they share the same resource. The subject and object become nodes, while the predicate becomes an arrow between nodes in the graph. In the table above, since "Seoul" appears in two rows, it is grouped into a single node.

When written in a table, it looks like a simple three-column table, but the difference lies in the fact that the values in the cells are not strings but globally recognized identifiers used worldwide.

## IRIs and Literals

According to the Primer, an IRI is used to refer to resources in RDF. It is the internationalized version of what is commonly called a URI, and URLs are also a form of IRI. Since IRIs are global identifiers, they can be reused as-is when others refer to the same target. All three positions in a triple can contain an IRI.

For example, writing "Seoul" simply as `Seoul` could lead to different meanings in different documents. Writing it as an IRI like `http://example.org/city/Seoul` fixes it to a single target that the address points to (this address is an example created by me for explanation purposes).

Values (literals) are basic values that are not IRIs, such as strings, dates, and numbers. They have data types, and strings can include language tags. Literals can only appear in the object position of a triple. In the table above, the name cell with "Republic of Korea" enclosed in quotes is a literal.

Resources without identifiers are represented as blank nodes. The Primer compares blank nodes to simple variables in algebra.

## What Schemas and Ontologies Do

With triples alone, no one defines what the predicate "capital of" means. Therefore, a vocabulary that defines terms is needed, and in RDF, RDF Schema (RDFS) performs this task. The components introduced by the Primer are as follows:

| Element | Function |
|---|---|
| Class | A category for classifying resources; instances are linked to classes via the `type` property. |
| subClassOf | Declares that one class is a subclass of another (hierarchy). |
| subPropertyOf | Declares that one property is a subproperty of another. |
| domain | The class that the subject of this property must belong to. |
| range | The class that the object of this property must belong to. |

When classes and relationship types are defined in this way, it is called an ontology. The OWL 2 Overview document describes an ontology as "a structured vocabulary dealing with a specific domain and shared by a user community," stating that terms are defined in relation to other terms. OWL 2 is a formally defined ontology language that provides classes, properties, individuals, and data values. You can think of it as expressing more than RDFS. OWL 2 ontologies are primarily exchanged as RDF documents, and any OWL 2 ontology can be viewed as an RDF graph.

### Inference

Since meanings are formally defined, machines can derive new triples from existing ones. An example from the Primer is simple:

- Fact: `ex:bob foaf:knows ex:alice`
- Declaration: The domain of `foaf:knows` is `foaf:Person`
- Inference: `ex:bob` is a `foaf:Person`

Even though it wasn't explicitly stated that Bob is a person, this follows from the domain declaration of the predicate. The Primer refers to such cases where a set of triples implies another triple as entailment and notes that reasoners can also detect inconsistencies. An example would be a non-integer literal appearing in a value declared as an integer.

OWL 2 documentation lists "class consistency, subsumption, and instance retrieval" as queries answered by reasoners. It also states that OWL 2 RL inference is "sound but generally not complete." In other words, while the derived conclusions can be trusted, whether all derivable conclusions are found depends on the profile used.

## Differences from Property Graphs

There is no single way to handle graphs. The property graph approach, where attributes are directly attached to nodes and relationships, is widely used in [Graph Databases](#/post/ai-graph-db). RDF, on the other hand, represents everything as triples, shares names and vocabularies globally using IRIs, and has standardized schemas and inference rules. Rather than saying one is better than the other, it's more accurate to say they serve different purposes. We will not delve into a detailed comparison of the two in this article and move on.

## Example: Simple Model

If we place the above Seoul example alongside its schema, it looks like this. Since I haven't run the code directly, I'm listing only the table.

| Category | Triple |
|---|---|
| Schema | domain of Capital (attribute) = City, range = Country |
| Schema | City and Country are classes |
| Fact | Seoul is the capital of South Korea |
| Inferred | Seoul is a city; South Korea is a country |

Although only one line was written for the fact, two additional lines are derived thanks to the schema. This structure is similar to Bob's example in the Primer.

## Common Misconceptions

- Ontologies are philosophical terms and therefore difficult: What we discuss here can be understood simply as a shared vocabulary that defines concepts and relationships.
- RDF is a type of database: RDF is a model for representing data, while storage and querying are separate concerns.
- Having a schema prevents incorrect data by checking it: In RDFS, domain/range are essentially inference rules. As in the Bob example above, they are used to say "if this is true, then that is also true," rather than marking something as "false."
- Inference yields all conclusions: As shown above, OWL 2 RL does not guarantee completeness.
- IRIs must be open web addresses: URLs are just one form of IRI; the core of an IRI is that it serves as a global identifier.

<details>
<summary>Detailed Explanation: Literal Position Restrictions and Blank Nodes</summary>

The Primer explicitly states that literals can only be used in the object position. Therefore, a sentence like "a string given" cannot be created directly; instead, if needed, we work around it by creating a resource with an attribute holding that string.

Blank nodes are used for intermediate nodes where naming is inconvenient or unnecessary. They can appear in subject or object positions.

</details>

## Reference Links

- W3C, RDF 1.1 Primer: https://www.w3.org/TR/rdf11-primer/
- W3C, OWL 2 Web Ontology Language Document Overview: https://www.w3.org/TR/owl2-overview/

← [Concept Map](#/post/ai-map)

Related articles: [Knowledge Graph](#/post/ai-knowledge-graph) · [Graph DB](#/post/ai-graph-db) · [GraphRAG](#/post/ai-graphrag)