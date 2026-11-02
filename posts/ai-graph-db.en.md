A graph database stores data as nodes and relationships (edges) rather than in tables (rows and columns). The Neo4j documentation explains that it stores data using "nodes, relationships, and properties," avoiding the use of tables or documents. Its flagship product is Neo4j, and its query language is Cypher.

## Differences from Relational Databases

In a relational database, to find "a friend's friend," you must join the same table repeatedly. Each additional step adds another JOIN.

```sql
-- 친구(friendship) 테이블을 두 번 JOIN해서 친구의 친구를 찾는 모양
SELECT f2.friend_id
FROM friendship f1
JOIN friendship f2 ON f1.friend_id = f2.user_id
WHERE f1.user_id = 1;
```

The Neo4j documentation contrasts this by noting that relational databases connect data using JOINs, which are computationally expensive operations. In contrast, graph databases do not use JOINs; instead, they store relationships directly alongside nodes. Therefore, traversing along edges is faster, according to the documentation. The docs also mention that because the schema is not fixed, it is easier to flexibly change the model.

| | Relational DB | Graph DB |
|---|---|---|
| Basic Unit | Table rows | Nodes and relationships |
| Relationship Representation | Foreign keys + JOIN | Direct storage of relationships |
| Queries It Handles Well | Aggregation, conditional search, structured data | Finding connections several steps away |
| Schema | Fixed in advance | Relatively flexible |

Memorizing "graph databases are faster" is incorrect. As shown in the table above, performance depends on the nature of the query. This distinction will be revisited in the section below titled "When does it work?"

## Property Graph Model

The model used by Neo4j is the property graph. There are four elements:

- **Node**: An entity such as a person or movie. You can attach zero or more labels (e.g., `Person`).
- **Relationship**: A line connecting two nodes. It must have exactly one start node, one end node, and one type, and it is directed.
- **Property**: Key-value pairs attached to nodes and relationships. The key point is that properties can also be attached to relationships (e.g., `role` on `ACTED_IN`).
- **Label**: A name tag used to group nodes.

```
(Keanu:Person {name:'Keanu Reeves'}) -[:ACTED_IN {roles:[...]}]-> (Matrix:Movie {title:'The Matrix'})
```

Even though arrows indicate direction, queries can traverse in the opposite direction or without regard for direction.

## Cypher Examples

Cypher uses patterns that look like drawing diagrams. Nodes are enclosed in parentheses `()`, relationships use square brackets `[]` and arrows. The examples below follow the syntax from the Neo4j documentation using a movie dataset.

**Create.** Assign labels and properties to nodes, and create relationships between existing nodes.

```cypher
CREATE (charlie:Person:Actor {name: 'Charlie Sheen'}), (oliver:Person:Director {name: 'Oliver Stone'})

MATCH (charlie:Person {name: 'Charlie Sheen'}), (oliver:Person {name: 'Oliver Stone'})
CREATE (charlie)-[:ACTED_IN {role: 'Bud Fox'}]->(wallStreet:Movie {title: 'Wall Street'})<-[:DIRECTED]-(oliver)
```

**Find.** Capture patterns that match using `MATCH` and return results with `RETURN`.

```cypher
MATCH (keanu:Person {name:'Keanu Reeves'})
RETURN keanu.name AS name, keanu.born AS born
```

**Traverse relationships in reverse.** From a movie to its director.

```cypher
MATCH (m:Movie {title: 'The Matrix'})<-[d:DIRECTED]-(p:Person)
RETURN p.name AS director
```

**Conditions and sorting.**

```cypher
MATCH (bornInEighties:Person)
WHERE bornInEighties.born >= 1980 AND bornInEighties.born < 1990
RETURN bornInEighties.name AS name, bornInEighties.born AS born
ORDER BY born DESC
```

**People two steps apart.** `--{2}` is a fixed-length pattern meaning "two relationships." In the SQL example above, where JOIN was used twice, here it is represented by a single number.

