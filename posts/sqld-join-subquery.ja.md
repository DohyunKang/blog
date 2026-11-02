SQLD 에서 조인과 서브쿼리는 SQL 활용 과목의 큰 비중을 차지합니다. 조인은 여러 테이블을 가로로 이어 붙이는 문법이며, 서브쿼리는 쿼리 안에 다른 쿼리를 포함하는 문법입니다. 두 가지 모두 "이 쿼리가 결과로 몇 행을 반환하는가"를 묻는 문제로 자주 등장합니다. 아래 예제는 파이썬 SQLite(3.50.4) 로 실행하여 결과를 확인했습니다. SQLD 시험 환경은 공식 사이트에서 확인하시면 되며, 문법은 방언마다 조금씩 다르므로 시험 범위는 공식 안내를 기준으로 하십시오.

## 예제 테이블

부서는 3 개, 사원은 5 명입니다. 사원 '정' 은 부서가 없으며 (NULL), 부서 '인사' 에는 사원이 없습니다. 이 두 줄이 조인과 서브쿼리 문제의 함정을 거의 모두 보여 줍니다.

```sql
CREATE TABLE dept(dept_id INTEGER PRIMARY KEY, dname TEXT);
CREATE TABLE emp(emp_id INTEGER PRIMARY KEY, ename TEXT, sal INTEGER,
                 dept_id INTEGER, mgr_id INTEGER);
INSERT INTO dept VALUES (10,'영업'),(20,'개발'),(30,'인사');
INSERT INTO emp VALUES (1,'김',500,10,NULL),(2,'이',300,10,1),
  (3,'박',400,20,1),(4,'최',200,20,3),(5,'정',350,NULL,3);
```

```
dept: 10 영업 / 20 개발 / 30 인사
emp : 김(500,10) 이(300,10) 박(400,20) 최(200,20) 정(350,NULL)
      관리자(mgr_id): 이·박→김, 최·정→박
```

## 조인 종류

| 종류 | 결과 | 예제 행 수 |
|---|---|---|
| INNER JOIN | 양쪽에서 조건에 맞는 행만 | 4 |
| LEFT OUTER JOIN | 왼쪽은 모두, 오른쪽이 없으면 NULL | 5 |
| RIGHT OUTER JOIN | 오른쪽은 모두, 왼쪽이 없으면 NULL | 5 |
| FULL OUTER JOIN | 양쪽 모두 | 6 |
| CROSS JOIN | 조건 없이 모든 조합 (곱집합) | 15 |
| SELF JOIN | 같은 테이블을 두 별칭으로 | 5 |

