GraphRAG는 문서에서 LLM으로 엔티티와 관계를 뽑아 지식그래프를 만들고, 서로 가까운 엔티티 묶음(커뮤니티)마다 요약을 미리 만들어 두었다가 질문에 쓰는 RAG다. Microsoft Research가 2024년 논문과 블로그로 공개했고 오픈소스 라이브러리도 있다.

## 일반 RAG가 약한 곳

[RAG](#/post/ai-rag)는 질문과 비슷한 청크 몇 개를 찾아서 [LLM](#/post/ai-llm)에게 붙여 주는 방식이다. 특정 사실을 묻는 질문에는 잘 맞는다. 그런데 GraphRAG 논문은 RAG가 "문서 묶음 전체에 대한 질문"에는 실패한다고 적는다. 예로 든 질문이 "이 데이터셋의 주요 주제가 뭐냐"다. 이런 질문은 검색 문제가 아니라 질의 중심 요약(query-focused summarization) 문제라는 게 논문의 시각이다. 반대로 기존 요약 방법은 RAG가 다루는 텍스트 양까지 커지지 못한다고 한다.

Microsoft 블로그가 두 가지 약점을 짚는다.

- 여러 문서에 흩어진 정보를 공통 속성으로 이어 붙이는 일("connect the dots")을 잘 못한다.
- 큰 문서 모음 전체를 이해해야 하는 질문에 약하다. 벡터 유사도 검색이라서 "상위 5개 주제"를 물으면 데이터의 실제 내용이 아니라 "주제"라는 단어가 들어간 글이 걸려 나온다.

블로그는 VIINA라는 2023년 6월 러시아·우크라이나 뉴스 기사 데이터셋으로 보여 준다. "Novorossiya가 뭐냐"는 둘 다 잘 답했지만, "Novorossiya가 뭘 했냐"는 일반 RAG가 답하지 못했고 GraphRAG는 근거 발췌와 함께 답했다. 이 데이터는 모델 학습 시점 이후 자료라서 골랐다고 한다.

## GraphRAG가 하는 일

공식 문서는 GraphRAG를 "구조적이고 계층적인 RAG"라고 소개한다. 색인(indexing) 단계는 이렇게 흐른다.

```
[색인 단계, 미리 한 번 — LLM이 많이 쓰인다]
문서 → TextUnit(청크) → 엔티티·관계·주장 추출 → 지식그래프
     → Leiden 방식으로 계층 군집화(커뮤니티) → 커뮤니티별 요약을 아래에서 위로 생성

[질문 단계]
Global: 커뮤니티 요약들 → 요약마다 부분 답 → 부분 답을 합쳐 최종 답
Local : 특정 엔티티 → 이웃 엔티티·관련 개념으로 퍼져 나가며 찾음
```

| 단계 | 하는 일 | 같이 볼 글 |
|---|---|---|
| 청크 나누기 | 입력 말뭉치를 TextUnit으로 자른다 | [RAG](#/post/ai-rag) |
| 추출 | 엔티티·관계·핵심 주장을 LLM이 뽑는다 | [지식그래프](#/post/ai-knowledge-graph), [온톨로지·트리플](#/post/ai-ontology-triple) |
| 군집화 | 그래프를 Leiden 기법으로 계층 군집화한다 | [그래프 DB](#/post/ai-graph-db) |
| 요약 | 각 커뮤니티와 구성 요소의 요약을 아래부터 만든다 | |

일반 RAG는 "비슷한 글 조각"을 찾지만, GraphRAG는 "연결된 개체들의 묶음과 그 요약"을 찾는다는 점이 다르다. 청크는 벡터로 찾을 때 [임베딩](#/post/ai-embedding)이 쓰이는 반면, 그래프는 엔티티 사이의 연결을 따라간다.

## 질문 방식 네 가지

공식 문서가 나누는 검색 방식은 이렇다.

| 방식 | 잘 맞는 질문 |
|---|---|
| Global Search | 말뭉치 전체에 대한 큰 질문. 커뮤니티 요약을 이용한다 |
| Local Search | 특정 엔티티에 대한 질문. 이웃과 관련 개념으로 퍼져 나간다 |
| DRIFT Search | Local과 비슷하되 커뮤니티 정보가 맥락으로 더해진다 |
| Basic Search | 일반 top-k 벡터 검색. 일반 RAG로 충분한 질문용 |

문서가 Basic Search를 같이 두었다는 점이 눈에 띈다. 모든 질문이 그래프를 필요로 하지는 않는다는 얘기로 읽힌다.

## 논문에서 본 결과

논문은 100만 토큰 안팎 데이터셋에서 전역 이해(global sensemaking) 질문을 테스트했다. 일반 RAG 기준선보다 답의 포괄성(comprehensiveness)과 다양성(diversity)이 크게 좋아졌다고 보고한다. 블로그에도 비슷하게, LLM 평가자가 포괄성·다양성·근거 제시 면에서 GraphRAG를 꾸준히 더 나은 쪽으로 골랐다고 나온다. 반면 SelfCheckGPT로 본 충실성(faithfulness)은 일반 RAG와 비슷했고, 블로그는 평가 틀이 아직 개발 중이라고 쓴다. 답은 출처 텍스트를 인용해서 원문과 대조해 볼 수 있다.

## 언제 쓰고, 언제 일반 RAG로 충분한가

여기부터는 위 자료의 성격에서 읽히는 구분이다.

| 상황 | 선택 |
|---|---|
| "이 계약서의 해지 조항이 뭐냐" 같은 특정 사실 질문 | 일반 RAG |
| 문서 하나 또는 소규모라서 통째로 넣어도 되는 경우 | 일반 RAG(또는 그냥 컨텍스트에 넣기, [컨텍스트 윈도우](#/post/ai-context-window)) |
| "전체 자료의 주요 주제·흐름이 뭐냐" | GraphRAG Global |
| 여러 문서에 흩어진 사람·조직·사건의 관계를 이어야 하는 질문 | GraphRAG Local/DRIFT |
| 자주 바뀌는 문서 | 일반 RAG가 가볍다(색인을 다시 돌리는 부담이 덜하다) |

마지막 줄은 아래 비용 얘기에서 이어지는 추론이고, 공식 문서가 그렇게 말한 건 아니다.

## 비용과 복잡도

GitHub 저장소의 안내문은 GraphRAG 색인이 "비싼 작업이 될 수 있다"고 적고, 문서를 전부 읽고 과정과 비용을 이해한 뒤 작게 시작하라고 권한다. 이 글을 쓰면서 확인한 공식 문서 첫 페이지와 블로그에는 구체적인 비용 숫자가 없었다. 색인에서 LLM이 모든 텍스트에 엔티티 추출과 요약을 돌린다는 구조상 일반 RAG의 임베딩 한 번보다 호출이 훨씬 많아질 수밖에 없다.

공식 문서는 프롬프트를 데이터에 맞게 손보라고 "강하게 권장"한다. 기본값 그대로는 최선의 결과가 안 나올 수 있다는 이유다. 또 `graphrag init --force`를 하면 설정과 프롬프트를 덮어쓰니 백업하라는 주의도 있다.

## 흔한 오해

- GraphRAG가 일반 RAG를 대체한다: 문서 스스로 Basic Search를 선택지로 두고 있다. 질문 종류에 따라 갈린다.
- 그래프 DB가 있어야 한다: 이 글에서 확인한 공식 문서 색인 단계에는 그래프 DB 얘기가 없었다. 그래프 DB가 무엇인지는 [그래프 DB](#/post/ai-graph-db) 글에서 따로 다룬다.
- 환각이 사라진다: 논문·블로그가 보고한 충실성 지표는 일반 RAG와 비슷한 수준이었다([환각](#/post/ai-hallucination)).

<details>
<summary>자세한 풀이: 커뮤니티 요약으로 전체 질문에 답하는 과정</summary>

논문 초록 기준으로, 질문이 오면 커뮤니티 요약 각각이 부분 답을 만들고, 그 부분 답들을 다시 요약해 최종 답을 낸다. 요약을 질문 전에 미리 만들어 두기 때문에, 질문 때마다 원문 전체를 읽지 않고 요약 층만 읽으면 된다. 군집화가 계층적이라서 큰 묶음(큰 주제)부터 작은 묶음(세부 주제)까지 어느 높이의 요약을 쓸지 고를 수 있다. 공식 문서도 요약을 아래에서 위로 만든다고 설명한다.

</details>

## 근거 링크

- Edge et al., From Local to Global: A Graph RAG Approach to Query-Focused Summarization: https://arxiv.org/abs/2404.16130
- Microsoft GraphRAG 공식 문서: https://microsoft.github.io/graphrag/
- Microsoft Research 블로그, GraphRAG: Unlocking LLM discovery on narrative private data: https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/
- microsoft/graphrag 저장소(비용 안내): https://github.com/microsoft/graphrag

← [개념 지도로](#/post/ai-map)

관련 글: [RAG](#/post/ai-rag) · [지식그래프](#/post/ai-knowledge-graph) · [그래프 DB](#/post/ai-graph-db)
