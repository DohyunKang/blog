图数据库是一种以点（节点）和线（关系）而非表（行·列）形式存储数据的数据库。Neo4j 文档指出：“数据以节点、关系和属性进行存储，而不使用表或文档。”其代表产品是 Neo4j，查询语言为 Cypher。

## 与关系型数据库的区别

在关系型数据库中，若要查找“朋友的朋友”，必须通过 `JOIN` 连接同一张表；每多一步，就需要增加一次 `JOIN`。

```sql
-- 친구(friendship) 테이블을 두 번 JOIN해서 친구의 친구를 찾는 모양
SELECT f2.friend_id
FROM friendship f1
JOIN friendship f2 ON f1.friend_id = f2.user_id
WHERE f1.user_id = 1;
```

Neo4j 文档对此部分的对比如下：关系型数据库依赖 `JOIN` 连接数据，这是一种计算成本高昂的操作；而图数据库不使用 `JOIN`，而是直接将关系存储在节点旁边。因此，文档称沿着边遍历的速度更快。此外，文档还提到其模式（schema）并非固定不变，这使得模型更容易灵活调整。

| | 关系型 DB | 图数据库 |
|---|---|---|
| 基本单位 | 表的行 | 节点和关系 |
| 关系表达 | 外键 + JOIN | 直接存储关系 |
| 擅长的问题类型 | 聚合、条件搜索、结构化数据 | 查找多步连接的对象 |
| 模式 (Schema) | 预先确定 | 相对灵活 |

如果死记“图数据库更快”就会出错。根据上述表格，其适用性取决于问题的形态。这部分将在下方的“何时适用”中进一步阐述。

## 属性图模型

Neo4j 采用的模型是属性图（property graph）。要素共有四种：

- **节点**：代表对象，如人物、电影等。可以为节点附加 0 个或多个标签（`Label`），例如 `Person`。
- **关系**：连接两个节点的线。必须且只能有一个起始节点和一个结束节点，并带有类型和方向。
- **属性**：附加在节点和关系上的键值对。关键点在于关系也可以拥有属性（例如：`ACTED_IN` 关系上可附带 `role`）。
- **标签**：用于归类节点的名称标识。

```
(Keanu:Person {name:'Keanu Reeves'}) -[:ACTED_IN {roles:[...]}]-> (Matrix:Movie {title:'The Matrix'})
```

即使存在箭头方向，查询时仍可沿反向或无方向路径进行遍历。

## Cypher 示例

Cypher 采用类似绘图的模式语法：节点用括号 `()` 表示，关系用方括号 `[]` 和箭头表示。以下示例遵循 Neo4j 文档中的电影数据集语法。

**创建**。为节点添加标签和属性，并在现有节点之间建立关系。

```cypher
CREATE (charlie:Person:Actor {name: 'Charlie Sheen'}), (oliver:Person:Director {name: 'Oliver Stone'})

MATCH (charlie:Person {name: 'Charlie Sheen'}), (oliver:Person {name: 'Oliver Stone'})
CREATE (charlie)-[:ACTED_IN {role: 'Bud Fox'}]->(wallStreet:Movie {title: 'Wall Street'})<-[:DIRECTED]-(oliver)
```

**查找**。使用 `MATCH` 匹配符合模式的记录，并通过 `RETURN` 返回结果。

```cypher
MATCH (keanu:Person {name:'Keanu Reeves'})
RETURN keanu.name AS name, keanu.born AS born
```

**反向遍历关系**。从电影找到导演。

```cypher
MATCH (m:Movie {title: 'The Matrix'})<-[d:DIRECTED]-(p:Person)
RETURN p.name AS director
```

**条件与排序**。

```cypher
MATCH (bornInEighties:Person)
WHERE bornInEighties.born >= 1980 AND bornInEighties.born < 1990
RETURN bornInEighties.name AS name, bornInEighties.born AS born
ORDER BY born DESC
```

**相隔两层的节点**。`--{2}` 是表示“两次关系”的固定长度模式。在前面的 SQL 中需要写两次 `JOIN`，而在这里只需一个数字即可表达。

