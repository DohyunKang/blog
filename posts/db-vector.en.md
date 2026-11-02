A vector DB stores embedding vectors and quickly retrieves the k vectors most similar to a query vector. While a traditional DB finds rows with "equal values," a vector DB finds rows with "similar values."

## What is stored?

It stores arrays of numbers. When you feed a piece of text into an embedding model, it outputs a list of hundreds to thousands of numbers, which are stored alongside additional information (metadata) like the original document ID and source. For details on what embeddings are, see [detailed → Embedding](#/post/ai-embedding).

The primary use case is search. A representative example is RAG, where you embed a question to find similar document chunks and then feed them to an LLM. [detailed → RAG](#/post/ai-rag)

## Can't we just compare everything?

It works if the dataset is small. You can compare the query vector against every stored vector one by one, score them, and sort by score for exact results. This is called exhaustive search (brute force). The problem is that it slows down proportionally to the number of items.

Memory usage is also worth considering. Storing a 1536-dimensional vector as float32 (4 bytes) takes about 6KB per vector; for 1 million vectors, that's about 6GB (calculated value). Index structures require additional memory. It is often stated that exhaustive search is sufficient when there are around hundreds of thousands of vectors and queries are infrequent. However, the threshold for "sufficient" depends on hardware and dimensionality, so you need to test it yourself.

## Approximate Nearest Neighbor (ANN)

When the number of items grows, you build an index. A vector index does not guarantee finding the *exact* nearest neighbor but finds something "almost as close" much faster. This is called Approximate Nearest Neighbor (ANN). Traditional DB indexes assume exact results ([detailed → Index](#/post/db-index)), whereas vector indexes trade off some accuracy from the start to gain speed.

Accuracy is measured by recall: the ratio of how many items the index finds among the true top 10 closest ones. A recall of 0.95 means it correctly identifies an average of 9.5 out of the top 10.

There are two representative methods:

| | IVF (IVFFlat) | HNSW |
|---|---|---|
| Idea | Divides vectors into clusters (lists) and scans only a few clusters close to the query | Starts broad from upper layers of a layered proximity graph and narrows down to lower layers |
| Build | Requires data to create clusters (training phase) | Can be built on an empty table |
| Speed & Recall | Relatively low | Relatively high |
| Build time & Memory | Low | High |

The comparison in the table above regarding pgvector is taken from the pgvector README. HNSW was introduced in a 2016 paper by Malkov & Yashunin; according to green-highlighted notes, search cost grows logarithmically due to starting search from upper layers and separating links by distance scale. It is also described as resembling a skip list.

### Trying to build IVF myself

Since the principle wasn't clear visually, I built a toy example using numpy with 20,000 64-dimensional vectors divided into 100 clusters, scanning only `probes` number of clusters close to each query.

```python
import numpy as np
rng = np.random.default_rng(0)
N, D, K, C = 20000, 64, 10, 100
centers = rng.normal(size=(C, D))
X = centers[rng.integers(0, C, N)] + 0.5 * rng.normal(size=(N, D))
X /= np.linalg.norm(X, axis=1, keepdims=True)
Q = X[rng.choice(N, 200, replace=False)] + 0.1 * rng.normal(size=(200, D))
Q /= np.linalg.norm(Q, axis=1, keepdims=True)

def exact(q):                       # 전수 탐색: 전부 비교
    return np.argsort(-(X @ q))[:K]

# k-means로 군집 만들기 (10번만 반복)
cent = X[rng.choice(N, 100, replace=False)].copy()
for _ in range(10):
    lab = np.argmax(X @ cent.T, axis=1)
    for c in range(100):
        m = X[lab == c]
        if len(m): cent[c] = m.mean(0)
    cent /= np.linalg.norm(cent, axis=1, keepdims=True)
lab = np.argmax(X @ cent.T, axis=1)
lists = [np.where(lab == c)[0] for c in range(100)]

def ivf(q, probes):                 # 가까운 군집 probes개만 훑기
    cs = np.argsort(-(cent @ q))[:probes]
    ids = np.concatenate([lists[c] for c in cs])
    return ids[np.argsort(-(X[ids] @ q))[:K]]
```

The execution results were as follows (run directly on my PC):

| probes | recall@10 | Average vectors scanned |
|---|---|---|
| 1 | 0.95 | 231 / 20000 |
| 3 | 1.00 | 631 / 20000 |
| 10 | 1.00 | 2036 / 20000 |

Scanning just one cluster yielded a recall of 0.95 with only about 1% coverage. This was under easier conditions because the data clusters were distinct; it doesn't mean this is what happens with real-world data, but rather that increasing `probes` improves recall while increasing the amount scanned. Query speed was not measured.

<details>
<summary>Where are similar controls in pgvector?</summary>

pgvector is a PostgreSQL extension. According to the README, indexes are created like this:

```sql
CREATE INDEX ON items USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX ON items USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
```

- HNSW: `m` (default 16) and `ef_construction` (default 64) are set during build; `hnsw.ef_search` (default 40) is set at query time. Larger values increase recall but slow down performance.
- IVFFlat: `lists` is the number of clusters. The README recommends starting with rows/1000 for up to 1 million rows, and the square root of the row count for larger datasets. `ivfflat.probes` (default 1) serves the same role as `probes` in the toy example above.
- Distance operators: `<->` for L2 distance, `<#>` for negative inner product, `<=>` for cosine distance.
- The maximum dimension for creating an index is 2,000 for the `vector` type and 4,000 for `halfvec`.

</details>

## Filters make it tricky

In actual services, conditions such as "only among this user's documents" or "only after 2024" are applied. However, implementing these with vector indexes is more difficult than expected. The pgvector README explains that filters in approximate indexes are applied *after* index search. For example, if only 10% of rows match the condition and `ef_search` is set to 40, on average only 4 candidates remain out of the top 40. This means you may not be able to retrieve the requested k results.

Several solutions are documented. If few rows match the condition, a full (exact) search is appropriate; if there are few distinct values, consider partial indexes; if there are many, consider partitioning. Starting from version 0.8.0, an iterative index scan is also available, which continues scanning the index until enough results satisfying the conditions are collected.

Qdrant documents take a different approach. If you create a payload index for filtering beforehand, edges considering the filter are added to the HNSW graph. Consequently, if you add data before creating the payload index and then try to add it later, you must rebuild the HNSW. Each database solves this problem differently.

<details>
<summary>strict order vs relaxed order</summary>

pgvector's iterative scan has two modes: `strict_order` maintains results in exact distance order, while `relaxed_order` sacrifices some ordering accuracy for better recall. Scanning does not continue indefinitely; it stops at `hnsw.max_scan_tuples` (default 20,000).

</details>

## pgvector or Dedicated DB?

If you are already using PostgreSQL, pgvector is the least cumbersome option. It allows general columns alongside vectors, enabling filtering via SQL and JOINs, while leveraging existing transaction and backup mechanisms ([see details → Relational Databases and SQL](#/post/db-rdb-sql)). Another significant advantage is that you do not need to operate an additional service.

Dedicated vector databases (such as Qdrant, Pinecone, Milvus, Weaviate, etc.) specialize in vector search, so features like filtering structures, quantization, and distributed processing are optimized for vectors. However, they require operating an additional service and managing data synchronization between the source database and the vector database.

My understanding of the selection criteria is as follows:

| Situation | Recommendation |
|---|---|
| Already using PostgreSQL, not many vectors, heavy filtering/JOINs | pgvector |
| Very large number of vectors, search is core to the service | Consider dedicated DB |
| Around a few thousand items, prototype stage | Full scan or file-level storage is sufficient |

These are general guidelines; the numerical boundaries depend on data and query patterns, so you must evaluate them directly. For positioning relative to other types like key-value stores or document databases, see [see details → NoSQL](#/post/db-nosql). For how to scale a database as it grows, see [see details → Scaling](#/post/db-scaling).

## Common Misconceptions

- You do not need a vector database to perform RAG. If the scale is small, full scan is sufficient. Building a small-scale RAG is covered in [see details → Building RAG Yourself](#/post/app-rag-build).
- Results from vector indexes are not exact nearest neighbors. Because they are approximate, some items may be missed; you must balance recall and speed when configuring settings.
- Changing the embedding model means you cannot reuse existing vectors. Since each model has a different coordinate system, you must re-embed data and rebuild the index (this is generally known information and was not separately verified in this document).
- Vector search does not completely replace keyword search. Proper nouns or precise terminology sometimes benefit more from keyword search.

← Concept map ([#/post/db-map])

Related articles: [Embedding](#/post/ai-embedding) · [Index](#/post/db-index) · [Building RAG Yourself](#/post/app-rag-build)

## Reference Links

- pgvector README (index options, defaults, filtering, iterative scan): https://github.com/pgvector/pgvector
- Malkov & Yashunin, HNSW (arXiv 1603.09320, abstract available): https://arxiv.org/abs/1603.09320
- Qdrant documentation, Indexing (payload index, filterable HNSW): https://qdrant.tech/documentation/concepts/indexing/