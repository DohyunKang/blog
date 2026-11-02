SQLD에서 GROUP BY 단원은 집계 함수와 NULL, WHERE와 HAVING의 순서, ROLLUP·CUBE·GROUPING SETS의 결과 행 수, 집합 연산자의 중복 처리를 묻는 문제가 자주 나온다. 아래 예제는 duckdb에서 직접 돌려 결과를 확인했다. 시험 환경(Oracle) 문법과 다른 곳은 따로 적어 뒀다.

## 예제 테이블

설명에 쓸 테이블은 사원 7명짜리다. 부서(dept), 직급(job), 급여(sal), 수당(comm) 네 컬럼만 있다.

| id | dept | job | sal | comm |
|---|---|---|---|---|
| 1 | SALES | CLERK | 300 | 50 |
| 2 | SALES | CLERK | 320 | NULL |
| 3 | SALES | SENIOR | 400 | NULL |
| 4 | DEV | CLERK | 350 | NULL |
| 5 | DEV | SENIOR | 450 | NULL |
| 6 | DEV | SENIOR | 470 | NULL |
| 7 | HR | CLERK | 310 | NULL |

## 집계 함수

집계 함수는 여러 행을 받아 값 하나를 돌려준다. COUNT, SUM, AVG, MAX, MIN이 기본이다.

- `COUNT(*)`는 행 수를 센다. NULL이 있어도 센다.
- `COUNT(컬럼)`은 그 컬럼이 NULL이 아닌 행만 센다.
- SUM, AVG, MAX, MIN은 NULL을 건너뛰고 계산한다.
- 행이 하나도 없을 때 `COUNT`는 0, 나머지는 NULL을 돌려준다.

```sql
SELECT COUNT(*), COUNT(comm), AVG(sal), AVG(comm) FROM emp;
-- 7, 1, 371.43, 50
```

수당이 있는 사람은 1명뿐이라 `COUNT(comm)`은 1이고, `AVG(comm)`은 7로 나눈 값이 아니라 50이다. NULL 행이 분모에서 빠지기 때문이다. 이 부분이 단골 함정이라 계산 문제가 나오면 NULL이 몇 개인지부터 본다.

