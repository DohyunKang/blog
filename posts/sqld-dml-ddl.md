SQL 명령은 하는 일에 따라 묶어 부른다. 행을 넣고 고치고 지우면 DML, 그 변경을 확정하거나 되돌리면 TCL, 테이블 자체를 만들고 바꾸고 없애면 DDL이다. 시험에서는 이 분류부터 묻고, 그다음 각 명령이 어떻게 다른지를 묻는다.

## 먼저 분류

| 분류 | 이름 | 명령 | 하는 일 |
|---|---|---|---|
| DML | 데이터 조작어 | SELECT, INSERT, UPDATE, DELETE, MERGE | 행을 읽고 바꾼다 |
| DDL | 데이터 정의어 | CREATE, ALTER, DROP, RENAME, TRUNCATE | 테이블 같은 객체의 구조를 다룬다 |
| DCL | 데이터 제어어 | GRANT, REVOKE | 권한을 준다/뺀다 ([자세히 → DCL](#/post/sqld-dcl-procedure)) |
| TCL | 트랜잭션 제어어 | COMMIT, ROLLBACK, SAVEPOINT | DML 결과를 확정하거나 되돌린다 |

헷갈리는 건 TRUNCATE다. 행을 지우니까 DML 같지만 분류는 DDL이다. 이 한 줄은 자주 나오는 함정이라 따로 외워 둔다.

아래 예제는 파이썬에 들어 있는 SQLite로 직접 돌려서 결과를 확인했다. SQLite는 방언이 조금 달라서, 시험에서 기준이 되는 Oracle 문법과 다른 부분은 그때그때 적는다.

## DML: INSERT, UPDATE, DELETE

테이블을 이렇게 만들어 두고 시작한다. 제약조건은 뒤에서 설명한다.

```sql
CREATE TABLE dept(dept_id INTEGER PRIMARY KEY, dname TEXT NOT NULL UNIQUE);
CREATE TABLE emp(
  emp_id  INTEGER PRIMARY KEY,
  ename   TEXT NOT NULL,
  sal     INTEGER DEFAULT 3000 CHECK(sal >= 0),
  dept_id INTEGER REFERENCES dept(dept_id)
);
INSERT INTO dept VALUES (10,'영업'), (20,'개발');
INSERT INTO emp(emp_id, ename, dept_id) VALUES (1,'kim',10);
```

INSERT는 열 이름을 적고 넣는 쪽이 안전하다. 열을 생략하면 테이블 정의 순서대로 전부 채워야 해서 열이 하나 늘면 깨진다. 위 INSERT에서 sal을 안 적었더니 DEFAULT 값 3000이 들어갔다(`[(1, 'kim', 3000, 10)]`).

UPDATE는 WHERE가 핵심이다. WHERE를 빼면 전체 행이 바뀐다. 개발 부서만 500 올리는 문장을 돌리니 이렇게 나왔다.

```sql
UPDATE emp SET sal = sal + 500 WHERE dept_id = 20;
-- (1, 3000), (5, 2500)  ← 5번 사원(원래 2000)만 올랐다
```

DELETE도 같다. WHERE가 없으면 전부 지워진다. 그리고 자식 행이 참조하는 부모 행(영업 부서)을 지우려 하면 외래키 때문에 막힌다. SQLite에서는 `PRAGMA foreign_keys=ON`을 켜야 막힌다(기본값은 꺼짐).

<details>
<summary>자주 나오는 유형: 서브쿼리를 쓴 UPDATE·INSERT</summary>

- `UPDATE ... SET 열 = (서브쿼리)`: 서브쿼리가 한 행·한 값만 돌려줘야 한다. 여러 행이면 오류다.
- `INSERT INTO A SELECT ... FROM B`: VALUES 대신 SELECT 결과를 통째로 넣는다. 열 개수와 타입이 맞아야 한다.
- 시험에서는 "실행하면 몇 건이 바뀌는가", "어디서 오류가 나는가"로 물어서, WHERE 조건에 걸리는 행 수를 직접 세는 연습이 필요하다.
</details>

## MERGE

있으면 UPDATE, 없으면 INSERT를 한 문장으로 하는 명령이다. 소스(USING)와 타깃(INTO)을 ON 조건으로 맞춰 보고, 맞는 행은 `WHEN MATCHED`, 안 맞는 행은 `WHEN NOT MATCHED`로 간다. Oracle 문서의 예제는 이렇다.

```sql
MERGE INTO people_target pt
USING people_source ps
ON (pt.person_id = ps.person_id)
WHEN MATCHED THEN UPDATE
  SET pt.first_name = ps.first_name, pt.last_name = ps.last_name, pt.title = ps.title
WHEN NOT MATCHED THEN INSERT
  (pt.person_id, pt.first_name, pt.last_name, pt.title)
  VALUES (ps.person_id, ps.first_name, ps.last_name, ps.title);
```

문서 기준으로 알아 둘 것은 세 가지다. UPDATE 절이나 INSERT 절 중 하나는 반드시 있어야 하고, ON 절에 쓴 열은 UPDATE로 못 바꾸고, 같은 타깃 행을 한 MERGE에서 두 번 갱신할 수 없다.

SQLite에는 MERGE가 없고 비슷한 역할로 UPSERT가 있다. 이미 있는 키(emp_id=1)에 넣으면 UPDATE로 바뀐다.

```sql
INSERT INTO emp VALUES (1,'kim2',9,10)
ON CONFLICT(emp_id) DO UPDATE SET ename = excluded.ename, sal = excluded.sal;
-- (1, 'kim2', 9, 10)
```

## TCL: 트랜잭션

트랜잭션은 "다 되거나 전혀 안 되거나"로 묶이는 작업 단위다. 계좌 이체에서 출금만 되고 입금이 안 되면 안 되니까 둘을 한 덩어리로 본다. 더 깊은 이야기는 [자세히 → 트랜잭션](#/post/db-transaction)에 있다.

- COMMIT: 지금까지의 DML을 확정한다.
- ROLLBACK: 마지막 COMMIT 이후의 변경을 취소한다.
- SAVEPOINT: 중간 저장점을 만들고 `ROLLBACK TO 이름`으로 거기까지만 되돌린다.

직접 돌려 본 결과다.

```sql
BEGIN;
DELETE FROM emp;           -- count(*) = 0
ROLLBACK;                  -- count(*) = 2, 다시 살아났다

BEGIN;
UPDATE emp SET sal = 1 WHERE emp_id = 1;
SAVEPOINT a;
UPDATE emp SET sal = 2 WHERE emp_id = 1;
ROLLBACK TO a;             -- sal을 2로 바꾼 것만 취소
COMMIT;                    -- 결과 sal = 1
```

시험에서 자주 나오는 건 "SAVEPOINT 뒤에 ROLLBACK TO를 하면 어디까지 남는가" 같은 순서 문제다. 저장점 이후만 취소되고 그 앞의 변경은 남는다는 것만 잡으면 풀린다.

<details>
<summary>트랜잭션 특성(ACID)과 DDL의 자동 확정</summary>

- 원자성(Atomicity): 전부 반영되거나 전부 취소된다.
- 일관성(Consistency): 실행 전후로 DB 규칙(제약조건)이 지켜진다.
- 격리성(Isolation): 동시에 도는 트랜잭션이 서로의 중간 상태를 보지 못한다.
- 지속성(Durability): COMMIT된 결과는 장애가 나도 남는다.
- Oracle에서 DDL은 실행하는 즉시 자동으로 COMMIT된다고 알려져 있어서, DML 뒤에 DDL을 날리면 앞의 DML도 확정된다. 시험에서 "ROLLBACK이 되는가"를 묻는 문제에 이 점이 걸린다.
</details>

## DDL: CREATE, ALTER, DROP, TRUNCATE

CREATE는 위에서 이미 썼다. ALTER는 만든 뒤에 구조를 고친다. 열을 추가하는 건 이렇다.

```sql
ALTER TABLE emp ADD COLUMN email TEXT;   -- 열: emp_id, ename, sal, dept_id, email
```

Oracle에서는 `ADD`, `MODIFY`(타입·크기 변경), `DROP COLUMN`, `RENAME COLUMN` 형태를 쓴다. SQLite는 지원 범위가 달라서 위처럼 `ADD COLUMN`으로 확인했다.

시험에서 가장 많이 묻는 건 지우는 세 가지의 차이다.

| 명령 | 분류 | 지우는 대상 | 롤백 | 조건(WHERE) |
|---|---|---|---|---|
| DELETE | DML | 행 (골라서) | 가능 (COMMIT 전) | 가능 |
| TRUNCATE | DDL | 행 전부 (구조는 남김) | 불가 | 불가 |
| DROP | DDL | 테이블 자체 | 불가 | 해당 없음 |

Oracle 문서에도 TRUNCATE는 롤백할 수 없고 FLASHBACK TABLE로도 되살릴 수 없다고 나온다. 테이블을 지웠다 다시 만드는 것과 달리 권한·인덱스·제약조건은 그대로 남는다. DROP은 테이블 정의까지 없애서 `DROP TABLE emp` 뒤에는 스키마 목록에서 emp가 사라졌다.

## 제약조건

잘못된 값이 아예 못 들어오게 DB가 막는 규칙이다. 위 테이블에 일부러 틀린 값을 넣어서 어떤 오류가 나는지 봤다.

| 제약조건 | 의미 | 시도한 입력 | 결과 |
|---|---|---|---|
| NOT NULL | 빈 값 금지 | ename에 NULL | 거부 |
| PRIMARY KEY | 중복·NULL 금지, 행을 대표 | emp_id=1 두 번 | 거부 (UNIQUE 위반) |
| UNIQUE | 중복 금지 (NULL은 가능) | dname '영업' 두 번 | 거부 |
| CHECK | 조건을 만족해야 함 | sal = -1 | 거부 |
| FOREIGN KEY | 부모에 있는 값만 허용 | 없는 dept_id=99 | 거부 |
| DEFAULT | 값을 안 주면 기본값 | sal 생략 | 3000 |

DEFAULT는 엄밀히는 규칙이 아니라 기본값이지만 같이 묶어 외운다. PRIMARY KEY가 UNIQUE와 NOT NULL을 합친 것이라는 점, 한 테이블에 PK는 하나지만 UNIQUE는 여러 개 둘 수 있다는 점이 단골이다. 외래키가 가리키는 식별자 개념은 [자세히 → 관계와 식별자](#/post/sqld-relation-identifier)에서 이어진다.

<details>
<summary>외래키와 삭제 옵션</summary>

부모 행을 지울 때 자식이 있으면 기본은 막는다(위에서 영업 부서 삭제가 막힌 이유). 옵션으로 동작을 바꿀 수 있다.

- `ON DELETE CASCADE`: 부모를 지우면 자식도 같이 지운다.
- `ON DELETE SET NULL`: 자식의 외래키 열을 NULL로 바꾼다.
- 반대로 부모 테이블을 DROP할 때도 자식이 참조 중이면 막히는 것이 보통이다.
</details>

## 흔한 오해

- "TRUNCATE는 DELETE의 빠른 버전이니 DML이다." 분류는 DDL이고 롤백이 안 된다.
- "UNIQUE 열에는 NULL을 못 넣는다." 못 넣는 건 PRIMARY KEY 쪽이다.
- "UPDATE에 WHERE를 안 쓰면 오류가 난다." 오류 없이 전체 행이 바뀐다.
- "ROLLBACK은 DDL도 되돌린다." Oracle에서 DDL은 자동 확정이라 못 되돌린다고 알려져 있다.

SELECT 쪽 함수와 조건은 [자세히 → SELECT와 함수](#/post/sqld-select-func)에, 전체 흐름은 map에 있다.

← [개념 map으로](#/post/sqld-map)

관련 글: [DCL과 절차형 SQL](#/post/sqld-dcl-procedure) · [트랜잭션](#/post/db-transaction) · [관계와 식별자](#/post/sqld-relation-identifier)

## 근거 링크

- Oracle Database SQL Language Reference, MERGE: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/MERGE.html
- Oracle Database SQL Language Reference, TRUNCATE TABLE: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TRUNCATE-TABLE.html
