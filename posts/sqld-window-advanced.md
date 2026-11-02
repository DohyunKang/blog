윈도우 함수는 GROUP BY처럼 행을 합치지 않고 행마다 계산값을 하나씩 붙여 주는 함수다. SQLD 2과목에서 순위, 이전/다음 행, 누적 합계, TOP N, 계층형 질의, PIVOT, 정규표현식이 이 단원에 묶여 나온다. 시험 일정과 응시료는 공식 사이트에서 확인한다.

## 윈도우 함수가 뭔지

집계 함수는 그룹마다 결과를 한 줄로 만든다. 윈도우 함수(분석 함수)는 같은 계산을 하되 입력 행 수를 그대로 유지한다. Oracle 문서 표현으로는 "행마다 하나의 결과를 돌려주는 집계"다.

모양은 늘 같다.

```
함수() OVER ( [PARTITION BY ...] [ORDER BY ...] [윈도잉 절] )
```

- PARTITION BY: 그룹을 나눈다. 생략하면 전체가 한 그룹이다. GROUP BY와 달리 행이 합쳐지지 않는다.
- ORDER BY: 그룹 안의 정렬 기준이다.
- 윈도잉 절(ROWS/RANGE): 계산에 쓸 행의 범위다. ORDER BY가 있어야 쓴다.

실행 순서도 외워 둘 만하다. 윈도우 함수는 FROM, WHERE, GROUP BY, HAVING 다음에 계산된다. 그래서 SELECT 절과 ORDER BY 절에만 쓸 수 있고, WHERE에는 못 쓴다. 순위로 걸러내려면 한 번 감싸야 한다. 이게 시험에서 오답 보기로 자주 나오는 자리다.

## 순위 함수 셋

같은 점수가 있을 때 번호를 어떻게 매기느냐가 세 함수의 차이다. 아래는 부서별 급여 순위를 직접 돌려 본 결과다(테이블은 가상 데이터).

| ename | deptno | sal | RANK | DENSE_RANK | ROW_NUMBER |
|---|---|---|---|---|---|
| A | 10 | 500 | 1 | 1 | 1 |
| B | 10 | 500 | 1 | 1 | 2 |
| C | 10 | 400 | 3 | 2 | 3 |
| D | 10 | 300 | 4 | 3 | 4 |

- RANK: 동점이면 같은 번호를 주고 다음 번호를 건너뛴다(1, 1, 3).
- DENSE_RANK: 동점이면 같은 번호, 건너뛰지 않는다(1, 1, 2).
- ROW_NUMBER: 동점이어도 무조건 다른 번호다. 동점끼리 누가 먼저인지는 정해져 있지 않아서, 결과를 고정하려면 정렬 키를 하나 더 붙인다(`ORDER BY sal DESC, ename`).

```sql
select ename, deptno, sal,
  rank()       over (partition by deptno order by sal desc) rnk,
  dense_rank() over (partition by deptno order by sal desc) drnk,
  row_number() over (partition by deptno order by sal desc, ename) rn
from emp;
```

## 앞뒤 행, 누적, 비율

- LAG(컬럼, n): n행 앞의 값. LEAD(컬럼, n): n행 뒤의 값. 첫 행의 LAG, 마지막 행의 LEAD는 NULL이다(기본값을 세 번째 인수로 줄 수 있다).
- FIRST_VALUE / LAST_VALUE: 윈도 안의 첫 값과 마지막 값.
- SUM 같은 집계 함수에 OVER를 붙이면 누적·이동 합계가 된다.
- RATIO_TO_REPORT(x): 그룹 합계 대비 x의 비율.
- NTILE(n): 그룹을 n개 구간으로 나눈다.
- CUME_DIST, PERCENT_RANK: 누적 분포와 상대 순위.

월별 매출에서 직전 달과 다음 달 값을 붙이면 이렇게 나온다.

```sql
select month, amount,
  lag(amount,1)  over (order by month) prev,
  lead(amount,1) over (order by month) nxt
from sales where product='x';
-- (1, 10, NULL, 20) (2, 20, 10, 30) (3, 30, 20, NULL)
```

<details>
<summary>윈도잉 절 자세히 (ROWS와 RANGE, 기본 범위)</summary>

경계 키워드는 다섯 가지다.

| 키워드 | 뜻 |
|---|---|
| UNBOUNDED PRECEDING | 파티션 맨 앞(시작점에만) |
| UNBOUNDED FOLLOWING | 파티션 맨 끝(끝점에만) |
| CURRENT ROW | 현재 행 |
| n PRECEDING | 현재 행 기준 n행 앞 |
| n FOLLOWING | 현재 행 기준 n행 뒤 |

