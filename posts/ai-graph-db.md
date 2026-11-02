그래프 DB는 데이터를 표(행·열)가 아니라 점(노드)과 선(관계)으로 저장하는 DB다. Neo4j 문서는 "노드, 관계, 속성으로 저장하고 표나 문서로 저장하지 않는다"고 설명한다. 대표 제품이 Neo4j이고, 질의 언어는 Cypher다.

## 관계형 DB와 다른 점

관계형 DB에서 "친구의 친구"를 구하려면 같은 테이블을 JOIN으로 이어 붙여야 한다. 한 단계 더 가면 JOIN이 하나 더 붙는다.

```sql
-- 친구(friendship) 테이블을 두 번 JOIN해서 친구의 친구를 찾는 모양
SELECT f2.friend_id
FROM friendship f1
JOIN friendship f2 ON f1.friend_id = f2.user_id
WHERE f1.user_id = 1;
```

Neo4j 문서는 이 부분을 이렇게 대비한다. 관계형 DB는 JOIN으로 데이터를 잇는데 이게 계산 비용이 큰 연산이고, 그래프 DB는 JOIN을 쓰지 않고 관계를 노드 옆에 직접 저장해 둔다고 한다. 그래서 선을 따라 걷는 순회가 빠르다는 것이 문서의 설명이다. 문서는 스키마가 고정되어 있지 않아 모델을 유연하게 바꾸기 쉽다는 점도 같이 든다.

| | 관계형 DB | 그래프 DB |
|---|---|---|
| 기본 단위 | 표의 행 | 노드와 관계 |
| 관계 표현 | 외래 키 + JOIN | 관계를 직접 저장 |
| 잘 푸는 질문 | 집계, 조건 검색, 정형 데이터 | 몇 단계 건너 연결된 것 찾기 |
| 스키마 | 먼저 정해 둠 | 비교적 유연 |

"그래프 DB가 더 빠르다"로 외우면 틀린다. 위 표대로 질문의 모양에 따라 갈린다. 이 부분은 아래 '언제 맞나'에서 다시 쓴다.

## 속성 그래프 모델

Neo4j가 쓰는 모델은 속성 그래프(property graph)다. 요소는 네 가지다.

- 노드: 사람, 영화 같은 대상. 라벨(`Person`)을 0개 이상 붙일 수 있다.
- 관계: 두 노드를 잇는 선. 시작 노드, 끝 노드, 타입이 딱 하나 있어야 하고 방향이 있다.
- 속성: 노드와 관계에 붙는 키-값 쌍. 관계에도 붙는다는 게 포인트다(예: `ACTED_IN`에 `role`).
- 라벨: 노드를 묶는 이름표.

```
(Keanu:Person {name:'Keanu Reeves'}) -[:ACTED_IN {roles:[...]}]-> (Matrix:Movie {title:'The Matrix'})
```

화살표 방향이 있어도 질의에서는 반대 방향이나 방향 없이도 따라갈 수 있다.

## Cypher 예시

Cypher는 그림 그리듯 패턴을 쓴다. 노드는 괄호 `()`, 관계는 대괄호 `[]`와 화살표다. 아래는 Neo4j 문서의 영화 데이터셋 예시 문법을 따른 것이다.

만들기. 노드에 라벨과 속성을 주고, 이미 있는 노드 사이에 관계를 만든다.

```cypher
CREATE (charlie:Person:Actor {name: 'Charlie Sheen'}), (oliver:Person:Director {name: 'Oliver Stone'})

MATCH (charlie:Person {name: 'Charlie Sheen'}), (oliver:Person {name: 'Oliver Stone'})
CREATE (charlie)-[:ACTED_IN {role: 'Bud Fox'}]->(wallStreet:Movie {title: 'Wall Street'})<-[:DIRECTED]-(oliver)
```

찾기. 패턴에 맞는 걸 `MATCH`로 잡고 `RETURN`으로 돌려준다.

```cypher
MATCH (keanu:Person {name:'Keanu Reeves'})
RETURN keanu.name AS name, keanu.born AS born
```

관계를 거꾸로 따라가기. 영화에서 감독으로.

```cypher
MATCH (m:Movie {title: 'The Matrix'})<-[d:DIRECTED]-(p:Person)
RETURN p.name AS director
```

조건과 정렬.

```cypher
MATCH (bornInEighties:Person)
WHERE bornInEighties.born >= 1980 AND bornInEighties.born < 1990
RETURN bornInEighties.name AS name, bornInEighties.born AS born
ORDER BY born DESC
```

두 칸 떨어진 사람. `--{2}`는 "관계 두 번"이라는 고정 길이 패턴이다. 앞의 SQL에서 JOIN을 두 번 쓴 게 여기선 숫자 하나다.

```cypher
MATCH (tom:Person {name:'Tom Hanks'})--{2}(colleagues:Person)
RETURN DISTINCT colleagues.name AS name, colleagues.born AS bornIn
ORDER BY bornIn
LIMIT 5
```

