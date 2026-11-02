Embedding converts text (or images) into lists of numbers so that "similar meanings result in nearby numbers," while vector search is the process of finding those nearby items among them.

## What is Embedding?

OpenAI documents describe embedding as a vector (list) of floating-point numbers representing text. The distance between two vectors indicates the relevance between the texts; the closer they are, the more relevant they are.

This becomes easier to understand with an analogy to maps. Seoul and Busan have their locations defined by two numbers: latitude and longitude. If two coordinates are close, the two cities are also close. Embedding attaches these coordinates to sentences. However, instead of just two numbers, there are hundreds to thousands of dimensions. According to the OpenAI models mentioned in the document, `text-embedding-3-small` has a base dimension of 1536, and `text-embedding-3-large` has 3072 dimensions. The number of dimensions varies by model.

These coordinates are not set by humans. The embedding model learns to place texts used in similar contexts close together during the learning process. This concept was widely popularized in the 2013 word2vec paper (Mikolov et al.) at the word level. According to Green, it proposes two structures for cheaply learning continuous vector representations of words from large data and claims to achieve the highest level at the time in word similarity tests. Current sentence/document embedding is understood as an extension of this, though I have not traced the lineage exactly.

There is more about how LLMs handle words as numbers internally in [Details → LLM](#/post/ai-llm), but the embedding mentioned here is closer to "creating a single vector for a piece of text for search and comparison."

## Cosine Similarity

There are several ways to measure how close two vectors are, but cosine similarity is most commonly used for text. It looks at the angle between the two vectors. If they point in the same direction, it is 1; if perpendicular, 0; and if opposite, -1. It ignores length and only considers direction.

| Value | Meaning |
|---|---|
| Close to 1 | Directions are almost identical; meanings are similar |
| Near 0 | Little relevance |
| Negative | Opposite direction (rarely seen in actual text embeddings) |

OpenAI documents recommend cosine similarity and note that their own embeddings are normalized to a length of 1, so calculating only the dot product yields the same result. It is also stated that cosine distance and Euclidean distance produce the same ranking. This is because for vectors with a length of 1, the order by angle is the same as the order by distance. Therefore, in actual code, it is common to "normalize and then calculate the dot product."

<details>
<summary>Detailed explanation: Cosine similarity formula</summary>

For two vectors a and b, cosine similarity is as follows.

cos(a, b) = (a · b) / (|a| × |b|)

a · b is the sum of products of corresponding elements (dot product), and |a| is the length of the vector. If both vectors are pre-adjusted to a length of 1, the denominator becomes 1, making the dot product equal to cosine similarity. When storing normalization, doing it once leaves only multiplication and addition for search, making it fast.

</details>

## How is it different from keyword search?

Keyword search checks whether words in the query exist exactly in the document. It works well for finding exact terms, product codes, or error messages. However, if the words differ, it fails to find them.

| | Keyword Search | Vector Search |
|---|---|---|
| Criteria | Do words overlap? | Are meanings close? |
| Finding "Refund Method" document using query "Payment Cancellation Procedure" | Easy to miss due to different words | Captures based on similar meaning |
| Finding error code `E4012` | Captures exactly | Weak because it's a string with no meaning |
| Reason for results | Shows which words matched | Hard to explain why they are considered close |
| Requirements | Index | Embedding model + vector store |

Therefore, in practice, the two are often mixed (hybrid search). This part was not verified by reading official documentation but accepted as commonly stated. The method of attaching search results to an LLM to generate answers continues in [Details → RAG](#/post/ai-rag).

## Minimal Code Run Directly

Even without a real embedding model, the skeleton of "creating vectors, normalizing them, and finding close ones" can be seen with just numpy. Below is a toy example where axes are manually created as three categories (animals, food, vehicles). The only difference from actual models is that they generate these numbers directly. This code was executed on my PC to verify the behavior (numpy 2.5.4).

```python
import numpy as np

# 손으로 만든 3차원 벡터 (축: 동물, 음식, 탈것)
docs = {
    "고양이가 잔다":     [0.9, 0.1, 0.0],
    "강아지가 뛴다":     [0.8, 0.1, 0.1],
    "김치찌개를 끓인다": [0.1, 0.9, 0.0],
    "자전거를 탄다":     [0.1, 0.0, 0.9],
}
names = list(docs)
M = np.array([docs[n] for n in names], dtype=float)
M /= np.linalg.norm(M, axis=1, keepdims=True)   # 길이 1로 정규화

def search(q, k=2):
    q = np.array(q, dtype=float)
    q /= np.linalg.norm(q)
    scores = M @ q                  # 정규화했으니 내적 = 코사인
    for i in np.argsort(-scores)[:k]:
        print(f"{scores[i]:.3f}  {names[i]}")

search([0.85, 0.15, 0.0])           # "동물 쪽" 질문
```

Upon execution, "Cat sleeps" appears at the top with approximately 0.998, and "Dog runs" with approximately 0.991. Sentences about food and vehicles are pushed down.

To switch to a real model, only the part that generates numbers needs to be replaced. Below is an example using sentence-transformers.

```python
# pip install sentence-transformers 필요
from sentence_transformers import SentenceTransformer
model = SentenceTransformer("all-MiniLM-L6-v2")   # 모델 이름은 예시
vecs = model.encode(["환불 방법", "결제 취소 절차"], normalize_embeddings=True)
print(vecs @ vecs.T)   # 정규화했으니 내적 = 코사인 유사도 표
```

## Vector DB and ANN

The code above compares the query vector against the entire document collection. While this works fine for hundreds of documents, it becomes slow when dealing with millions, as every query requires a full comparison. Instead of finding the *exact* nearest neighbor, we use methods to quickly find something "almost as close." This is known as Approximate Nearest Neighbor (ANN) search. It trades some accuracy for speed.

A vector database stores vectors and maintains an ANN index to help locate nearby items efficiently. It often includes filtering capabilities based on metadata such as date or author. While there are many product names in the market, this article does not compare specific products.

Among ANN algorithms, HNSW is frequently mentioned. According to the abstract of the 2016 paper by Malkov & Yashunin, it is constructed using layered proximity graphs: starting with a broad search at the upper layers and narrowing down in lower layers. It claims that search complexity grows logarithmically. Some descriptions also note its similarity to skip lists.

To put it simply, finding a road on a world map is like first traveling roughly via a highway map before switching to a local neighborhood map. This analogy was added for my own understanding and does not reflect the original paper's wording.

<details>
<summary>Detailed explanation: The trade-off for accuracy</summary>

ANN may miss the true nearest neighbor. Therefore, we use a metric called recall to measure "how many of the top k truly close items were found." The HNSW abstract states that its neighbor selection heuristic significantly improves performance in high-recall ranges. Increasing index parameters raises recall but degrades speed and memory usage, creating a trade-off.

</details>

## Common Misconceptions

- Embeddings mean the model understands meaning: This is closer to saying that texts appearing in similar contexts within training data are placed near each other. The definition of "closeness" depends on what the model has learned.
- A similarity score close to 1 means identical meaning: Sentences with opposite meanings can still appear close if they share the same topic, according to some sources. I have not conducted direct experiments on this.
- Vector search replaces keyword search: Precise searches for code or names are better suited for keywords. Therefore, a hybrid approach is often used.
- Higher dimensions are always better: OpenAI documentation suggests reducing dimensions via `dimensions` to fit storage constraints. While higher dimensions contain more information, they also increase storage costs. I have no data outside of this document to quantify the quality difference.
- You can reuse existing vectors when switching models: Since each model has its own coordinate system, mixing and comparing them is not advisable. This is an inference based on principles rather than a direct verification from the document.

## Reference Links

- OpenAI Documentation, Embeddings: https://developers.openai.com/api/docs/guides/embeddings
- Malkov & Yashunin, HNSW (arXiv 1603.09320): https://arxiv.org/abs/1603.09320
- Mikolov et al., Efficient Estimation of Word Representations in Vector Space (arXiv 1301.3781): https://arxiv.org/abs/1301.3781

← [Concept Map](#/post/ai-map)

Related posts: [RAG](#/post/ai-rag) · [LLM](#/post/ai-llm) · [Context Window](#/post/ai-context-window)