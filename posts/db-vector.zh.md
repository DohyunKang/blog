向量数据库（Vector DB）是一种存储嵌入向量，并能快速检索出与查询向量最接近的 k 个结果的数据库。如果说普通数据库是寻找“值相同的行”，那么向量数据库则是寻找“值相似的行”。

## 存储的是什么

存储的是数字数组。将一段文本输入嵌入模型后，会生成数百到数千个数字组成的列表，并将其与原文 ID、来源等附加信息（元数据）一起存储。关于嵌入（Embedding）的详细内容请见 [详情 → 嵌入](#/post/ai-embedding)。

主要用途是搜索。例如，将问题转换为嵌入向量以查找相似的文档片段，并将这些片段提供给 LLM，这就是典型的 RAG（检索增强生成）。[详情 → RAG](#/post/ai-rag)

## 为什么不直接全部比较

如果数据量较少，这样做也是可以的。将查询向量与存储的所有向量逐一进行比较并按分数排序，结果是准确的。这种方法称为全量搜索（brute force, exact search）。问题在于其速度会随着数据量的增加而变慢。

内存消耗也值得考量。以 1536 维的 float32（4 字节）格式存储一个向量约为 6KB，100 万个则约为 6GB（计算值），此外索引结构还需要额外占用空间。经常看到这样的说法：当向量数量在数十万左右且查询频率不高时，全量搜索通常也足够。至于“足够”的界限取决于硬件和维度，需要自行评估。

## 近似最近邻（ANN）

当数据量增加时，就需要建立索引。向量索引并不保证找到绝对最近的结果，而是能更快地找到“几乎最近”的结果。这种方法称为近似最近邻（Approximate Nearest Neighbor, ANN）。普通数据库的索引建立在结果准确的前提下（[详情 → 索引](#/post/db-index)），而向量索引则是在一开始就牺牲部分精度以换取速度。

准确性通常用召回率（recall）来衡量。即在真正接近的前 10 个结果中，索引找出了多少个的比例。例如召回率为 0.95，意味着在平均情况下能正确找到前 10 个中的 9.5 个。

主要有两种代表性方法：

| | IVF(IVFFlat) | HNSW |
|---|---|---|
| 思路 | 将向量划分为簇（列表），仅扫描与查询最接近的几个簇 | 在分层构建的近似图中，从上层的粗略范围逐步缩小到下层的精细范围 |
| 构建方式 | 需要数据来构建簇（学习阶段） | 即使在空表上也能构建 |
| 速度·召回率 | 相对较低 | 相对较高 |
| 构建时间·内存占用 | 较少 | 较多 |

上述关于 pgvector 的比较内容源自 pgvector README 的说明。HNSW 出自 2016 年 Malkov & Yashunin 的论文，根据绿色图表所示，由于其从上层开始搜索以及按距离规模分离链接的机制，搜索成本呈对数级增长。也有说法称其结构与跳表（skip list）相似。

### 亲手实现一下 IVF

为了理解其原理，我用 numpy 写了一个玩具程序进行测试。将 2 万个 64 维向量划分为 100 个簇，每次查询仅扫描最接近的 `probes` 个簇。

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

运行结果如下（在我的 PC 上直接运行）：

| probes | recall@10 | 平均扫描的向量数 |
|---|---|---|
| 1 | 0.95 | 231 / 20000 |
| 3 | 1.00 | 631 / 20000 |
| 10 | 1.00 | 2036 / 20000 |

即使只扫描一个簇，仅查看约 1% 的数据就达到了 0.95 的召回率。这是因为我们将数据划分成了界限分明的簇，属于比实际情况更理想的条件。这并不意味着在实际数据中能达到同样的效果，只需关注随着 `probes` 增加，召回率上升而扫描量增加的这一趋势即可。未对查询速度进行测量。

<details>
<summary>pgvector 中是否有类似的调节参数</summary>

pgvector 是 PostgreSQL 的扩展。根据 README，索引构建方式如下：

```sql
CREATE INDEX ON items USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX ON items USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
```

- HNSW: `m`（默认 16）、`ef_construction`（默认 64）为构建时参数，`hnsw.ef_search`（默认 40）为查询时参数。数值设得越大，召回率越高但速度越慢。
- IVFFlat: `lists` 表示簇的数量。README 建议对于 100 万行以内的数据，以行数/1000 作为起始点；超过 100 万行则建议以行数的平方根作为起始点。`ivfflat.probes`（默认 1）的作用与上述玩具程序中的 `probes` 相同。
- 距离算子：`<->` 为 L2 距离，`<#>` 为负内积，`<=>` 为余弦距离。
- 可建立索引的维度：基于 `vector` 类型最高支持 2000 维，`halfvec` 类型最高支持 4000 维。

</details>

## 加上过滤条件后变得复杂

在实际服务中，通常会附加诸如“仅针对该用户的文档”、“仅限 2024 年之后”之类的条件。而在向量索引中，这比想象中要困难得多。pgvector README 指出，在近似索引中，过滤器是在索引搜索之后应用的。例如，如果符合条件的行占 10%，且 `ef_search` 为 40，那么在候选的 40 个结果中平均只剩下 4 个。这意味着可能无法满足请求的 k 个结果数量。

文档中提到了几种应对方法：如果符合条件的行较少，则适合进行精确（全量）搜索；如果值种类较少，可考虑部分索引；如果值种类较多，则应考虑分区。从 0.8.0 版本开始，还引入了迭代索引扫描（iterative index scan），即持续扫描索引，直到收集到足够多的满足条件的结果为止。

Qdrant 文档则提出了不同的方案。它建议预先创建用于过滤的 payload 索引，因为这样可以在 HNSW 图中添加考虑了过滤器的边；如果之后才添加 payload 索引，则需要重新构建整个 HNSW 图。同样的问题，不同数据库有不同的解决方案。

<details>
<summary>strict order 与 relaxed order</summary>

pgvector 的迭代扫描支持两种模式：`strict_order` 会保持结果按精确距离排序；而 `relaxed_order` 则允许顺序略有偏差，但能提供更好的召回率。扫描不会无限进行，会在 `hnsw.max_scan_tuples`（默认为 20,000）处停止。

</details>

## 使用 pgvector 还是专用向量数据库？

如果你已经在生产环境中使用 PostgreSQL，那么 pgvector 是最省事的方案。它允许在向量列旁边存储普通列，从而可以用 SQL 进行过滤并执行 JOIN 操作，同时可以直接复用现有的事务和备份机制（[详情 → 关系型数据库与 SQL](#/post/db-rdb-sql)）。此外，无需额外增加服务节点也是一个重要优势。

专用向量数据库（如 Qdrant、Pinecone、Milvus、Weaviate 等）则以向量搜索为核心功能，其过滤结构、量化和分布式处理等功能都是围绕向量特性设计的。但代价是需要额外运营一个服务，并且需要在原始数据库与向量数据库之间同步数据。

我总结的选择标准大致如下：

| 情况 | 建议方向 |
|---|---|
| 已使用 PostgreSQL，向量数量不多，过滤条件和 JOIN 操作频繁 | pgvector |
| 向量数量极大，且搜索是服务的核心功能 | 考虑专用向量数据库 |
| 数据量在几千条左右，处于原型开发阶段 | 全量扫描或文件级存储已足够 |

这些是一般性指导原则，具体的数值界限会因数据和查询方式的不同而变化，因此仍需根据实际情况自行评估。关于与其他类型存储（如键值存储、文档数据库）的定位，请参考 [详情 → NoSQL](#/post/db-nosql)；关于系统规模扩大后如何扩展数据库，请参考 [详情 → 扩展性](#/post/db-scaling)。

## 常见误解

- 并非只有使用向量数据库才能进行 RAG（检索增强生成）。在数据量较小时，全量扫描同样可行。构建小型 RAG 系统的方案可参考 [详情 → 亲手打造 RAG](#/post/app-rag-build)。
- 向量索引返回的结果并非精确的最近邻。由于是近似搜索，可能会遗漏某些结果，因此需要综合考量召回率和速度来调整配置参数。
- 更换嵌入模型后，无法直接复用现有的向量。因为不同模型使用不同的坐标系，必须重新计算嵌入并重建索引（这是普遍已知的事实，本文档未单独验证）。
- 向量搜索并不能完全取代关键词搜索。对于专有名词或精确术语，关键词搜索往往表现更好。

← 概念地图 (#/post/db-map)

相关文章：[嵌入](#/post/ai-embedding) · [索引](#/post/db-index) · [亲手打造 RAG](#/post/app-rag-build)

## 参考链接

- pgvector README（索引选项、默认值、过滤、迭代扫描）：https://github.com/pgvector/pgvector
- Malkov & Yashunin, HNSW (arXiv 1603.09320，查看预印本)：https://arxiv.org/abs/1603.09320
- Qdrant 文档，索引（payload 索引、支持过滤的 HNSW）：https://qdrant.tech/documentation/concepts/indexing/