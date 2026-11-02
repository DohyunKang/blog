관계형 DB는 데이터를 표(테이블)로 나눠 담고 표끼리 키로 연결해 두는 방식이고, SQL은 그 표에서 필요한 행을 꺼내고 바꾸는 언어다.

## 관계형 DB가 뭔지

엑셀 시트 여러 장을 떠올리면 된다. 시트 하나가 테이블이고, 가로 한 줄이 행(row), 세로 한 칸이 열(column)이다. 엑셀과 다른 점은 열마다 타입과 규칙을 DB가 강제한다는 것이다. 숫자 열에 글자를 넣으면 막히고, 비어 있으면 안 되는 열에 빈 값을 넣어도 막힌다.

"관계형"이라는 이름은 테이블 사이의 관계에서 왔다. 주문 테이블에 고객 이름을 매번 적는 대신 고객 번호만 적어 두고, 이름이 필요하면 고객 테이블에서 찾아온다. 같은 정보를 한 곳에만 두려는 것이다. 이렇게 나누는 이유는 [자세히 → 정규화](#/post/db-normalization)에서 따로 다룬다.

대표적인 관계형 DB는 PostgreSQL, MySQL, SQLite 같은 것들이다. 이 글은 설치 없이 파이썬에 들어 있는 SQLite로 직접 돌려 본 결과를 쓴다. 서버 없이 파일 하나(또는 메모리)로 돌아가서 공부용으로 편하다. 방언 차이는 조금 있지만 아래 내용은 PostgreSQL·MySQL에서도 거의 같다.

## 테이블과 키

핵심 용어는 두 개다.

| 용어 | 뜻 | 아래 예제에서 |
|---|---|---|
| 기본 키(Primary Key) | 행 하나를 유일하게 가리키는 열 | `users.id`, `orders.id` |
| 외래 키(Foreign Key) | 다른 테이블의 기본 키를 가리키는 열 | `orders.user_id` → `users.id` |

기본 키는 겹치면 안 되고 비면 안 된다. 외래 키는 "존재하는 행만 가리켜야 한다"는 규칙을 DB가 지켜 준다. 그 외에 `NOT NULL`(빈 값 금지), `UNIQUE`(중복 금지) 같은 제약도 열에 붙일 수 있다.

예제 테이블은 고객과 주문이다.

```sql
CREATE TABLE users (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);
CREATE TABLE orders (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  item    TEXT NOT NULL,
  price   INTEGER NOT NULL
);
```

```
users                              orders
id | name | email                  id | user_id | item   | price
1  | 민지 | minji@...              1  | 1       | 키보드 | 50000
2  | 준호 | junho@...              2  | 1       | 마우스 | 20000
3  | 서연 | seoyeon@...            3  | 2       | 모니터 | 200000
```

orders의 `user_id`가 users의 `id`를 가리킨다. 서연은 주문이 없다. 이 "주문 없는 고객"이 뒤에 조인을 설명할 때 쓰인다.

## 넣고, 꺼내고, 바꾸고, 지우고

데이터를 다루는 기본 동작은 넷이다(흔히 CRUD라고 부른다).

```sql
INSERT INTO users (name, email) VALUES ('민지','minji@example.com'), ('준호','junho@example.com'), ('서연','seoyeon@example.com');
INSERT INTO orders (user_id, item, price) VALUES (1,'키보드',50000), (1,'마우스',20000), (2,'모니터',200000);

SELECT name, email FROM users WHERE id = 1;     -- 꺼내기
UPDATE orders SET price = 45000 WHERE id = 1;   -- 바꾸기
DELETE FROM orders WHERE id = 3;                -- 지우기
```

실행해 보니 `SELECT`는 `('민지', 'minji@example.com')` 한 행을 돌려줬고, `UPDATE` 뒤에 id 1 주문의 가격이 45000으로 바뀌어 있었다. `DELETE` 뒤에는 orders가 3행에서 2행이 됐다.

`SELECT`는 `SELECT 열 FROM 테이블 WHERE 조건` 순서로 읽으면 된다. 어느 표에서(FROM), 어느 행만(WHERE), 어느 열을(SELECT) 가져올지다. 정렬은 `ORDER BY`, 개수 제한은 `LIMIT`를 뒤에 붙인다.

`UPDATE`와 `DELETE`에서 `WHERE`를 빼먹으면 전체 행에 적용된다. 일부러 해 봤는데, `UPDATE orders SET price = 0`을 `WHERE` 없이 돌리자 3행의 가격이 전부 0이 됐다. 에러도 경고도 없었다. 실무에서 먼저 같은 조건으로 `SELECT`를 돌려 몇 행이 잡히는지 보고 나서 바꾸라는 말이 나오는 이유다.

## 조인

테이블을 나눠 놨으니 합쳐서 볼 방법이 필요하다. 그게 `JOIN`이다.

```sql
SELECT u.name, o.item, o.price
FROM users u JOIN orders o ON o.user_id = u.id;
```

결과는 이랬다.

```
('민지', '키보드', 50000)
('민지', '마우스', 20000)
('준호', '모니터', 200000)
```

`ON` 조건이 맞는 행끼리만 붙는다. 서연은 주문이 없어서 결과에서 사라졌다. 이게 `INNER JOIN`(그냥 `JOIN`이라고 쓰면 이것)이다. PostgreSQL 튜토리얼도 같은 설명이다. 안쪽 조인은 짝이 맞지 않는 행을 무시한다.

서연도 같이 보고 싶으면 `LEFT JOIN`을 쓴다.

```sql
SELECT u.name, o.item
FROM users u LEFT JOIN orders o ON o.user_id = u.id;
```

```
('민지', '마우스')
('민지', '키보드')
('준호', '모니터')
('서연', None)
```

왼쪽 테이블(users)의 행은 전부 나오고, 짝이 없는 곳은 오른쪽 열이 NULL로 채워진다. 파이썬에서는 `None`으로 보인다. 행 순서는 `ORDER BY`를 안 쓰면 보장되지 않는다. 실제로 민지의 두 행이 입력 순서와 반대로 나왔다.

| 종류 | 짝 없는 행 | 서연 |
|---|---|---|
| `JOIN`(INNER) | 버린다 | 안 나온다 |
| `LEFT JOIN` | 왼쪽은 남기고 오른쪽을 NULL로 | 나온다 |

## 묶어서 세기

고객별 주문 수와 합계는 `GROUP BY`로 구한다.

```sql
SELECT u.name, COUNT(o.id), SUM(o.price)
FROM users u LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id;
```

```
('민지', 2, 70000)
('준호', 1, 200000)
('서연', 0, None)
```

여기서 `COUNT(o.id)`는 NULL을 세지 않아서 서연이 0으로 나왔다. `COUNT(*)`로 썼다면 서연도 1로 나왔을 것이다(이 부분은 이번에 실행해 보지는 않았고, 집계 함수가 NULL을 건너뛴다는 일반 동작에 따른 설명이다). `SUM`은 대상이 전부 NULL이면 0이 아니라 NULL을 돌려준다.

<details>
<summary>실행한 전체 코드 (파이썬 sqlite3)</summary>

```python
import sqlite3
con = sqlite3.connect(":memory:")
con.execute("PRAGMA foreign_keys = ON")
con.executescript("""
CREATE TABLE users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  item TEXT NOT NULL, price INTEGER NOT NULL
);
INSERT INTO users (name, email) VALUES ('민지','minji@example.com'),('준호','junho@example.com'),('서연','seoyeon@example.com');
INSERT INTO orders (user_id, item, price) VALUES (1,'키보드',50000),(1,'마우스',20000),(2,'모니터',200000);
""")
for r in con.execute("SELECT u.name, o.item, o.price FROM users u JOIN orders o ON o.user_id = u.id"):
    print(r)
```

SQLite 3.50.4에서 돌렸고, 본문에 적은 출력은 이 연결에서 나온 그대로다.
</details>

## 제약이 막아 주는 것

제약은 잘못된 데이터가 들어오기 전에 DB가 거절하게 하는 장치다. 두 가지를 일부러 틀려 봤다.

```sql
INSERT INTO orders (user_id, item, price) VALUES (99, 'x', 1);        -- 없는 고객 99
INSERT INTO users (name, email) VALUES ('a', 'minji@example.com');    -- 이메일 중복
```

각각 `FOREIGN KEY constraint failed`, `UNIQUE constraint failed: users.email`로 막혔다.

SQLite에는 함정이 하나 있다. 공식 문서에 따르면 외래 키 검사는 하위 호환 때문에 기본으로 꺼져 있어서 연결마다 `PRAGMA foreign_keys = ON`을 켜야 한다. 위 코드 맨 앞에 그 줄을 넣은 이유다. 안 켜면 없는 고객 99번의 주문도 그냥 들어간다(이쪽은 꺼진 상태로 돌려 보지 않았고 문서 설명을 따랐다). PostgreSQL·MySQL(InnoDB)은 기본으로 검사한다고 알고 있는데, 이번에 문서로 확인하지는 않았다.

## 흔한 오해

- SQL은 프로그래밍 언어처럼 "어떻게" 하라고 적는 게 아니라 "무엇을" 원하는지 적는다. 어느 인덱스를 어떤 순서로 탈지는 DB가 정한다. 그 부분은 [자세히 → 인덱스](#/post/db-index)에 있다.
- 관계형 DB는 낡았다는 인상이 있지만 지금도 서비스 데이터의 기본값으로 많이 쓰인다. 다른 방식과의 비교는 [자세히 → NoSQL](#/post/db-nosql)에서 본다.
- `JOIN`이 느린 건 아니다. 키에 인덱스가 있는지에 달린 얘기다.
- `NULL`은 0도 빈 문자열도 아니고 "값 없음"이다. `WHERE x = NULL`은 안 잡히고 `IS NULL`로 써야 한다(이것도 이번에 실행해 보지는 않았다).
- 한 번에 여러 문장을 묶어 성공·실패를 같이 처리하는 건 트랜잭션이라는 별개 주제다. [자세히 → 트랜잭션](#/post/db-transaction)에서 이어진다.

## 근거 링크

- SQLite, Foreign Key Support: https://www.sqlite.org/foreignkeys.html (외래 키 기본 꺼짐, PRAGMA)
- PostgreSQL 문서, Joins Between Tables: https://www.postgresql.org/docs/current/tutorial-join.html (inner/left outer join 설명)
- 코드 출력은 직접 실행(SQLite 3.50.4, 파이썬 sqlite3)

← 개념 지도로 (#/post/db-map)

관련 글: [인덱스](#/post/db-index) · [정규화](#/post/db-normalization) · [트랜잭션](#/post/db-transaction)
