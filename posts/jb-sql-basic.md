정보처리기사에서 SQL은 문법을 길게 쓰라고 하지 않고, 짧은 쿼리를 보여 주고 결과나 분류를 고르게 하는 식으로 나온다. 그래서 명령이 어느 분류인지, 조인 종류마다 결과 행이 어떻게 달라지는지, 뷰와 인덱스가 각각 무엇을 위한 건지를 구분할 수 있으면 된다. 아래 쿼리는 파이썬에 들어 있는 SQLite로 직접 돌려서 결과를 확인했다. 시험 기준은 Oracle 계열 문법이라 방언이 다른 부분은 따로 적는다. 기출문제 원문은 싣지 않고, 어떤 유형으로 나오는지만 적는다. 시험 일정과 응시료는 공식 사이트에서 확인한다.

## 분류부터 외운다

| 분류 | 명령 | 하는 일 |
|---|---|---|
| DDL (정의어) | CREATE, ALTER, DROP, TRUNCATE | 테이블·뷰·인덱스 같은 객체의 구조를 만들고 바꾸고 없앤다 |
| DML (조작어) | SELECT, INSERT, UPDATE, DELETE | 행을 읽고 넣고 고치고 지운다 |
| DCL (제어어) | GRANT, REVOKE | 사용자 권한을 주고 뺀다 |
| TCL (트랜잭션 제어어) | COMMIT, ROLLBACK, SAVEPOINT | DML 결과를 확정하거나 되돌린다 |

시험에서 분류를 묻는 문제는 대부분 이 표를 그대로 묻는다. 함정은 TRUNCATE다. 행을 지우니까 DML 같지만 DDL로 분류한다. 또 DROP은 테이블 구조까지 없애고, DELETE는 행만 지운다. 이 차이는 보기에서 자주 섞어 낸다.

DDL의 ALTER는 열 추가·변경·삭제에 쓴다. DROP에 붙는 CASCADE와 RESTRICT는 참조하는 객체가 있을 때 같이 지울지 막을지를 정하는 옵션이다.