```cypher
MATCH (tom:Person {name:'Tom Hanks'})--{2}(colleagues:Person)
RETURN DISTINCT colleagues.name AS name, colleagues.born AS bornIn
ORDER BY bornIn
LIMIT 5
```

<details>
<summary>详细解析：步数未知时（可变长度）</summary>

文档中的量化路径模式允许指定重复次数范围。文档示例展示了沿车站行进的模式。

```cypher
(n:Stop)-[:NEXT]->{1,10}(m:Stop)
```

`->{1,10}` 表示将 `NEXT` 关系重复 1 到 10 次。若应用于人物关系，可写作 `(a:Person)-[:KNOWS]->{1,3}(b:Person)`，其中 `KNOWS` 是我举例使用的名称。

文档指出虽然仍保留旧式的星号语法（`*1..3`），但符合 GQL 标准的是上述的量化方式。两者的语义略有不同，需参考文档中的链接资源进行确认和使用。

若不对重复次数设置上限而允许任意步数，当图规模较大时可能导致结果爆炸，因此建议设置上限以确保安全。

</details>

## 与知识图谱及 LLM 的结合点

将事实表述为“主语 - 关系 - 宾语”，其结构直接对应节点 - 关系 - 节点。这种累积的事实网络构成了 [知识图谱](#/post/ai-knowledge-graph)，而图数据库则是存储此类数据的候选方案。关于定义点和线约定的讨论，将在 [本体与三元组](#/post/ai-ontology-triple) 中继续展开。

它与 [LLM](#/post/ai-llm) 主要在两个方面结合：
1. 从图中检索数据以回答查询问题。这与仅检索文档片段的 [RAG](#/post/ai-rag) 不同，它是沿着关系路径收集信息（[GraphRAG](#/post/ai-graphrag)）。
2. 将模型的天然语言查询转换为 Cypher 语句。此时生成的查询可能出错或与模式不匹配，因此需要在执行前进行验证。由于关系被显式存储，我们可以追踪答案是通过何种路径得出的，从而更容易检查 [幻觉](#/post/ai-hallucination) 问题。

## 何时适用，何时不适用

适用的情况是当关系成为问题的核心时。

- 寻找跨越多个步骤的连接（如“朋友的朋友”、“同一作品中的人物”）
- 答案在于“如何连接”，例如路径、推荐等
- 关系类型频繁增减，不希望固定数据模式的场景

相反的情况则不适用。

- 类似订单、结算等需要对行进行聚合并计算总和的常规任务。这是关系型数据库经过长期打磨的领域。
- 几乎不存在关系、以单一查询为主的数据
- 团队熟悉 SQL 但对 Cypher 尚不熟悉时的运维负担

文档所提到的优点（无需 JOIN、模型灵活）仅适用于关系遍历场景。因此，我认为与其彻底替换现有的关系型数据库，不如将关系中重要的部分单独构建为图结构，这种架构更为现实。

## 常见误解

- 图数据库总是比 SQL 快：聚合或简单查询，关系型数据库表现更好。“更快”指的是沿连接路径进行的查询。
- 图数据库没有模式（Schema）：这仅意味着灵活，但如何对节点和关系进行建模仍需设计。文档也指出可以为节点添加索引和约束。
- 添加图数据库就能提高 LLM 回答的准确性：如果图中包含的事实错误或遗漏，LLM 的回答也会随之出错。构建图本身才是核心工作。

## 参考链接

- Neo4j, Graph database concepts: https://neo4j.com/docs/getting-started/get-started-with-neo4j/graph-database/
- Neo4j Cypher Manual, Basic queries: https://neo4j.com/docs/cypher-manual/current/queries/basic/
- Neo4j Cypher Manual, CREATE: https://neo4j.com/docs/cypher-manual/current/clauses/create/
- Neo4j Cypher Manual, Variable-length patterns: https://neo4j.com/docs/cypher-manual/current/patterns/variable-length-patterns/

← [概念地图](#/post/ai-map)

相关文章：[知识图谱](#/post/ai-knowledge-graph) · [GraphRAG](#/post/ai-graphrag) · [RAG](#/post/ai-rag)