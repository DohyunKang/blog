NoSQL은 하나의 기술 이름이 아니라 관계형(RDB) 표 모양이 아닌 저장 방식을 통틀어 부르는 말이고, 네 가지 모양(Key-Value, Document, Column, Graph)마다 잘하는 일이 다르다.

## NoSQL이 뭔지

이름만 보면 "SQL이 없는 DB" 같은데, 실제로는 "관계형 표 모델이 아닌 DB"에 가깝다. 어떤 제품은 SQL 비슷한 쿼리 언어를 쓰기도 한다. 그래서 정의보다 분류로 이해하는 쪽이 쉬웠다.

RDB는 데이터를 표(테이블)에 넣고 키로 이어 붙인다. [자세히 → 관계형 DB와 SQL 기본](#/post/db-rdb-sql) 정규화를 하면 중복이 없어지는 대신 읽을 때 조인으로 다시 합쳐야 한다. [자세히 → 정규화와 모델링](#/post/db-normalization) NoSQL 쪽은 "읽을 때 쓰는 모양 그대로 저장해 두자"는 쪽으로 간 경우가 많다. 그 대가로 조인이나 트랜잭션 같은 걸 약하게 지원하거나 아예 없는 제품도 있다.

## 네 가지 모양

| 종류 | 저장 모양 | 대표 제품 | 잘하는 일 |
|---|---|---|---|
| Key-Value | 키 하나에 값 하나 | Redis | 세션, 캐시, 카운터 |
| Document | JSON 비슷한 문서 | MongoDB | 한 덩어리로 읽고 쓰는 데이터 |
| Column(wide-column) | 파티션 키로 나눈 행, 열은 유연 | Cassandra | 쓰기 많은 대용량 분산 |
| Graph | 노드와 관계 | Neo4j | 관계를 따라가는 질의 |

### Key-Value

가장 단순하다. 사전(dict)처럼 키로 넣고 키로 꺼낸다. 값 안쪽은 DB가 신경 쓰지 않는 경우가 많고, 그래서 빠르고 단순하다. 키가 아닌 값으로 찾는 건 못 하거나 비싸다.

Redis는 Key-Value지만 값이 단순 문자열만은 아니다. 공식 문서는 Redis를 "data structure server"라고 소개하고, 값으로 문자열, 해시, 리스트, 셋, 정렬된 셋(sorted set), 스트림, JSON 등 여러 자료구조를 제공한다고 적는다. 캐시 쪽 이야기는 따로 있다. [자세히 → 캐시와 Redis](#/post/db-cache-redis)

### Document

JSON 모양의 문서를 통째로 저장한다. MongoDB 문서는 같은 컬렉션 안에서도 문서마다 필드가 달라도 되고, 필드를 추가할 때 기존 문서를 다시 쓰거나 마이그레이션을 돌릴 필요가 없다고 설명한다. 필요하면 스키마 검증(schema validation)으로 구조를 강제할 수도 있다. 즉 "스키마가 없다"기보다 "스키마를 DB가 아니라 앱 쪽에서 쥔다"에 가까웠다.

설계 원칙으로 문서는 이 문장을 든다. "함께 접근하는 데이터는 함께 저장한다." 주문과 주문 항목처럼 항상 같이 읽는 건 문서 안에 넣고(embedding), 크거나 가끔만 읽는 건 따로 두고 참조(referencing)한다. 문서의 예시는 상품 페이지에 최근 리뷰 5개만 보여 주니 전체 리뷰는 별도 컬렉션에 두는 경우다.

같은 주문을 두 방식으로 놓아 보면 차이가 보인다. 실행해서 확인한 결과다.

```python
import json, sqlite3

order = {"id": 1, "user": "kim", "items": [{"sku": "A1", "qty": 2}, {"sku": "B7", "qty": 1}]}
print(json.dumps(order, ensure_ascii=False))
# {"id": 1, "user": "kim", "items": [{"sku": "A1", "qty": 2}, {"sku": "B7", "qty": 1}]}

db = sqlite3.connect(":memory:")
db.executescript("""
create table orders(id int primary key, user text);
create table order_items(order_id int, sku text, qty int);
insert into orders values (1,'kim');
insert into order_items values (1,'A1',2),(1,'B7',1);
""")
print(db.execute("""select o.user, i.sku, i.qty
  from orders o join order_items i on i.order_id=o.id where o.id=1""").fetchall())
# [('kim', 'A1', 2), ('kim', 'B7', 1)]
```

문서 쪽은 읽는 한 번으로 끝나고, RDB 쪽은 테이블 두 개를 조인한다. 반대로 "SKU A1을 산 모든 주문"을 찾거나 상품 이름을 한 번에 바꾸는 일은 문서에 흩어져 있으면 오히려 번거로워진다. 모양을 읽기 쪽에 맞추면 다른 쪽이 불편해지는 건 어쩔 수 없다.

### Column(wide-column)

이름 때문에 "컬럼 지향 분석 DB"와 헷갈리기 쉽다. 여기서 말하는 건 Cassandra 같은 wide-column 저장소다. Cassandra 공식 문서는 이걸 partitioned wide-column storage로 설명한다. 행의 기본키 첫 부분이 파티션 키이고, 이 값이 그 행을 클러스터의 어느 노드가 가질지 정한다. 효율적인 질의에는 파티션 키가 들어가야 한다. 문서에 외래키나 파티션을 넘나드는 조인이 있다는 설명은 없었고, 그래서 "테이블을 질의에 맞춰 만든다"는 식으로 설계하게 된다. 문서가 이 표현을 직접 쓰지는 않았다.

<details>
<summary>Column 계열을 질의 먼저 설계한다는 것</summary>

RDB는 데이터 모양을 먼저 정리하고 질의는 나중에 SQL로 만든다. 파티션 키로 찾는 구조에서는 반대로 "어떤 질의를 날릴지"가 먼저 나오고, 그 질의에 맞는 테이블을 만든다. 같은 데이터를 다른 질의용으로 한 번 더 저장하는 일도 생긴다. 이 설명은 Cassandra 문서에서 직접 확인한 문장이 아니라 파티션 키 구조로부터 이해한 내용이다.
</details>

### Graph

노드(사람, 상품)와 관계(팔로우, 구매)를 저장한다. Neo4j 문서에 따르면 노드는 라벨과 속성을 가지고, 관계는 방향과 타입이 하나씩 있으며 관계도 속성을 가질 수 있다. 문서는 RDB에서 JOIN이 비싸지는 반면 그래프 DB는 관계를 노드 옆에 직접 저장해 따라가는 게 빠르다고 말한다.

"친구의 친구" 질의를 작은 데이터로 돌려 봤다. SQLite의 재귀 쿼리와 인접 리스트 BFS가 같은 답을 냈다.

```python
db.executescript("""
create table follows(a text, b text);
insert into follows values ('kim','lee'),('lee','park'),('lee','choi'),('park','jung');
""")
q = """
with recursive reach(person, depth) as (
  select 'kim', 0
  union
  select f.b, r.depth+1 from reach r join follows f on f.a=r.person where r.depth<2
)
select person, min(depth) from reach where depth>0 group by person order by 2,1
"""
print(db.execute(q).fetchall())
# [('lee', 1), ('choi', 2), ('park', 2)]
```

두 단계 이내를 찾는 건 SQL로도 된다. 단계가 깊어지고 질의가 복잡해질 때 그래프 쪽이 편해진다는 게 문서의 취지이고, 이 정도 작은 데이터로 속도 차이를 재 본 건 아니다.

## 분산이 끼면: CAP

NoSQL을 얘기하면 CAP이 따라 나온다. 분산 저장소에서 일관성(Consistency), 가용성(Availability), 분할 허용(Partition tolerance) 중 둘까지만 보장할 수 있다는 정리다. Eric Brewer가 2000년에 추측으로 제시했고, 2002년 Gilbert와 Lynch가 증명했다.

여기서 일관성은 ACID의 일관성과 다르다. "읽으면 가장 최근에 쓴 값이 나온다(아니면 오류)"는 뜻이다. [자세히 → 트랜잭션과 격리 수준](#/post/db-transaction) 가용성은 죽지 않은 노드에 요청하면 응답이 온다는 뜻인데, 최신값이라는 보장은 없다.

"셋 중 둘을 고른다"는 말은 오해를 낳는다. 네트워크 분할은 현실에서 피할 수 없어서, 실제 선택은 분할이 생긴 동안 일관성을 택할지 가용성을 택할지다. Brewer 본인도 나중에 이 식의 이해가 오도하기 쉽다고 했고, 분할이 없을 때는 둘 다 충족할 수 있다. 2010년 Abadi는 여기에 PACELC를 붙였다. 분할이 있으면 가용성 대 일관성, 없어도 지연(latency) 대 일관성을 고르게 된다는 확장이다.

그래서 "Cassandra는 AP, MongoDB는 CP" 식의 딱지는 조심해서 읽는다. 설정에 따라 달라지는 제품이 많고, 이 글에서는 제품별 분류를 확인하지 못했다. 복제와 샤딩 쪽 이야기는 다음 글에 이어진다. [자세히 → 복제와 샤딩](#/post/db-scaling)

## 흔한 오해

- NoSQL은 SQL이 필요 없다: 분류 이름일 뿐이고, SQL 비슷한 언어를 가진 제품도 있다.
- NoSQL이 RDB보다 빠르다: 모양이 맞는 질의에서 빠른 것이고, 안 맞는 질의에서는 오히려 느리거나 못 한다.
- 스키마가 없어서 설계를 안 해도 된다: 문서 DB도 임베드할지 참조할지 정해야 하고, 안 정하면 앱 코드에 흩어진다.
- NoSQL은 트랜잭션이 안 된다: 제품마다 다르다. 이 글에서는 제품별 지원 범위를 확인하지 못했다.

## 어떻게 고르나

처음 보면 "NoSQL로 갈까"가 아니라 "내 질의가 무슨 모양인가"를 먼저 묻는 게 맞았다.

| 이런 상황이면 | 먼저 볼 것 |
|---|---|
| 관계가 많고 정합성이 중요, 질의가 자주 바뀜 | RDB |
| 키 하나로 빠르게 읽고 쓰기, 캐시·세션 | Key-Value |
| 한 덩어리로 읽는 데이터, 필드가 자주 바뀜 | Document |
| 쓰기가 아주 많고 파티션 키로만 찾음 | Wide-column |
| 관계를 여러 단계 따라가야 함 | Graph |

특별히 이유가 없으면 RDB로 시작하는 쪽이 부담이 적었다. 질의가 자유롭고 트랜잭션이 되기 때문이다. 벡터 검색처럼 새로 생긴 요구는 전용 저장소로 따로 다룬다. [자세히 → 벡터 DB](#/post/db-vector)

← 개념 지도로

관련 글: [인덱스](#/post/db-index) · [캐시와 Redis](#/post/db-cache-redis) · [복제와 샤딩](#/post/db-scaling)

## 근거 링크

- MongoDB 데이터 모델링 소개: https://www.mongodb.com/docs/manual/core/data-modeling-introduction/
- Redis 데이터 타입: https://redis.io/docs/latest/develop/data-types/
- CAP 정리(Wikipedia): https://en.wikipedia.org/wiki/CAP_theorem
- Cassandra 아키텍처 개요: https://cassandra.apache.org/doc/latest/cassandra/architecture/overview.html
- Neo4j 그래프 DB 소개: https://neo4j.com/docs/getting-started/get-started-with-neo4j/graph-database/

## 확인 못 함

- 제품별 CAP 분류(Cassandra, MongoDB 등)와 설정에 따른 변화
- 제품별 트랜잭션·조인 지원 범위, Cassandra의 tunable consistency(가져온 페이지에 설명 없음)
- 친구의 친구 질의의 실제 성능 차이(작은 데이터로 결과만 확인, 속도는 측정 안 함)
