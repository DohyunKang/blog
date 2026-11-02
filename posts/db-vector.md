벡터 DB는 임베딩 벡터를 저장해 두고, 질의 벡터와 가장 가까운 것 k개를 빠르게 꺼내 주는 DB다. 일반 DB가 "값이 같은 행"을 찾는다면 벡터 DB는 "값이 비슷한 행"을 찾는다.

## 무엇을 저장하나

저장하는 건 숫자 배열이다. 글 하나를 임베딩 모델에 넣으면 수백~수천 개짜리 숫자 목록이 나오고, 이걸 원문 id·출처 같은 부가 정보(메타데이터)와 같이 넣어 둔다. 임베딩이 뭔지는 [자세히 → 임베딩](#/post/ai-embedding)에 있다.

쓰임새는 대부분 검색이다. 질문을 임베딩해서 가까운 문서 조각을 찾고, 그걸 LLM에 붙여 주는 RAG가 대표적이다. [자세히 → RAG](#/post/ai-rag)

## 그냥 다 비교하면 안 되나

데이터가 적으면 된다. 질의 벡터를 저장된 벡터 전부와 하나씩 비교해서 점수 순으로 자르면 정확하다. 이걸 전수 탐색(brute force, exact search)이라 한다. 문제는 개수에 비례해서 느려진다는 점이다.

메모리도 따져 볼 만하다. 1536차원 벡터를 float32(4바이트)로 저장하면 하나에 약 6KB고, 100만 개면 약 6GB다(계산값). 인덱스 구조는 별도로 더 먹는다. 벡터가 수십만 개 안팎이고 질의가 가끔이면 전수 탐색으로도 충분한 경우가 많다는 얘기를 자주 본다. 어디까지가 "충분"인지는 하드웨어와 차원에 따라 달라서 직접 재 봐야 한다.

## 근사 최근접 이웃(ANN)

개수가 늘면 인덱스를 만든다. 벡터 인덱스는 정확하게 가장 가까운 것을 보장하지 않고 "거의 가까운 것"을 훨씬 빨리 찾는다. 이걸 근사 최근접 이웃(Approximate Nearest Neighbor, ANN)이라 한다. 일반 DB 인덱스는 결과가 정확하다는 전제인데([자세히 → 인덱스](#/post/db-index)), 벡터 인덱스는 처음부터 정확도 일부를 내주고 들어간다는 점이 다르다.

정확도는 재현율(recall)로 잰다. 진짜 가까운 상위 10개 중 인덱스가 몇 개를 찾았는지의 비율이다. 재현율 0.95면 10개 중 평균 9.5개를 맞혔다는 뜻이다.

대표적인 방식은 두 가지다.

| | IVF(IVFFlat) | HNSW |
|---|---|---|
| 아이디어 | 벡터를 군집(리스트)으로 나누고 질의와 가까운 군집 몇 개만 훑는다 | 층층이 쌓은 근접 그래프에서 위층에서 크게 → 아래층에서 좁혀 간다 |
| 만들기 | 데이터가 있어야 군집을 만든다(학습 단계) | 빈 테이블에도 만들 수 있다 |
| 속도·재현율 | 상대적으로 낮다 | 상대적으로 좋다 |
| 빌드 시간·메모리 | 적다 | 많다 |

위 표의 pgvector 쪽 비교는 pgvector README 설명을 옮긴 것이다. HNSW는 2016년 Malkov & Yashunin 논문에서 나왔고, 초록 기준으로 위층에서 시작하는 탐색과 거리 규모별 링크 분리 덕에 탐색 비용이 로그 규모로 늘어난다고 한다. 건너뛰기 목록(skip list)과 닮았다는 설명도 있다.

### IVF를 직접 만들어 보면

원리가 눈에 안 들어와서 numpy로 장난감을 만들어 돌려 봤다. 64차원 벡터 2만 개를 100개 군집으로 나누고, 질의마다 가까운 군집 `probes`개만 훑는다.

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

실행 결과는 이랬다(내 PC에서 직접 실행).

| probes | recall@10 | 평균으로 훑은 벡터 수 |
|---|---|---|
| 1 | 0.95 | 231 / 20000 |
| 3 | 1.00 | 631 / 20000 |
| 10 | 1.00 | 2036 / 20000 |

군집 하나만 훑어도 1%쯤만 보고 재현율 0.95가 나왔다. 데이터를 군집이 뚜렷하게 만들어서 실제보다 쉬운 조건이다. 실제 데이터에서 이 정도 나온다는 뜻은 아니고, `probes`를 키울수록 재현율이 오르고 훑는 양이 늘어나는 흐름만 보면 된다. 질의 속도는 재지 않았다.

<details>
<summary>pgvector에서 같은 조절 장치가 어디 있나</summary>

pgvector는 PostgreSQL 확장이다. README 기준으로 인덱스는 이렇게 만든다.

```sql
CREATE INDEX ON items USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX ON items USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
```

- HNSW: `m`(기본 16), `ef_construction`(기본 64)은 빌드 때, `hnsw.ef_search`(기본 40)는 질의 때 값이다. 크게 잡으면 재현율이 오르고 느려진다.
- IVFFlat: `lists`는 군집 수다. README는 100만 행까지는 행 수/1000, 그 이상은 행 수의 제곱근을 시작점으로 권한다. `ivfflat.probes`(기본 1)가 위 장난감의 `probes`와 같은 역할이다.
- 거리 연산자: `<->` L2, `<#>` 음의 내적, `<=>` 코사인 거리.
- 인덱스를 만들 수 있는 차원은 `vector` 타입 기준 2,000까지, `halfvec`은 4,000까지다.

</details>

## 필터가 붙으면 까다롭다

실제 서비스에서는 "이 사용자의 문서 중에서만", "2024년 이후만" 같은 조건이 붙는다. 벡터 인덱스에서는 이게 생각보다 어렵다. pgvector README는 근사 인덱스에서 필터가 인덱스 탐색 뒤에 적용된다고 설명한다. 예를 들어 조건에 맞는 행이 10%고 `ef_search`가 40이면, 후보 40개 중 평균 4개만 남는다. 요청한 k개를 못 채울 수 있다는 뜻이다.

대처는 몇 가지가 문서에 나와 있다. 조건에 맞는 행이 적으면 정확한(전수) 탐색이 잘 맞고, 값 종류가 적으면 부분 인덱스, 많으면 파티셔닝을 고려하라고 한다. 0.8.0부터는 조건을 만족하는 결과가 충분히 모일 때까지 인덱스를 계속 훑는 반복 스캔(iterative index scan)도 있다.

Qdrant 문서는 다른 방향이다. 필터링용 payload 인덱스를 먼저 만들어 두면 HNSW 그래프에 필터를 고려한 간선이 더해지는 구조여서, payload 인덱스는 데이터를 넣기 전에 만들고 나중에 추가하면 HNSW를 다시 만들어야 한다고 적혀 있다. 같은 문제를 DB마다 다르게 푼다.

<details>
<summary>strict order와 relaxed order</summary>

pgvector의 반복 스캔은 두 모드가 있다. `strict_order`는 결과를 정확한 거리 순으로 유지하고, `relaxed_order`는 순서가 조금 어긋나는 대신 재현율이 좋다. 무한히 훑지는 않고 `hnsw.max_scan_tuples`(기본 20,000)에서 멈춘다.

</details>

## pgvector냐 전용 DB냐

이미 PostgreSQL을 쓴다면 pgvector가 가장 덜 번거롭다. 벡터 옆에 일반 컬럼이 있어서 필터를 SQL로 쓰고 JOIN도 되고, 트랜잭션·백업을 그대로 쓴다([자세히 → 관계형 DB와 SQL](#/post/db-rdb-sql)). 서비스가 하나 늘지 않는 것도 크다.

전용 DB(Qdrant, Pinecone, Milvus, Weaviate 등)는 벡터 검색이 본업이라 필터링 구조·양자화·분산 처리 같은 기능이 벡터에 맞춰져 있다. 대신 서비스 하나를 더 운영해야 하고, 원본 DB와 벡터 DB 사이 데이터를 맞추는 일이 생긴다.

내가 이해한 선택 기준은 이 정도다.

| 상황 | 기운 쪽 |
|---|---|
| 이미 PostgreSQL, 벡터 수 많지 않음, 필터·JOIN 많음 | pgvector |
| 벡터 수가 아주 많고 검색이 서비스의 핵심 | 전용 DB 검토 |
| 몇 천 개 안팎, 프로토타입 | 전수 탐색이나 파일 수준으로도 충분 |

이건 일반적으로 말하는 기준이고, 숫자 경계는 데이터와 질의 방식에 따라 달라서 직접 재 보는 수밖에 없다. 키 값 저장소나 문서 DB 같은 다른 종류와의 위치는 [자세히 → NoSQL](#/post/db-nosql)에, 규모가 커졌을 때 DB를 어떻게 늘리는지는 [자세히 → 확장](#/post/db-scaling)에 있다.

## 흔한 오해

- 벡터 DB가 있어야 RAG를 할 수 있다는 건 아니다. 규모가 작으면 전수 탐색으로도 된다. RAG를 작게 만들어 보는 건 [자세히 → RAG 직접 만들기](#/post/app-rag-build)에 있다.
- 벡터 인덱스 결과는 정확한 최근접이 아니다. 근사라서 놓치는 게 있고, 재현율과 속도를 같이 보고 설정을 정한다.
- 임베딩 모델을 바꾸면 기존 벡터를 그대로 쓸 수 없다. 모델마다 좌표계가 달라서 새로 임베딩하고 인덱스도 다시 만들어야 한다(일반적으로 알려진 내용이고 이번에 문서로 따로 확인하지는 않았다).
- 벡터 검색이 키워드 검색을 완전히 대신하지도 않는다. 고유명사나 정확한 용어는 키워드 쪽이 나을 때가 있다.

← 개념 map으로 (#/post/db-map)

관련 글: [임베딩](#/post/ai-embedding) · [인덱스](#/post/db-index) · [RAG 직접 만들기](#/post/app-rag-build)

## 근거 링크

- pgvector README (인덱스 옵션·기본값·필터링·반복 스캔): https://github.com/pgvector/pgvector
- Malkov & Yashunin, HNSW (arXiv 1603.09320, 초록 확인): https://arxiv.org/abs/1603.09320
- Qdrant 문서, Indexing (payload 인덱스·필터링 가능한 HNSW): https://qdrant.tech/documentation/concepts/indexing/

