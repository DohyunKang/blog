SQLD 2과목(SQL 기본 및 활용)의 첫 단원이다. SELECT는 쓰는 순서와 실행되는 순서가 다르고, 문제는 대개 그 차이와 NULL에서 갈린다. 개념은 쉬운데 결과를 정확히 맞히는 문제가 많아서, 직접 돌려 본 결과를 같이 적었다.

시험 일정과 응시료는 공식 사이트에서 확인하면 된다. 이 글은 단원 핵심과 자주 나오는 유형만 다룬다. 데이터 모델링 쪽은 [자세히 → 데이터 모델링의 이해](#/post/sqld-modeling)에 있다.

## 쓰는 순서와 실행 순서

SELECT 문은 이렇게 쓴다.

```
SELECT 열 → FROM 테이블 → WHERE 조건 → GROUP BY → HAVING → ORDER BY
```

실행은 다르게 흘러간다. SQL Server 문서가 정리한 논리적 처리 순서는 FROM, ON, JOIN, WHERE, GROUP BY, HAVING, SELECT, DISTINCT, ORDER BY, TOP이다. 문서는 실제 물리적 실행은 옵티마이저가 정하고 달라질 수 있다고 덧붙인다. 시험에서 묻는 건 어디까지나 이 논리적 순서다.

이 순서에서 바로 따라 나오는 규칙이 있다.

| 상황 | 이유 |
|---|---|
| WHERE에서 SELECT의 별칭을 못 쓴다 | 별칭은 SELECT 단계에서 생기는데 WHERE는 그 앞이다 |
| ORDER BY에서는 별칭을 쓸 수 있다 | ORDER BY가 SELECT 뒤다 |
| WHERE에서 집계 함수를 못 쓴다 | 그룹은 WHERE 뒤에 만들어진다. 그룹 조건은 HAVING |

HAVING과 집계는 [자세히 → GROUP BY와 집합 연산](#/post/sqld-group-set)에서 따로 본다.

## WHERE와 연산자

비교는 `=, <>, <, >, <=, >=`이고, 범위·목록·패턴은 아래처럼 쓴다.

| 연산자 | 뜻 |
|---|---|
| BETWEEN a AND b | a 이상 b 이하. 양 끝값을 포함한다 |
| IN (a, b, c) | 목록 중 하나와 같다. OR로 이은 것과 같다 |
| LIKE | 패턴 비교. `%`는 0글자 이상, `_`는 정확히 한 글자 |
| IS NULL / IS NOT NULL | NULL 여부 |

LIKE는 Oracle 문서 기준으로 대소문자를 구분하고, `ESCAPE`로 지정한 문자 뒤의 `%`나 `_`는 일반 문자로 본다. 예를 들어 `LIKE '_a%'`는 두 번째 글자가 a인 값이다. 아래 예제 데이터에서는 `'Park'`이 걸린다.

논리 연산자는 우선순위가 NOT, AND, OR 순이다. AND가 OR보다 먼저 묶이니까 괄호가 없으면 의도와 다르게 읽힌다. 다음 두 쿼리는 같은 결과가 나왔지만, 읽는 방식은 다르다.

```
WHERE sal >= 300 AND dept = 'A' OR dept = 'B'     -- (sal>=300 AND dept='A') OR dept='B'
WHERE sal >= 300 AND (dept = 'A' OR dept = 'B')   -- 괄호가 있으면 이쪽
```

문제에서 같은 결과가 나오는 우연한 데이터가 주어질 수도 있으니, 결과만 보지 말고 묶이는 순서로 푸는 게 안전하다.

## NULL이 제일 많이 틀린다

NULL은 값이 없다는 뜻이라 0도 빈 문자열도 아니다. NULL이 낀 비교와 연산은 거의 NULL(알 수 없음)이 된다. 아래 예제는 SQLite에서 실제로 돌려 확인했다.

<details>
<summary>예제 테이블 (SQLite로 실행해 확인)</summary>

```sql
create table emp(id int, name text, dept text, sal int, comm int);
insert into emp values
 (1,'Kim','A',300,null),
 (2,'Lee','A',250,50),
 (3,'Park','B',400,null),
 (4,'Choi',null,200,0),
 (5,'Jung','B',350,100);
```

</details>

아래는 위 테이블에서 돌린 결과다.

| 쿼리 | 결과 |
|---|---|
| `WHERE comm = NULL` | 0건 |
| `WHERE comm IS NULL` | 2건 (id 1, 3) |
| `SELECT sal + comm` | id 1, 3은 NULL, 나머지는 값 |
| `COUNT(*)`, `COUNT(comm)` | 5, 3 |
| `AVG(comm)` | 50.0 (0, 50, 100의 평균. NULL 행은 빠진다) |
| `WHERE dept <> 'A'` | id 3, 5 (dept가 NULL인 id 4는 빠진다) |
| `WHERE dept NOT IN ('A', NULL)` | 0건 |

정리하면 이렇다.

- 비교 연산에 NULL이 들어가면 참도 거짓도 아닌 "알 수 없음"이라 행이 걸러진다. 그래서 `= NULL`은 항상 0건이고 `IS NULL`을 써야 한다.
- NULL이 낀 산술 연산 결과는 NULL이다.
- `COUNT(*)`는 행 수를 세고, `COUNT(열)`과 `AVG`는 NULL을 건너뛴다. 합계·평균 문제에서 이 차이가 자주 나온다.
- `NOT IN` 목록에 NULL이 하나라도 있으면 아무 행도 안 나온다. 서브쿼리 결과에 NULL이 섞이는 경우에 자주 나오는 함정이다.

## NULL 처리 함수

| 함수 | 동작 |
|---|---|
| NVL(a, b) | a가 NULL이면 b, 아니면 a (Oracle) |
| COALESCE(a, b, c, ...) | 처음 나오는 NULL이 아닌 값. 표준 SQL이다 |
| NULLIF(a, b) | a와 b가 같으면 NULL, 다르면 a |

NVL은 Oracle 함수이고, COALESCE는 같은 일을 인자 여러 개로 할 수 있다. NULLIF는 `CASE WHEN a = b THEN NULL ELSE a END`와 같다. 흔한 쓰임은 0으로 나누는 걸 피하는 것이다. `total / NULLIF(cnt, 0)`처럼 쓰면 cnt가 0일 때 NULL이 나온다.

위 예제 테이블에서 돌려 본 결과다.

```sql
select id, sal + coalesce(comm, 0) from emp order by id;
-- (1,300) (2,300) (3,400) (4,200) (5,450)

select id, nullif(comm, 0) from emp order by id;
-- (1,None) (2,50) (3,None) (4,None) (5,100)
```

## 문자·숫자 함수

시험에는 결과값을 직접 묻는 문제가 나오니, 인자의 의미를 정확히 알아야 한다.

| 함수 | 설명 |
|---|---|
| UPPER / LOWER | 대문자 / 소문자 |
| LENGTH | 글자 수 |
| SUBSTR(문자열, 시작, 길이) | 시작 위치부터 길이만큼. 길이를 생략하면 끝까지 |
| REPLACE(문자열, 찾을 값, 바꿀 값) | 치환 |
| ROUND(숫자, n) | n자리까지 반올림. n이 음수면 소수점 왼쪽 자리 |
| ABS, MOD | 절댓값, 나머지 |

SUBSTR는 Oracle 문서 기준으로 시작 위치가 0이면 1로 보고, 음수면 문자열 끝에서부터 센다. `SUBSTR('ABCDEFG', -5, 4)`는 `CDEF`가 된다.

ROUND의 음수 자리는 소수점 왼쪽으로 센다. Oracle 문서 예제에서 `ROUND(15.193, -1)`은 20이다. 음수 값은 절댓값을 반올림한 뒤 부호를 붙이는 식이라 `ROUND(-15.193, -1)`은 -20이다.

## 날짜 함수

날짜는 대부분 Oracle 기준으로 나온다. 확인한 것은 `ADD_MONTHS(날짜, n)`이다. n개월 뒤 날짜를 돌려주고, 시작일이 그 달의 말일이거나 결과 달에 그 날짜가 없으면 결과 달의 말일이 된다. 예를 들어 1월 31일에 1개월을 더하면 2월 말일이다. 이 말일 규칙이 시험에서 함정이 되기 쉽다.

날짜 형식 변환(`TO_CHAR`, `TO_DATE`)은 형식 문자열을 외우는 쪽이라, 해당 문서의 형식 요소 표를 한 번 훑어 두면 충분하다.

## CASE

조건 분기는 두 가지 꼴이다.

```sql
select id,
  case when sal >= 350 then 'H' when sal >= 250 then 'M' else 'L' end
from emp order by id;
-- (1,'M') (2,'M') (3,'H') (4,'L') (5,'H')

select id, case dept when 'A' then 1 when 'B' then 2 end
from emp order by id;
-- (1,1) (2,1) (3,2) (4,None) (5,2)
```

위쪽은 조건식을 위에서부터 보고 처음 참인 것에서 멈춘다. 그래서 `sal >= 350`을 먼저 둬야 한다. 순서를 뒤집으면 400도 M이 된다. 아래쪽은 값 하나를 비교하는 단순 CASE이고, 어디에도 안 맞는데 ELSE도 없으면 NULL이다. dept가 NULL인 id 4가 그렇다. 단순 CASE는 `=` 비교라서 NULL을 매칭하지 못한다는 점도 기억해 둔다.

## 자주 나오는 유형

- 쿼리를 주고 결과 행 수나 값을 묻는 문제. NULL 행이 어디서 빠지는지 따라가야 한다.
- 실행 순서 때문에 오류가 나는 쿼리 고르기. 별칭을 WHERE에서 쓰거나 집계를 WHERE에 쓴 경우다.
- `NOT IN`과 NULL 조합, `= NULL` 비교.
- AND/OR 우선순위로 결과가 달라지는 WHERE.
- 함수에 인자를 넣었을 때의 결과(SUBSTR, ROUND, NVL, ADD_MONTHS).

풀 때는 먼저 FROM과 WHERE로 행을 추리고, 그다음 SELECT에서 계산한 값을 본다. NULL이 있으면 행마다 따로 평가한다.

← 개념 지도로 ([SQLD 지도](#/post/sqld-map))

관련 글: [자세히 → 조인과 서브쿼리](#/post/sqld-join-subquery) · [자세히 → GROUP BY와 집합 연산](#/post/sqld-group-set) · [자세히 → 관계형 DB와 SQL 기본](#/post/db-rdb-sql)

## 근거 링크

- [SELECT (Transact-SQL) — Microsoft Learn (논리적 처리 순서)](https://learn.microsoft.com/en-us/sql/t-sql/queries/select-transact-sql)
- [Oracle NVL](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/NVL.html)
- [Oracle NULLIF](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/NULLIF.html)
- [Oracle LIKE 조건](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Pattern-matching-Conditions.html)
- [Oracle SUBSTR](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SUBSTR.html)
- [Oracle ROUND(number)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ROUND-number.html)
- [Oracle ADD_MONTHS](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ADD_MONTHS.html)
