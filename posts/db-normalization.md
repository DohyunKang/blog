정규화는 같은 사실이 여러 곳에 적히지 않게 테이블을 나누는 작업이고, 1NF부터 3NF는 그걸 세 단계로 쪼갠 규칙이다.

## 왜 나누나

처음엔 엑셀처럼 한 표에 다 적고 싶어진다. 주문 하나에 고객 이름, 이메일, 상품, 가격, 수량을 한 줄로 쓰면 보기도 편하다. 문제는 같은 고객 이메일과 같은 상품 가격이 줄마다 반복된다는 점이다.

Microsoft 문서도 같은 얘기로 시작한다. 정규화는 데이터를 정리하는 과정이고, 중복과 어긋난 의존을 없애는 규칙에 따라 테이블을 만들고 관계를 잇는 일이다. 고객 주소 변경이 쉬워지려면 주소가 Customers 테이블 한 곳에만 있어야 한다는 예가 나온다.

중복이 있으면 생기는 문제는 보통 세 가지로 부른다(Wikipedia 정리).

| 이름 | 무슨 일이 생기나 |
|---|---|
| 수정 이상 | 반복된 값을 일부 줄만 고쳐서 같은 사실이 두 가지 답을 낸다 |
| 삽입 이상 | 다른 데이터가 없으면 어떤 사실을 넣을 수 없다 (수업 배정 전엔 신임 교수를 못 적는 식) |
| 삭제 이상 | 한 줄을 지웠더니 다른 사실까지 같이 사라진다 |

정규화는 이 이상들이 생기는 구조를 미리 막는 쪽이다. 개념은 1970년 Codd의 관계형 모델과 함께 나왔다. 1NF가 그때, 2NF·3NF는 1971년, BCNF는 Codd와 Boyce가 1974년에 정의했다.

## 직접 돌려 본 예: 한 표에 다 적으면

SQLite로 작은 표를 만들어 봤다. 주문 2건에 키보드가 두 번 나온다.

```sql
CREATE TABLE flat(order_id INT, customer TEXT, email TEXT,
                  product TEXT, price INT, qty INT);
INSERT INTO flat VALUES
 (1,'민수','m@x.com','키보드',50000,1),
 (1,'민수','m@x.com','마우스',20000,2),
 (2,'지영','j@x.com','키보드',50000,1);
-- 2번 주문의 키보드 가격만 고쳤다
UPDATE flat SET price=55000 WHERE order_id=2 AND product='키보드';
SELECT DISTINCT price FROM flat WHERE product='키보드';
```

결과는 50000과 55000 두 줄이었다. 키보드 가격이 둘이 된 것이다. 수정 이상이 이렇게 생긴다.

## 1NF, 2NF, 3NF

세 단계를 한 줄로 줄이면 이렇다.

| 단계 | 규칙 | 어기면 보이는 것 |
|---|---|---|
| 1NF | 칸 하나에 값 하나. 반복되는 칸(분류1, 분류2…)을 만들지 않는다 | 항목이 셋째로 늘면 칸을 추가해야 한다 |
| 2NF | 키가 둘 이상이면, 키 일부에만 달린 값은 따로 뺀다 | 상품 가격이 주문 줄마다 반복된다 |
| 3NF | 키가 아닌 값끼리 의존하지 않게 한다 | 고객 등급 때문에 할인율이 줄마다 반복된다 |

Microsoft 문서의 학생 예시가 이걸 잘 보여 준다. 처음엔 Class1, Class2, Class3 칸이 있는 표다. 1NF에서 수업을 한 줄씩 풀어 쓴다. 2NF에서 학생 정보와 수강 정보를 나눈다. 3NF에서는 Adv-Room(지도교수 방 번호)이 학생이 아니라 교수에게 달린 값이라서 Faculty 테이블로 옮긴다.

2NF와 3NF를 헷갈렸는데, 이렇게 외웠다. 2NF는 "키 전체에 달렸나", 3NF는 "키에만 달렸나(다른 일반 칸을 거치지 않았나)". Wikipedia 쪽 정의로는 3NF가 키가 아닌 속성끼리의 이행 종속이 없는 상태다.

<details>
<summary>자세한 풀이: 주문 예제를 3NF까지 나눈 결과</summary>

위의 flat 표를 나누면 고객, 상품, 주문, 주문 항목 네 개가 된다.

```sql
CREATE TABLE customer(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE);
CREATE TABLE product(id INTEGER PRIMARY KEY, name TEXT, price INT);
CREATE TABLE orders(id INTEGER PRIMARY KEY,
                    customer_id INT REFERENCES customer(id));
CREATE TABLE order_item(
  order_id INT REFERENCES orders(id),
  product_id INT REFERENCES product(id),
  qty INT, unit_price INT,
  PRIMARY KEY(order_id, product_id));
```

실행해서 확인한 것은 세 가지다.