```cypher
MATCH (tom:Person {name:'Tom Hanks'})--{2}(colleagues:Person)
RETURN DISTINCT colleagues.name AS name, colleagues.born AS bornIn
ORDER BY bornIn
LIMIT 5
```

<details>
<summary>Detailed explanation: When the number of steps is unknown (variable length)</summary>

The documentation's quantified path patterns allow specifying a range for the repetition count. The example in the docs shows a shape following stations.

```cypher
(n:Stop)-[:NEXT]->{1,10}(m:Stop)
```

`->{1,10}` means repeating the `NEXT` relationship from 1 to 10 times. For person relationships, you could write something like `(a:Person)-[:KNOWS]->{1,3}(b:Person)`. `KNOWS` is a name I used as an example.

The documentation notes that the older asterisk notation (`*1..3`) still exists but states that the quantified approach above aligns with the GQL standard. Since their meanings differ slightly, you should check the linked references in the documentation before using them.

Allowing any number of steps without an upper limit can cause result explosion when the graph is large, so setting an upper limit appears safer.

</details>

## Intersection with Knowledge Graphs and LLMs

If facts are written as "subject - relationship - object," they directly become node-relationship-node structures. This web of accumulated facts is a [Knowledge Graph](#/post/ai-knowledge-graph), and graph databases are candidates for storing them. The discussion on defining the conventions for points and lines continues in [Ontology & Triples](#/post/ai-ontology-triple).

It intersects with [LLMs](#/post/ai-llm) in two ways. First, it involves retrieving data from a graph to answer questions; unlike [RAG](#/post/ai-rag), which only retrieves document chunks, this follows relationships to gather information ([GraphRAG](#/post/ai-graphrag)). Second, the model converts natural language questions into Cypher. Since the generated queries can be incorrect or incompatible with the schema, a verification step is needed before execution. Because relationships are explicitly stored, it is easier to trace how an answer was derived via specific paths, which facilitates checking for [hallucinations](#/post/ai-hallucination).

## When to Use It and When It Doesn't Fit

It works well when relationships are central to the question.

- Questions about finding entities connected through multiple steps (e.g., friends of friends, actors in the same movie)
- Questions where the answer is "how they are connected," such as paths or recommendations
- Data where relationship types frequently change and expand, making a fixed schema undesirable

The opposite applies when it does not fit.

- Routine tasks involving aggregation and summation over rows, such as orders and settlements, which are well-established domains for relational databases.
- Data with minimal relationships and focused primarily on single queries.
- Operational overhead when the team is familiar with SQL but new to Cypher.

The advantages mentioned in the document (no JOINs, flexible model) apply only to graph traversal. Therefore, I believe it is more practical to isolate relationship-heavy parts into a graph rather than replacing an existing relational database entirely.

## Common Misconceptions

- Graph databases are always faster than SQL: Aggregation and simple queries are better suited for relational databases. Speed refers specifically to queries that traverse connections.
- Graph databases have no schema: This means flexibility, but you still need to design how nodes and relationships are modeled. The document also notes that indexes and constraints can be applied to nodes.
- Adding a graph database makes LLM answers more accurate: If the facts stored in the graph are incorrect or missing, the results will remain inaccurate. Building the graph is the core task.

## Reference Links

- Neo4j, Graph database concepts: https://neo4j.com/docs/getting-started/get-started-with-neo4j/graph-database/
- Neo4j Cypher Manual, Basic queries: https://neo4j.com/docs/cypher-manual/current/queries/basic/
- Neo4j Cypher Manual, CREATE: https://neo4j.com/docs/cypher-manual/current/clauses/create/
- Neo4j Cypher Manual, Variable-length patterns: https://neo4j.com/docs/cypher-manual/current/patterns/variable-length-patterns/

← [Concept Map](#/post/ai-map)

Related posts: [Knowledge Graph](#/post/ai-knowledge-graph) · [GraphRAG](#/post/ai-graphrag) · [RAG](#/post/ai-rag)