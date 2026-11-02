SQL 명령은 수행하는 작업에 따라 분류됩니다. 행을 추가, 수정, 삭제하는 것은 DML이며, 해당 변경사항을 확정하거나 되돌리는 것은 TCL이고, 테이블 자체를 생성, 변경, 삭제하는 것은 DDL입니다. 시험에서는 이 분류부터 묻고, 그다음 각 명령의 차이점을 묻습니다.

## 먼저 분류

| 분류 | 이름 | 명령 | 하는 일 |
|---|---|---|---|
| DML | 데이터 조작어 | SELECT, INSERT, UPDATE, DELETE, MERGE | 행을 읽고 변경합니다 |
| DDL | 데이터 정의어 | CREATE, ALTER, DROP, RENAME, TRUNCATE | 테이블과 같은 객체의 구조를 다룹니다 |
| DCL | 데이터 제어어 | GRANT, REVOKE | 권한을 부여하거나 취소합니다 ([자세히 → DCL](#/post/sqld-dcl-procedure)) |
| TCL | 트랜잭션 제어어 | COMMIT, ROLLBACK, SAVEPOINT | DML 결과를 확정하거나 되돌립니다 |

헷갈리기 쉬운 것은 TRUNCATE입니다. 행을 삭제하므로 DML처럼 보이지만 분류는 DDL입니다. 이 한 줄은 자주 나오는 함정이라 따로 외워 두어야 합니다.

아래 예제는 파이썬에 내장된 SQLite 를 직접 실행하여 결과를 확인했습니다. SQLite 는 방언이 조금 달라서, 시험에서 기준이 되는 Oracle 문법과 다른 부분은 그때그때 적겠습니다.

## DML: INSERT, UPDATE, DELETE

테이블을 이렇게 만들어 두고 시작합니다. 제약조건은 뒤에 설명합니다.

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

INSERT 는 열 이름을 명시하고 넣는 쪽이 안전합니다. 열을 생략하면 테이블 정의 순서대로 모두 채워야 하므로 열이 하나 늘어나면 오류가 발생합니다. 위의 INSERT 에서 `sal` 을 안 적었더니 DEFAULT 값 3000 이 들어갔습니다(`[(1, 'kim', 3000, 10)]`).

UPDATE 는 WHERE 가 핵심입니다. WHERE 를 빼면 전체 행이 변경됩니다. 개발 부서만 500 을 올리는 문장을 실행하니 이렇게 나왔습니다.

```sql
UPDATE emp SET sal = sal + 500 WHERE dept_id = 20;
-- (1, 3000), (5, 2500)  ← 5번 사원(원래 2000)만 올랐다
```

DELETE 도 마찬가지입니다. WHERE 가 없으면 모두 삭제됩니다. 그리고 자식 행이 참조하는 부모 행 (영업 부서) 을 삭제하려 하면 외래키 때문에 막힙니다. SQLite 에서는 `PRAGMA foreign_keys=ON`을 켜야 막히며 (기본값은 꺼짐), 이를 활성화해야 합니다.

<details>
<summary>자주 나오는 유형: 서브쿼리를 사용한 UPDATE·INSERT</summary>

- `UPDATE ... SET 열 = (서브쿼리)`: 서브쿼리가 한 행, 한 값만 반환해야 합니다. 여러 행이면 오류가 발생합니다.
- `INSERT INTO A SELECT ... FROM B`: VALUES 대신 SELECT 결과를 통째로 삽입합니다. 열 개수와 타입이 일치해야 합니다.
- 시험에서는 "실행하면 몇 건이 변경되는가", "어디서 오류가 발생하는가"로 물어서, WHERE 조건에 걸리는 행 수를 직접 세는 연습이 필요합니다.
</details>

## MERGE

존재하는 행에는 UPDATE, 존재하지 않는 행에는 INSERT 를 한 문장으로 수행하는 명령입니다. 소스 (USING) 와 타깃 (INTO) 을 ON 조건으로 매칭한 후, 일치하는 행은 `WHEN MATCHED`, 일치하지 않는 행은 `WHEN NOT MATCHED`로 처리합니다. Oracle 문서의 예제는 다음과 같습니다.

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

문서 기준으로 알아 둘 것은 세 가지입니다. UPDATE 절이나 INSERT 절 중 하나는 반드시 있어야 하며, ON 절에 쓴 열은 UPDATE 로 변경할 수 없고, 같은 타깃 행을 하나의 MERGE 명령에서 두 번 갱신할 수 없습니다.

SQLite 에서는 MERGE 가 없고 유사한 역할을 UPSERT 가 수행합니다. 이미 있는 키 (`emp_id=1`) 에 값을 넣으면 UPDATE 로 변경됩니다.

```sql
INSERT INTO emp VALUES (1,'kim2',9,10)
ON CONFLICT(emp_id) DO UPDATE SET ename = excluded.ename, sal = excluded.sal;
-- (1, 'kim2', 9, 10)
```

## TCL: 트랜잭션

트랜잭션은 "모두 성공하거나 전혀 안 되거나"로 묶이는 작업 단위입니다. 계좌 이체에서 출금만 되고 입금이 안 되면 안 되므로 둘을 하나의 덩어리로 봅니다. 더 깊은 이야기는 [자세히 → 트랜잭션](#/post/db-transaction)에 있습니다.

- COMMIT: 지금까지의 DML 을 확정합니다.
- ROLLBACK: 마지막 COMMIT 이후의 변경사항을 취소합니다.
- SAVEPOINT: 중간 저장점을 생성하고 `ROLLBACK TO 이름`으로 해당 지점까지만 되돌립니다.

직접 실행해 본 결과입니다.

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

시험에서 자주 나오는 것은 "SAVEPOINT 뒤에 ROLLBACK TO 를 하면 어디까지 남는가"와 같은 순서 문제입니다. 저장점 이후만 취소되고 그 앞의 변경사항은 유지된다는 점만 파악하면 풀립니다.

<details>
<summary>트랜잭션 특성 (ACID) 과 DDL 의 자동 확정</summary>

- Atomicity: Either all changes are applied or all are rolled back.
- Consistency: Database rules (constraints) are maintained before and after execution.
- Isolation: Concurrent transactions cannot see each other's intermediate states.
- Durability: Once committed, results persist even in the event of a failure.
- It is known that DDL statements in Oracle are automatically committed immediately upon execution; therefore, executing a DDL statement after a DML statement confirms the preceding DML as well. This point is often tested in questions asking "Is it rolled back?".
</details>

## DDL: CREATE, ALTER, DROP, TRUNCATE

CREATE has already been mentioned above. ALTER modifies the structure after creation. Adding columns looks like this:

```sql
ALTER TABLE emp ADD COLUMN email TEXT;   -- 열: emp_id, ename, sal, dept_id, email
```

Oracle uses `ADD`, `MODIFY` (for changing type/size), `DROP COLUMN`, and `RENAME COLUMN`. SQLite supports a different range of features, so it was confirmed using `ADD COLUMN` as shown above.

The most frequently asked question in exams is the difference between the three deletion methods.

| Command | Category | Target Deleted | Rollback Possible | Condition (WHERE) |
|---|---|---|---|---|
| DELETE | DML | Rows (selected) | Yes (before COMMIT) | Possible |
| TRUNCATE | DDL | All rows (structure remains) | No | Not possible |
| DROP | DDL | Table itself | No | N/A |

Oracle documentation also states that TRUNCATE cannot be rolled back and cannot be recovered via FLASHBACK TABLE. Unlike deleting a table and recreating it, permissions, indexes, and constraints remain intact. DROP removes the table definition entirely; after `DROP TABLE emp`, `emp` disappears from the schema list.

## Constraints

These are rules enforced by the database to prevent invalid values from being entered. I intentionally inserted incorrect values into the table above to observe the resulting errors.

| Constraint | Meaning | Attempted Input | Result |
|---|---|---|---|
| NOT NULL | Prohibits empty values | NULL in ename | Rejected |
| PRIMARY KEY | Prohibits duplicates and NULLs; represents a row | emp_id=1 twice | Rejected (UNIQUE violation) |
| UNIQUE | Prohibits duplicates (NULLs allowed) | dname '영업' twice | Rejected |
| CHECK | Must satisfy condition | sal = -1 | Rejected |
| FOREIGN KEY | Only allows values existing in parent table | Non-existent dept_id=99 | Rejected |
| DEFAULT | Uses default value if none provided | sal omitted | 3000 |

Strictly speaking, DEFAULT is not a rule but a default value, but it is often memorized together with constraints. Common exam points include: PRIMARY KEY combines UNIQUE and NOT NULL; while only one PK can exist per table, multiple UNIQUE constraints are allowed. The concept of identifiers referenced by foreign keys continues in [Relation and Identifiers](#/post/sqld-relation-identifier).

<details>
<summary>Foreign Keys and Delete Options</summary>

When deleting a parent row with child rows present, the default behavior is to prevent deletion (as seen with the blocked department deletion above). However, this behavior can be modified using options.

- `ON DELETE CASCADE`: Deletes child rows along with the parent.
- `ON DELETE SET NULL`: Sets the foreign key column of the child to NULL.
- Conversely, dropping a parent table usually fails if children reference it.
</details>

## Common Misconceptions

- "TRUNCATE is just a faster version of DELETE and thus DML." It is actually DDL and cannot be rolled back.
- "NULLs cannot be inserted into UNIQUE columns." This restriction applies to PRIMARY KEY, not UNIQUE alone.
- "Errors occur if WHERE is omitted in UPDATE." No error occurs; all rows are updated.
- "ROLLBACK also undoes DDL." In Oracle, DDL is automatically committed, so it cannot be rolled back.

Details on SELECT functions and conditions can be found in [SELECT and Functions](#/post/sqld-select-func), while the overall flow is available in the map.

← [Concept Map](#/post/sqld-map)

Related articles: [DCL and Procedural SQL](#/post/sqld-dcl-procedure) · [Transactions](#/post/db-transaction) · [Relation and Identifiers](#/post/sqld-relation-identifier)

## Reference Links

- Oracle データベース SQL 言語リファレンス、MERGE: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/MERGE.html
- Oracle データベース SQL 言語リファレンス、TRUNCATE TABLE: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TRUNCATE-TABLE.html