PostgreSQL 문서도 동일한 분류로 설명합니다. 단순히 `JOIN`만 쓰면 INNER 가 기본이며, `OUTER` 는 생략해도 됩니다. 기본 개념은 [자세히 → 관계형 DB 와 SQL 기본](#/post/db-rdb-sql)에 있습니다.

### INNER JOIN

```sql
SELECT e.ename, d.dname
FROM emp e INNER JOIN dept d ON e.dept_id = d.dept_id;
```

```
김 영업 / 이 영업 / 박 개발 / 최 개발
```

'정' 은 부서가 NULL 이라 짝이 없어서 제외되었고, '인사' 도 사원이 없어서 제외되었습니다. 이렇게 사라지는 행을 세는 것이 INNER 문제의 핵심입니다.

### OUTER JOIN

```sql
SELECT e.ename, d.dname
FROM emp e LEFT OUTER JOIN dept d ON e.dept_id = d.dept_id;
```

```
김 영업 / 이 영업 / 박 개발 / 최 개발 / 정 NULL
```

왼쪽 (emp) 은 모두 남고, 짝이 없는 '정' 의 부서는 NULL 로 채워졌습니다. 테이블 순서를 바꿔 `dept d LEFT JOIN emp e`로 쓰면 '인사' 가 남고 사원이 NULL 이 됩니다. RIGHT 는 LEFT 의 방향만 반대이므로, 시험에서는 "어느 쪽이 기준 (모두 남는 쪽) 인가"를 먼저 확인하면 됩니다. FULL OUTER 는 양쪽 미매칭 행을 모두 포함하여 위 예제에서 6 행 (정-NULL, 인사-NULL 포함) 이 나왔습니다.

RIGHT 와 FULL 은 SQLite 에서 3.39.0 부터 지원합니다. 공식 문서에 문법 도표로 실려 있으며, 이전 버전에서는 거부됩니다.

### CROSS JOIN

```sql
SELECT COUNT(*) FROM emp CROSS JOIN dept;   -- 15
```

5 행 × 3 행 = 15 행입니다. 조건이 없으므로 모든 조합이 나옵니다. `FROM emp, dept`처럼 쉼표로 쓰고 WHERE 에 조인 조건을 빠뜨려도 같은 결과가 나와서, "행이 갑자기 폭발했다"는 문제의 원인이 됩니다.

### SELF JOIN

```sql
SELECT e.ename, m.ename AS mgr
FROM emp e LEFT JOIN emp m ON e.mgr_id = m.emp_id;
```

```
김 NULL / 이 김 / 박 김 / 최 박 / 정 박
```

같은 테이블을 두 번 사용하므로 별칭 (e, m) 이 필수입니다. 별칭이 없으면 어느 쪽 열인지 구분할 수 없습니다. 계층 구조 (사원 - 관리자) 를 표현할 때 사용합니다. 최상위인 '김' 은 관리자가 없어서 INNER 로 하면 제외되고 LEFT 로 하면 남습니다.

### ON, USING, NATURAL

조인 조건을 지정하는 방법은 세 가지입니다.

| 방식 | 뜻 | 주의 |
|---|---|---|
| `ON a.x = b.y` | 임의의 조건 | 가장 범용 |
| `USING (x)` | 두 테이블에 같은 이름인 열 x 로 조인 | 결과에 x 가 한 번만 나옴 |
| `NATURAL JOIN` | 이름이 같은 열 전체로 자동 조인 | 열이 추가되면 조인 조건이 조용히 바뀜 |

PostgreSQL 문서는 NATURAL 이 위험하다고 별도로 경고합니다. 스키마가 바뀌면 조인 열이 조용히 늘어날 수 있기 때문입니다.

<details>
<summary>OUTER JOIN 에서 ON 과 WHERE 가 다른 이유</summary>

INNER JOIN 에서는 조건을 ON 에 쓰든 WHERE 에 쓰든 결과가 같습니다. OUTER JOIN 에서는 달라집니다. ON 은 조인하기 전에 적용되어 미매칭 행이 NULL 로 살아남고, WHERE 는 조인한 다음에 적용되어 NULL 로 채워진 행까지 걸러냅니다. 같은 "급여 400 이상" 조건을 두 위치에 넣어 보았습니다.

```sql
-- ON에 조건
SELECT d.dname, e.ename FROM dept d
LEFT JOIN emp e ON e.dept_id = d.dept_id AND e.sal >= 400;
-- 영업 김 / 개발 박 / 인사 NULL   (3행)

-- WHERE에 조건
SELECT d.dname, e.ename FROM dept d
LEFT JOIN emp e ON e.dept_id = d.dept_id
WHERE e.sal >= 400;
-- 영업 김 / 개발 박               (2행)
```

'인사' 는 WHERE 쪽에서 사라졌습니다. NULL >= 400 은 참이 아니어서 걸러진 것입니다. 결국 WHERE 에 오른쪽 테이블 조건을 걸면 LEFT JOIN 이 INNER JOIN 처럼 동작합니다. 시험에서는 이 차이를 행 수로 묻는 경우가 많습니다.

</details>

## 서브쿼리 종류

서브쿼리는 괄호로 감싸인 SELECT 입니다. 어디에 위치하는가와 몇 행을 반환하는가로 나눕니다.

| 위치 | 이름 | 예 |
|---|---|---|
| SELECT 절 | 스칼라 서브쿼리 | 사원마다 부서명을 한 칸으로 가져오기 |
| FROM 절 | 인라인 뷰 | 서브쿼리 결과를 임시 테이블처럼 쓰기 |
| WHERE 절 | 중첩 서브쿼리 | IN, 비교 연산자, EXISTS 와 함께 |

| 반환 행 수 | 사용할 수 있는 연산자 |
|---|---|
| 단일 행 | `=`, `>`, `<` 등 |
| 다중 행 | `IN`, `ANY`(SOME), `ALL`, `EXISTS` |

단일 행 서브쿼리 자리에 여러 행이 나오면 에러가 난다. 이 조합이 시험에 자주 나온다.

### 단일 행, 다중 행

```sql
-- 평균 급여보다 많이 받는 사람 (단일 행)
SELECT ename FROM emp WHERE sal > (SELECT AVG(sal) FROM emp);   -- 김, 박

-- 개발 부서 소속 (다중 행 가능)
SELECT ename FROM emp
WHERE dept_id IN (SELECT dept_id FROM dept WHERE dname = '개발'); -- 박, 최
```

평균은 (500+300+400+200+350)/5 = 350이라 김과 박만 걸린다. '정'은 350으로 같아서 `>`에는 안 걸린다. 경계값은 문제에서 자주 노린다.

PostgreSQL 문서 기준으로 `IN`은 `= ANY`와 같고 `NOT IN`은 `<> ALL`과 같다. `ANY`는 하나라도 참이면 참, `ALL`은 전부 참이어야 참이다. 서브쿼리가 빈 결과일 때 ANY는 거짓, ALL은 참이다. (`> ALL`·`> ANY`는 SQLite 가 지원하지 않아서 이 글에서는 돌려 보지 않았고, 개념만 문서에서 가져왔다.)

### 인라인 뷰와 스칼라 서브쿼리

```sql
SELECT d.dname, t.avg_sal
FROM dept d
JOIN (SELECT dept_id, AVG(sal) AS avg_sal FROM emp GROUP BY dept_id) t
  ON d.dept_id = t.dept_id;
-- 영업 400.0 / 개발 300.0
```

FROM 절의 서브쿼리는 괄호 뒤에 별칭 (t) 을 붙인다. 표준은 별칭을 요구하고, PostgreSQL 은 생략도 허용하지만 붙이길 권한다. 이 경우 '정' 의 NULL 그룹도 GROUP BY 에서 한 그룹으로 만들어지지만, 조인에서 짝이 없어 사라졌다.

```sql
SELECT ename, (SELECT dname FROM dept d WHERE d.dept_id = e.dept_id) AS dname
FROM emp e;
-- 김 영업 / 이 영업 / 박 개발 / 최 개발 / 정 NULL
```

스칼라 서브쿼리는 한 행·한 열만 돌려줘야 한다. 결과를 보면 LEFT JOIN 과 닮았다. 짝이 없으면 NULL 이 나온다는 점도 같다.

### 상관 서브쿼리

바깥 쿼리의 열을 안쪽에서 참조하는 서브쿼리다. 바깥 행마다 안쪽이 다시 계산된다.

```sql
-- 자기 부서 평균보다 급여가 높은 사람
SELECT ename, sal, dept_id FROM emp e
WHERE sal > (SELECT AVG(sal) FROM emp WHERE dept_id = e.dept_id);
-- 김 500 10 / 박 400 20
```

영업 평균은 400, 개발 평균은 300 이다. 김 (500) 과 박 (400) 만 자기 부서 평균을 넘는다. '정' 은 부서가 NULL 이라 `dept_id = NULL`이 참이 되지 않아 서브쿼리가 NULL 을 반환하고, 비교 결과도 걸러진다.

구분법은 간단하다. 서브쿼리 안에 바깥 별칭 (e.) 이 보이면 상관 서브쿼리다. 안쪽을 따로 떼어 실행할 수 있으면 비상관이다.

### EXISTS 와 IN, 그리고 NOT IN 의 함정

```sql
-- 사원이 없는 부서
SELECT dname FROM dept d
WHERE NOT EXISTS (SELECT 1 FROM emp e WHERE e.dept_id = d.dept_id);   -- 인사

SELECT dname FROM dept WHERE dept_id NOT IN (SELECT dept_id FROM emp);  -- 결과 0행!
```

두 번째 쿼리가 0 행이 나온다. emp.dept_id 에 NULL('정') 이 있어서다. PostgreSQL 문서에 같은 설명이 있다. 서브쿼리에 NULL 이 하나라도 있고 일치하는 행이 없으면 `NOT IN`의 결과는 거짓이 아니라 NULL 이 되고, WHERE 에서는 NULL 이 참이 아니라서 모든 행이 걸러진다. 서브쿼리에서 NULL 을 빼면 정상으로 돌아온다.

```sql
SELECT dname FROM dept
WHERE dept_id NOT IN (SELECT dept_id FROM emp WHERE dept_id IS NOT NULL);  -- 인사
```

| | EXISTS | IN |
|---|---|---|
| 조건 | 서브쿼리가 한 행이라도 돌려주는가 | 값이 목록에 있는가 |
| 서브쿼리 SELECT 목록 | 보통 `SELECT 1`, 값은 무관 | 단일 열 |
| NULL 영향 | 거의 없음 | `NOT IN`에서 치명적 |

EXISTS 는 PostgreSQL 문서 설명대로 조인과 비슷하게 동작하지만 바깥 행당 최대 한 번만 나온다. 일대다 관계에서 조인하면 행이 늘어나지만 EXISTS 는 늘어나지 않는다. 같은 결과를 조인으로 쓸지 서브쿼리로 쓸지는 중복 여부를 보고 고른다.

<details>
<summary>시험에서 반복해서 볼 만한 함정 정리</summary>

- 별칭 없는 SELF JOIN 은 오류.
- OUTER JOIN 에서 오른쪽 테이블 조건을 WHERE 에 걸면 INNER 처럼 변함.
- 쉼표 조인에 조인 조건이 빠지면 곱집합, N×M 행.
- 단일 행 연산자(`=`) 뒤 서브쿼리가 여러 행이면 오류.
- `NOT IN`의 서브쿼리 결과에 NULL 이 있으면 결과가 비게 됨. EXISTS 는 영향 없음.
- 스칼라 서브쿼리는 한 행·한 열이어야 함.
- 인라인 뷰에는 별칭을 붙임.

</details>

## 뷰

뷰는 SELECT 문에 이름을 붙여 저장해 둔 것이다. 데이터를 복사해 두는 게 아니라 쿼리를 저장해 두고, 조회할 때마다 그 쿼리가 실행된다.

```sql
CREATE VIEW v_dev AS
SELECT e.ename, e.sal FROM emp e
JOIN dept d ON d.dept_id = e.dept_id WHERE d.dname = '개발';

SELECT * FROM v_dev;   -- 박 400 / 최 200
```

| 쓰는 이유 | 설명 |
|---|---|
| 복잡한 조인 숨기기 | 매번 긴 쿼리를 쓰지 않고 이름 하나로 |
| 접근 제한 | 일부 열·행만 보이게 해서 권한 부여 |
| 쿼리 재사용 | 같은 조인을 여러 곳에서 |

시험에서는 "뷰는 독립된 데이터를 가지지 않는다", "뷰를 삭제해도 원본 테이블은 영향 없다" 같은 문장이 자주 나온다. 뷰 정의 문법은 [자세히 → DML·TCL·DDL 과 제약조건](#/post/sqld-dml-ddl)에서 이어진다. 뷰 갱신 가능 여부는 DBMS 마다 다르니 이 글에서는 돌려 보지 않았다.

## 풀이 순서

조인 문제는 이 순서로 따라가면 거의 풀린다.

1. 어느 테이블이 기준 (전부 남는 쪽) 인지 정한다.
2. 조인 조건에서 짝이 없는 행이 누구인지 찾는다 (NULL 포함).
3. INNER 면 그 행을 지우고, OUTER 면 NULL 로 채운다.
4. WHERE 가 NULL 채워진 행을 걸러내는지 확인한다.
5. GROUP BY 나 집계가 붙었으면 그다음에 계산한다.

サブクエリ問題は、内側から実行されると考え、相関サブクエリは外側の行を 1 つずつ代入して検討します。その後 `NOT IN` が現れる場合は、サブクエリに NULL が含まれているかを確認します。類似の集計・集合演算については [詳細 → GROUP BY と集合演算](#/post/sqld-group-set) で、前の単元は [詳細 → SELECT と関数](#/post/sqld-select-func) で続けます。練習は 프로그래머스 SQL 高得点キットの JOIN、SELECT 問題を直接解いてみてください。

---

← [概念マップで](#/post/sqld-map)

関連記事：[GROUP BY と集合演算](#/post/sqld-group-set) · [ウィンドウ関数と高度な SQL](#/post/sqld-window-advanced) · [関係型 DB と SQL 基礎](#/post/db-rdb-sql)

## 根拠リンク

- SQLite SELECT ドキュメント: https://www.sqlite.org/lang_select.html
- PostgreSQL ドキュメント、テーブル表現式（JOIN）: https://www.postgresql.org/docs/current/queries-table-expressions.html
- PostgreSQL ドキュメント、サブクエリ表現式: https://www.postgresql.org/docs/current/functions-subquery.html