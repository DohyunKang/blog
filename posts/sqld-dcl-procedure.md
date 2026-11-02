SQLD에서 이 단원은 분량이 작은 편이다. 그래도 GRANT/REVOKE의 옵션 차이, 롤이 뭔지, 프로시저·함수·트리거가 어떻게 다른지는 보기 문장으로 자주 바뀌어 나오는 쪽이라 정리해 둔다. 일정과 응시 관련 내용은 공식 사이트에서 확인하면 된다.

SQL 명령은 성격에 따라 DDL, DML, TCL, DCL로 나눈다. 앞의 세 가지는 [DML·TCL·DDL과 제약조건](#/post/sqld-dml-ddl)에서 다뤘고, 이 글은 남은 DCL과 절차형 SQL이다.

## DCL이 뭔지

DCL(Data Control Language)은 데이터에 접근할 수 있는 권한을 제어하는 명령어다. 시험에 나오는 건 두 개다.

| 명령 | 하는 일 |
|---|---|
| GRANT | 사용자나 롤에 권한을 준다 |
| REVOKE | 준 권한을 회수한다 |

권한은 두 종류로 나뉜다. 시스템 권한은 테이블을 만들거나 세션을 연결하는 것처럼 DB 전체에 관한 권한이고, 객체 권한은 특정 테이블에 SELECT, UPDATE를 하는 것처럼 객체 하나에 대한 권한이다. 문법도 이 둘이 다르다. 아래는 Oracle 공식 문서에 나온 형태다.

```sql
-- 시스템 권한·롤
GRANT 시스템권한 | 롤 TO 대상 [WITH ADMIN OPTION];

-- 객체 권한
GRANT 객체권한 ON 객체 TO 대상 [WITH GRANT OPTION];
```

대상(grantee)에는 사용자, 롤, PUBLIC이 올 수 있다. PUBLIC은 모든 사용자라는 뜻이다.

## 옵션 두 개가 제일 헷갈린다

WITH ADMIN OPTION과 WITH GRANT OPTION은 이름이 비슷한데 붙는 대상이 다르다. 시험에서 이 둘을 바꿔 놓은 보기가 자주 나온다.

| | WITH ADMIN OPTION | WITH GRANT OPTION |
|---|---|---|
| 붙는 곳 | 시스템 권한, 롤 | 객체 권한 |
| 받은 사람이 할 수 있는 것 | 그 권한·롤을 다른 사람에게 줄 수 있다 | 그 객체 권한을 다른 사람이나 롤에 줄 수 있다 |
| 제약 | 문서 기준 GLOBAL 롤은 넘길 수 없다 | 롤에게 줄 때는 쓸 수 없다 |

외우는 방법은 단순하게 잡았다. ADMIN은 시스템·롤, GRANT는 객체. 옵션만 빼는 명령은 따로 없어서, 옵션을 없애려면 권한을 통째로 회수하고 옵션 없이 다시 줘야 한다.

<details>
<summary>REVOKE에서 연쇄 회수가 일어나는 경우</summary>

객체 권한을 회수하면 연쇄로 따라 지워진다. A가 B에게 WITH GRANT OPTION으로 객체 권한을 줬고 B가 C에게 다시 줬다면, A가 B의 권한을 회수할 때 C의 권한도 같이 사라진다. 문서 예시도 한 사용자의 UPDATE를 회수하니 그 사용자가 넘겨 준 다른 사용자의 권한까지 같이 지워지는 구조였다. 그 객체 권한에 기대고 있던 프로시저나 함수는 더 이상 실행되지 않고, 그 객체 위에 만든 뷰는 무효가 된다.

시스템 권한과 롤을 회수할 때는 문서가 다른 사람에게까지 연쇄로 번진다는 말은 따로 적지 않는다. 시험에서는 "객체 권한 회수는 연쇄, 시스템 권한은 아니다" 정도로 구분해서 물어보는 경우가 많다.

REVOKE에는 CASCADE CONSTRAINTS도 있다. REFERENCES 권한(또는 ALL)을 회수할 때만 의미가 있고, 그 권한으로 상대가 만들어 둔 참조 무결성 제약조건을 같이 지운다. 상대가 그런 제약조건을 만들어 둔 상태라면 이 옵션이 필수다.

```sql
REVOKE REFERENCES ON hr.employees FROM oe CASCADE CONSTRAINTS;
```
</details>

## 롤(ROLE)

권한을 사용자마다 하나씩 주면 사람이 많아질수록 관리가 힘들다. 롤은 여러 권한을 묶어 이름을 붙인 것이다. 롤에 권한을 담아 두고 롤을 사용자에게 주면 된다.

- 롤을 사용자에게 주면 사용자가 그 권한을 쓸 수 있게 된다. 문서 기준으로 세션에서 롤이 켜져 있어야 실제로 권한이 행사된다.
- 롤을 다른 롤에 줄 수도 있다. 그러면 받는 롤에 권한이 합쳐진다. 서로를 주고받는 순환 부여는 안 된다.
- 롤을 PUBLIC에 주면 모든 사용자가 쓸 수 있다.
- 롤에는 REFERENCES 권한을 줄 수 없다.

시험에서는 "롤을 쓰면 권한 관리가 편해진다" 쪽 문장이 맞는 보기로 나오는 경우가 많다. DBMS마다 미리 만들어 둔 롤이 있는데 이름과 구성은 제품마다 다르니, 쓰는 DBMS 문서를 보고 확인한다.

## 절차형 SQL

일반 SQL은 한 문장씩 던지는 방식이다. 절차형 SQL은 변수, 조건문, 반복문 같은 프로그래밍 요소를 SQL에 넣어서 여러 문장을 하나로 묶고, 그걸 DB 안에 이름을 붙여 저장해 두는 방식이다. Oracle은 PL/SQL, SQL Server는 T-SQL로 부른다. 저장하는 단위가 세 가지다.

| 종류 | 호출 | 값 반환 | 특징 |
|---|---|---|---|
| 프로시저 | 명시적으로 호출 | 필수 아님 | 매개변수를 받고 여러 작업을 묶는다 |
| 함수 | 명시적으로 호출 | 값 하나를 반환 | 반환값이 있어서 SQL 문장 안에서 쓸 수 있다 |
| 트리거 | 이벤트가 나면 자동 실행 | 없음 | 매개변수도 없고 직접 호출도 못 한다 |

Oracle 문서는 트리거를 "시스템이 정의한 이벤트(예: 테이블에 대한 DML)가 일어나면 DB가 자동으로 실행하는, DB에 저장된 이름 붙은 PL/SQL 단위"로 설명한다. 켜고 끌 수는 있지만 직접 호출할 수는 없고, 이벤트를 새로 정의할 수도 없다. 프로시저·함수와 구분하는 핵심이 이 부분이다.

### 트리거를 읽는 법

시험에는 트리거 이름과 구성요소를 묻는 문제가 나온다. 알아 둘 것은 세 가지다.

- BEFORE / AFTER: 이벤트 문장보다 먼저 도는지, 나중에 도는지. BEFORE 트리거에서는 값을 쓰기 전에 바꿀 수 있다.
- 행 단위 / 문장 단위: FOR EACH ROW를 붙이면 영향받는 행마다 한 번씩, 안 붙이면 문장당 한 번 돈다. 영향받은 행이 0개여도 문장 단위는 한 번 돈다.
- :OLD / :NEW: 행의 변경 전 값과 후 값. 행 단위 트리거에서만 쓴다. UPDATE는 둘 다, INSERT는 :NEW, DELETE는 :OLD가 의미 있다.

```sql
CREATE OR REPLACE TRIGGER emp_bi
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
  :NEW.created_on := SYSDATE;
END;
/
```

위는 Oracle 문서의 예시다. 행이 들어가기 전에 생성일 컬럼에 현재 시각을 넣는다.

동작을 직접 확인하고 싶어서 SQLite로 같은 구조를 돌려 봤다. SQLite는 `:OLD` 대신 `old.`를 쓰는 등 문법이 약간 다르지만, 행 단위 AFTER UPDATE 트리거가 변경 전후 값을 읽어 로그 테이블에 쌓는 흐름은 같다.

```sql
create table emp(id integer primary key, name text, sal integer);
create table sal_log(emp_id int, old_sal int, new_sal int);
create trigger trg_sal after update of sal on emp for each row
begin insert into sal_log values(old.id, old.sal, new.sal); end;

insert into emp values(1, 'kim', 300);
update emp set sal = 350 where id = 1;
select * from sal_log;   -- (1, 300, 350)
```

급여를 300에서 350으로 바꿨더니 로그에 `(1, 300, 350)`이 한 줄 쌓였다. 호출한 적이 없는데 UPDATE 하나로 트리거가 돌았다는 점이 프로시저와 다른 부분이다.

## 자주 나오는 유형

- 옵션 짝 맞추기: ADMIN OPTION은 시스템 권한·롤, GRANT OPTION은 객체 권한. 바꿔 쓴 보기가 틀린 보기다.
- 회수 결과 묻기: A→B→C로 객체 권한이 넘어간 뒤 A가 B 것을 회수하면 C 것도 사라진다.
- 롤의 성격: 권한 묶음이고 관리 편의를 위한 것. 사용자에게도, 다른 롤에도 줄 수 있다.
- 프로시저·함수·트리거 구분: 호출하는가(프로시저·함수) 자동으로 도는가(트리거), 값을 돌려주는가(함수).
- 트리거 요소: BEFORE/AFTER, 행/문장 단위, :OLD/:NEW가 어느 이벤트에서 의미가 있는지.

풀 때는 문장 속 키워드부터 본다. 보기에 "자동으로"가 있으면 트리거, "반환"이 있으면 함수, "객체"가 있으면 GRANT OPTION 쪽으로 먼저 좁히면 대부분 두세 개로 줄어든다. 문제에서 쓰는 DBMS가 Oracle인지 SQL Server인지도 같이 본다. 세부 문법이 제품마다 다르다.

관련해서 함께 읽으면 좋은 글은 제약조건과 DDL을 다룬 [DML·TCL·DDL과 제약조건](#/post/sqld-dml-ddl), 기본 조회 문법의 [SELECT와 함수](#/post/sqld-select-func), 그리고 전체 흐름을 보는 [SQLD map](#/post/sqld-map)다.

← 개념 map으로 (#/post/sqld-map)

## 근거 링크

- Oracle Database SQL Language Reference, GRANT: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/GRANT.html
- Oracle Database SQL Language Reference, REVOKE: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/REVOKE.html
- Oracle Database PL/SQL Language Reference, Triggers: https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/plsql-triggers.html