- product 한 곳만 고치면 키보드 가격이 55000 하나로 나온다.
- 존재하지 않는 고객 99로 주문을 넣으려 하면 `FOREIGN KEY constraint failed`가 난다(SQLite는 `PRAGMA foreign_keys=ON`을 켜야 한다).
- JOIN으로 주문-고객-상품을 다시 묶으면 처음 flat 표와 같은 내용이 나온다.

order_item에 unit_price를 따로 둔 건 일부러다. 상품 가격이 나중에 바뀌어도 지난 주문은 그때 가격이어야 하기 때문이다. 이건 중복처럼 보여도 "주문 시점의 사실"이라 다른 값이다. 이 부분은 문서에서 읽은 게 아니라 예제를 짜면서 정한 설계다.

</details>

## ERD 그리기

모델링은 표를 나누기 전에 "무엇이 있고 서로 어떻게 엮이나"를 먼저 그리는 일이다. 그림이 ERD(개체-관계 다이어그램)다. 순서는 이렇게 잡았다.

1. 명사를 뽑는다: 고객, 상품, 주문.
2. 각 명사의 속성을 적는다: 고객은 이름·이메일.
3. 관계의 수를 정한다: 고객 1명은 주문 여러 개(1:N), 주문과 상품은 서로 여러 개(N:M).
4. N:M은 중간 테이블로 푼다: 그래서 order_item이 생긴다.

텍스트로 그리면 이 정도다.

```
customer 1 ──< orders 1 ──< order_item >── 1 product
```

`──<`는 "여러 개" 쪽이다. 정규화를 외워서 하는 것보다, ERD에서 N:M을 풀고 속성을 제자리에 놓다 보면 대부분 3NF 근처가 된다고 한다. 이 말은 내가 직접 검증한 건 아니고 손으로 그려 보며 든 느낌에 가깝다.

## 반정규화

정규화하면 테이블이 늘고 읽을 때 JOIN이 늘어난다. Microsoft 문서도 3NF를 끝까지 지키려면 도시, 우편번호, 담당자 같은 작은 표가 줄줄이 생기고 성능이 떨어질 수 있다고 적는다. 자주 바뀌는 데이터에만 3NF를 적용하는 방법도 거기서 제안한다.

그래서 일부러 중복을 허용하는 것을 반정규화라고 부른다. 예를 들면 이런 경우다.

- 주문 테이블에 총액을 미리 저장해 두고 목록 화면에서 합계를 계산하지 않는다.
- 게시글 테이블에 댓글 수 칼럼을 둔다.

대신 값이 어긋나지 않게 갱신하는 코드를 직접 책임져야 한다. 읽기가 압도적으로 많고 JOIN이 병목으로 확인됐을 때 쓰는 쪽이고, 먼저 [인덱스](#/post/db-index)로 풀리는지 보는 게 순서 같다. 읽기 부하를 덜려고 값을 따로 두는 방법은 [캐시](#/post/db-cache-redis) 쪽 글에서 이어진다.

## 흔한 오해

- 정규화는 많이 나눌수록 좋다: 문서도 3NF가 대부분의 응용에서 필요한 최고 수준이라고 하고, 그 위(4NF·5NF)는 실무에서 잘 고려하지 않는다고 적는다.
- 정규화하면 느려진다: JOIN이 늘어 느려질 수 있는 건 맞지만, 그건 측정해서 확인할 일이다. 중복이 낳는 불일치 비용도 같이 따져야 한다.
- 반정규화는 설계 실수다: 알고 하는 반정규화는 선택이다. 모르고 생긴 중복이 문제다.
- NoSQL이면 정규화가 필요 없다: 문서형 DB는 일부러 묶어서 저장하는 모델링을 쓰는 경우가 많다. 이 이야기는 [NoSQL 글](#/post/db-nosql)에서 다룬다.

참고로 Microsoft 문서는 4NF를 BCNF라고 부르는데, Wikipedia는 BCNF를 3NF보다 엄격한 별도 형태로 놓는다. 둘이 다르게 말해서, 여기서는 BCNF를 Wikipedia 쪽 설명으로 이해했다. 테이블 간 관계를 SQL로 다루는 방법은 [관계형 DB와 SQL](#/post/db-rdb-sql)에, 쪼갠 테이블을 한꺼번에 고칠 때 필요한 건 [트랜잭션](#/post/db-transaction)에 있다.

## 근거 링크

- Microsoft Learn, Database normalization description: https://learn.microsoft.com/en-us/office/troubleshoot/access/database-normalization-description
- Wikipedia, Database normalization: https://en.wikipedia.org/wiki/Database_normalization

← 개념 지도로 (#/post/db-map)

관련 글: [관계형 DB와 SQL](#/post/db-rdb-sql) · [인덱스](#/post/db-index) · [NoSQL](#/post/db-nosql)
