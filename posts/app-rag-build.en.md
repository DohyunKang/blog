[RAG](#/post/ai-rag) sounds simple just by reading about the concept, but when you try to build it yourself, there are specific areas that demand attention: how to chunk documents, what to use for creating vectors, how many to retrieve and combine, and how to evaluate success. This article records my journey of implementing minimal code that runs without external services, following these five steps in order. The code has been tested by direct execution.

## What We're Building

We'll work with three short documents similar to an internal FAQ (covering refunds, shipping, and accounts). When a question comes in, we'll find relevant chunks and construct a prompt up to that point. I've intentionally omitted the model invocation part; since any API call boils down to "sending the constructed prompt" in one line, everything you need to learn is before that.

```
문서 → 청킹 → 임베딩 → 저장(벡터 DB 자리) → [질문] → 검색 → 프롬프트 → (모델) → 답
```

| Step | Code in This Article | In Actual Usage |
|---|---|---|
| Chunking | Group by paragraphs, then split when character count exceeds limit | Based on tokens, using headings as units, etc. |
| Embedding | 2-gram text hash (toy version) | Embedding model API or local model |
| Vector DB | Single NumPy matrix | Use a vector database when document volume grows |
| Search | Top k by cosine similarity | Hybrid search, re-ranking |
| Prompt | Append data + question | Same |

The reason the embedding is a "toy" is simple: real embedding models require installation or keys, making it impossible to run this article's code as-is. Instead, I designed it so that only one function (`embed`) needs changing; the rest remains usable. The toy embedding looks only at character overlap, so it doesn't perform semantic search. The actual work embeddings do (bringing similar meanings closer) does not happen in this code.

## Full Code

```python
import re, zlib
import numpy as np

DOCS = {
    "refund.md": "환불 규정\n\n구매 후 7일 이내에는 사유와 관계없이 전액 환불된다. 7일이 지나면 환불되지 않는다.\n\n디지털 상품은 다운로드를 시작하면 환불이 어렵다.",
    "shipping.md": "배송 안내\n\n주문 후 평일 기준 2~3일 안에 도착한다. 제주와 도서 지역은 하루가 더 걸린다.\n\n배송 조회는 마이페이지의 주문 내역에서 한다.",
    "account.md": "계정 안내\n\n비밀번호를 잊으면 로그인 화면의 비밀번호 찾기에서 이메일로 재설정 링크를 받는다.\n\n탈퇴하면 주문 내역은 5년간 보관된다.",
}

def chunk(text, size=70, overlap=15):
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    out, buf = [], ""
    for p in paras:
        if buf and len(buf) + len(p) > size:
            out.append(buf)
            buf = buf[-overlap:] + "\n" + p
        else:
            buf = (buf + "\n" + p) if buf else p
    if buf:
        out.append(buf)
    return out

DIM = 512
def embed(text):
    # 장난감 임베딩: 글자 2-gram을 해시해서 벡터에 더한다.
    v = np.zeros(DIM)
    t = re.sub(r"\s+", "", text)
    for i in range(len(t) - 1):
        v[zlib.crc32(t[i:i+2].encode()) % DIM] += 1
    n = np.linalg.norm(v)
    return v / n if n else v

index = []  # (출처, 청크, 벡터)
for name, text in DOCS.items():
    for c in chunk(text):
        index.append((name, c, embed(c)))
M = np.stack([v for _, _, v in index])

def search(q, k=2):
    scores = M @ embed(q)
    top = np.argsort(-scores)[:k]
    return [(index[i][0], index[i][1], float(scores[i])) for i in top]

def build_prompt(q, hits):
    ctx = "\n\n".join(f"[자료 {i+1}: {n}] {c}" for i, (n, c, _) in enumerate(hits))
    return f"다음 자료만 근거로 답하라. 자료에 없으면 모른다고 답하라.\n\n{ctx}\n\n질문: {q}"

EVAL = [
    ("환불은 며칠 안에 해야 해?", "refund.md"),
    ("배송은 얼마나 걸려?", "shipping.md"),
    ("비밀번호 까먹었어", "account.md"),
    ("제주도는 배송이 더 느려?", "shipping.md"),
]

if __name__ == "__main__":
    print(len(index), "chunks")
    hit = 0
    for q, gold in EVAL:
        r = search(q, 1)
        ok = gold in [n for n, _, _ in r]
        hit += ok
        print(ok, q, "->", [n for n, _, _ in r])
    print("hit@1 =", hit / len(EVAL))
    print(build_prompt(EVAL[0][0], search(EVAL[0][0], 2)))
```

Running this produces 6 chunks, and all 4 evaluation questions find the correct document first (hit@1 = 1.0). At the end, the prompt to be sent to the model is printed.

## 1. Chunking

Chunking is the process of splitting documents into units for retrieval. In the code, paragraphs are separated by blank lines, and chunks are formed by grouping paragraphs until the `size` limit is exceeded, at which point a chunk is split. The next chunk starts with the last `overlap` characters from the previous chunk.

Running this reveals the problem with simple character-based overlap immediately. One of the chunk lists starts with "이 지나면 환불되지 않는다." (Refunds are not available after this). Because we're overlapping by character count, a word gets cut in half. Without knowing that the preceding sentence was about "7 days", this fragment alone makes no sense. Using sentence boundaries instead of character counts for overlap eliminates this issue. The Contextual Retrieval article from Anthropic also notes that chunk size, boundaries, and overlap affect retrieval performance, stating that chunks are typically under a few hundred tokens.

Also, the appropriate size varies by dataset. The 70-character limit in this article is deliberately small because the documents are very short.

## 2. Embedding

`embed` converts text into a list of numbers with length 512. The toy method splits text into pairs of characters, adds 1 to the corresponding hash bucket, and normalizes the final length to 1. Normalizing the length to 1 means the dot product of two vectors becomes cosine similarity, allowing search to be completed with a single matrix multiplication.

Using Python's built-in `hash()` function causes values to change on every run (because string hashes are randomized per process). That's why I switched to `zlib.crc32`. I initially used `hash()`, but changed it after realizing evaluation metrics could fluctuate.

There are two things to watch out for when switching to a real model: documents and questions must be embedded using the same model. Also, if you don't store the embedding dimension and model name, old vectors and new vectors will mix up when you switch models later.

## 3. Storage

`index` holds the list of chunks, and `M` is the matrix stacking the vectors. This approach is sufficient for thousands of chunks. Matrix multiplication is fast and easy to understand. Use a vector database if you exceed hundreds of thousands of items, have multiple servers, or documents change frequently. The main functions of a vector database are: approximate nearest neighbor search (finding without comparing everything), storing on disk, and filtering by metadata. The current code lacks all three. [Learn more → Vector DB](#/post/db-vector)

I included the source (file name) when saving so it can be attached to the prompt. With a source, the model can say "where I saw this" along with its answer, and humans can easily verify it.

## 4. Search

`search` embeds the question, computes dot products with all chunks, and returns the top k by score. There's no fixed value for k. The Anthropic article compared passing 5, 10, and 20 items to the model, finding that 20 performed best. While increasing the number raises the probability of including the correct answer, too many can make the model distracted, so I recommend experimenting directly.

It is also noted that semantic search alone can miss exact words like error codes, so a hybrid approach combining BM25 (based on word matching) with semantic search and merging their rankings is frequently used. This was not included in the code of this article because the document set is too small to observe any difference.

## 5. Prompt

The `build_prompt` function lists the data with numbers and sources, placing the question at the end. The instructions are two-fold: "Answer only based on the provided context; if the information is not present, state that you do not know." Without these instructions, the model will fill in gaps using its own knowledge ([hallucination](#/post/ai-hallucination)). Tips for crafting prompts are covered separately in [Prompt Engineering](#/post/ai-prompt).

When actually attaching a model, this string is sent as the user message to the API. Since the data must fit within the [context window](#/post/ai-context-window), you need to verify whether the combined length of k and chunk size stays within the limit.

## Evaluation

This is the stage most quickly forgotten after building the system. It begins with question-answer pairs stored in the code under `EVAL`. You can determine how many results are needed simply by checking if the correct document appears in the top k results (hit@k). This serves as the primary criterion to distinguish whether an incorrect answer stems from the retrieval or the model.

- Correct chunk not found in search results → Retrieval issue (chunking, embedding, k)
- Correct chunk exists but answer is wrong → Prompt or model issue

The hit@1 = 1.0 reported in this article should not be trusted. It was an extremely easy test with only 4 questions and 3 documents, where the question and document shared identical wording, so a simple character overlap yields a match. If you were to replace "refund" with "getting money back," this toy embedding would likely collapse immediately, but that was not tested in this article. Evaluation questions must be phrased as natural user queries and should include expressions not found in the documents to be meaningful.

[Read more → RAG evaluation & app evaluation](#/post/app-eval)

<details>
<summary>Detailed explanation: Metrics that evaluate up to the answer</summary>

hit@k measures only retrieval performance. For tools that also evaluate answer quality, Ragas is available. The names found on the document list page are Context Precision and Context Recall for retrieval, and Faithfulness and Response Relevancy for generation. Based on the names alone, it appears these metrics separately measure whether the necessary chunks were retrieved, whether the answer adheres to the provided context, and whether the response matches the question.

If you implement this yourself, start by manually creating 20–30 question-answer pairs and re-evaluating hit@k whenever you change parameters (chunk size, k, embedding model). The key point is to judge based on whether numbers improve and avoid relying on intuition for adjustments.

</details>

<details>
<summary>Detailed explanation: Additional enhancements to consider</summary>

- Replace embeddings with a real model: Change only the `embed` function and adjust `DIM` to match the model's dimensionality.
- Hybrid search: Combine BM25 scores and embedding scores to select top-ranked results. The Contextual Retrieval article mentions using rank fusion.
- Re-ranking: Retrieve a generous number of candidates (150 in the article) and then reduce them to over 20 using a re-ranking model.
- Add one line of context before chunks: A method to reduce issues where company names or time periods are missing from chunks.
- Caching: Do not recalculate embeddings if documents do not change. Repeatedly attaching the same data to prompts can reduce costs via [prompt caching](#/post/ai-prompt-caching).

</details>

## Reference Links

- Anthropic, Introducing Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
- Ragas, Available Metrics (list of metric names only): https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/
- Code for this article: Written and executed directly (no link available)

← [Concept map](#/post/ai-map)

Related articles: [RAG](#/post/ai-rag) · [Embedding](#/post/ai-embedding) · [Vector DB](#/post/db-vector)