SQL 명령을 분류별로 더 자세히 정리한 글은 SQLD 쪽에 있다. [자세히 → DML·TCL·DDL과 제약조건](#/post/sqld-dml-ddl)

## 트랜잭션 제어는 짧게

TCL은 COMMIT, ROLLBACK, SAVEPOINT 세 개다. SAVEPOINT는 트랜잭션 중간에 이름을 붙여 두고 거기까지만 되돌릴 수 있게 한다. 직접 돌려서 확인한 흐름은 이렇다.

```sql
BEGIN;
DELETE FROM emp WHERE emp_id = 1;
SAVEPOINT a;
DELETE FROM emp WHERE emp_id = 2;
ROLLBACK TO a;   -- 2번 삭제만 취소
COMMIT;          -- 1번 삭제는 확정
-- 남은 행: emp_id 2, 3
```

Oracle에서는 BEGIN 없이 첫 DML이 트랜잭션을 연다. SQLite는 위처럼 BEGIN을 쓴다. 트랜잭션의 성질(ACID)과 동시성 제어는 별도 글에 있다. [자세히 → 정규화와 트랜잭션](#/post/jb-normalization-transaction)

## 예제 테이블

이후 쿼리는 이 두 테이블 기준이다. 사원 4명 중 choi는 부서가 NULL이고, 인사 부서에는 사원이 없다.

```sql
CREATE TABLE dept(dept_id INTEGER PRIMARY KEY, dname TEXT NOT NULL);
CREATE TABLE emp(emp_id INTEGER PRIMARY KEY, ename TEXT, sal INTEGER,
                 dept_id INTEGER REFERENCES dept(dept_id));
INSERT INTO dept VALUES (10,'영업'),(20,'개발'),(30,'인사');
INSERT INTO emp VALUES (1,'kim',3000,10),(2,'lee',4000,20),
                       (3,'park',5000,20),(4,'choi',2500,NULL);
```

## 조인

조인은 두 테이블의 행을 조건으로 이어 붙인다. 종류별로 결과가 몇 행인지가 시험 포인트다.

| 종류 | 남기는 행 | 위 데이터에서 결과 |
|---|---|---|
| INNER JOIN | 양쪽에 짝이 있는 행만 | kim, lee, park (3행) |
| LEFT OUTER JOIN | 왼쪽 전부, 짝 없으면 NULL | 위 3행 + choi(부서 NULL) = 4행 |
| RIGHT OUTER JOIN | 오른쪽 전부 | 인사 부서가 NULL 사원과 함께 나온다 |
| FULL OUTER JOIN | 양쪽 전부 | 양쪽의 짝 없는 행이 모두 나온다 |
| CROSS JOIN | 모든 조합 | 4 × 3 = 12행 |

```sql
SELECT e.ename, d.dname
FROM emp e LEFT OUTER JOIN dept d ON e.dept_id = d.dept_id;
-- choi|NULL, kim|영업, lee|개발, park|개발

SELECT d.dname, e.ename
FROM dept d LEFT JOIN emp e ON e.dept_id = d.dept_id;
-- 인사|NULL 이 포함된다
```

같은 LEFT JOIN이어도 테이블 순서를 바꾸면 남는 쪽이 달라진다. 위 두 쿼리에서 첫 번째는 choi가, 두 번째는 인사 부서가 NULL 짝과 함께 남았다. RIGHT와 FULL은 위 표의 설명대로 읽으면 된다.

그 밖에 이름이 같은 열로 자동 연결하는 NATURAL JOIN, 같은 테이블을 별칭으로 두 번 쓰는 SELF JOIN, 등호가 아닌 조건으로 잇는 NON-EQUI JOIN 같은 말도 나온다. 용어만 구분하면 된다.

조인과 서브쿼리는 SQLD에 더 풀어 둔 글이 있다. [자세히 → 조인과 서브쿼리](#/post/sqld-join-subquery)

## GROUP BY와 HAVING

그룹으로 묶고 집계한 뒤 조건을 거는 건 HAVING, 묶기 전에 행을 거르는 건 WHERE다. 집계 함수는 WHERE에 쓰지 못한다.

```sql
SELECT dept_id, COUNT(*), AVG(sal) FROM emp GROUP BY dept_id;
-- NULL|1|2500.0,  10|1|3000.0,  20|2|4500.0

SELECT dept_id, COUNT(*) FROM emp GROUP BY dept_id HAVING COUNT(*) >= 2;
-- 20|2
```

NULL 부서도 GROUP BY에서는 하나의 그룹으로 묶였다. 그리고 `COUNT(*)`와 `COUNT(열)`은 다르다. 위 데이터에서 `COUNT(*)`는 4, `COUNT(dept_id)`는 3이 나왔다. 열 이름을 넣으면 NULL은 세지 않는다. 이 차이는 계산 문제로 자주 나온다.

집합 연산(UNION, UNION ALL, INTERSECT, EXCEPT)도 같은 범주다. UNION은 중복을 제거하고 UNION ALL은 남긴다. [자세히 → 그룹·집합 연산](#/post/sqld-group-set)

## 서브쿼리와 NULL 함정

서브쿼리는 괄호 안의 SELECT다. 단일 행을 돌려주면 비교 연산자와 쓰고, 여러 행이면 IN, ANY, ALL, EXISTS와 쓴다.

```sql
SELECT ename FROM emp WHERE sal > (SELECT AVG(sal) FROM emp);
-- lee, park      (평균 3625보다 큰 사원)

SELECT dname FROM dept d
WHERE EXISTS (SELECT 1 FROM emp e WHERE e.dept_id = d.dept_id);
-- 개발, 영업
```

시험에서 한 번씩 걸려드는 건 NOT IN과 NULL이다. 서브쿼리 결과에 NULL이 하나라도 있으면 NOT IN은 아무 행도 돌려주지 않는다.

```sql
SELECT dname FROM dept WHERE dept_id NOT IN (SELECT dept_id FROM emp);
-- 결과 없음 (emp.dept_id에 NULL이 있어서)

SELECT dname FROM dept
WHERE dept_id NOT IN (SELECT dept_id FROM emp WHERE dept_id IS NOT NULL);
-- 인사
```

인사 부서에 사원이 없는데도 첫 쿼리는 빈 결과였다. NULL과의 비교가 참도 거짓도 아닌 UNKNOWN이 되기 때문이다. 이런 데이터에서는 NOT EXISTS를 쓰면 같은 문제가 안 생긴다.

## 뷰

뷰는 SELECT 문에 이름을 붙여 저장해 둔 가상 테이블이다. 데이터를 따로 복사해 두지 않고, 조회할 때마다 원본 테이블에서 읽는다.

```sql
CREATE VIEW v_dev AS SELECT ename, sal FROM emp WHERE dept_id = 20;
SELECT * FROM v_dev;               -- lee 4000, park 5000
UPDATE emp SET sal = 9999 WHERE emp_id = 2;
SELECT * FROM v_dev;               -- lee 9999, park 5000
```

원본을 고치니 뷰 결과가 바로 바뀌었다. 시험에서 뷰의 특징으로 묻는 것은 다음과 같다.

| 항목 | 내용 |
|---|---|
| 목적 | 보안(보일 열·행만 노출), 복잡한 쿼리 단순화, 논리적 독립성 |
| 저장 | 정의(SELECT 문)만 저장하고 데이터는 저장하지 않는다 |
| 삭제 | DROP VIEW. 원본 테이블은 그대로다 |
| 갱신 | 조인·집계·DISTINCT가 들어간 뷰는 갱신이 제한된다(SQLite는 뷰 자체를 읽기 전용으로 둔다) |
| 인덱스 | 뷰에는 인덱스를 만들 수 없다고 보는 것이 일반적인 시험 답이다 |

<details>
<summary>인덱스 항목은 DBMS에 따라 다르다</summary>

일반 뷰는 데이터를 저장하지 않으니 인덱스 대상이 아니라는 설명이 교재의 기본이다. 반대로 결과를 실제로 저장하는 물리 뷰(Materialized View)는 별도 개념이라 인덱스를 둘 수 있는 DBMS가 있다. 시험 보기에 '뷰'라고만 나오면 일반 뷰로 읽는다.
</details>

## 인덱스

인덱스는 특정 열 값으로 행을 빨리 찾게 해 주는 별도 구조다. 만들어 두면 조회는 빨라지고, INSERT·UPDATE·DELETE 때 인덱스도 같이 고쳐야 해서 쓰기는 느려진다. 저장 공간도 더 쓴다.

```sql
CREATE INDEX idx_emp_dept ON emp(dept_id);
EXPLAIN QUERY PLAN SELECT * FROM emp WHERE dept_id = 20;
-- SEARCH emp USING INDEX idx_emp_dept (dept_id=?)
```

인덱스를 만들기 전에는 테이블을 처음부터 훑는 방식이지만, 만든 뒤에는 위처럼 인덱스를 타고 찾는다고 실행 계획이 알려 줬다. 시험에는 인덱스가 어떤 열에 효과적인지, 클러스터드와 논클러스터드의 차이, B-Tree 구조 정도가 나온다. 실행 계획을 읽는 문제가 나오면 'INDEX를 쓰는지, 전체를 훑는지'만 구분하면 된다.

물리 설계 쪽의 인덱스·파티션 내용은 따로 정리해 뒀다. [자세히 → DB 물리 설계와 분산 DB](#/post/jb-physical-design) 인덱스 구조는 [자세히 → 인덱스](#/post/db-index)에서 더 다룬다.

## 제약조건과 무결성

무결성은 데이터가 틀린 값으로 들어가지 못하게 막는 규칙이다. 시험에서는 개체 무결성(기본키는 NULL·중복 불가), 참조 무결성(외래키는 참조 대상에 있는 값이거나 NULL), 도메인 무결성(허용 값 범위)을 구분한다.

```sql
DELETE FROM dept WHERE dept_id = 20;
-- FOREIGN KEY constraint failed  (emp가 20번 부서를 참조하는 중)
```

외래키로 참조되는 부모 행을 지우려 하면 참조 무결성 때문에 막혔다. 외래키 옵션으로 ON DELETE CASCADE(자식도 같이 삭제), SET NULL(자식의 외래키를 NULL로)을 줄 수 있다. SQLite는 `PRAGMA foreign_keys=ON`을 켜야 이 검사를 한다. 키의 종류와 관계 모델은 [자세히 → 데이터베이스 기본과 데이터 모델](#/post/jb-db-concept)에 정리했다.

## DCL

DCL은 권한 부여(GRANT)와 회수(REVOKE) 두 개다. 형태는 이렇다.

```sql
GRANT SELECT, INSERT ON emp TO user1 WITH GRANT OPTION;
REVOKE INSERT ON emp FROM user1;
```

WITH GRANT OPTION을 붙여 권한을 받은 사용자는 그 권한을 다른 사람에게 다시 줄 수 있다. 이 옵션은 시험에서 한 줄 문제로 나오기 좋은 소재다. SQLite에는 GRANT·REVOKE가 없어서 위 두 문장은 직접 실행해 보지 못했고, 형태만 적었다.

## 자주 나오는 유형 정리

| 유형 | 풀이 방식 |
|---|---|
| 명령의 분류 고르기 | DDL·DML·DCL·TCL 표로 바로 판단, TRUNCATE는 DDL |
| 조인 결과 행 수 | 어느 쪽이 기준인지 보고, 짝 없는 행이 남는지 확인 |
| GROUP BY 결과 | 먼저 WHERE로 거르고, 묶고, HAVING으로 거르는 순서 |
| COUNT 계산 | `COUNT(*)`는 전체, `COUNT(열)`은 NULL 제외 |
| 서브쿼리 결과 | 안쪽 쿼리 결과부터 구해 놓고 바깥에 대입 |
| 뷰·인덱스 설명 고르기 | 뷰는 가상, 저장은 정의만 / 인덱스는 읽기 빠름, 쓰기 느림 |

결과를 묻는 문제는 데이터를 표로 그려서 한 단계씩 손으로 따라가는 게 가장 안전했다. 위 예제를 손으로 먼저 예상하고 돌려서 맞춰 보는 방식으로 연습하기 좋다.

← [개념 map으로](#/post/jb-map)

관련 글: [정규화와 트랜잭션](#/post/jb-normalization-transaction) · [DB 물리 설계와 분산 DB](#/post/jb-physical-design) · [데이터베이스 기본과 데이터 모델](#/post/jb-db-concept)

## 근거 링크

- SQLite SAVEPOINT 문서: https://www.sqlite.org/lang_savepoint.html
- SQLite CREATE VIEW 문서(SQLite에서 뷰는 읽기 전용): https://www.sqlite.org/lang_createview.html
- 직접 실행: Python 3 내장 sqlite3 (SQLite 3.50.4)에서 이 글의 쿼리 결과를 확인했다.