- ROWS는 물리적인 행 개수로, RANGE는 ORDER BY 값의 거리(날짜 간격 등)로 범위를 잡는다.
- ORDER BY만 쓰고 윈도잉 절을 생략하면 기본 범위는 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`다. 그래서 `SUM(x) OVER (ORDER BY ...)`는 누적 합계가 된다.
- 동점 행이 있을 때 RANGE는 동점 행에 같은 결과를 주고, ROWS는 행 순서에 따라 결과가 달라질 수 있다.
- LAST_VALUE는 기본 범위가 현재 행까지라서, 파티션의 진짜 마지막 값을 원하면 `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`을 붙이는 식으로 쓴다.

누적 합계와 비율 예시(직접 실행한 결과).

```sql
select month, product, amount,
  sum(amount) over (order by month, product
                    rows between unbounded preceding and current row) run,
  sum(amount) over (partition by month) month_total,
  round(100.0*amount/sum(amount) over (partition by month),1) pct
from sales order by month, product;
-- (1,'x',10, 10,15,66.7) (1,'y',5, 15,15,33.3) (2,'x',20, 35,35,57.1) ...
```
</details>

## TOP N

윈도우 함수 쪽 풀이는 순위를 매긴 뒤 바깥 쿼리에서 거른다.

```sql
select * from (
  select ename, deptno, sal,
         rank() over (partition by deptno order by sal desc) rnk
  from emp
) where rnk <= 2;
```

위 가상 데이터로 돌리면 10번 부서에서 동점 두 명(A, B)이 1위로 나오고, 20번 부서에서는 E, F가 나온다. RANK를 쓰면 동점 때문에 N명보다 많아질 수 있고, ROW_NUMBER를 쓰면 정확히 N명이다. 시험에서는 이 차이를 묻는다.

DBMS마다 전체 TOP N 문법이 다르다는 점도 자주 나온다.

| DBMS | 문법 |
|---|---|
| Oracle | `ROWNUM <= n` (정렬은 서브쿼리 안에서), 12c 이후 `FETCH FIRST n ROWS ONLY` |
| SQL Server | `SELECT TOP (n) ...`, 동점까지 포함하려면 `WITH TIES` |

Oracle에서 `ROWNUM`은 정렬 전에 번호가 붙기 때문에 `WHERE ROWNUM <= 3 ... ORDER BY` 순서로 쓰면 정렬된 상위 3개가 아니다. 인라인 뷰로 먼저 정렬하고 바깥에서 자른다. `FETCH FIRST n ROWS WITH TIES`는 마지막 행과 동점인 행까지 같이 돌려주고 ORDER BY가 필요하다(Oracle 12c 이후 동작).

## 계층형 질의

조직도, 메뉴, 댓글처럼 부모-자식이 한 테이블 안에 있는 데이터를 트리 순서로 읽는 문법이다. Oracle은 CONNECT BY를 쓴다.

```sql
SELECT last_name, employee_id, manager_id, LEVEL
  FROM employees
  START WITH employee_id = 100
  CONNECT BY PRIOR employee_id = manager_id
  ORDER SIBLINGS BY last_name;
```

| 요소 | 의미 |
|---|---|
| START WITH | 루트 행을 정하는 조건 |
| CONNECT BY | 부모-자식 연결 조건. 한쪽에 PRIOR가 있어야 한다 |
| PRIOR | 부모 행의 값을 가리키는 연산자 |
| LEVEL | 깊이. 루트가 1 |
| NOCYCLE | 순환이 있어도 에러 대신 행을 돌려준다(없으면 ORA-01436) |
| ORDER SIBLINGS BY | 계층 순서를 유지한 채 형제끼리만 정렬 |
| SYS_CONNECT_BY_PATH(col, '/') | 루트부터 현재 행까지의 경로 |
| CONNECT_BY_ISLEAF | 자식이 없으면 1 |
| CONNECT_BY_ROOT col | 최상위 조상의 값 |

`CONNECT BY PRIOR employee_id = manager_id`는 부모의 사원번호가 자식의 매니저 번호와 같다는 뜻이라서 위에서 아래로(순방향) 내려간다. PRIOR를 반대쪽에 붙이면 아래에서 위로(역방향) 올라간다. 방향 문제가 나오면 PRIOR가 어느 쪽에 붙었는지부터 본다. WHERE 조건은 계층을 다 만든 뒤 행마다 적용되고, 일반 ORDER BY나 GROUP BY를 쓰면 계층 순서가 깨진다.

SQL Server는 CONNECT BY가 없고 재귀 CTE를 쓴다. Oracle 문서도 더 유연한 방법으로 재귀 WITH를 안내한다. 아래는 SQLite에서 직접 돌린 재귀 쿼리다(조직도는 가상 데이터).

```sql
with recursive t(id, name, lvl, path) as (
  select id, name, 1, '/'||name from org where mgr is null
  union all
  select o.id, o.name, t.lvl+1, t.path||'/'||o.name
  from org o join t on o.mgr = t.id)