<details>
<summary>자세한 풀이: 몇 단계인지 모를 때(가변 길이)</summary>

문서의 양자화(quantified) 경로 패턴은 반복 횟수를 범위로 줄 수 있다. 문서 예시는 정거장을 따라가는 모양이다.

```cypher
(n:Stop)-[:NEXT]->{1,10}(m:Stop)
```

`->{1,10}`은 `NEXT` 관계를 1번에서 10번까지 반복한다는 뜻이다. 사람 관계로 바꾸면 `(a:Person)-[:KNOWS]->{1,3}(b:Person)`처럼 쓸 수 있다. `KNOWS`는 내가 예로 든 이름이다.

문서는 옛 문법인 별표 형태(`*1..3`)도 아직 남아 있지만 GQL 표준에 맞는 건 위의 양자화 쪽이라고 적는다. 둘은 의미가 조금 달라서 문서의 링크된 레퍼런스에서 확인하고 써야 한다.

반복 횟수 상한 없이 아무 단계나 허용하면 그래프가 클 때 결과가 폭발할 수 있으니 상한을 주는 편이 안전해 보인다.

</details>

## 지식그래프·LLM과 만나는 지점

사실을 "주어 - 관계 - 목적어"로 적으면 그게 그대로 노드-관계-노드가 된다. 이렇게 쌓은 사실의 그물이 [지식그래프](#/post/ai-knowledge-graph)이고, 그걸 저장하는 후보가 그래프 DB다. 점과 선의 약속을 정하는 얘기는 [온톨로지·트리플](#/post/ai-ontology-triple)에서 이어진다.

[LLM](#/post/ai-llm)과는 두 군데서 엮인다. 하나는 질문에 답할 자료를 그래프에서 찾아 넣는 것으로, 문서 조각만 찾는 [RAG](#/post/ai-rag)와 달리 관계를 따라 모은다([GraphRAG](#/post/ai-graphrag)). 다른 하나는 모델이 자연어 질문을 Cypher로 바꿔 주는 식인데, 이때 만든 쿼리가 틀리거나 스키마와 안 맞을 수 있어서 실행 전에 확인하는 단계가 필요하다. 관계가 명시적으로 저장돼 있으면 어떤 경로로 답이 나왔는지 따라가 볼 수 있어서 [환각](#/post/ai-hallucination)을 점검하기 쉬워진다는 정도로 이해하고 있다.

## 언제 쓰고, 언제 안 맞나

맞는 경우는 관계가 질문의 중심일 때다.

- 몇 단계 건너 연결된 것을 찾는 질문(친구의 친구, 같은 작품에 나온 사람의 사람)
- 경로·추천처럼 "어떻게 이어지는지"가 답인 질문
- 관계 종류가 자주 늘고 바뀌어서 스키마를 고정하기 싫은 데이터

안 맞는 경우는 반대다.

- 주문·정산처럼 행을 집계하고 합계를 내는 정형 업무. 관계형 DB가 오래 다듬어진 영역이다.
- 관계가 거의 없고 단일 조회 위주인 데이터
- 팀이 SQL에는 익숙하고 Cypher는 처음인 경우의 운영 부담

문서가 말하는 장점(JOIN 없음, 유연한 모델)은 어디까지나 관계 순회에 해당한다. 그래서 기존 관계형 DB를 갈아엎기보다, 관계가 중요한 부분만 따로 그래프로 두는 구성이 현실적이라고 생각한다.

## 흔한 오해

- 그래프 DB는 SQL보다 항상 빠르다: 집계나 단순 조회는 관계형이 더 낫다. 빠르다는 건 연결을 따라가는 질의의 얘기다.
- 그래프 DB는 스키마가 없다: 유연하다는 것이지, 노드·관계를 어떻게 모델링할지는 여전히 설계해야 한다. 문서도 노드에 인덱스와 제약을 걸 수 있다고 한다.
- 그래프 DB를 붙이면 LLM 답이 정확해진다: 그래프에 든 사실이 틀리거나 빠져 있으면 그대로 틀린다. 그래프를 만드는 일이 본 작업이다.

## 근거 링크

- Neo4j, Graph database concepts: https://neo4j.com/docs/getting-started/get-started-with-neo4j/graph-database/
- Neo4j Cypher Manual, Basic queries: https://neo4j.com/docs/cypher-manual/current/queries/basic/
- Neo4j Cypher Manual, CREATE: https://neo4j.com/docs/cypher-manual/current/clauses/create/
- Neo4j Cypher Manual, Variable-length patterns: https://neo4j.com/docs/cypher-manual/current/patterns/variable-length-patterns/

← [개념 지도로](#/post/ai-map)

관련 글: [지식그래프](#/post/ai-knowledge-graph) · [GraphRAG](#/post/ai-graphrag) · [RAG](#/post/ai-rag)
