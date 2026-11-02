GraphRAG is a Retrieval-Augmented Generation (RAG) approach that extracts entities and relationships from documents to build a knowledge graph, pre-generating summaries for each group of closely related entities (communities), which are then used when answering questions. Microsoft Research released this in 2024 via a paper and blog post, and an open-source library is also available.

## Where Standard RAG Falls Short

[RAG](#/post/ai-rag) works by finding a few chunks similar to the query and providing them to the [LLM](#/post/ai-llm). It performs well for questions about specific facts. However, the GraphRAG paper notes that standard RAG fails on "questions about the entire document collection." The example given is: "What are the main topics in this dataset?" From the paper's perspective, such questions are not retrieval problems but rather query-focused summarization problems. Conversely, existing summarization methods cannot handle the volume of text that RAG deals with.

The Microsoft blog highlights two key weaknesses:

- It struggles to connect information scattered across multiple documents based on common attributes ("connect the dots").
- It performs poorly on questions requiring understanding of an entire large document collection. Because it relies on vector similarity search, asking for "top 5 topics" retrieves articles containing the word "topic" rather than reflecting the actual content of the data.

The blog demonstrates this using VIINA, a dataset of Russian-Ukrainian news articles from June 2023. Both models answered "What is Novorossiya?" correctly, but standard RAG failed to answer "What did Novorossiya do?", whereas GraphRAG provided an answer with cited evidence. The blog notes that this dataset was chosen because it consists of materials published after the model's training period.

## What GraphRAG Does

Official documentation introduces GraphRAG as "structured and hierarchical RAG." The indexing phase proceeds as follows:

```
[색인 단계, 미리 한 번 — LLM이 많이 쓰인다]
문서 → TextUnit(청크) → 엔티티·관계·주장 추출 → 지식그래프
     → Leiden 방식으로 계층 군집화(커뮤니티) → 커뮤니티별 요약을 아래에서 위로 생성

[질문 단계]
Global: 커뮤니티 요약들 → 요약마다 부분 답 → 부분 답을 합쳐 최종 답
Local : 특정 엔티티 → 이웃 엔티티·관련 개념으로 퍼져 나가며 찾음
```

| Step | Action | Related Reading |
|---|---|---|
| Chunking | Splits the input corpus into TextUnits | [RAG](#/post/ai-rag) |
| Extraction | An LLM extracts entities, relationships, and key claims | [Knowledge Graph](#/post/ai-knowledge-graph), [Ontology & Triples](#/post/ai-ontology-triple) |
| Clustering | Performs hierarchical clustering on the graph using the Leiden algorithm | [Graph Database](#/post/ai-graph-db) |
| Summarization | Generates summaries for each community and its components (from bottom up) | |

While standard RAG finds "similar text fragments," GraphRAG finds "groups of connected entities along with their summaries." Embeddings are used when searching chunks via vectors, whereas the graph follows connections between entities.

## Four Query Modes

Official documentation categorizes search methods as follows:

| Method | Suitable Questions |
|---|---|
| Global Search | Broad questions about the entire corpus; utilizes community summaries |
| Local Search | Questions about specific entities; spreads to neighbors and related concepts |
| DRIFT Search | Similar to Local, but community information is added as context |
| Basic Search | Standard top-k vector search; sufficient for typical RAG queries |

It is notable that the documentation includes Basic Search. This suggests that not every question requires a graph.

## Results from the Paper

The paper tested global sensemaking questions on datasets of around 1 million tokens, reporting significant improvements in answer comprehensiveness and diversity compared to standard RAG baselines. Similarly, the blog states that LLM evaluators consistently rated GraphRAG higher than other methods in terms of comprehensiveness, diversity, and evidence provision. In contrast, faithfulness scores measured by SelfCheckGPT were comparable to standard RAG, and the blog notes that the evaluation framework is still under development. Answers can be verified against source text by citing the original documents.

## When to Use It vs. When Standard RAG Suffices

The following distinctions are inferred from the nature of the materials:

| Situation | Recommendation |
|---|---|
| Specific fact questions like "What is the termination clause in this contract?" | Standard RAG |
| Single document or small collection that can be inserted entirely | Standard RAG (or simply adding to context, [Context Window](#/post/ai-context-window)) |
| Questions about "main topics and flow of the entire dataset" | GraphRAG Global |
| Questions requiring connecting relationships between people, organizations, or events scattered across multiple documents | GraphRAG Local/DRIFT |
| Frequently changing documents | Standard RAG is lighter (less overhead for re-indexing) |

The last row is an inference continuing from the cost discussion below; it was not explicitly stated in the official documentation.

## Cost and Complexity

The GitHub repository guide notes that GraphRAG indexing "can be an expensive operation" and recommends starting small after understanding the process and costs by reading all documents. While writing this, I found no specific cost figures on the official documentation's first page or in the blog post. Given the architecture where the LLM performs entity extraction and summarization over all text during indexing, the number of calls will inevitably be much higher than a single embedding call in standard RAG.

The official documentation "strongly recommends" adjusting prompts to fit your data, as default settings may not yield optimal results. Additionally, running `graphrag init --force` will overwrite configurations and prompts, so a backup is advised.

## Common Misconceptions

- GraphRAG replaces standard RAG: The document itself lists Basic Search as an option, branching based on query type.
- A graph database is required: No mention of a graph database was found in the official documentation's indexing steps. What a graph database is is covered separately in the [Graph DB](#/post/ai-graph-db) post.
- Hallucinations disappear: Fidelity metrics reported in papers and blogs were at levels similar to standard RAG ([Hallucination](#/post/ai-hallucination)).

<details>
<summary>Detailed explanation: Answering all questions via community summaries</summary>

Based on the paper abstract, when a question is received, each community summary generates a partial answer, which are then summarized again to produce the final answer. Since summaries are pre-generated before questions are asked, only the summary layer needs to be read for each query, without reading the entire original text. Clustering is hierarchical, allowing you to choose at which level of summarization to operate—from large groups (broad topics) down to small groups (specific topics). The official documentation also explains that summaries are built from bottom to top.

</details>

## Reference Links

- Edge et al., From Local to Global: A Graph RAG Approach to Query-Focused Summarization: https://arxiv.org/abs/2404.16130
- Microsoft GraphRAG official documentation: https://microsoft.github.io/graphrag/
- Microsoft Research blog, GraphRAG: Unlocking LLM discovery on narrative private data: https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/
- microsoft/graphrag repository (cost guidance): https://github.com/microsoft/graphrag

← [Concept Map](#/post/ai-map)

Related posts: [RAG](#/post/ai-rag) · [Knowledge Graph](#/post/ai-knowledge-graph) · [Graph DB](#/post/ai-graph-db)