NULL을 0으로 보고 평균을 내고 싶으면 `AVG(NVL(comm, 0))`처럼 바꿔야 한다. NVL은 Oracle 함수다. 이 이야기는 [자세히 → SELECT문과 함수](#/post/sqld-select-func)에서 더 다룬다.

## GROUP BY와 HAVING

GROUP BY는 지정한 컬럼 값이 같은 행끼리 묶어서 그룹당 한 줄로 만든다. 규칙은 두 개다.

- SELECT 목록에는 GROUP BY에 쓴 컬럼, 집계 함수, 상수만 올 수 있다. 그 외 컬럼을 쓰면 Oracle은 ORA-00979 오류를 낸다.
- 그룹을 거른 조건은 WHERE가 아니라 HAVING에 쓴다. WHERE는 묶기 전에 행을 거르고, HAVING은 묶은 뒤에 그룹을 거른다.

```sql
SELECT dept, COUNT(*), SUM(sal)
FROM emp
GROUP BY dept
HAVING SUM(sal) >= 1000
ORDER BY dept;
-- DEV 3 1270 / SALES 3 1020   (HR은 310이라 빠짐)
```

SQL이 실행되는 논리 순서는 이렇게 외우면 편했다.

| 순서 | 절 | 하는 일 |
|---|---|---|
| 1 | FROM | 테이블을 정한다 |
| 2 | WHERE | 행을 거른다 |
| 3 | GROUP BY | 묶는다 |
| 4 | HAVING | 그룹을 거른다 |
| 5 | SELECT | 컬럼을 고른다 |
| 6 | ORDER BY | 정렬한다 |

ORDER BY가 SELECT 뒤에 오기 때문에 SELECT에서 붙인 별칭을 ORDER BY에서는 쓸 수 있다. Oracle 문서도 별칭은 ORDER BY에서만 쓸 수 있다고 적는다.

<details>
<summary>WHERE에 집계 함수를 쓰면 안 되는 이유</summary>

WHERE는 3번(묶기)보다 앞에 실행된다. 이 시점에는 아직 그룹이 없어서 `SUM(sal)` 같은 값이 존재하지 않는다. 그래서 `WHERE SUM(sal) >= 1000`은 오류가 난다. 같은 조건이 "부서 합계"가 아니라 "행 하나의 값"에 대한 거라면 WHERE에 써도 된다. 예를 들어 `WHERE sal >= 400`은 묶기 전에 급여 400 이상인 행만 남긴다. 성능 면에서도 그룹 조건이 아니라면 WHERE로 먼저 줄이는 쪽이 낫다.

</details>

## ROLLUP, CUBE, GROUPING SETS

GROUP BY 하나로 소계와 총계까지 한 번에 뽑는 확장 문법이다. Oracle 문서는 이걸 UNION ALL로 따로 묶어 쓰는 대신 한 쿼리 블록에서 처리해 테이블을 한 번만 읽게 하는 방법이라고 설명한다.

### ROLLUP

`ROLLUP(a, b)`는 오른쪽 컬럼부터 하나씩 빼면서 소계를 만든다. 컬럼이 n개면 집계 수준이 n+1개다.

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY ROLLUP(dept, job)
ORDER BY dept, job;
```

| dept | job | SUM(sal) |
|---|---|---|
| DEV | CLERK | 350 |
| DEV | SENIOR | 920 |
| DEV | NULL | 1270 |
| HR | CLERK | 310 |
| HR | NULL | 310 |
| SALES | CLERK | 620 |
| SALES | SENIOR | 400 |
| SALES | NULL | 1020 |
| NULL | NULL | 2600 |

`(dept, job)` 상세 행, `(dept)` 부서 소계, `()` 총계가 한 결과에 들어 있다. 컬럼 순서를 바꿔 `ROLLUP(job, dept)`로 쓰면 소계 기준이 직급으로 바뀐다. 순서가 결과를 정한다는 점이 시험에 자주 걸린다.

### CUBE

`CUBE(a, b)`는 컬럼의 가능한 조합을 전부 만든다. 컬럼이 n개면 2의 n제곱 수준이다.

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY CUBE(dept, job)
ORDER BY dept, job;
```

ROLLUP 결과에 직급별 소계 두 줄이 더 붙는다.

| dept | job | SUM(sal) |
|---|---|---|
| NULL | CLERK | 1280 |
| NULL | SENIOR | 1320 |

ROLLUP 9행에 직급별 2행이 더해져 총 11행이다. 조합이 `(dept, job)`, `(dept)`, `(job)`, `()` 네 개라서 그렇다. CUBE는 컬럼 순서를 바꿔도 결과 행의 집합이 같다.

### GROUPING SETS

`GROUPING SETS`는 내가 지정한 묶음만 계산한다. 소계 중에 필요한 것만 고를 때 쓴다.

```sql
SELECT dept, job, SUM(sal)
FROM emp
GROUP BY GROUPING SETS ((dept), (job))
ORDER BY dept, job;
-- 부서별 3줄 + 직급별 2줄 = 5줄
```

총계도, 상세 행도 안 나온다. 지정한 `(dept)`와 `(job)`만 나온다. 컬럼 순서가 바뀌어도 결과가 같다는 점은 CUBE와 같다.

<details>
<summary>세 문법을 GROUPING SETS로 풀어쓰면</summary>

Oracle 문서에 나오는 등가 표현이다.

- `ROLLUP(a, b, c)` = `GROUPING SETS ((a,b,c), (a,b), (a), ())`
- `CUBE(a, b, c)` = `GROUPING SETS ((a,b,c), (a,b), (a,c), (b,c), (a), (b), (c), ())` (8개)
- `GROUPING SETS (a, b, (b,c))` = `GROUP BY a` UNION ALL `GROUP BY b` UNION ALL `GROUP BY b, c`

괄호로 묶은 `(b, c)`는 한 덩어리로 취급한다. `ROLLUP(a, (b, c))`는 `(a,b,c)`, `(a)`, `()` 세 수준이라 b만의 소계는 나오지 않는다.

</details>

### GROUPING 함수

ROLLUP·CUBE의 소계 행은 해당 컬럼이 NULL로 나온다. 그런데 실제 데이터에도 NULL이 있을 수 있어서 NULL만 보고는 소계인지 구분이 안 된다. `GROUPING(컬럼)`은 그 NULL이 소계 때문이면 1, 아니면 0을 돌려준다.

```sql
SELECT dept, job, SUM(sal), GROUPING(dept), GROUPING(job)
FROM emp
GROUP BY ROLLUP(dept, job)
ORDER BY dept, job;
-- DEV / NULL / 1270 / 0 / 1   (직급 자리가 소계)
-- NULL / NULL / 2600 / 1 / 1  (총계)
```

Oracle 문서의 예는 `DECODE(GROUPING(department_name), 1, 'ALL DEPARTMENTS', department_name)`처럼 소계 행에 이름을 붙이는 쓰임이다. 같은 계열로 `GROUPING_ID`는 여러 컬럼의 GROUPING 값을 비트 벡터 숫자로 돌려주고, `GROUP_ID`는 중복된 그룹을 구분한다.

## 집합 연산자

두 SELECT 결과를 위아래로 합치거나 빼는 연산이다. 조인이 컬럼을 옆으로 붙인다면 집합 연산은 행을 위아래로 다룬다. 조인은 [자세히 → 조인과 서브쿼리](#/post/sqld-join-subquery)에 있다.

| 연산자 | 결과 | 중복 |
|---|---|---|
| UNION | 합집합 | 제거 |
| UNION ALL | 합집합 | 유지 |
| INTERSECT | 교집합 | 제거 |
| MINUS | 차집합(앞 결과에서 뒤 결과를 뺌) | 제거 |

MINUS는 Oracle 이름이고, duckdb·PostgreSQL 같은 곳에서는 EXCEPT라고 쓴다. 아래 결과는 EXCEPT로 돌려 얻었다.

```sql
SELECT job FROM emp WHERE dept = 'SALES'
UNION ALL
SELECT job FROM emp WHERE dept = 'DEV';
-- CLERK CLERK SENIOR CLERK SENIOR SENIOR  (6행)

-- UNION이면 CLERK, SENIOR (2행)

SELECT job FROM emp WHERE dept = 'SALES'
INTERSECT
SELECT job FROM emp WHERE dept = 'HR';
-- CLERK

SELECT job FROM emp WHERE dept = 'DEV'
MINUS   -- duckdb에서는 EXCEPT
SELECT job FROM emp WHERE dept = 'HR';
-- SENIOR
```

UNION은 중복을 없애는 작업이 한 번 더 들어가는 연산이다. 중복이 없다고 알고 있으면 UNION ALL을 쓰는 쪽이 간단하다.

Oracle 문서가 정리한 규칙은 이렇다.

- 두 SELECT의 컬럼 수가 같아야 하고, 같은 위치의 컬럼은 같은 데이터 유형 그룹(숫자·문자)이어야 한다. 한쪽에 없는 컬럼은 `TO_CHAR(NULL)` 같은 식으로 맞춘다.
- ORDER BY는 맨 마지막에 한 번만 쓴다. 각 SELECT 안에는 못 쓴다.
- 연산자 우선순위는 같고 왼쪽부터 처리한다. INTERSECT를 다른 연산자와 섞을 때는 괄호로 순서를 분명히 하라고 문서에 적혀 있다.

<details>
<summary>풀이 순서 잡는 법</summary>

집합 연산 문제는 이 순서로 풀었다.

1. 각 SELECT가 돌려주는 행을 먼저 따로 적는다.
2. 연산자를 왼쪽부터 하나씩 적용한다. UNION과 INTERSECT, MINUS가 섞이면 괄호가 있는지 본다.
3. 중복 제거 여부(UNION ALL인지)를 마지막에 한 번 더 확인한다.
4. 컬럼 수·유형이 안 맞으면 오류라는 선택지가 정답일 수 있다.

</details>

## 자주 나오는 유형 정리

- COUNT(*)와 COUNT(컬럼), AVG의 NULL 처리 결과값 계산
- WHERE와 HAVING의 위치, HAVING 없이 집계 함수를 WHERE에 쓴 틀린 SQL 고르기
- GROUP BY에 없는 컬럼을 SELECT에 쓴 문장이 왜 오류인지
- ROLLUP, CUBE, GROUPING SETS 결과 행 수 세기
- GROUPING 함수 값이 1인 행 찾기
- UNION과 UNION ALL의 결과 행 수 차이, INTERSECT·MINUS 결과

윈도우 함수로 그룹 안에서 순위를 매기는 건 [자세히 → 윈도우 함수와 고급 SQL](#/post/sqld-window-advanced)에서 이어진다. 시험 일정과 응시료는 공식 사이트에서 확인한다.

← 개념 map으로 (#/post/sqld-map)

관련 글: [SELECT문과 함수](#/post/sqld-select-func) · [조인과 서브쿼리](#/post/sqld-join-subquery) · [윈도우 함수와 고급 SQL](#/post/sqld-window-advanced)

## 근거 링크

- Oracle Database 19c SQL Language Reference, SELECT: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html
- Oracle Database 19c, GROUPING 함수: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/GROUPING.html
- Oracle Database 19c, UNION ALL·INTERSECT·MINUS 연산자: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/The-UNION-ALL-INTERSECT-MINUS-Operators.html
- Oracle Database 19c Data Warehousing Guide, SQL for Aggregation: https://docs.oracle.com/en/database/oracle/oracle-database/19/dwhsg/sql-aggregation-data-warehouses.html
