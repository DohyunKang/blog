GraphRAG 是一种基于文档的检索增强生成（RAG）技术，它利用大语言模型（LLM）从文档中提取实体和关系以构建知识图谱，并为彼此邻近的实体集合（社区）预先生成摘要，以便在回答提问时使用。微软研究院于 2024 年通过论文和博客公开了该技术，并提供了开源库。

## 普通 RAG 的不足之处

[RAG](#/post/ai-rag) 的工作原理是检索与问题相似的若干文本块（chunks），并将其提供给 [LLM](#/post/ai-llm)。这种方法在处理询问特定事实的问题时表现良好。然而，GraphRAG 论文指出，RAG 在回答“关于整个文档集合的问题”时会失败。例如，“该数据集的主要主题是什么？”这类问题。论文认为，这并非检索问题，而是查询导向的摘要（query-focused summarization）问题。相反，现有的摘要方法无法处理 RAG 所能处理的文本量。

微软博客指出了两个弱点：

- 难以将分散在多份文档中的信息通过共同属性连接起来（即“连点成线”）。
- 对于需要理解整个大型文档集合的问题表现不佳。由于采用向量相似度检索，当询问“前五大主题”时，检索结果往往是包含“主题”一词的文本，而非数据的实际内容。

博客使用 VIINA 数据集进行了演示，该数据集收录了 2023 年 6 月俄罗斯与乌克兰的新闻文章。“Novorossiya 是什么？”这一问题两者均能较好回答，但“Novorossiya 做了什么？”普通 RAG 无法回答，而 GraphRAG 则能结合引用依据进行回答。博客说明该数据集是在模型训练时间点之后收集的，因此特意选用。

## GraphRAG 的功能

官方文档将 GraphRAG 介绍为“结构化且分层式的 RAG”。其索引（indexing）流程如下：

```
[색인 단계, 미리 한 번 — LLM이 많이 쓰인다]
문서 → TextUnit(청크) → 엔티티·관계·주장 추출 → 지식그래프
     → Leiden 방식으로 계층 군집화(커뮤니티) → 커뮤니티별 요약을 아래에서 위로 생성

[질문 단계]
Global: 커뮤니티 요약들 → 요약마다 부분 답 → 부분 답을 합쳐 최종 답
Local : 특정 엔티티 → 이웃 엔티티·관련 개념으로 퍼져 나가며 찾음
```

| 步骤 | 操作内容 | 参考文章 |
|---|---|---|
| 分块 | 将输入语料库分割为 TextUnit | [RAG](#/post/ai-rag) |
| 提取 | 由 LLM 抽取实体、关系及核心主张 | [知识图谱](#/post/ai-knowledge-graph), [本体与三元组](#/post/ai-ontology-triple) |
| 聚类 | 使用 Leiden 算法对图进行层次聚类 | [图数据库](#/post/ai-graph-db) |
| 摘要 | 自下而上为每个社区及其组成部分生成摘要 | |

普通 RAG 寻找的是“相似的文本片段”，而 GraphRAG 寻找的是“相连实体的集合及其摘要”。在检索时，普通 RAG 使用 [嵌入](#/post/ai-embedding) 向量查找文本块，而 GraphRAG 则沿着实体间的连接关系进行遍历。

## 四种提问方式

官方文档将搜索方式分为以下四类：

| 方式 | 适用问题类型 |
|---|---|
| Global Search | 针对整个语料库的大型问题，利用社区摘要 |
| Local Search | 针对特定实体的问题，会扩散至其邻居及相关概念 |
| DRIFT Search | 与 Local 类似，但将社区信息作为上下文补充 |
| Basic Search | 普通的 top-k 向量检索，适用于普通 RAG 已足够的问题 |

文档中保留了 Basic Search 选项这一点值得注意，暗示并非所有问题都需要借助图谱。

## 论文中的实验结果

论文在约 100 万 token 的数据集上测试了全局理解（global sensemaking）类问题。报告称，与基于普通 RAG 的基线相比，答案的包容性（comprehensiveness）和多样性（diversity）显著提升。博客中也提到类似结果：LLM 评估者 consistently 在包容性、多样性和提供依据方面更倾向于选择 GraphRAG。另一方面，通过 SelfCheckGPT 评估的忠实度（faithfulness）与普通 RAG 相当，博客指出评估框架仍在开发中。答案可引用源文本，以便与原文进行对照验证。

## 何时使用 GraphRAG，何时普通 RAG 已足够

从下文起是基于上述资料性质的区分：

| 场景 | 建议方案 |
|---|---|
| “该合同书的终止条款是什么？”等特定事实问题 | 普通 RAG |
| 单份文档或规模较小、可整体输入的情况 | 普通 RAG（或直接放入上下文，[上下文窗口](#/post/ai-context-window)） |
| “整个资料的主要主题与脉络是什么？” | GraphRAG Global |
| 需要连接分散在多份文档中的人物、组织或事件关系的问题 | GraphRAG Local/DRIFT |
| 频繁更新的文档 | 普通 RAG 更轻量（无需重新运行索引，负担较小） |

最后一行是基于下文关于成本的推理得出的结论，并非官方文档的原话。

## 成本与复杂度

GitHub 仓库的指南指出，GraphRAG 索引“可能是一项昂贵的任务”，并建议在了解文档处理流程和成本后从小规模开始。在撰写本文时，我发现官方文档首页和博客中并未提供具体的成本数字。由于索引的结构要求 LLM 对所有文本执行实体提取和摘要，其调用次数必然远多于普通 RAG 的一次嵌入操作。

官方文档“强烈建议”根据数据调整提示词（prompt），因为直接使用默认值可能无法获得最佳结果。此外，使用 `graphrag init --force` 会覆盖设置和提示词，因此也提醒用户注意备份。

## 常见误解

- GraphRAG 取代普通 RAG：文档本身将 Basic Search 列为选项之一，会根据问题类型进行选择。
- 必须拥有图数据库：本文检查的官方文档索引阶段并未提及图数据库。关于什么是图数据库，将在 [图数据库](#/post/ai-graph-db) 文章中另行讨论。
- 幻觉现象消失：论文和博客报道的忠实度指标与普通 RAG 处于相似水平（[幻觉](#/post/ai-hallucination)）。

<details>
<summary>详细解析：通过社区摘要回答所有问题的过程</summary>

根据论文摘要，当收到问题时，每个社区摘要会生成部分答案，然后对这些部分答案再次进行摘要以得出最终答案。由于摘要是在提问之前预先生成的，因此每次提问时无需阅读原文全文，只需读取摘要层即可。由于聚类是层次化的，用户可以选择使用哪个层级的摘要，从大的集合（主要主题）到小的集合（细分主题）。官方文档也解释说，摘要是从下往上构建的。

</details>

## 参考链接

- Edge et al., From Local to Global: A Graph RAG Approach to Query-Focused Summarization: https://arxiv.org/abs/2404.16130
- Microsoft GraphRAG 官方文档：https://microsoft.github.io/graphrag/
- Microsoft Research 博客，GraphRAG: Unlocking LLM discovery on narrative private data: https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/
- microsoft/graphrag 仓库（含成本说明）：https://github.com/microsoft/graphrag

← [概念地图](#/post/ai-map)

相关文章：[RAG](#/post/ai-rag) · [知识图谱](#/post/ai-knowledge-graph) · [图数据库](#/post/ai-graph-db)