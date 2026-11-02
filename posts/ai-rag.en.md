RAG is a method where, upon receiving a query, it first retrieves relevant documents and appends them to the prompt, allowing the model to answer based on that information. This enables the model to provide answers about content it doesn't know without retraining.

## Why is it needed?

[LLMs](#/post/ai-llm) only possess knowledge up to their training cutoff date. They naturally do not know about internal regulations changed yesterday or company-specific documents. While it would be ideal for them to admit ignorance when lacking information, they sometimes fabricate plausible-sounding answers ([hallucination → hallucinations](#/post/ai-hallucination)).

However, we cannot simply insert all documents into the prompt either. There are limits to the [context window](#/post/ai-context-window); costs increase with length, and there is a tendency for intermediate content to be underutilized. The "Lost in the Middle" paper reports that performance is high when relevant information appears at the beginning or end of the input but drops significantly when located in the middle—a trend observed even in models supporting long contexts.

That's why RAG involves selecting and including only the necessary parts. The term originates from a 2020 paper by Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks." The paper refers to knowledge stored in model weights as parametric memory and external knowledge (like Wikipedia vector indexes) as non-parametric memory, proposing a method that combines both. In my own words, it's like "memorized knowledge + an openable book."

## Flow

Here is the general flow:

```
[준비 단계, 미리 한 번]
문서 → 청킹(조각내기) → 임베딩(숫자 벡터로) → 벡터 DB에 저장

[질문이 올 때마다]
질문 → 임베딩 → 비슷한 청크 검색(top-k) → 프롬프트에 붙임 → 모델이 답변
```

| Step | Action | Key Point |
|---|---|---|
| Chunking | Splits documents into appropriate sizes | Becomes the unit for retrieval |
| Embedding | Converts chunks into meaning-rich vectors | [See details → Embedding](#/post/ai-embedding) |
| Retrieval | Finds chunks close to the query vector | Retrieves only the top k results |
| Prompt Injection | Appends chunks with instructions like "Answer based on the following materials" | [See details → Prompt](#/post/ai-prompt) |
| Answer Generation | The model reads the materials and writes the response | Including citations makes verification easier |

The prompt injection part roughly looks like this:

```
다음 자료만 근거로 질문에 답하라. 자료에 없으면 모른다고 답하라.

[자료 1] ...청크...
[자료 2] ...청크...

질문: ...
```

The single line saying "State if the information is not in the materials" is surprisingly important. Without it, the model fills gaps with its own knowledge when information is missing from the provided materials.

## Chunk Size

How chunks are split directly affects retrieval quality. Anthropic's Contextual Retrieval article also notes that chunk size, boundaries, and overlap influence search performance.

- If too large, multiple topics mix within a single chunk, blurring embeddings and consuming significant prompt space.
- If too small, sentences are cut without surrounding context, causing loss of meaning.
- Adding overlap allows neighboring chunks to capture content split at boundaries, though it increases duplication.

I haven't found a definitive token count that is optimal. The article itself suggests experimenting for each use case. While it's commonly said that splitting by title or paragraph works better than by character count depending on document type (regulations, conversations, code), I have not personally verified this claim.

## Re-ranking and Hybrid Search

The top k results from the initial retrieval are not always the best. Therefore, two additional techniques are often combined.

Hybrid search combines embedding-based retrieval (meaning-based) with BM25 (word-matching based). Embeddings excel at finding semantically similar content but may miss exact matches for error codes like "TS-999" or specific terminology. BM25 works in the opposite manner. The results from both are merged using rank fusion, and duplicates are removed.

Re-ranking is a step where, after an initial broad retrieval, a re-ranking model jointly evaluates the query and chunks to reassign scores, keeping only the top-ranked ones. Initial retrieval is fast but approximate, whereas re-ranking is slower but more precise. However, this introduces some latency, making the number of items to re-rank a trade-off between cost and speed.

Anthropic's article includes numerical data based on the ratio of cases where the correct answer was absent within the top 20 chunks (search failure rate).

| Method | Failure Rate | Compared to Baseline |
|---|---|---|
| Basic Embedding | 5.7% | Baseline |
| Embedding with context sentences appended to chunks | 3.7% | 35% reduction |
| Above + Context BM25 | 2.9% | 49% reduction |
| Above + Re-ranking | 1.9% | 67% reduction |

These values come from the article's own experimental conditions (dataset, re-ranking model is Cohere). There is no guarantee that similar reductions will occur with your data, but the direction is worth referencing.

The context appending technique mentioned here addresses the issue where chunks are split without company names or periods, such as "Revenue increased by 3% compared to the previous quarter," by adding a short explanatory sentence before each chunk.

## Failure Cases

Where RAG typically fails is generally not in the model itself but at the front-end stages.

- The necessary chunks are not retrieved from the search. This is the most common issue, and this metric measures exactly that failure rate.
- Chunks are cut in a way that loses context. The company name example above illustrates this.
- The information is found but buried in the middle, so the model doesn't use it. This refers to the "Lost in the Middle" phenomenon mentioned earlier.
- When multiple documents need to be combined for an answer (e.g., comparison or aggregation), the top few chunks are insufficient.
- Documents are outdated or contradict each other. While retrieval works fine, the data itself may be incorrect. This cannot be fixed with RAG.
- Even when provided with data, the model answers using its own knowledge or misreads the documents.

Therefore, when the answer is wrong, don't blame the "model" first; instead, check which chunks were included in the prompt—that's the proper order of investigation.

## How Fine-Tuning Differs

Both are grouped under "ways to make the model understand our stuff," but they do different things.

| | RAG | Fine-Tuning |
|---|---|---|
| What changes | The input the model sees | The model's weights |
| Best suited for | Frequently changing knowledge, internal documents, citations needed | Tone of voice, output format, consistent behavior |
| Knowledge updates | Fixing the documents is enough | Requires retraining |
| Citation attribution | Can display chunks directly | Difficult |

Practical articles discussing retrieval generally summarize it as "use RAG for knowledge issues and fine-tuning for behavioral issues," and often suggest combining both. However, most of these come from company or personal blogs and are more opinions than facts; I couldn't find controlled experiments comparing both approaches on the same task.

## Common Misconceptions

- Using RAG eliminates hallucinations: It only reduces them. If retrieval fails or the model ignores the retrieved data, it will still hallucinate just as before.
- Fine-tuning makes the model memorize document content: Practical articles commonly state that fine-tuning is weak for reliably memorizing facts. I haven't tried this myself.
- Having a vector DB means you have RAG: A database is just storage; quality depends on chunking, retrieval methods, and re-ranking.
- If context windows are longer, RAG isn't needed: For small knowledge bases (around 200k tokens or under 500 pages per Anthropic's guidelines), feeding everything in at once is simplest. Larger bases still require RAG.

<details>
<summary>Detailed explanation: How semantic search finds results</summary>

Embedding converts text into a list of numbers with hundreds to thousands of dimensions. Models trained to place semantically similar texts close together in vector space create these embeddings. Questions are also converted to vectors using the same model, and nearby chunks (based on cosine similarity, etc.) from the stored chunk vectors are selected. When there are many chunks, approximate nearest neighbor search indexes are used instead of comparing each one individually.

BM25 is a scoring function that considers how often and how rarely words appear. It caps word frequency to prevent common words from dominating scores and adjusts for document length. While it doesn't understand meaning, finding the same characters serves as a complementary relationship with embeddings.

</details>

## Reference Links

- Lewis et al., Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks: https://arxiv.org/abs/2005.11401
- Anthropic, Introducing Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
- Liu et al., Lost in the Middle: https://arxiv.org/abs/2307.03172
- (Summary of search results only) Collection of practical articles on RAG vs Fine-Tuning, e.g.: https://blog.premai.io/fine-tuning-vs-rag-a-decision-framework-for-custom-llm-applications

← [Concept map](#/post/ai-map)

Related articles: [Embedding](#/post/ai-embedding) · [Context Window](#/post/ai-context-window) · [Hallucination](#/post/ai-hallucination)