select * from t order by path;
-- (1,'King',1,'/King') (2,'Kim',2,'/King/Kim') (4,'Park',3,'/King/Kim/Park') (3,'Lee',2,'/King/Lee')
```

첫 SELECT가 START WITH, 두 번째 SELECT의 조인 조건이 CONNECT BY, `lvl`이 LEVEL, `path`가 SYS_CONNECT_BY_PATH에 대응한다고 보면 된다.

## PIVOT과 UNPIVOT

PIVOT은 행을 열로 돌린다. 집계하면서 돌리기 때문에, 쓰지 않은 컬럼들로 암묵적인 GROUP BY가 걸린다.

```sql
SELECT *
FROM (SELECT product, quarter, amount FROM sales)
PIVOT (
  SUM(amount) FOR quarter IN ('Q1' AS q1, 'Q2' AS q2, 'Q3' AS q3, 'Q4' AS q4)
);
```

UNPIVOT은 반대로 열을 행으로 돌린다. 기본은 NULL 행을 제외한다(`EXCLUDE NULLS`).

```sql
SELECT product, quarter, amount
FROM sales_wide
UNPIVOT (amount FOR quarter IN (q1 AS 'Q1', q2 AS 'Q2', q3 AS 'Q3', q4 AS 'Q4'));
```

PIVOT 문법이 없는 DBMS에서나 PIVOT이 나오기 전에 쓰던 방식이 CASE와 집계 함수를 같이 쓰는 방법이다. SQLD 시험에는 이쪽도 나온다. 직접 돌린 결과다.

```sql
select month,
  sum(case when product='x' then amount end) x,
  sum(case when product='y' then amount end) y
from sales group by month;
-- (1,10,5) (2,20,15) (3,30,NULL)
```

해당 조건에 맞는 값이 없으면 SUM이 NULL을 돌려준다는 점도 위 결과에서 보인다(3월의 y).

## 정규표현식

Oracle의 `REGEXP_LIKE(원본, 패턴 [, 옵션])`은 LIKE의 정규식 버전이고 POSIX 표준을 따른다. 옵션은 한 글자씩이다.

| 옵션 | 효과 |
|---|---|
| i | 대소문자 구분 안 함 |
| c | 대소문자·악센트 구분 |
| n | `.`이 줄바꿈도 매치 |
| m | `^`, `$`가 각 줄의 시작·끝 |
| x | 패턴의 공백 무시 |

```sql
SELECT first_name FROM employees
WHERE REGEXP_LIKE (first_name, '^Ste(v|ph)en$');   -- Steven, Stephen
```

같은 계열로 REGEXP_INSTR, REGEXP_REPLACE, REGEXP_SUBSTR이 있다. 기호 자체는 일반 정규식과 같다(`^` 시작, `$` 끝, `|` 또는, `()` 그룹). 시험에서는 함수 이름과 기본 기호를 알아보는 정도로 나온다고 보고 준비하면 된다.

## 자주 걸리는 부분

- 윈도우 함수는 WHERE에 못 쓴다. 감싸서 거른다.
- RANK는 번호를 건너뛰고, DENSE_RANK는 안 건너뛰고, ROW_NUMBER는 동점도 구분한다.
- LAG의 첫 행, LEAD의 마지막 행은 NULL이다.
- PARTITION BY는 행을 합치지 않는다.
- 계층형 질의에서 PRIOR 위치가 방향을 정한다.
- Oracle ROWNUM은 정렬 전에 매겨진다.

윈도우 함수를 처음 보면 OVER 안이 복잡해 보이는데, 위 세 칸에 뭘 넣었는지만 보면 읽힌다.

[← 개념 map으로](#/post/sqld-map)

관련 글: [GROUP BY와 집합 연산](#/post/sqld-group-set), [조인과 서브쿼리](#/post/sqld-join-subquery), [SELECT와 함수](#/post/sqld-select-func), [DML·TCL·DDL과 제약조건](#/post/sqld-dml-ddl)

## 근거 링크

- [Oracle Database 19c SQL Language Reference – Analytic Functions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Analytic-Functions.html)
- [Oracle Database 19c SQL Language Reference – Hierarchical Queries](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Hierarchical-Queries.html)
- [Oracle Database 19c SQL Language Reference – SELECT (PIVOT/UNPIVOT)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html)
- [Oracle Database 19c SQL Language Reference – Pattern-matching Conditions (REGEXP_LIKE)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Pattern-matching-Conditions.html)
